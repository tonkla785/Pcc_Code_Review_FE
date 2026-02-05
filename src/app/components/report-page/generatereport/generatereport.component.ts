import { Component, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../services/authservice/auth.service';
import { RepositoryService } from '../../../services/reposervice/repository.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { ScanService } from '../../../services/scanservice/scan.service';
import { SecurityService } from '../../../services/securityservice/security.service';
import { IssueService } from '../../../services/issueservice/issue.service';
import { TokenStorageService } from '../../../services/tokenstorageService/token-storage.service';

import { ExcelService } from '../../../services/report-generator/excel/excel.service';
import { WordService } from '../../../services/report-generator/word/word.service';
import { PowerpointService } from '../../../services/report-generator/powerpoint/powerpoint.service';
import { PdfService } from '../../../services/report-generator/pdf/pdf.service';

import { ReportHistoryService } from '../../../services/reporthistoryservice/report-history.service';
import { ReportHistoryRequest } from '../../../interface/report_history_interface';
import { NotificationService } from '../../../services/notiservice/notification.service';

import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SecurityIssueDTO } from '../../../interface/security_interface';
import { IssuesResponseDTO } from '../../../interface/issues_interface';

import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { IssuesDetailResponseDTO } from '../../../interface/issues_interface';

interface Project {
  id: string;
  name: string;
  selected: boolean;
}

interface Section {
  name: string;
  key: string;
  selected: boolean;
  disabled: boolean;
}

interface SelectedSections {
  qualityGate: boolean;
  issueBreakdown: boolean;
  securityAnalysis: boolean;
  technicalDebt: boolean;
  recommendations: boolean;
}

interface ReportContext {
  projectName: string;
  dateFrom: string;
  dateTo: string;
  scans: ScanResponseDTO[];
  issues: IssuesResponseDTO[];
  securityData: any;
  selectedSections: SelectedSections;
  recommendationsData?: any[];
  generatedBy: string;
}

@Component({
  selector: 'app-generatereport',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './generatereport.component.html',
  styleUrl: './generatereport.component.css'
})
export class GeneratereportComponent implements OnInit {

  reportType = '';
  projects: Project[] = [];
  dateFrom?: string;
  dateTo?: string;
  outputFormat = '';
  loading = false;
  today = new Date().toISOString().split('T')[0];
  noScanInRange = false;

  sections: Section[] = [
    { name: 'Quality Gate Summary', key: 'QualityGateSummary', selected: false, disabled: false },
    { name: 'Issue Breakdown', key: 'IssueBreakdown', selected: false, disabled: false },
    { name: 'Security Analysis', key: 'SecurityAnalysis', selected: false, disabled: false },
    { name: 'Technical Debt', key: 'TechnicalDebt', selected: false, disabled: false },
    // { name: 'Trend Analysis', key: 'TrendAnalysis', selected: false, disabled: false },
    { name: 'Recommendations', key: 'Recommendations', selected: false, disabled: false }
  ];

  formatMap: Record<string, string> = {
    'PDF': 'pdf',
    'Excel': 'xlsx',
    'Word': 'docx',
    'PowerPoint': 'pptx'
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly repositoryService: RepositoryService,
    private readonly sharedDataService: SharedDataService,
    private readonly scanService: ScanService,
    private readonly securityService: SecurityService,
    private readonly issueService: IssueService,
    private readonly tokenStorageService: TokenStorageService,
    private readonly excelService: ExcelService,
    private readonly wordService: WordService,
    private readonly pptService: PowerpointService,
    private readonly pdfService: PdfService,
    private readonly reportHistoryService: ReportHistoryService,
    private readonly notificationService: NotificationService,
    private readonly snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    this.initQueryParams();
    this.loadRepositories();
  }

  private initQueryParams(): void {
    this.route.queryParams.subscribe(params => {
      if (params['reportType']) {
        this.reportType = params['reportType'];
      }
    });
  }

