import { Component } from '@angular/core'
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgApexchartsModule, ApexOptions } from 'ng-apexcharts';
import { AuthService } from '../../../services/authservice/auth.service';

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
  time: string; // e.g., '5d', '4h'
  cost: number;
}

@Component({
  selector: 'app-technicaldebt',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './technicaldebt.component.html',
  styleUrl: './technicaldebt.component.css'
})
export class TechnicaldebtComponent {


    // Meta (matches your text)
    totalDays = 45;
    totalHours = 8;
    totalCost = 1_350_000;
  
    // Distribution by project
    projectDebts: ProjectDebt[] = [
      { name: 'Angular-App', days: 18, cost: 540_000 },
      { name: 'API-Service', days: 12, cost: 360_000 },
      { name: 'Web-Portal',  days: 8,  cost: 240_000 },
      { name: 'Auth-Service', days: 5, cost: 150_000 },
      { name: 'Mobile-App', days: 2, cost: 60_000 },
    ];
    get maxProjectDays(): number {
      return Math.max(...this.projectDebts.map(p => p.days), 1);
    }
  
    // Categories
    categories: CategoryShare[] =  [
      { name: ' Documentation', percent: 15, icon: 'bi bi-journal-text' },
      { name: ' Architecture',  percent: 25, icon: 'bi bi-diagram-3' },
      { name: ' Code Quality',  percent: 35, icon: 'bi bi-wrench-adjustable' },
      { name: ' Test Coverage', percent: 15, icon: 'bi-clipboard-check' },
      { name: ' Security',      percent: 10, icon: 'bi bi-shield-lock' },
    ];
  
    // Top items
    topDebtItems: DebtItem[] = [
      { priority: 'High', colorClass: 'high', item: 'Refactor legacy module', time: '5d', cost: 150_000 },
      { priority: 'High', colorClass: 'high', item: 'Add unit tests',        time: '3d', cost: 90_000 },
      { priority: 'Med', colorClass: 'med',  item: 'Update dependencies',    time: '2d', cost: 60_000 },
      { priority: 'Med', colorClass: 'med',  item: 'Improve documentation',  time: '1d', cost: 30_000 },
      { priority: 'Low', colorClass: 'low',  item: 'Code formatting',        time: '4h', cost: 6_000  },
    ];
 constructor(
      private readonly router: Router,
      private readonly authService: AuthService,
    ) { }

    ngOnInit(): void {
    const userId = this.authService.userId;
    console.log(userId);
    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }
  }

    // ปุ่มย้อนกลับ
  goBack(): void {
    this.router.navigate(['/analysis']);
  }

  debtSeries = [
    {
      name: 'Total Debt (days)',
      data: [55, 50, 48, 40, 35, 30] // ตัวอย่างค่า debt
    }
  ];

  debtChartOptions: ApexOptions = {
    chart: {
      type: 'line',
      height: 250,
      toolbar: { show: false }
    },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    xaxis: {
      categories: [
        '60d ago', '50d ago', '40d ago', '30d ago', '20d ago', '10d ago'
      ]
    },
    yaxis: {
      min: 0
    },
    dataLabels: {  enabled: false },
    tooltip: { enabled: true },
    title: {
      text: 'Debt Trend (Last 60 Days)',
      align: 'left'
    },
    colors: ['#008FFB']
  };

  
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
          i.time,
          i.cost
        ].join(','));
      });
  
      rows.push('');
      rows.push('Section,Project,Days,Cost (THB)');
      this.projectDebts.forEach(p => {
        rows.push(['Projects', p.name, String(p.days), String(p.cost)].join(','));
      });
  
      rows.push('');
      rows.push(['Summary','Total Days','Total Hours','Estimated Cost (THB)'].join(','));
      rows.push(['', String(this.totalDays), String(this.totalHours), String(this.totalCost)].join(','));
  
      const csv = rows.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0,10).replace(/-/g, '');
      a.download = `technical-debt-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
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
