import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NgApexchartsModule, ApexOptions, ChartComponent, ApexYAxis } from 'ng-apexcharts';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { SecurityService } from '../../../services/securityservice/security.service';
import { ScanService } from '../../../services/scanservice/scan.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import {
  SecurityIssueDTO,
  VulnerabilitySeverity,
  OwaspCategory,
  HotSecurityIssue
} from '../../../interface/security_interface';

@Component({
  selector: 'app-securitydashboard',
  standalone: true,
  imports: [NgApexchartsModule, CommonModule, RouterLink],
  templateUrl: './securitydashboard.component.html',
  styleUrl: './securitydashboard.component.css'
})
export class SecuritydashboardComponent implements OnInit {

  securityIssues: SecurityIssueDTO[] = [];
  vulnerabilities: VulnerabilitySeverity[] = [];
  owaspCoverage: OwaspCategory[] = [];
  hotIssues: HotSecurityIssue[] = [];

  securityScore = 0;
  riskLevel = 'SAFE';

  chartReady = false;
  hasChartData = false;
  trendDataLoaded = false;
  chartSeries = [{ name: 'Security Issues', data: [] as number[] }];
  chartOptions: ApexOptions = this.getDefaultChartOptions();

  @ViewChild('chart') chart!: ChartComponent;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sharedData: SharedDataService,
    private readonly securityService: SecurityService,
    private readonly scanService: ScanService
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    this.sharedData.securityIssues$.subscribe(issues => {
      if (issues) {
        this.securityIssues = issues;
        this.applyMetrics();
      }
    });

    if (!this.sharedData.hasSecurityIssuesCache) {
      this.loadSecurityData();
    }

    this.loadTrendData();
  }

  loadSecurityData(): void {
    this.securityService.getSecurityIssues().subscribe({
      next: (issues) => {
        this.sharedData.setSecurityIssues(issues);
      },
      error: (err) => console.error('Failed to load security issues:', err)
    });
  }

  loadTrendData(): void {
    this.scanService.getScansHistory().subscribe({
      next: (scans) => {
        this.calculateTrend7Days(scans);
      },
      error: (err) => console.error('Failed to load scan history for trend:', err)
    });
  }

  private applyMetrics(): void {
    const metrics = this.securityService.calculateAndStore(this.securityIssues);

    this.securityScore = metrics.score;
    this.riskLevel = metrics.riskLevel;
    this.hotIssues = metrics.hotIssues;
    this.vulnerabilities = metrics.vulnerabilities;

    this.owaspCoverage = this.securityService.calculateOwaspCoverage(this.securityIssues);
  }

  private calculateTrend7Days(scans: ScanResponseDTO[]): void {
    const today = new Date();
    const dates: Date[] = [];
    const categories: string[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      d.setHours(23, 59, 59, 999);
      dates.push(d);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      categories.push(`${day}/${month}`);
    }

    const dataSeries: number[] = [];

    const projectIds = new Set(scans.map(s => s.project?.id).filter(id => !!id));

    dates.forEach(date => {
      let dailyTotal = 0;

      projectIds.forEach(pid => {
        const projectScans = scans.filter(s => s.project?.id === pid);

        const validScans = projectScans.filter(s => {
          const scanDate = this.parseDate(s.startedAt);
          return scanDate && scanDate <= date;
        });

        if (validScans.length > 0) {
          validScans.sort((a, b) => {
            const da = this.parseDate(a.startedAt)?.getTime() || 0;
            const db = this.parseDate(b.startedAt)?.getTime() || 0;
            return db - da;
          });
          const latestScan = validScans[0];
          const vulns = latestScan.metrics?.vulnerabilities || 0;
          dailyTotal += vulns;
        }
      });

      dataSeries.push(dailyTotal);
    });

    const maxValue = Math.max(...dataSeries, 0);

    this.chartOptions = {
      ...this.chartOptions,
      xaxis: { ...this.chartOptions.xaxis, categories: categories },
      yaxis: {
        ...this.chartOptions.yaxis as ApexYAxis,
        min: 0,
        max: maxValue + 1,
        forceNiceScale: true,
        decimalsInFloat: 0
      }
    };

    this.chartSeries = [{ name: 'Security Issues', data: dataSeries }];

    this.hasChartData = true;
    this.chartReady = true;
    this.trendDataLoaded = true;
  }

  private parseDate(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;

    let dateStr = String(val).trim().replace(' ', 'T');

    if (dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts[1].length > 3) {
        dateStr = `${parts[0]}.${parts[1].substring(0, 3)}`;
      }
    }

    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }

  private getDefaultChartOptions(): ApexOptions {
    return {
      chart: { type: 'line', height: 200, toolbar: { show: false } },
      stroke: { curve: 'smooth', width: 3 },
      xaxis: { categories: [], type: 'category' },
      yaxis: { min: 0, forceNiceScale: true, decimalsInFloat: 0 },
      dataLabels: { enabled: false },
      tooltip: { enabled: true },
      title: { text: 'Security Trend (7 Days)', align: 'left' },
      colors: ['#008FFB']
    };
  }

  get totalVulnerabilities(): number {
    return this.vulnerabilities.reduce((acc, v) => acc + v.count, 0);
  }

  goBack(): void {
    this.router.navigate(['/analysis']);
  }
}