  private loadRepositories(): void {
    if (!this.sharedDataService.hasRepositoriesCache) {
      this.repositoryService.getAllRepo().subscribe({
        next: (repos) => this.sharedDataService.setRepositories(repos),
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

  onSelectProject(selected: Project): void {
    this.projects.forEach(p => p.selected = (p === selected));
    this.checkScanInDateRange();
  }

  hasSelectedProjects(): boolean {
    return this.projects.some(p => p.selected);
  }

  onDateFromChange(): void {
    if (this.dateTo && this.dateFrom! > this.dateTo) {
      this.dateTo = this.dateFrom;
    }
    this.checkScanInDateRange();
  }

  onDateToChange(): void {
    if (this.dateFrom && this.dateTo! < this.dateFrom) {
      this.dateFrom = this.dateTo;
    }
    this.checkScanInDateRange();
  }

  isFormValid(form: NgForm): boolean {
    form.form.markAllAsTouched();
    if (!this.hasSelectedProjects()) return false;
    if (!this.dateFrom || !this.dateTo) return false;
    if (this.dateFrom > this.dateTo) return false;
    if (this.dateFrom > this.today || this.dateTo > this.today) return false;
    if (!this.outputFormat) return false;
    if (this.noScanInRange) return false;
    if (!this.hasSelectedSections()) return false;
    return true;
  }

  hasSelectedSections(): boolean {
    return this.sections.some(s => s.selected);
  }

  cancel(form?: NgForm): void {
    if (form) {
      form.resetForm();
    }
    this.projects.forEach(p => p.selected = false);
    this.sections.forEach(s => s.selected = false);
    this.dateFrom = '';
    this.dateTo = '';
    this.outputFormat = '';
  }

  // ตรวจสอบว่ามี scan อยู่ในวันที่เลือกปล่าว
  checkScanInDateRange(): void {
    if (!this.hasSelectedProjects() || !this.dateFrom || !this.dateTo) {
      this.noScanInRange = false;
      return;
    }

    const selectedProject = this.getSelectedProject();
    if (!selectedProject) {
      this.noScanInRange = false;
      return;
    }

    const repo = this.sharedDataService.repositoriesValue.find(r => r.projectId === selectedProject.id);
    if (!repo?.scans) {
      this.noScanInRange = true;
      return;
    }

    const filteredScans = this.filterScansByDateRange(repo.scans);
    this.noScanInRange = filteredScans.length === 0;
  }

  private getSelectedProject(): Project | undefined {
    return this.projects.find(p => p.selected);
  }

  // ดึง scan ตามช่วงวันที่
  private filterScansByDateRange(scans: any[]): any[] {
    return scans.filter(scan => {
      const scanDate = scan.startedAt ? new Date(scan.startedAt).toISOString().split('T')[0] : '';
      const isSuccess = (scan.status as string) === 'SUCCESS';
      return scanDate >= this.dateFrom! && scanDate <= this.dateTo! && isSuccess;
    });
  }

  // หลักการ Report ส่วยใหญ่
  onGenerate(form: NgForm): void {
    if (this.isFormValid(form)) {
      this.generateReport();
    }
  }

  generateReport(): void {
    if (!this.hasSelectedProjects() || !this.dateFrom || !this.dateTo || !this.outputFormat) {
      return;
    }

    this.loading = true;

    this.securityService.loadAndCalculate().subscribe({
      next: () => this.executeReportGeneration(),
      error: (err) => {
        this.loading = false;
        alert('Failed to generate report: Security data unavailable');
      }
    });
  }

  private executeReportGeneration(): void {
    const selectedProject = this.getSelectedProject()!;

    this.scanService.getScansHistory().subscribe({
      next: (allScans) => {
        this.sharedDataService.Scans = allScans;
        this.processScansAndIssues(selectedProject, allScans);
      },
      error: (err) => {
        this.loading = false;
      }
    });
  }

  private processScansAndIssues(project: Project, allScans: ScanResponseDTO[]): void {
    const projectScans = allScans.filter(
      s => s.project?.id === project.id
    );

    const filteredScans = projectScans.filter(scan => {
      const scanDate = scan.startedAt ? new Date(scan.startedAt).toISOString().split('T')[0] : '';
      const isSuccess = (scan.status as string) === 'SUCCESS';
      return scanDate >= this.dateFrom! && scanDate <= this.dateTo! && isSuccess;
    });

    filteredScans.sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime());

    this.issueService.getAllIssues().subscribe({
      next: (allIssues) => {
        const filteredIssues = this.filterIssuesByScans(allIssues, filteredScans);
        this.processReportData(project.id, project.name, filteredScans, filteredIssues);
      },
      error: () => {
        this.processReportData(project.id, project.name, filteredScans, []);
      }
    });
  }

  private filterIssuesByScans(allIssues: IssuesResponseDTO[], scans: ScanResponseDTO[]): IssuesResponseDTO[] {
    const validScanIds = new Set(scans.map(s => s.id));

    return allIssues.filter(issue => {
      const isCorrectScan = validScanIds.has(issue.scanId);
      const type = (issue.type || '').toUpperCase();
      const isCorrectType = type === 'BUG' || type === 'VULNERABILITY';
      return isCorrectScan && isCorrectType;
    });
  }

  // เลือกข้อมูลจะ genreport ครั้งสุดท้าย
  private processReportData(
    projectId: string,
    projectName: string,
    scans: ScanResponseDTO[],
    issues: IssuesResponseDTO[]
  ): void {
    const securityData = this.buildSecurityData(scans);
    const selectedSections = this.buildSelectedSections();

    if (selectedSections.recommendations) {
      this.fetchRecommendationsData(issues).subscribe({
        next: (recommendationsData) => {
          this.finalizeReport(projectId, projectName, scans, issues, securityData, selectedSections, recommendationsData);
        },
        error: (err) => {
          console.error('Failed to fetch recommendations', err);
          this.finalizeReport(projectId, projectName, scans, issues, securityData, selectedSections, []);
        }
      });
    } else {
      this.finalizeReport(projectId, projectName, scans, issues, securityData, selectedSections);
    }
  }

  private buildSecurityData(scans: ScanResponseDTO[]): any {
    const isSecuritySelected = this.sections.find(s => s.key === 'SecurityAnalysis')?.selected;

    if (!isSecuritySelected) {
      return undefined;
    }

    const securityIssues = this.sharedDataService.securityIssuesValue as SecurityIssueDTO[];
    if (!securityIssues) {
      return undefined;
    }

    const validScanIds = new Set(scans.map(s => s.id));
    const filteredSecurityIssues = securityIssues.filter(issue => validScanIds.has(issue.scanId));
    const metrics = this.securityService.calculate(filteredSecurityIssues);

    return {
      metrics,
      owaspCoverage: this.securityService.calculateOwaspCoverage(filteredSecurityIssues),
      hotIssues: metrics.hotIssues
    };
  }

  private buildSelectedSections(): SelectedSections {
    return {
      qualityGate: this.sections.find(s => s.key === 'QualityGateSummary')?.selected ?? false,
      issueBreakdown: this.sections.find(s => s.key === 'IssueBreakdown')?.selected ?? false,
      securityAnalysis: this.sections.find(s => s.key === 'SecurityAnalysis')?.selected ?? false,
      technicalDebt: this.sections.find(s => s.key === 'TechnicalDebt')?.selected ?? false,
      recommendations: this.sections.find(s => s.key === 'Recommendations')?.selected ?? false
    };
  }

  // สรุปข้อมูล
  private finalizeReport(
    projectId: string,
    projectName: string,
    scans: ScanResponseDTO[],
    issues: IssuesResponseDTO[],
    securityData: any,
    selectedSections: SelectedSections,
    recommendationsData: any[] = []
  ): void {
    const context = this.buildReportContext(projectName, scans, issues, securityData, selectedSections, recommendationsData);

    try {
      this.exportToFormat(context);
      this.saveReportHistoryToApi(projectId, projectName, scans, issues, securityData, selectedSections, recommendationsData);
      this.createReportNotification(projectName, true);  // success notification
      this.snackBar.open('Report generated successfully', '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-green']
      });
    } catch (e) {
      console.error('Error generating report', e);
      this.createReportNotification(projectName, false); // failed notification
    } finally {
      this.loading = false;
    }
  }

  private buildReportContext(
    projectName: string,
    scans: ScanResponseDTO[],
    issues: IssuesResponseDTO[],
    securityData: any,
    selectedSections: SelectedSections,
    recommendationsData: any[] = []
  ): ReportContext {
    const user = this.tokenStorageService.getLoginUser();

    return {
      projectName,
      dateFrom: this.dateFrom!,
      dateTo: this.dateTo!,
      scans,
      issues,
      securityData,
      selectedSections,
      recommendationsData,
      generatedBy: user?.username || 'Unknown'
    };
  }

  private exportToFormat(context: ReportContext): void {
    switch (this.outputFormat) {
      case 'Excel':
        this.excelService.generateExcel(context);
        break;
      case 'Word':
        this.wordService.generateWord(context);
        break;
      case 'PowerPoint':
        this.pptService.generatePowerPoint(context);
        break;
      case 'PDF':
        this.pdfService.generatePdf(context);
        break;
    }
  }

  // เรียกใช้ Api บันทึกประวัตื gen ลง database
  private saveReportHistoryToApi(
    projectId: string,
    projectName: string,
    scans: ScanResponseDTO[],
    issues: IssuesResponseDTO[],
    securityData: any,
    selectedSections: SelectedSections,
    recommendationsData: any[] = []
  ): void {
    const user = this.tokenStorageService.getLoginUser();

    const request: ReportHistoryRequest = {
      projectId,
      projectName,
      dateFrom: this.dateFrom!,
      dateTo: this.dateTo!,
      format: this.outputFormat,
      generatedBy: user?.username || 'Unknown',
      includeQualityGate: selectedSections.qualityGate,
      includeIssueBreakdown: selectedSections.issueBreakdown,
      includeSecurityAnalysis: selectedSections.securityAnalysis,
      includeTechnicalDebt: selectedSections.technicalDebt,
      includeRecommendations: selectedSections.recommendations,
      snapshotData: { scans, issues, securityData, selectedSections, recommendationsData },
      fileSizeBytes: 0
    };

    this.reportHistoryService.createReportHistory(request).subscribe({
      next: (result) => console.log('Report history saved:', result.id),
      error: (err) => console.error('Failed to save report history:', err)
    });
  }

  private createReportNotification(reportName: string, isSuccess: boolean): void {
    const userId = this.tokenStorageService.getLoginUser()?.id;
    if (!userId) return;

    const title = isSuccess ? '✅ Report Generated' : '❌ Report Failed';
    const message = isSuccess
      ? `Generate ${reportName} complete`
      : `Generate ${reportName} failed`;

    this.notificationService.createNotification({
      userId,
      type: 'System',
      title,
      message
    }).subscribe({
      next: () => console.log('Report notification created'),
      error: (err) => console.error('Failed to create notification:', err)
    });
  }

  // ส่วนนี้ถ้าจะเอาเปิดใช้ได้
  private fetchRecommendationsData(issues: IssuesResponseDTO[]) {
    const severityOrder: Record<string, number> = {
      'BLOCKER': 0, 'CRITICAL': 1, 'MAJOR': 2, 'MINOR': 3, 'INFO': 4
    };

    const sortedIssues = [...issues].sort((a, b) =>
      (severityOrder[a.severity?.toUpperCase()] ?? 5) - (severityOrder[b.severity?.toUpperCase()] ?? 5)
    );

    const topIssues = sortedIssues.slice(0, 20);

    if (topIssues.length === 0) {
      return of([]);
    }

    const detailsRequests = topIssues.map(issue =>
      this.issueService.getAllIssuesDetails(issue.id).pipe(
        map((details: IssuesDetailResponseDTO) => ({
          id: issue.id,
          message: issue.message || 'No description',
          component: issue.component || 'Unknown',
          line: issue.line || 0,
          type: (issue.type || '').toUpperCase(),
          severity: (issue.severity || 'MINOR').toUpperCase(),
          ruleKey: issue.ruleKey || '',
          recommendedFix: details.recommendedFix || 'No recommendation available',
          description: details.description || '',
          vulnerableCode: details.vulnerableCode || ''
        })),
        catchError(() => of({
          id: issue.id,
          message: issue.message || 'No description',
          component: issue.component || 'Unknown',
          line: issue.line || 0,
          type: (issue.type || '').toUpperCase(),
          severity: (issue.severity || 'MINOR').toUpperCase(),
          ruleKey: issue.ruleKey || '',
          recommendedFix: 'Unable to fetch recommendation',
          description: '',
          vulnerableCode: ''
        }))
      )
    );

    return forkJoin(detailsRequests);
  }
}
