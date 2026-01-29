import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
  debtCost: string;
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
export class AnalysisComponent implements OnInit {

  securityScore = 0;
  technicalDebt = '0d';
  codeCoverage = 78;
  buildStatus = 'Passing';
  lintingIssues = 12;
  testCoverage = 80;

  topSecurityIssues: HotSecurityIssue[] = [];
  topDebtProjects: DebtProject[] = [];

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
        value: this.technicalDebt,
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
    private readonly scanService: ScanService
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadSecurityData();
    this.loadTechnicalDebt();
  }

  loadSecurityData(): void {

    this.sharedData.securityScore$.subscribe(score => {
      this.securityScore = score;
    });

    this.sharedData.hotIssues$.subscribe(issues => {
      this.topSecurityIssues = issues;
    });

    if (!this.sharedData.hasSecurityIssuesCache) {
      this.securityService.getSecurityIssues().subscribe({
        next: (issues) => {
          this.sharedData.setSecurityIssues(issues);
          this.securityService.calculateAndStore(issues);
        },
        error: (err) => console.error('Failed to load security data:', err)
      });
    }
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

    this.topDebtProjects = latestScans
      .map(s => {
        const minutes = s.metrics?.technicalDebtMinutes || 0;
        const days = minutes / 480;
        const costVal = days * 30000;
        const costStr = `THB${Math.ceil(costVal).toLocaleString()}`;
        const score = (days * 2) + (costVal / 50000);

        return {
          projectName: s.project?.name || 'Unknown Project',
          debtTime: this.formatDebtTime(minutes),
          debtMinutes: minutes,
          debtCost: costStr,
          priority: this.getPriority(score),
          color: this.getColor(score)
        };
      })
      .sort((a, b) => b.debtMinutes - a.debtMinutes)
      .slice(0, 5);
  }

  private latestScanPerProject(scans: ScanResponseDTO[]): ScanResponseDTO[] {
    const map = new Map<string, ScanResponseDTO>();
    scans.forEach(s => {
      const projectName = s.project?.name || 'Unknown';
      const scanDate = new Date(s.startedAt || 0);

      if (!map.has(projectName) || scanDate > new Date(map.get(projectName)!.startedAt || 0)) {
        map.set(projectName, s);
      }
    });
    return Array.from(map.values());
  }

  private formatDebtTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const days = Math.floor(hours / 8);
    const remainingHours = hours % 8;

    if (days > 0) {
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }


  private getPriority(score: number): string {
    if (score >= 10) return 'High';
    if (score >= 5) return 'Medium';
    return 'Low';
  }

  private getColor(score: number): string {
    if (score >= 10) return 'bg-danger';
    if (score >= 5) return 'bg-warning text-dark';
    return 'bg-success';
  }

  goToDebt(): void {
    this.router.navigate(['/technical-debt']);
  }
}
