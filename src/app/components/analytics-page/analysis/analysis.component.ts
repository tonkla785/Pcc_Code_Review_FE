import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { SecurityService } from '../../../services/securityservice/security.service';
import { ScanService } from '../../../services/scanservice/scan.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { TechnicalDebtDataService, DebtItem } from '../../../services/shared-data/technicaldebt-data.service';

interface HotSecurityIssue {
  name: string;
  count: number;
}

interface DebtProject {
    // Legacy interface, kept if needed by other parts, but mostly replaced by DebtItem
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
  topDebtProjects: DebtItem[] = [];

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
    private readonly scanService: ScanService,
    private readonly techDebtDataService: TechnicalDebtDataService
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadSecurityData();
    // this.loadTechnicalDebt(); // No longer needed if relying on shared data provided by TechnicalDebtComponent
    
    // Subscribe to shared data
    this.techDebtDataService.totalDebt$.subscribe(debt => {
        if(debt.days > 0 || debt.hours > 0 || debt.minutes > 0) {
            this.technicalDebt = `${debt.days}d ${debt.hours}h ${debt.minutes}m`;
        } else {
            this.technicalDebt = '0d 0h 0m';
        }
    });

    this.techDebtDataService.topDebtItems$.subscribe(items => {
        this.topDebtProjects = items;
    });
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

  // loadTechnicalDebt removed as we use shared data from TechnicalDebtComponent
  // The user requested to use shared data from TechnicalDebtComponent.
  // If Analysis is visited first, it will be empty until TechDebt is visited (as per "Shared Data" pattern).
  // If I wanted to force load, I would need to duplicate the logic or move it to service. 
  // Given previous instruction rejected duplication/service-logic-move, I assume this behavior is desired.


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
