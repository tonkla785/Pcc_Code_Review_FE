import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NgApexchartsModule, ApexOptions, ChartComponent } from 'ng-apexcharts';
import { Subscription } from 'rxjs';
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
export class SecuritydashboardComponent implements OnInit, OnDestroy {

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

  private subscription = new Subscription();

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

    this.subscription.add(
      this.sharedData.securityIssues$.subscribe(issues => {
        if (issues && issues.length > 0) {
          this.securityIssues = issues;
          this.applyMetrics();
        }
      })
    );

    this.loadSecurityData();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadSecurityData(): void {
    this.securityService.loadAndCalculate().subscribe({
      next: (issues) => {
        this.securityIssues = issues;
        this.applyMetrics();
      },
      error: (err) => console.error('Failed to load security issues', err)
    });
  }

  private applyMetrics(): void {
    const metrics = this.securityService.calculateAndStore(this.securityIssues);

    this.securityScore = metrics.score;
    this.riskLevel = metrics.riskLevel;
    this.hotIssues = metrics.hotIssues;
    this.vulnerabilities = metrics.vulnerabilities;

    this.owaspCoverage = this.securityService.calculateOwaspCoverage(this.securityIssues);
    this.calculateTrend7Days();
  }

  calculateTrend7Days(): void {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dateCountMap = new Map<string, number>();

    for (const issue of this.securityIssues) {
      if (!issue.createdAt) continue;

      const created = new Date(issue.createdAt);
      if (created < sevenDaysAgo || created > today) continue;

      const key = this.toDateKey(created);
      dateCountMap.set(key, (dateCountMap.get(key) || 0) + 1);
    }

    const daysWithData = Array.from(dateCountMap.entries())
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => a.localeCompare(b));

    const days: string[] = [];
    const counts: number[] = [];

    if (daysWithData.length === 0) {
      this.hasChartData = false;
      this.chartReady = true;
      return;
    }

    this.hasChartData = true;
    daysWithData.forEach(([, count], index) => {
      days.push(`Day ${index + 1}`);
      counts.push(count);
    });

    this.chartSeries = [{ name: 'Security Issues', data: counts }];
    this.chartOptions = {
      ...this.getDefaultChartOptions(),
      xaxis: { categories: days, type: 'category' }
    };

    this.chartReady = false;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.chartReady = true;
      this.cdr.detectChanges();
    }, 50);
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
