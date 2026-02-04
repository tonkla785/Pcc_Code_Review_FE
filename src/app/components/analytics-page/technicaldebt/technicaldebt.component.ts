import { Component, OnDestroy } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgApexchartsModule, ApexOptions } from 'ng-apexcharts';
import { DebtTimePipe } from '../../../pipes/debt-time.pipe';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { ScanService } from '../../../services/scanservice/scan.service';

type Priority = 'High' | 'Med' | 'Low';

interface ProjectDebt {
  name: string;
  days: number;
  cost: number;
  lastScan?: Date;
}

interface CategoryShare {
  name: string;
  percent: number;
  icon: string;
}

interface DebtItem {
  priority: Priority;
  colorClass: string; // 'high' | 'med' | 'low'
  item: string;
  time: number; // minutes
  cost: number;
}

@Component({
  selector: 'app-technicaldebt',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, DebtTimePipe],
  templateUrl: './technicaldebt.component.html',
  styleUrl: './technicaldebt.component.css'
})
export class TechnicaldebtComponent implements OnDestroy {


  // Meta (matches your text)
  totalDays = 0;
  totalHours = 0;
  totalMinutes = 0;
  totalCost = 0;

  // Distribution by project
  projectDebts: ProjectDebt[] = [];
  get maxProjectDays(): number {
    return Math.max(...this.projectDebts.map(p => p.days), 1);
  }

  // Categories
  categories: CategoryShare[] = [
    { name: ' Documentation', percent: 0, icon: 'bi bi-journal-text' },
    { name: ' Architecture', percent: 0, icon: 'bi bi-diagram-3' },
    { name: ' Code Quality', percent: 0, icon: 'bi bi-wrench-adjustable' },
    { name: ' Test Coverage', percent: 0, icon: 'bi-clipboard-check' },
    { name: ' Security', percent: 0, icon: 'bi bi-shield-lock' },
  ];

