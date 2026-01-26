import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { SecurityService } from '../../../services/securityservice/security.service';

interface SecurityIssue {
  name: string;
  count: number;
  priority: string;
  color: string;
}

interface DebtItem {
  item: string;
  time: string;
  cost: number;
  priority: string;
  color: string;
}

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analysis.component.html',
  styleUrl: './analysis.component.css'
})
export class AnalysisComponent implements OnInit, OnDestroy {

  securityScore = 0;
  technicalDebt = '45d';
  codeCoverage = 78;
  buildStatus = 'Passing';
  lintingIssues = 12;
  testCoverage = 80;

  private subscriptions: Subscription[] = [];

  topSecurityIssues: SecurityIssue[] = [
    { name: 'SQL Injection', count: 3, priority: 'High', color: 'red' },
    { name: 'XSS Vulnerability', count: 2, priority: 'Medium', color: 'orange' },
    { name: 'Hardcoded Secrets', count: 2, priority: 'Low', color: 'yellow' }
  ];

  topDebtItems: DebtItem[] = [
    { item: 'Refactor legacy module', time: '5d', cost: 150000, priority: 'High', color: 'red' },
    { item: 'Add unit tests', time: '3d', cost: 90000, priority: 'High', color: 'red' },
    { item: 'Update dependencies', time: '2d', cost: 60000, priority: 'Medium', color: 'yellow' }
  ];

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sharedData: SharedDataService,
    private readonly securityService: SecurityService
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadSecurityScore();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadSecurityScore(): void {
    const sub = this.sharedData.securityScore.subscribe((score: number) => {
      this.securityScore = score;
    });
    this.subscriptions.push(sub);

    if (this.sharedData.securityScoreValue === 0) {
      this.securityService.getSecurityIssues().subscribe({
        next: (issues) => {
          const deductionMap: Record<string, number> = {
            'BLOCKER': 20, 'CRITICAL': 10, 'MAJOR': 5, 'MINOR': 1
          };
          let totalDeduction = 0;
          for (const issue of issues) {
            totalDeduction += deductionMap[issue.severity?.toUpperCase() || ''] || 0;
          }
          const score = Math.max(0, 100 - totalDeduction);
          const risk = score >= 80 ? 'LOW' : score >= 60 ? 'MEDIUM' : score >= 40 ? 'HIGH' : 'CRITICAL';
          this.sharedData.setSecurityScore(score, risk);
        },
        error: (err) => console.error('Failed to load security score', err)
      });
    }
  }

  get summaryCards() {
    return [
      { title: 'Security Score', value: this.securityScore, icon: 'bi bi-shield-fill', action: () => this.goToSecurity() },
      { title: 'Technical Debt', value: this.technicalDebt, icon: 'bi bi-clock', action: () => this.goToDebt() }
    ];
  }

  goToSecurity(): void {
    this.router.navigate(['/security-dashboard']);
  }

  goToDebt(): void {
    this.router.navigate(['/technical-debt']);
  }
}
