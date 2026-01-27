import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { SecurityService } from '../../../services/securityservice/security.service';
import { ScanService } from '../../../services/scanservice/scan.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';

interface HotSecurityIssue {
  name: string;
  count: number;
}

interface DebtProject {
  projectName: string;
  debtTime: string;
  debtMinutes: number;
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
  topDebtProjects: DebtProject[] = [];

  private subscriptions: Subscription[] = [];

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sharedData: SharedDataService,
    private readonly securityService: SecurityService,
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
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
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

  loadTechnicalDebt(): void {
    this.scanService.getScansHistory().subscribe({
      next: (data) => {
        this.sharedData.Scans = data;
        this.calculateDebt(data);
      },
      error: (err) => console.error('Failed to load scan history', err)
    });
  }

  private calculateDebt(scans: ScanResponseDTO[]): void {
    const latestScans = this.latestScanPerProject(scans);

    const totalMinutes = latestScans.reduce((sum, s) => sum + (s.metrics?.technicalDebtMinutes || 0), 0);
    this.technicalDebt = this.formatDebtTime(totalMinutes);

    const sortedProjects = latestScans
      .map(scan => {
        const debtMinutes = scan.metrics?.technicalDebtMinutes || 0;
        const cost = scan.metrics?.debtRatio || 0;
        const days = debtMinutes / 480;
        const score = (days * 2) + (cost / 50000);
        return {
          projectName: scan.project?.name || scan.project?.projectName || 'Unknown',
          debtMinutes,
          cost,
          score
        };
      })
      .filter(p => p.debtMinutes > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    this.topDebtProjects = sortedProjects.map(p => ({
      projectName: p.projectName,
      debtTime: this.formatDebtTime(p.debtMinutes),
      debtMinutes: p.debtMinutes,
      priority: this.getDebtPriority(p.score),
      color: this.getDebtColor(p.score)
    }));

    this.cdr.detectChanges();
  }

  private latestScanPerProject(scans: ScanResponseDTO[]): ScanResponseDTO[] {
    const map = new Map<string, ScanResponseDTO>();

    for (const scan of scans) {
      const projectId = scan.project?.id || scan.project?.projectId;
      if (!projectId) continue;

      const existing = map.get(projectId);
      if (!existing) {
        map.set(projectId, scan);
      } else {
        const existingDate = new Date(existing.startedAt);
        const scanDate = new Date(scan.startedAt);
        if (scanDate > existingDate) {
          map.set(projectId, scan);
        }
      }
    }

    return Array.from(map.values());
  }

  private formatDebtTime(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 480) return `${Math.floor(minutes / 60)}h`;
    const days = Math.floor(minutes / 480);
    const hours = Math.floor((minutes % 480) / 60);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  private getDebtPriority(score: number): string {
    if (score >= 10) return 'High';
    if (score >= 5) return 'Med';
    return 'Low';
  }

  private getDebtColor(score: number): string {
    if (score >= 10) return 'bg-danger';
    if (score >= 5) return 'bg-warning';
    return 'bg-success';
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
