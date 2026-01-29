import { Component, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RepositoryService } from '../../../services/reposervice/repository.service';
import { ExportreportService, ReportRequest } from '../../../services/exportreportservice/exportreport.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { ScanService } from '../../../services/scanservice/scan.service';
import { SecurityService } from '../../../services/securityservice/security.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SecurityIssueDTO } from '../../../interface/security_interface';

// Services
import { ExcelService } from '../../../services/report-generator/excel/excel.service';
import { WordService } from '../../../services/report-generator/word/word.service';
import { PowerpointService } from '../../../services/report-generator/powerpoint/powerpoint.service';
import { TokenStorageService } from '../../../services/tokenstorageService/token-storage.service';

interface Project {
  id: string;
  name: string;
  selected: boolean;
}

@Component({
  selector: 'app-generatereport',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './generatereport.component.html',
  styleUrl: './generatereport.component.css'
})
export class GeneratereportComponent implements OnInit {

  reportType: string = '';
  projects: Project[] = [];
  dateFrom?: string;
  dateTo?: string;
  outputFormat: string = '';
  loading = false;

  sections = [
    { name: "Quality Gate Summary", key: "QualityGateSummary", selected: true, disabled: false },
    { name: "Issue Breakdown", key: "IssueBreakdown", selected: false, disabled: true },
    { name: "Security Analysis", key: "SecurityAnalysis", selected: false, disabled: false },
    { name: "Technical Debt", key: "TechnicalDebt", selected: false, disabled: true },
    { name: "Trend Analysis", key: "TrendAnalysis", selected: false, disabled: true },
    { name: "Recommendations", key: "Recommendations", selected: false, disabled: true },
  ];

  formatMap: Record<string, string> = {
    "PDF": "pdf",
    "Excel": "xlsx",
    "Word": "docx",
    "PowerPoint": "pptx"
  };

  today: string = new Date().toISOString().split('T')[0];
  noScanInRange: boolean = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly repositoryService: RepositoryService,
    private readonly exportreportService: ExportreportService,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sharedDataService: SharedDataService,
    private readonly scanService: ScanService,
    private readonly securityService: SecurityService,
    private readonly excelService: ExcelService,
    private readonly wordService: WordService,
    private readonly pptService: PowerpointService,
    private readonly tokenStorageService: TokenStorageService
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.route.queryParams.subscribe(params => {
      if (params['reportType']) {
        this.reportType = params['reportType'];
      }
    });

    if (!this.sharedDataService.hasRepositoriesCache) {
      this.repositoryService.getAllRepo().subscribe({
        next: (repos) => {
          this.sharedDataService.setRepositories(repos);
          console.log('Repositories loaded:', repos);
        },
        error: (err) => console.error('Failed to load repositories', err)
      });
    }