  // Top items
  topDebtItems: DebtItem[] = [];
  
  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sharedData: SharedDataService,
    private readonly scanService: ScanService,
    private readonly location: Location,
  ) { }

  // Helper for Top Items
  private parseEffortToMinutes(effort: string): number {
    if(!effort) return 0;
    // Format examples: "10min", "1h 30min", "5d", "2h"
    // Simple regex or logic
    let minutes = 0;
    
    // min
    const minMatch = effort.match(/(\d+)min/);
    if(minMatch) minutes += parseInt(minMatch[1]);
    
    // h
    const hMatch = effort.match(/(\d+)h/);
    if(hMatch) minutes += parseInt(hMatch[1]) * 60;
    
    // d (Assume 8h day -> 480m)
    const dMatch = effort.match(/(\d+)d/);
    if(dMatch) minutes += parseInt(dMatch[1]) * 480;

    return minutes;
  }
  debtSeries: any[] = [];
  debtChartOptions: ApexOptions = {};

  ScanHistoy: ScanResponseDTO[] = [];
  pollSubscription: Subscription = new Subscription();

  ngOnInit(): void {
    this.sharedData.scansHistory$.subscribe(data => { 
      this.ScanHistoy = this.latestScanPerProject(data ?? []);
      this.calculateTotalDebt();
      this.calculateProjectDebts();
    });
    
    // Initial Load
    this.loadScanHistory();

    // Poll every 30 seconds
    this.pollSubscription = interval(30000).subscribe(() => {
      this.loadScanHistory();
    });
  }

  ngOnDestroy(): void {
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
    }
  }

  loadScanHistory() {
    this.sharedData.setLoading(true);
    this.scanService.getScansHistory().subscribe({
      next: (data) => {
        this.sharedData.Scans = data;
        this.sharedData.setLoading(false);
        this.ScanHistoy = this.latestScanPerProject(data);
        this.calculateTotalDebt();
        this.calculateCategoryDebt();
        this.calculateDebtTrend(data); // Pass full history
        this.calculateProjectDebts();
        this.calculateTopDebtProjects();
        console.log('Scan history loaded:', this.ScanHistoy );
      },
      error: () => this.sharedData.setLoading(false)
    });
  }

  calculateTopDebtProjects() {
    // 1. Find Max Cost
    const maxCost = this.ScanHistoy.reduce((max, scan) => Math.max(max, scan.metrics?.debtRatio || 0), 0);
    const step = maxCost / 3;

    // 2. Map and Classify
    const projects = this.ScanHistoy.map(scan => {
        const debtMinutes = scan.metrics?.technicalDebtMinutes || 0;
        const days = this.toTechDebtDays(debtMinutes);
        const cost = scan.metrics?.debtRatio || 0;
        const name = scan.project?.name || scan.project?.id || 'Unknown';

        // Classification based on Max Cost
        // Low: 0 - step
        // Med: step - 2*step
        // High: > 2*step
        
        let priority: Priority = 'Low';
        let color = 'low';

        if (cost > (step * 2)) {
            priority = 'High';
            color = 'high';
        } else if (cost > step) {
            priority = 'Med';
            color = 'med';
        }

        return {
            priority: priority,
            colorClass: color,
            item: name, 
            time: debtMinutes,
            cost: cost
        } as DebtItem;
    });

    // Sort by Cost Descending
    this.topDebtItems = projects.sort((a, b) => b.cost - a.cost).slice(0, 5);
  }

  calculateProjectDebts() {
    this.projectDebts = this.ScanHistoy.map(scan => {
        const debtMinutes = scan.metrics?.technicalDebtMinutes || 0;
        const days = this.toTechDebtDays(debtMinutes);
        const cost = scan.metrics?.debtRatio || 0;
        
        return {
            name: scan.project?.name || scan.project?.id || 'Unknown',
            days: days,
            cost: cost,
            lastScan: new Date(scan.startedAt)
        } as ProjectDebt;
    }).sort((a, b) => b.cost - a.cost);
  }

  calculateDebtTrend(allScans: ScanResponseDTO[]) {
    // 1. Group scans by Project to find Start Date and Latest Cost
    const projectMap = new Map<string, { name: string, startDate: Date, cost: number }>();
    
    allScans.forEach(s => {
        const pid = s.project?.id;
        if(!pid) return;

        const date = new Date(s.startedAt);
        const name = s.project?.name || pid;

        if(!projectMap.has(pid)) {
            // Initial assumption, cost will be updated later
            projectMap.set(pid, { name, startDate: date, cost: 0 });
        } else {
            const entry = projectMap.get(pid)!;
            // Update Start Date if this scan is earlier to find the "creation" date
            if(date < entry.startDate) {
                entry.startDate = date;
            }
        }
    });

    // Find the LATEST cost for each project (Current Debt)
    const latestCosts = new Map<string, { date: Date, cost: number }>();
    allScans.forEach(s => {
         const pid = s.project?.id;
         if(!pid) return;
         const d = new Date(s.startedAt);
         const c = s.metrics?.debtRatio || 0;
         
         if(!latestCosts.has(pid) || d > latestCosts.get(pid)!.date) {
             latestCosts.set(pid, { date: d, cost: c });
         }
    });

    // Merge Cost info into Project Map
    projectMap.forEach((val, key) => {
        if(latestCosts.has(key)) {
            val.cost = latestCosts.get(key)!.cost;
        }
    });

    // 2. Filter projects started in last 60 days
    const now = new Date();
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(now.getDate() - 60);

    const projects = Array.from(projectMap.values())
        .filter(p => p.startDate >= sixtyDaysAgo && p.startDate <= now)
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()); // Chronological 

    // 3. Calculate Cumulative
    let runningTotal = 0;
    const dataPoints: { x: string, y: number, added: number, dateStr: string }[] = [];

    // Add a starting point
    if(projects.length > 0) {
        dataPoints.push({ x: 'Start', y: 0, added: 0, dateStr: 'Initial' }); 
    }

    projects.forEach(p => {
        runningTotal += p.cost;
        dataPoints.push({
            x: p.name,
            y: runningTotal,
            added: p.cost,
            dateStr: p.startDate.toLocaleDateString('th-TH')
        });
    });

    this.debtSeries = [
      {
        name: 'Cumulative Cost',
        data: dataPoints.map(p => ({ x: p.x, y: p.y }))
      }
    ];

    this.debtChartOptions = {
      chart: {
        type: 'line', // explicit request for Line Chart
        height: 350,
        toolbar: { show: false },
        zoom: { enabled: false }
      },
      stroke: {
        curve: 'smooth',
        width: 3
      },
      xaxis: {
        type: 'category', // Project Names as categories
        title: { text: 'Projects (Chronological Order)' },
        labels: {
            rotate: -45,
            style: { fontSize: '12px' }
        }
      },
      yaxis: {
        min: 0, 
        title: { text: 'Cumulative Cost (THB)' },
        labels: {
            formatter: (val: number) => this.formatTHB(val)
        }
      },
      dataLabels: { enabled: false },
      tooltip: { 
        custom: ({ series, seriesIndex, dataPointIndex, w }) => {
            const p = dataPoints[dataPointIndex];
            // Safe check
            if(!p) return '';
            return `
            <div style="padding: 10px; background: #fff; border: 1px solid #ccc; color: #000;">
                <div><b>${p.x}</b></div>
                <div>Created: ${p.dateStr}</div>
                <div>Added Cost: ${this.formatTHB(p.added)}</div>
                <hr style="margin: 5px 0;">
                <div><b>Cumulative: ${this.formatTHB(p.y)}</b></div>
            </div>`;
        }
      },
      title: {
        text: 'Cumulative Debt Growth (New Projects - Last 60 Days)',
        align: 'left'
      },
      colors: ['#008FFB'],
      markers: { size: 5 }
    };
  }

  totalDebtMinutes = 0;

  calculateTotalDebt() {
    this.totalDebtMinutes = this.ScanHistoy.reduce((sum, p) => sum + (p.metrics?.technicalDebtMinutes || 0), 0);
    // Use 8 hours (480 mins) for a "work day"
    this.totalDays = Math.floor(this.totalDebtMinutes / 480);
    const remainingAfterDays = this.totalDebtMinutes % 480;
    this.totalHours = Math.floor(remainingAfterDays / 60);
    this.totalMinutes = remainingAfterDays % 60;

    this.calculateCategoryDebt();
  }

  calculateCategoryDebt() {
    let sumSecurity = 0;
    let sumQuality = 0;
    let sumTest = 0;
    let sumArch = 0;
    let sumDoc = 0; 
    let count = 0;

    // Aggregate metrics from all latest scans
    this.ScanHistoy.forEach(scan => {
      const m = scan.metrics;
      // If no metrics, skip this scan from the average
      if (!m) return;
      
      count++;

      // 1. Security (Vulnerabilities & Hotspots)
      // A: vuln=0, hs<=1 (0) | B: vuln=0, hs<=3 (20) | C: vuln 1-2 (40) | D: vuln 3-5 (60) | E: vuln >5 (80)
      let secScore = 0;
      const v = m.vulnerabilities || 0;
      const hs = m.securityHotspots || 0;

      if (v === 0 && hs <= 1) secScore = 0;
      else if (v === 0 && hs <= 3) secScore = 20;
      else if (v <= 2) secScore = 40;
      else if (v <= 5) secScore = 60;
      else secScore = 80;

      sumSecurity += secScore;

      // 2. Architecture (Duplicated Lines %)
      // A <= 3 (0), B <= 8 (20), C <= 15 (40), D <= 25 (60), E > 25 (80)
      const dup = m.duplicatedLinesDensity || 0;
      let archScore = 0;
      if (dup <= 3) archScore = 0;
      else if (dup <= 8) archScore = 20;
      else if (dup <= 15) archScore = 40;
      else if (dup <= 25) archScore = 60;
      else archScore = 80;

      sumArch += archScore;

      // 3. Documentation (Code Smells -> Maintainability)
      // A <= 10 (0), B <= 25 (20), C <= 40 (40), D <= 60 (60), E > 60 (80)
      const smells = m.codeSmells || 0;
      let docScore = 0;
      if (smells <= 10) docScore = 0;
      else if (smells <= 25) docScore = 20;
      else if (smells <= 40) docScore = 40;
      else if (smells <= 60) docScore = 60;
      else docScore = 80;

      sumDoc += docScore;

      // 4. Test Coverage (Coverage %)
      // 0-20 (80), 21-40 (60), 41-60 (40), 61-80 (20), 81-100 (0)
      const cov = m.coverage || 0;
      let testScore = 0;
      if (cov <= 20) testScore = 80;
      else if (cov <= 40) testScore = 60;
      else if (cov <= 60) testScore = 40;
      else if (cov <= 80) testScore = 20;
      else testScore = 0;

      sumTest += testScore;

      // 5. Code Quality (Bugs -> Inferred Score)
      // A: 0 (0), B: <=2 (20), C: <=5 (40), D: <=10 (60), E: >10 (80)
      const bugs = m.bugs || 0;
      let qualScore = 0;
      if (bugs === 0) qualScore = 0;
      else if (bugs <= 2) qualScore = 20;
      else if (bugs <= 5) qualScore = 40;
      else if (bugs <= 10) qualScore = 60;
      else qualScore = 80;

      sumQuality += qualScore;
    });

    if (count === 0) return;

    // Calculate Averages
    const avgSec = sumSecurity / count;
    const avgArch = sumArch / count;
    const avgDoc = sumDoc / count;
    const avgTest = sumTest / count;
    const avgQual = sumQuality / count;

    const totalAvg = avgSec + avgArch + avgDoc + avgTest + avgQual;

    if (totalAvg === 0) return;

    // Normalize to 100%
    this.categories = [
       { name: ' Documentation', percent: Number(((avgDoc / totalAvg) * 100).toFixed(1)), icon: 'bi bi-journal-text' },
       { name: ' Architecture', percent: Number(((avgArch / totalAvg) * 100).toFixed(1)), icon: 'bi bi-diagram-3' },
       { name: ' Code Quality', percent: Number(((avgQual / totalAvg) * 100).toFixed(1)), icon: 'bi bi-wrench-adjustable' },
       { name: ' Test Coverage', percent: Number(((avgTest / totalAvg) * 100).toFixed(1)), icon: 'bi-clipboard-check' },
       { name: ' Security', percent: Number(((avgSec / totalAvg) * 100).toFixed(1)), icon: 'bi bi-shield-lock' },
    ];
  }

  totalCosts(): number {
    return this.ScanHistoy.reduce((sum, p) => sum + (p.metrics?.debtRatio || 0), 0);
  }

  latestScanPerProject(scans: ScanResponseDTO[]): ScanResponseDTO[] {
    const byProject = new Map<string, ScanResponseDTO>();

    for (const s of scans) {
      const pid = s.project?.id;
      if (!pid) continue;

      const prev = byProject.get(pid);
      if (!prev) {
        byProject.set(pid, s);
        continue;
      }
      const sTime = new Date(s.completedAt ?? s.startedAt ?? 0).getTime();
      const pTime = new Date(prev.completedAt ?? prev.startedAt ?? 0).getTime();

      if (sTime > pTime) {
        byProject.set(pid, s);
      }
    }

    return Array.from(byProject.values());
  }

  toTechDebtDays(minutes: number): number {
    return minutes / 480; 
  }


  // Utils
  formatTHB(value: number): string {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(value);
  }

  trackByName = (_: number, item: { name: string }) => item.name;
  trackByItem = (_: number, item: DebtItem) => item.item + item.priority;

  // Actions
  goBack(): void {
    this.location.back();
  }

  generateDebtReport(): void {
    this.router.navigate(['/generatereport'], {
      queryParams: { reportType: 'technical-debt-analysis' }
    });
  }


  exportToExcel(): void {
    // สร้าง CSV (เปิดด้วย Excel ได้) จากข้อมูล Top Debt Items + Project summary
    const rows: string[] = [];

    rows.push('Section,Priority,Item,Time,Cost (THB)');
    this.topDebtItems.forEach(i => {
      rows.push([
        'Top Debt Items',
        i.priority,
        `"${i.item.replace(/"/g, '""')}"`,
        this.formatMinutesToTime(i.time), // Format for CSV
        i.cost
      ].join(','));
    });

    rows.push('');
    rows.push('Section,Project,Scan Date,Cost (THB)');
    this.projectDebts.forEach(p => {
      rows.push(['Projects', p.name, p.lastScan ? p.lastScan.toISOString().split('T')[0] : '-', String(p.cost)].join(','));
    });

    rows.push('');
    rows.push(['Summary', 'Total Days', 'Total Hours',  'Total Minutes', 'Estimated Cost (THB)'].join(','));
    rows.push(['', String(this.totalDays), String(this.totalHours), String(this.totalMinutes), String(this.totalCosts())].join(','));

    const csv = rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.download = `technical-debt-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Helper for CSV
  formatMinutesToTime(minutes: number): string {
     const days = Math.floor(minutes / 480);
     const hours = Math.floor((minutes % 480) / 60);
     const minute = Math.floor(minutes % 60);
     return `${days }d ${hours}h ${minute}m`;
  }

  actionPlanText = '';
  isModalOpen = false;

  createActionPlan(): void {
    this.actionPlanText = this.topDebtItems.map((i, idx) =>
      `${idx + 1}. [${i.priority}] ${i.item} — Owner: <assign>, ETA: <date>`
    ).join('\n');
  }

  openModal(): void {
    this.createActionPlan();
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
  }

}
