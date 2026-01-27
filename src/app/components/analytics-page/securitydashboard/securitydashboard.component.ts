import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NgApexchartsModule, ApexOptions, ChartComponent } from 'ng-apexcharts';
import { AuthService } from '../../../services/authservice/auth.service';
import { SecurityService } from '../../../services/securityservice/security.service';
import { SecurityIssueDTO } from '../../../interface/security_interface';

interface VulnerabilitySeverity {
  severity: string;
  count: number;
  color: string;
}

interface OwaspCategory {
  name: string;
  status: 'pass' | 'warning' | 'fail';
  count: number;
}

interface HotSecurityIssue {
  name: string;
  count: number;
}

const owaspRuleMap: Record<string, string> = {
  'S4502': 'A01', 'S2612': 'A01', 'S5122': 'A01',
  'S2068': 'A02', 'S327': 'A02', 'S6418': 'A02', 'S4426': 'A02',
  'S3649': 'A03', 'S2076': 'A03', 'S5131': 'A03', 'S5334': 'A03',
  'S4792': 'A04', 'S5804': 'A04', 'S125': 'A04',
  'S4507': 'A05', 'S3330': 'A05', 'S1523': 'A05',
  'S5332': 'A06',
  'S4433': 'A07', 'S3403': 'A07',
  'S5042': 'A08', 'S2658': 'A08', 'S5696': 'A08',
  'S2250': 'A09', 'S2228': 'A09',
  'S5144': 'A10'
};

