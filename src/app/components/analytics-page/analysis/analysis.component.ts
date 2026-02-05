import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { SecurityService } from '../../../services/securityservice/security.service';
import { ScanService } from '../../../services/scanservice/scan.service';
import { TechnicalDebtDataService } from '../../../services/shared-data/technicaldebt-data.service';
import { TechnicalDebtService } from '../../../services/technicaldebtservice/technicaldebt.service';
import { DebtTimePipe } from '../../../pipes/debt-time.pipe';

interface HotSecurityIssue {
  name: string;
  count: number;
}

interface DebtProject {
  projectName: string;
  debtMinutes: number;
  debtCost: string;
  priority: string;
  color: string;
}

import { Subscription } from 'rxjs';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, DebtTimePipe],
  providers: [DebtTimePipe],
  templateUrl: './analysis.component.html',
  styleUrl: './analysis.component.css'
})
export class AnalysisComponent implements OnInit, OnDestroy {

  securityScore = 0;
  technicalDebt = 0;
  codeCoverage = 78;
  buildStatus = 'Passing';
  lintingIssues = 12;
  testCoverage = 80;

  topSecurityIssues: HotSecurityIssue[] = [];
  topDebtProjects: DebtProject[] = [];

  private subscriptions = new Subscription();

  get summaryCards() {
    return [
      {
        title: 'Security Score',
        value: `${this.securityScore}`,
        icon: 'bi bi-shield-check',
        action: () => this.router.navigate(['/security-dashboard'])
      },
      {
        title: 'Technical Debt',
        value: this.debtTimePipe.transform(this.technicalDebt, 'short'),
        icon: 'bi bi-clock-history',
        action: () => this.router.navigate(['/technical-debt'])
      }
    ];
  }

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sharedData: SharedDataService,
    private readonly securityService: SecurityService,
    private readonly scanService: ScanService,
    private readonly techDebtDataService: TechnicalDebtDataService,
    private readonly techDebtService: TechnicalDebtService,
    private readonly debtTimePipe: DebtTimePipe,
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    this.subscriptions.add(
      this.sharedData.securityScore$.subscribe(score => {
        this.securityScore = score;
      })
    );

    this.subscriptions.add(
      this.sharedData.hotIssues$.subscribe(issues => {
        this.topSecurityIssues = issues;
      })
    );

    this.subscriptions.add(
      this.techDebtDataService.totalDebt$.subscribe(debt => {
        const totalMinutes = (debt.days * 480) + (debt.hours * 60) + debt.minutes;
        this.technicalDebt = totalMinutes;
      })
    );

    this.subscriptions.add(
      this.techDebtDataService.topDebtItems$.subscribe(items => {
        this.topDebtProjects = items.map(item => ({
          projectName: item.item,
          debtMinutes: item.time,
          debtCost: `THB${Math.ceil(item.cost).toLocaleString()}`,
          priority: item.priority,
          color: item.colorClass === 'high' ? 'bg-danger' : (item.colorClass === 'med' ? 'bg-warning text-dark' : 'bg-success')
        }));
      })
    );

    if (!this.sharedData.hasSecurityIssuesCache) {
      this.securityService.getSecurityIssues().subscribe({
        next: (issues) => {
          this.sharedData.setSecurityIssues(issues);
          this.securityService.calculateAndStore(issues);
        },
        error: (err) => console.error('Failed to load security data:', err)
      });
    }

    if (!this.sharedData.hasScansHistoryCache) {
      this.scanService.getScansHistory().subscribe({
        next: (data) => this.sharedData.Scans = data,
        error: (err) => console.error('Failed to load scan history', err)
      });
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  goToDebt(): void {
    this.router.navigate(['/technical-debt']);
  }
}

