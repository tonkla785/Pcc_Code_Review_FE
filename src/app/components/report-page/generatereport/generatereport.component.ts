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
import { IssueService } from '../../../services/issueservice/issue.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SecurityIssueDTO } from '../../../interface/security_interface';

// Services
import { ExcelService } from '../../../services/report-generator/excel/excel.service';
import { WordService } from '../../../services/report-generator/word/word.service';
import { PowerpointService } from '../../../services/report-generator/powerpoint/powerpoint.service';
import { PdfService } from '../../../services/report-generator/pdf/pdf.service';
import { IssuesResponseDTO } from '../../../interface/issues_interface';
import { TokenStorageService } from '../../../services/tokenstorageService/token-storage.service';
import { HistoryDataService, ReportSnapshot } from '../../../services/shared-data/history-data.service';

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
    { name: "Quality Gate Summary", key: "QualityGateSummary", selected: false, disabled: false },
    { name: "Issue Breakdown", key: "IssueBreakdown", selected: false, disabled: false },
    { name: "Security Analysis", key: "SecurityAnalysis", selected: false, disabled: false },
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
    private readonly issueService: IssueService,
    private readonly excelService: ExcelService,
    private readonly wordService: WordService,
    private readonly pptService: PowerpointService,
    private readonly pdfService: PdfService,
    private readonly tokenStorageService: TokenStorageService,
    private readonly historyDataService: HistoryDataService
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
    const projectId = selectedProject!.id;

    const processScans = (allScans: ScanResponseDTO[]) => {
      const projectScans = allScans.filter(s => s.project?.name === projectName || s.project?.id === projectId);

      const filteredScans = projectScans.filter(scan => {
        const scanDate = scan.startedAt ? new Date(scan.startedAt).toISOString().split('T')[0] : '';
        return scanDate >= this.dateFrom! && scanDate <= this.dateTo!;
      });

      filteredScans.sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime());

      this.issueService.getAllIssues().subscribe({
        next: (allIssues: IssuesResponseDTO[]) => {
          const validScanIds = new Set(filteredScans.map(s => s.id));

          const filteredIssues = allIssues.filter((issue: IssuesResponseDTO) => {
            const isCorrectScan = validScanIds.has(issue.scanId);
            const type = (issue.type || '').toUpperCase();
            const isCorrectType = type === 'BUG' || type === 'VULNERABILITY';
            return isCorrectScan && isCorrectType;
          });

          this.processReportGeneration(selectedProject!.id, projectName, filteredScans, filteredIssues);
        },
        error: (err: any) => {
          console.error('Failed to load issues', err);
          this.processReportGeneration(selectedProject!.id, projectName, filteredScans, []);
        }
      });
    };

    this.scanService.getScansHistory().subscribe({
      next: (data) => {
        this.sharedDataService.Scans = data;
        processScans(data);
      },
      error: (err) => {
        console.error('Failed to load scan history', err);
        this.loading = false;
        alert('Failed to load scan data');
      }
    });
  }

  private processReportGeneration(projectId: string, projectName: string, scans: ScanResponseDTO[], issues: any[]) {
    let securityData: any = undefined;
    const isSecuritySelected = this.sections.find(s => s.key === 'SecurityAnalysis')?.selected;

    if (isSecuritySelected) {
      const securityIssues = this.sharedDataService.securityIssuesValue as SecurityIssueDTO[];
      if (securityIssues) {
        const validScanIds = new Set(scans.map(s => s.id));
        const filteredSecurityIssues = securityIssues.filter(issue => validScanIds.has(issue.scanId));

        const metrics = this.securityService.calculate(filteredSecurityIssues);

        securityData = {
          metrics: metrics,
          owaspCoverage: this.securityService.calculateOwaspCoverage(filteredSecurityIssues),
          hotIssues: metrics.hotIssues
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
      scans,
      issues,
      securityData,
      selectedSections
    };

    const snapshotId = Date.now().toString();
    const user = this.tokenStorageService.getLoginUser();

    const snapshot: ReportSnapshot = {
      id: snapshotId,
      metadata: {
        project: projectName,
        dateFrom: this.dateFrom!,
        dateTo: this.dateTo!,
        format: this.outputFormat,
        generatedBy: user?.username || 'Unknown',
        generatedAt: new Date().toISOString()
      },
      data: {
        scans,
        issues,
        securityData,
        selectedSections
      }
    };

    this.historyDataService.saveReportSnapshot(snapshot);

    try {
      if (this.outputFormat === 'Excel') {
        this.excelService.generateExcel(context);
        this.saveReportHistory(projectName, snapshotId);
      } else if (this.outputFormat === 'Word') {
        this.wordService.generateWord(context);
        this.saveReportHistory(projectName, snapshotId);
      } else if (this.outputFormat === 'PowerPoint') {
        this.pptService.generatePowerPoint(context);
        this.saveReportHistory(projectName, snapshotId);
      } else if (this.outputFormat === 'PDF') {
        this.pdfService.generatePdf({ ...context, generatedBy: user?.username });
        this.saveReportHistory(projectName, snapshotId);
        this.loading = false;
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

  private saveReportHistory(projectName: string, snapshotId: string) {
    const user = this.tokenStorageService.getLoginUser();
    const historyItem = {
      project: projectName,
      dateRange: `${this.dateFrom} to ${this.dateTo}`,
      generatedBy: user ? user.username : 'Unknown',
      email: user ? user.email : '',
      role: user ? user.role : '',
      generatedAt: new Date(),
      format: this.outputFormat,
      snapshotId: snapshotId
    };

    const storageKey = 'report_history';
    const currentHistory = JSON.parse(localStorage.getItem(storageKey) || '[]');
    currentHistory.push(historyItem);
    localStorage.setItem(storageKey, JSON.stringify(currentHistory));
  }
}
