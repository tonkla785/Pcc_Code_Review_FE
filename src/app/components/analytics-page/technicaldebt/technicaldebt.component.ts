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
  totalCost = 0;

  // Distribution by project
  projectDebts: ProjectDebt[] = [];
  get maxProjectDays(): number {
    return Math.max(...this.projectDebts.map(p => p.days), 1);
  }

  // Categories
  categories: CategoryShare[] = [
    { name: ' Documentation', percent: 15, icon: 'bi bi-journal-text' },
    { name: ' Architecture', percent: 25, icon: 'bi bi-diagram-3' },
    { name: ' Code Quality', percent: 35, icon: 'bi bi-wrench-adjustable' },
    { name: ' Test Coverage', percent: 15, icon: 'bi-clipboard-check' },
    { name: ' Security', percent: 10, icon: 'bi bi-shield-lock' },
  ];

  // Top items
  topDebtItems: DebtItem[] = [
    { priority: 'High', colorClass: 'high', item: 'Refactor legacy module', time: 2400, cost: 150_000 },
    { priority: 'High', colorClass: 'high', item: 'Add unit tests', time: 1440, cost: 90_000 },
    { priority: 'Med', colorClass: 'med', item: 'Update dependencies', time: 960, cost: 60_000 },
    { priority: 'Med', colorClass: 'med', item: 'Improve documentation', time: 480, cost: 30_000 },
    { priority: 'Low', colorClass: 'low', item: 'Code formatting', time: 240, cost: 6_000 },
  ];
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
    // 1. We already have 'projectDebts' calculated in calculateProjectDebts(), which gives us Cost and Days per project.
    // We can reuse that or recalculate if we want to be safe, but calculateProjectDebts seems to derive correctly from Latest Scan.
    // Let's use calculateProjectDebts' output if available, OR just iterate ScanHistory (which is latest scan per project).
    
    // Formula: Score = (Days * 2) + (Cost / 50,000)
    // Classification: >=10 High, 5-9.99 Med, <5 Low
    
    const projects = this.ScanHistoy.map(scan => {
        const debtMinutes = scan.metrics?.technicalDebtMinutes || 0;
        const days = this.toTechDebtDays(debtMinutes);
        const cost = scan.metrics?.debtRatio || 0; // Assuming debtRatio holds the Cost value as per previous logic
        const name = scan.project?.name || scan.project?.id || 'Unknown';

        // Score calc
        const score = (days * 2) + (cost / 50000);
        
        // Priority/Class
        let priority: Priority = 'Low';
        let color = 'low';
        
        if (score >= 10) {
            priority = 'High';
            color = 'high';
        } else if (score >= 5) {
            priority = 'Med';
            color = 'med';
        }

        return {
            priority: priority,
            colorClass: color,
            item: name, 
            time: debtMinutes, // Store minutes for pipe
            cost: cost,
            score: score 
        } as DebtItem & { score: number };
    });

    // Sort by Score Descending
    this.topDebtItems = projects.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  calculateProjectDebts() {
    this.projectDebts = this.ScanHistoy.map(scan => {
        const debtMinutes = scan.metrics?.technicalDebtMinutes || 0;
        const days = this.toTechDebtDays(debtMinutes);
        const cost = scan.metrics?.debtRatio || 0;
        
        return {
            name: scan.project?.name || scan.project?.id || 'Unknown',
            days: days,
            cost: cost
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

    // Add a starting point? (Optional, but good for line chart to start at 0 if no projects)
    if(projects.length > 0) {
        // dataPoints.push({ x: 'Start', y: 0, added: 0, dateStr: '' }); 
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
    this.totalHours = Math.floor((this.totalDebtMinutes % 480) / 60);

    this.calculateCategoryDebt();
  }

  calculateCategoryDebt() {
    let totalSecurityScore = 0;
    let totalQualityScore = 0;
    let totalTestScore = 0;
    let totalArchScore = 0;
    let totalDocScore = 0; 

    // Aggregate metrics from all latest scans
    this.ScanHistoy.forEach(scan => {
      const m = scan.metrics;
      if (!m) return;
      totalSecurityScore += (m.vulnerabilities || 0) * 10 
                          + (m.securityHotspots || 0) * 3;
      totalQualityScore += (m.bugs || 0) * 5 
                         + (m.codeSmells || 0) * 1;
      const coverageGap = 100 - (m.coverage || 0);
      if (coverageGap > 0) {
        totalTestScore += coverageGap * 5;
      }
      totalArchScore += (m.duplicatedLinesDensity || 0) * 5;
    });

    if (this.ScanHistoy.length > 0) {
       totalDocScore = this.ScanHistoy.length * 10; 
    }

    const totalScore = totalSecurityScore + totalQualityScore + totalTestScore + totalArchScore + totalDocScore;

    if (totalScore === 0) return; 

    this.categories = [
       { name: ' Documentation', percent: Math.round((totalDocScore / totalScore) * 100), icon: 'bi bi-journal-text' },
       { name: ' Architecture', percent: Math.round((totalArchScore / totalScore) * 100), icon: 'bi bi-diagram-3' },
       { name: ' Code Quality', percent: Math.round((totalQualityScore / totalScore) * 100), icon: 'bi bi-wrench-adjustable' },
       { name: ' Test Coverage', percent: Math.round((totalTestScore / totalScore) * 100), icon: 'bi-clipboard-check' },
       { name: ' Security', percent: Math.round((totalSecurityScore / totalScore) * 100), icon: 'bi bi-shield-lock' },
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
    rows.push('Section,Project,Days,Cost (THB)');
    this.projectDebts.forEach(p => {
      rows.push(['Projects', p.name, String(p.days), String(p.cost)].join(','));
    });

    rows.push('');
    rows.push(['Summary', 'Total Days', 'Total Hours', 'Estimated Cost (THB)'].join(','));
    rows.push(['', String(this.totalDays), String(this.totalHours), String(this.totalCost)].join(','));

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
     return `${days}d ${hours}h`;
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
