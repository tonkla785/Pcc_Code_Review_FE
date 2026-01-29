import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NgApexchartsModule, ApexOptions, ChartComponent } from 'ng-apexcharts';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { SecurityService } from '../../../services/securityservice/security.service';
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
  chartSeries = [{ name: 'Security Issues', data: [] as number[] }];
  chartOptions: ApexOptions = this.getDefaultChartOptions();

  @ViewChild('chart') chart!: ChartComponent;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sharedData: SharedDataService,
    private readonly securityService: SecurityService,
    private readonly cdr: ChangeDetectorRef
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
  }

  loadSecurityData(): void {
    this.securityService.getSecurityIssues().subscribe({
      next: (issues) => {
        this.sharedData.setSecurityIssues(issues);
      },
      error: (err) => console.error('Failed to load security issues:', err)
    });
  }

  private applyMetrics(): void {
    const metrics = this.securityService.calculateAndStore(this.securityIssues);

    this.securityScore = metrics.score;
    this.riskLevel = metrics.riskLevel;
    this.hotIssues = metrics.hotIssues;
    this.vulnerabilities = metrics.vulnerabilities;

    this.owaspCoverage = this.securityService.calculateOwaspCoverage(this.securityIssues);
    // this.calculateTrend7Days();
  }


  private toDateKey(date: Date): string {
    let year = date.getFullYear();
    if (year > 2400) year -= 543;

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