    this.sharedDataService.repositories$.subscribe(repos => {
      this.projects = repos.map(repo => ({
        id: repo.projectId!,
        name: repo.name,
        selected: false
      }));
    });
  }

  onSelectProject(selected: Project) {
    this.projects.forEach(p => {
      p.selected = (p === selected);
    });
    this.checkScanInDateRange();
  }

  hasSelectedProjects(): boolean {
    return this.projects.some(p => p.selected);
  }

  onDateFromChange() {
    if (this.dateTo && this.dateFrom! > this.dateTo) {
      this.dateTo = this.dateFrom;
    }
    this.checkScanInDateRange();
  }

  onDateToChange() {
    if (this.dateFrom && this.dateTo! < this.dateFrom) {
      this.dateFrom = this.dateTo;
    }
    this.checkScanInDateRange();
  }

  checkScanInDateRange() {
    if (!this.hasSelectedProjects() || !this.dateFrom || !this.dateTo) {
      this.noScanInRange = false;
      return;
    }

    const selectedProject = this.projects.find(p => p.selected);
    if (!selectedProject) {
      this.noScanInRange = false;
      return;
    }

    const repo = this.sharedDataService.repositoriesValue.find(r => r.name === selectedProject.name);
    if (!repo || !repo.scans) {
      this.noScanInRange = true;
      return;
    }

    const scans = repo.scans || [];
    const filteredScans = scans.filter(scan => {
      const scanDate = scan.startedAt ? new Date(scan.startedAt).toISOString().split('T')[0] : '';
      return scanDate >= this.dateFrom! && scanDate <= this.dateTo!;
    });

    this.noScanInRange = filteredScans.length === 0;
  }

  isFormValid(form: any): boolean {
    form.form.markAllAsTouched();
    if (!this.hasSelectedProjects()) return false;
    if (!this.dateFrom || !this.dateTo) return false;
    if (this.dateFrom > this.dateTo) return false;
    if (this.dateFrom > this.today || this.dateTo > this.today) return false;
    if (!this.outputFormat) return false;
    if (this.noScanInRange) return false;
    return true;
  }

  cancel(form?: any) {
    if (form) {
      form.resetForm();
    }
    this.projects.forEach(p => p.selected = false);
    this.sections.forEach(s => s.selected = true);
    this.dateFrom = '';
    this.dateTo = '';
    this.outputFormat = '';
    console.log('Form cancelled and cleared.');
  }

  onGenerate(form: NgForm) {
    if (this.isFormValid(form)) {
      this.generateReport();
    } else {
      console.warn('Form is invalid');
    }
  }

  generateReport() {
    if (this.hasSelectedProjects() && this.dateFrom && this.dateTo && this.outputFormat) {
      this.loading = true;

      this.securityService.loadAndCalculate().subscribe({
        next: () => {
          this.executeReportGeneration();
        },
        error: (err) => {
          console.error('Failed to load security data', err);
          this.loading = false;
          alert('Failed to generate report: Security data unavailable');
        }
      });
    }
  }

  private executeReportGeneration() {
    const selectedProject = this.projects.find(p => p.selected);
    const projectName = selectedProject!.name;

    const repo = this.sharedDataService.repositoriesValue.find(r => r.name === projectName);
    if (!repo) {
      this.loading = false;
      alert('ไม่พบข้อมูลโปรเจกต์');
      return;
    }

    const scans = repo.scans || [];
    const filteredScans = scans.filter(scan => {
      const scanDate = scan.startedAt ? new Date(scan.startedAt).toISOString().split('T')[0] : '';
      return scanDate >= this.dateFrom! && scanDate <= this.dateTo!;
    });

    const latestScan = filteredScans.length > 0
      ? filteredScans.sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime())[0]
      : null;

    if (!latestScan || !latestScan.scanId) {
      this.processReportGeneration(selectedProject!.id, projectName, null, []);
      return;
    }

    this.scanService.getScanById(latestScan.scanId).subscribe({
      next: (fullScan) => {
        const issues = fullScan.issueData || [];
        this.processReportGeneration(selectedProject!.id, projectName, fullScan, issues);
      },
      error: (err) => {
        console.error('Failed to fetch scan details', err);
        this.loading = false;
        alert('Failed to generate report');
      }
    });
  }

  private processReportGeneration(projectId: string, projectName: string, scanData: ScanResponseDTO | null, issues: any[]) {
    let securityData: any = undefined;
    const isSecuritySelected = this.sections.find(s => s.key === 'SecurityAnalysis')?.selected;

    if (isSecuritySelected) {
      const securityIssues = this.sharedDataService.securityIssuesValue as SecurityIssueDTO[];
      if (securityIssues) {
        securityData = {
          metrics: this.securityService.calculate(securityIssues),
          owaspCoverage: this.securityService.calculateOwaspCoverage(securityIssues),
          hotIssues: this.sharedDataService.hotIssuesValue
        };
      }
    }

    const selectedSections = {
      qualityGate: this.sections.find(s => s.key === 'QualityGateSummary')?.selected ?? false,
      issueBreakdown: this.sections.find(s => s.key === 'IssueBreakdown')?.selected ?? false,
      securityAnalysis: this.sections.find(s => s.key === 'SecurityAnalysis')?.selected ?? false
    };

    const context = {
      projectName,
      dateFrom: this.dateFrom!,
      dateTo: this.dateTo!,
      scanData,
      issues,
      securityData,
      selectedSections
    };

    try {
      if (this.outputFormat === 'Excel') {
        this.excelService.generateExcel(context);
        this.saveReportHistory(projectName);
      } else if (this.outputFormat === 'Word') {
        this.wordService.generateWord(context);
        this.saveReportHistory(projectName);
      } else if (this.outputFormat === 'PowerPoint') {
        this.pptService.generatePowerPoint(context);
        this.saveReportHistory(projectName);
      } else if (this.outputFormat === 'PDF') {
        this.generatePdfReport(projectId);
        return;
      }
    } catch (e) {
      console.error('Error generating report', e);
      alert('Error generating report');
    } finally {
      if (this.outputFormat !== 'PDF') {
        this.loading = false;
      }
    }
  }

  private saveReportHistory(projectName: string) {
    const user = this.tokenStorageService.getLoginUser();
    const historyItem = {
      project: projectName,
      dateRange: `${this.dateFrom} to ${this.dateTo}`,
      generatedBy: user ? user.username : 'Unknown',
      email: user ? user.email : '',
      role: user ? user.role : '',
      generatedAt: new Date(),
      format: this.outputFormat
    };

    const storageKey = 'report_history';
    const currentHistory = JSON.parse(localStorage.getItem(storageKey) || '[]');
    currentHistory.push(historyItem);
    localStorage.setItem(storageKey, JSON.stringify(currentHistory));
  }

  private generatePdfReport(projectId: string) {
    const req: ReportRequest = {
      projectId: projectId,
      dateFrom: this.dateFrom!,
      dateTo: this.dateTo!,
      outputFormat: 'pdf',
      includeSections: this.sections.filter(s => s.selected).map(s => s.key)
    };

    this.exportreportService.generateReport(req).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `report-${projectId}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.loading = false;

        const selectedProject = this.projects.find(p => p.selected);
        if (selectedProject) {
          this.saveReportHistory(selectedProject.name);
        }
      },
      error: (err) => {
        console.error('Generate PDF failed', err);
        this.loading = false;
        alert('Failed to generate PDF');
      }
    });
  }
}