const owaspCategories = [
  { id: 'A01', name: 'A01 Broken Access' },
  { id: 'A02', name: 'A02 Crypto Failures' },
  { id: 'A03', name: 'A03 Injection' },
  { id: 'A04', name: 'A04 Insecure Design' },
  { id: 'A05', name: 'A05 Security Config' },
  { id: 'A06', name: 'A06 Vulnerable Comp' },
  { id: 'A07', name: 'A07 Auth Failures' },
  { id: 'A08', name: 'A08 Data Integrity' },
  { id: 'A09', name: 'A09 Logging Fails' },
  { id: 'A10', name: 'A10 SSRF' }
];

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
  securityScore = 0;
  riskLevel = '';

  hotIssues: HotSecurityIssue[] = [];
  chartReady = false;

  @ViewChild('chart') chart!: ChartComponent;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly securityService: SecurityService,
    private readonly cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadSecurityIssues();
  }

  loadSecurityIssues(): void {
    this.securityService.getSecurityIssues().subscribe({
      next: (issues: SecurityIssueDTO[]) => {
        this.securityIssues = issues;
        this.calculateVulnerabilitiesBySeverity();
        this.calculateSecurityScore();
        this.calculateOwaspCoverage();
        this.calculateTrend7Days();
      },
      error: (err: Error) => console.error('Failed to load security issues', err)
    });
  }

  calculateVulnerabilitiesBySeverity(): void {
    const severityMap: Record<string, { label: string; color: string }> = {
      'BLOCKER': { label: 'Critical', color: 'bg-critical' },
      'CRITICAL': { label: 'High', color: 'bg-high' },
      'MAJOR': { label: 'Medium', color: 'bg-medium' },
      'MINOR': { label: 'Low', color: 'bg-low' }
    };

    const counts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };

    for (const issue of this.securityIssues) {
      const mapped = severityMap[issue.severity?.toUpperCase() || ''];
      if (mapped) counts[mapped.label]++;
    }

    this.vulnerabilities = [
      { severity: 'Critical', count: counts['Critical'], color: 'bg-critical' },
      { severity: 'High', count: counts['High'], color: 'bg-high' },
      { severity: 'Medium', count: counts['Medium'], color: 'bg-medium' },
      { severity: 'Low', count: counts['Low'], color: 'bg-low' }
    ];
  }

  calculateSecurityScore(): void {
    const deductionMap: Record<string, number> = {
      'BLOCKER': 20,
      'CRITICAL': 10,
      'MAJOR': 5,
      'MINOR': 1
    };

    let totalDeduction = 0;
    for (const issue of this.securityIssues) {
      const severity = issue.severity?.toUpperCase() || '';
      totalDeduction += deductionMap[severity] || 0;
    }

    this.securityScore = Math.max(0, 100 - totalDeduction);
    this.riskLevel = this.getRiskLevel(this.securityScore);
  }

  private getRiskLevel(score: number): string {
    if (score >= 80) return 'LOW';
    if (score >= 60) return 'MEDIUM';
    if (score >= 40) return 'HIGH';
    return 'CRITICAL';
  }

  calculateOwaspCoverage(): void {
    const categoryCounts: Record<string, number> = {};
    owaspCategories.forEach(cat => categoryCounts[cat.id] = 0);

    for (const issue of this.securityIssues) {
      const ruleId = this.extractRuleId(issue.ruleKey);
      const category = owaspRuleMap[ruleId];
      if (category) categoryCounts[category]++;
    }

    this.owaspCoverage = owaspCategories.map(cat => ({
      name: cat.name,
      count: categoryCounts[cat.id],
      status: this.getOwaspStatus(categoryCounts[cat.id])
    }));

    this.calculateHotIssues();
  }

  calculateHotIssues(): void {
    const rulesMap: Record<string, string[]> = {
      'SQL Injection': ['S3649'],
      'XSS Vulnerability': ['S5131'],
      'Hardcoded Secrets': ['S2068', 'S6418'],
      'Weak Encryption': ['S327', 'S4423', 'S4426', 'S4790'],
      'Path Traversal': ['S2083', 'S6096']
    };

    const counts: Record<string, number> = {
      'SQL Injection': 0,
      'XSS Vulnerability': 0,
      'Hardcoded Secrets': 0,
      'Weak Encryption': 0,
      'Path Traversal': 0
    };

    for (const issue of this.securityIssues) {
      const currentRule = this.extractRuleId(issue.ruleKey);

      for (const [category, rules] of Object.entries(rulesMap)) {
        if (rules.includes(currentRule)) {
          counts[category]++;
          break;
        }
      }
    }

    this.hotIssues = [
      { name: 'SQL Injection', count: counts['SQL Injection'] },
      { name: 'XSS Vulnerability', count: counts['XSS Vulnerability'] },
      { name: 'Hardcoded Secrets', count: counts['Hardcoded Secrets'] },
      { name: 'Weak Encryption', count: counts['Weak Encryption'] },
      { name: 'Path Traversal', count: counts['Path Traversal'] }
    ].sort((a, b) => b.count - a.count);
  }

  private extractRuleId(ruleKey: string): string {
    const match = ruleKey?.match(/S\d+/i);
    return match ? match[0].toUpperCase() : '';
  }

  private getOwaspStatus(count: number): 'pass' | 'warning' | 'fail' {
    if (count === 0) return 'pass';
    if (count === 1) return 'warning';
    return 'fail';
  }

  goBack(): void {
    this.router.navigate(['/analysis']);
  }

  get totalVulnerabilities(): number {
    return this.vulnerabilities.reduce((acc, v) => acc + v.count, 0);
  }

  calculateTrend7Days(): void {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    const dateCountMap = new Map<string, number>();

    for (const issue of this.securityIssues) {
      if (issue.createdAt) {
        const created = new Date(issue.createdAt);
        if (created >= sevenDaysAgo && created <= today) {
          const key = this.formatDateKey(created);
          dateCountMap.set(key, (dateCountMap.get(key) || 0) + 1);
        }
      }
    }

    const sortedDates = Array.from(dateCountMap.entries())
      .filter(([_, count]) => count > 0)
      .sort(([a], [b]) => a.localeCompare(b));

    const days: string[] = [];
    const counts: number[] = [];

    if (sortedDates.length === 0) {
      days.push('Day 1');
      counts.push(0);
    } else {
      sortedDates.forEach(([_, count], index) => {
        days.push(`Day ${index + 1}`);
        counts.push(count);
      });
    }

    this.chartSeries = [{ name: 'Security Issues', data: counts }];

    this.chartOptions = {
      chart: { type: 'line', height: 200, toolbar: { show: false } },
      stroke: { curve: 'smooth', width: 3 },
      xaxis: {
        categories: days,
        type: 'category'
      },
      yaxis: { min: 0, forceNiceScale: true, decimalsInFloat: 0 },
      dataLabels: { enabled: false },
      tooltip: { enabled: true },
      title: { text: 'Security Trend (7 Days)', align: 'left' },
      colors: ['#008FFB']
    };

    this.chartReady = false;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.chartReady = true;
      this.cdr.detectChanges();
    }, 50);
  }

  private formatDateKey(date: Date): string {
    let year = date.getFullYear();
    if (year > 2400) {
      year -= 543;
    }
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  chartSeries = [{ name: 'Security Issues', data: [] as number[] }];
  chartOptions: ApexOptions = {
    chart: { type: 'line', height: 200, toolbar: { show: false } },
    stroke: { curve: 'smooth', width: 3 },
    xaxis: { categories: [], type: 'category' },
    yaxis: { min: 0 },
    dataLabels: { enabled: false },
    tooltip: { enabled: true },
    title: { text: 'Security Trend (7 Days)', align: 'left' },
    colors: ['#008FFB']
  };

}
