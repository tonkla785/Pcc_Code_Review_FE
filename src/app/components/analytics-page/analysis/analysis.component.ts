import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { SecurityService } from '../../../services/securityservice/security.service';
import { WebSocketService } from '../../../services/websocket/websocket.service';
import { ScanService } from '../../../services/scanservice/scan.service';

interface HotSecurityIssue {
  name: string;
  count: number;
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
  technicalDebt = '0d';
  codeCoverage = 78;
  buildStatus = 'Passing';
  lintingIssues = 12;
  testCoverage = 80;

  topSecurityIssues: HotSecurityIssue[] = [];

  topDebtItems: DebtItem[] = [
    { item: 'Refactor legacy module', time: '5d', cost: 150000, priority: 'High', color: 'red' },
    { item: 'Add unit tests', time: '3d', cost: 90000, priority: 'High', color: 'red' },
    { item: 'Update dependencies', time: '2d', cost: 60000, priority: 'Medium', color: 'yellow' }
  ];

  private subscriptions: Subscription[] = [];

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sharedData: SharedDataService,
    private readonly securityService: SecurityService,
    private readonly ws: WebSocketService,
    private readonly scanService: ScanService,
    private readonly cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadSecurityData();
    this.loadTechnicalDebt();
    this.subscribeWebSocket();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private subscribeWebSocket(): void {
    const wsSub = this.ws.subscribeScanStatus().subscribe(event => {
      if (event.status === 'SUCCESS') {
        console.log('[Analysis] Scan SUCCESS, refreshing...');
        this.refreshSecurityData();
      }
    });
    this.subscriptions.push(wsSub);
  }

  loadSecurityData(): void {
    const scoreSub = this.sharedData.securityScore$.subscribe(score => {
      this.securityScore = score;
      this.cdr.detectChanges();
    });
    this.subscriptions.push(scoreSub);

    const hotIssuesSub = this.sharedData.hotIssues$.subscribe(issues => {
      this.topSecurityIssues = issues;
      this.cdr.detectChanges();
    });
    this.subscriptions.push(hotIssuesSub);

    this.securityService.loadAndCalculate().subscribe({
      error: (err) => console.error('Failed to load security data', err)
    });
  }

  refreshSecurityData(): void {
    console.log('[Analysis] Fetching fresh security issues...');
    this.securityService.getSecurityIssues().subscribe({
      next: (issues) => {
        console.log('[Analysis] Got', issues.length, 'issues');
        this.sharedData.setSecurityIssues(issues);
        this.securityService.calculateAndStore(issues);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to refresh security issues', err)
    });
  }

  loadTechnicalDebt(): void {
    if (!this.sharedData.hasScansHistoryCache) {
      this.scanService.getScansHistory().subscribe({
        next: (data) => {
          this.sharedData.Scans = data;
        },
        error: (err) => console.error('Failed to load scan history', err)
      });
    }

    const sub = this.sharedData.scansHistory$.subscribe(data => {
      if (data) {
        const totalMinutes = data.reduce((sum, p) => sum + (p.metrics?.technicalDebtMinutes || 0), 0);
        const days = Math.floor(totalMinutes / 480);
        this.technicalDebt = `${days}d`;
        this.cdr.detectChanges();
      }
    });
    this.subscriptions.push(sub);
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
