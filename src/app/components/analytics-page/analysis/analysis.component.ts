import { Component } from '@angular/core';
import {CommonModule} from '@angular/common';
import { Router} from '@angular/router';
import { AuthService } from '../../../services/authservice/auth.service';

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
export class AnalysisComponent {

  securityScore = 85;
  technicalDebt = '45d';
  codeCoverage = 78;
  buildStatus = 'Passing';
  lintingIssues = 12;
  testCoverage = 80;

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

  constructor(private readonly router: Router , private authService:AuthService) {}
  ngOnInit(): void {
    const userId = this.authService.userId;
    console.log(userId);
    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }

  }

  summaryCards: any[] = [
    { title: 'Security Score', value: this.securityScore, icon: 'bi bi-shield-fill', action: () => this.goToSecurity() },
    { title: 'Technical Debt', value: this.technicalDebt, icon: 'bi bi-clock', action: () => this.goToDebt() },
    // { title: 'Code Coverage', value: this.codeCoverage, icon: 'bi bi-beaker', action: null },
    // { title: 'Build Status', value: this.buildStatus, icon: 'bi bi-circle-fill', action: null },
    // { title: 'Linting Issues', value: this.lintingIssues, icon: 'bi bi-exclamation-triangle', action: null },
    // { title: 'Test Coverage', value: this.testCoverage, icon: 'bi bi-beaker', action: null }
  ];

  goToSecurity() {
    this.router.navigate(['/security-dashboard']);
  }

  goToDebt() {
    this.router.navigate(['/technical-debt']);
  }

}
