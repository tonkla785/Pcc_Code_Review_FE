import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RepositoryService} from '../../../services/reposervice/repository.service';
import { ExportreportService, ReportRequest } from '../../../services/exportreportservice/exportreport.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { ScanService} from '../../../services/scanservice/scan.service';
import { SecurityService } from '../../../services/securityservice/security.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SecurityIssueDTO} from '../../../interface/security_interface';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import pptxgen from 'pptxgenjs';

interface Project {
  id: string;      // projectId จาก backend
  name: string;    // ชื่อโปรเจกต์
  selected: boolean;
}

interface Section {
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
export class GeneratereportComponent {

  reportType: string = '';
  projects: Project[] = [];
  dateFrom?: string;
  dateTo?: string;
  outputFormat: string = '';
  email: string = '';
  loading = false;

  sections = [
    { name: "Quality Gate Summary", key: "QualityGateSummary", selected: true, disabled: false },
    { name: "Issue Breakdown", key: "IssueBreakdown", selected: false, disabled: true },
    { name: "Security Analysis", key: "SecurityAnalysis", selected: false, disabled: false },
    { name: "Technical Debt", key: "TechnicalDebt", selected: false, disabled: true },
    { name: "Trend Analysis", key: "TrendAnalysis", selected: false, disabled: true },
    { name: "Recommendations", key: "Recommendations", selected: false, disabled: true },
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly repositoryService: RepositoryService,
    private readonly exportreportService: ExportreportService,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sharedDataService: SharedDataService,
    private readonly scanService: ScanService,
    private readonly securityService: SecurityService
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

  today: string = new Date().toISOString().split('T')[0];
  noScanInRange: boolean = false;

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

  generateReport() {
    if (this.hasSelectedProjects() && this.dateFrom && this.dateTo && this.outputFormat) {
      const selectedProject = this.projects.find(p => p.selected);

      if (this.outputFormat === 'Excel') {
        this.exportToExcel(selectedProject!.name);
        return;
      }

      if (this.outputFormat === 'Word') {
        this.exportToWord(selectedProject!.name);
        return;
      }

      if (this.outputFormat === 'PowerPoint') {
        this.exportToPowerPoint(selectedProject!.name);
        return;
      }

      const req: ReportRequest = {
        projectId: selectedProject!.id,
        dateFrom: this.dateFrom!,
        dateTo: this.dateTo!,
        outputFormat: this.formatMap[this.outputFormat],
        includeSections: this.sections
          .filter(s => s.selected)
          .map(s => s.key)
      };

      console.log('Request to backend:', req);
      this.loading = true;

      this.exportreportService.generateReport(req).subscribe({
        next: (blob) => {
          console.log('Generate report success', blob);
          this.downloadFile(blob, `report-${req.projectId}.${req.outputFormat}`);
          this.loading = false;
        },
        error: (err) => {
          console.error('Generate report failed', err);
          this.loading = false;
          alert('Failed to generate report');
        }
      });
    }
  }

  exportToExcel(projectName: string) {
    this.loading = true;

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

      this.createExcelReport(projectName, null, []);
      this.loading = false;
      return;
    }

    this.scanService.getScanById(latestScan.scanId).subscribe({
      next: (fullScan) => {
        console.log('Full scan data:', fullScan);
        const issues = fullScan.issueData || [];
        this.createExcelReport(projectName, fullScan, issues);
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to fetch scan details', err);
        this.loading = false;
        alert('Failed to generate report');
      }
    });
  }

  private createExcelReport(projectName: string, scanData: ScanResponseDTO | null, issues: any[]) {
    const workbook = XLSX.utils.book_new();

    const summaryData: any[][] = [
      ['Code Review Report - Quality Gate Summary'],
      [`Project: ${projectName}`],
      [`Date Range: ${this.dateFrom} - ${this.dateTo}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [],
      ['Project Name', 'Status', 'Reliability', 'Security', 'Maintainability', 'Bugs', 'Vulnerabilities'],
    ];

    if (scanData) {
      const status = scanData.qualityGate === 'OK' ? 'Passed' : 'Failed';

      const reliability = this.formatRating(scanData.metrics?.reliabilityRating);
      const security = this.formatRating(scanData.metrics?.securityRating);
      const maintainability = this.formatRating(scanData.metrics?.maintainabilityRating);
      const bugs = scanData.metrics?.bugs ?? 0;
      const vulnerabilities = scanData.metrics?.vulnerabilities ?? 0;

      summaryData.push([
        projectName,
        status,
        reliability,
        security,
        maintainability,
        String(bugs),
        String(vulnerabilities)
      ]);
    } else {
      summaryData.push([projectName, 'No scan data in range', 'N/A', 'N/A', 'N/A', '0', '0']);
    }

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } },
    ];
    summarySheet['!cols'] = [
      { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }
    ];

    const includeSummary = this.sections.find(s => s.key === 'QualityGateSummary')?.selected;
    if (includeSummary) {
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    }

    // ==================== Sheet 2: Issues_List ====================
    const filteredIssues = issues.filter(issue => {
      if (issue.type !== 'Bug' && issue.type !== 'Vulnerability') return false;
      const issueDate = issue.createdAt ? new Date(issue.createdAt).toISOString().split('T')[0] : '';
      return issueDate >= this.dateFrom! && issueDate <= this.dateTo!;
    });

    const issuesData: any[][] = [
      ['Code Review Report - Issue Breakdown'],
      [`Project: ${projectName}`],
      [`Date Range: ${this.dateFrom} - ${this.dateTo}`],
      [],
      ['Project Name', 'Type', 'Severity', 'File Path', 'Line', 'Status'],
    ];

    if (filteredIssues.length > 0) {
      filteredIssues.forEach(issue => {
        const filePath = issue.component || 'N/A';
        const line = this.extractLineFromComponent(issue.component) || 'N/A';
        issuesData.push([
          projectName,
          issue.type,
          issue.severity,
          filePath,
          line,
          issue.status
        ]);
      });
    } else {
      issuesData.push([projectName, 'No issues found', '-', '-', '-', '-']);
    }

    // เฉพาะเมื่อติ๊ก Issue Breakdown
    const includeIssues = this.sections.find(s => s.key === 'IssueBreakdown')?.selected;
    if (includeIssues) {
      const issuesSheet = XLSX.utils.aoa_to_sheet(issuesData);
      issuesSheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
      ];
      issuesSheet['!cols'] = [
        { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 60 }, { wch: 10 }, { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(workbook, issuesSheet, 'Issues_List');
    }

    // ==================== Sheet 3: Security_Report ====================
    const includeSecurityAnalysis = this.sections.find(s => s.key === 'SecurityAnalysis')?.selected;
    if (includeSecurityAnalysis) {
      const securityIssues = this.sharedDataService.securityIssuesValue as SecurityIssueDTO[];
      const metrics = this.securityService.calculate(securityIssues);
      const owaspCoverage = this.securityService.calculateOwaspCoverage(securityIssues);
      const hotIssues = this.sharedDataService.hotIssuesValue;

      const securityData: any[][] = [
        ['Code Review Report - Security Analysis'],
        [`Generated: ${new Date().toLocaleString()}`],
        [],
        ['OWASP Top 10 Breakdown'],
        ['Category', 'Issue Count', 'Status'],
      ];

      owaspCoverage.forEach(owasp => {
        const statusText = owasp.status === 'pass' ? '✅ Pass' : owasp.status === 'warning' ? '⚠️ Warning' : '❌ Fail';
        securityData.push([owasp.name, String(owasp.count), statusText]);
      });

      securityData.push([]);
      securityData.push(['Vulnerability Severity']);
      securityData.push(['Severity', 'Count']);

      metrics.vulnerabilities.forEach(v => {
        securityData.push([v.severity, String(v.count)]);
      });

      securityData.push([]);
      securityData.push(['Top 5 Security Hotspots']);
      securityData.push(['Issue', 'Count']);

      const top5Hotspots = hotIssues.slice(0, 5);
      if (top5Hotspots.length > 0) {
        top5Hotspots.forEach(h => {
          securityData.push([h.name, String(h.count)]);
        });
      } else {
        securityData.push(['No hotspots detected', '-']);
      }

      const securitySheet = XLSX.utils.aoa_to_sheet(securityData);
      securitySheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
      ];
      securitySheet['!cols'] = [
        { wch: 30 }, { wch: 15 }, { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(workbook, securitySheet, 'Security_Report');
    }

    const filename = `report-${projectName}-${this.dateFrom}-to-${this.dateTo}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  private formatRating(value: string | number | undefined): string {
    if (value === null || value === undefined || value === '') return 'N/A';

    const s = String(value);

    if (s.startsWith('1')) return 'A';
    if (s.startsWith('2')) return 'B';
    if (s.startsWith('3')) return 'C';
    if (s.startsWith('4')) return 'D';
    if (s.startsWith('5')) return 'E';

    if (/^[A-E]$/i.test(s)) return s.toUpperCase();

    if (s === 'OK') return 'A';

    return s;
  }

  private extractLineFromComponent(component: string | undefined): string {
    if (!component) return '';
    const match = component.match(/:(\d+)$/);
    return match ? match[1] : '';
  }

  // ==================== Word Export ====================
  exportToWord(projectName: string) {
    this.loading = true;
    const repo = this.sharedDataService.repositoriesValue.find(r => r.name === projectName);
    if (!repo) { this.loading = false; return; }

    const scans = repo.scans || [];
    const filteredScans = scans.filter(scan => {
      const scanDate = scan.startedAt ? new Date(scan.startedAt).toISOString().split('T')[0] : '';
      return scanDate >= this.dateFrom! && scanDate <= this.dateTo!;
    });
    const latestScan = filteredScans.length > 0
      ? filteredScans.sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime())[0]
      : null;

    if (!latestScan || !latestScan.scanId) {
      this.createWordReport(projectName, null);
      return;
    }

    this.scanService.getScanById(latestScan.scanId).subscribe({
      next: (fullScan) => {
        this.createWordReport(projectName, fullScan);
      },
      error: () => {
        this.createWordReport(projectName, null);
      }
    });
  }

  private createWordReport(projectName: string, scanData: ScanResponseDTO | null) {
    const status = scanData?.qualityGate === 'OK' ? 'Passed' : (scanData ? 'Failed' : 'N/A');
    const includeSecurityAnalysis = this.sections.find(s => s.key === 'SecurityAnalysis')?.selected;

    const children: any[] = [
      new Paragraph({ text: 'Code Review Report', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: `Project: ${projectName}`, spacing: { after: 200 } }),
      new Paragraph({ text: `Date Range: ${this.dateFrom} - ${this.dateTo}`, spacing: { after: 400 } }),
      new Paragraph({ text: 'Quality Gate Summary', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: `Status: ${status}` }),
      new Paragraph({ text: `Reliability: ${this.formatRating(scanData?.metrics?.reliabilityRating)}` }),
      new Paragraph({ text: `Security: ${this.formatRating(scanData?.metrics?.securityRating)}` }),
      new Paragraph({ text: `Maintainability: ${this.formatRating(scanData?.metrics?.maintainabilityRating)}` }),
      new Paragraph({ text: `Bugs: ${scanData?.metrics?.bugs ?? 0}` }),
      new Paragraph({ text: `Vulnerabilities: ${scanData?.metrics?.vulnerabilities ?? 0}` }),
    ];

    if (includeSecurityAnalysis) {
      const securityIssues = this.sharedDataService.securityIssuesValue as SecurityIssueDTO[];
      const metrics = this.securityService.calculate(securityIssues);
      const owaspCoverage = this.securityService.calculateOwaspCoverage(securityIssues);
      const hotIssues = this.sharedDataService.hotIssuesValue;

      children.push(new Paragraph({ text: '', spacing: { after: 400 } }));
      children.push(new Paragraph({ text: 'Security Analysis', heading: HeadingLevel.HEADING_2 }));

      children.push(new Paragraph({ text: 'OWASP Top 10 Breakdown:', spacing: { before: 200 } }));
      owaspCoverage.forEach(owasp => {
        const statusIcon = owasp.status === 'pass' ? '[PASS]' : owasp.status === 'warning' ? '[WARN]' : '[FAIL]';
        children.push(new Paragraph({ text: `  ${owasp.name}: ${owasp.count} issues ${statusIcon}` }));
      });

      children.push(new Paragraph({ text: 'Vulnerability Severity:', spacing: { before: 200 } }));
      metrics.vulnerabilities.forEach(v => {
        children.push(new Paragraph({ text: `  ${v.severity}: ${v.count}` }));
      });

      children.push(new Paragraph({ text: 'Top 5 Security Hotspots:', spacing: { before: 200 } }));
      const top5 = hotIssues.slice(0, 5);
      if (top5.length > 0) {
        top5.forEach(h => {
          children.push(new Paragraph({ text: `  ${h.name}: ${h.count}` }));
        });
      } else {
        children.push(new Paragraph({ text: '  No hotspots detected' }));
      }
    }

    const doc = new Document({ sections: [{ children }] });

    const filename = `report-${projectName}-${this.dateFrom}-to-${this.dateTo}.docx`;
    Packer.toBlob(doc).then(blob => {
      saveAs(blob, filename);
      this.loading = false;
    });
  }

  // ==================== PowerPoint Export ====================
  exportToPowerPoint(projectName: string) {
    this.loading = true;
    const repo = this.sharedDataService.repositoriesValue.find(r => r.name === projectName);
    if (!repo) { this.loading = false; return; }

    const scans = repo.scans || [];
    const filteredScans = scans.filter(scan => {
      const scanDate = scan.startedAt ? new Date(scan.startedAt).toISOString().split('T')[0] : '';
      return scanDate >= this.dateFrom! && scanDate <= this.dateTo!;
    });
    const latestScan = filteredScans.length > 0
      ? filteredScans.sort((a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime())[0]
      : null;

    if (!latestScan || !latestScan.scanId) {
      this.createPowerPointReport(projectName, null);
      return;
    }

    this.scanService.getScanById(latestScan.scanId).subscribe({
      next: (fullScan) => {
        this.createPowerPointReport(projectName, fullScan);
      },
      error: () => {
        this.createPowerPointReport(projectName, null);
      }
    });
  }

  private createPowerPointReport(projectName: string, scanData: ScanResponseDTO | null) {
    const pptx = new pptxgen();
    pptx.author = 'Code Review System';
    pptx.title = 'Code Review Report';

    // Slide 1 - Title
    const slide1 = pptx.addSlide();
    slide1.addText('Code Review Report', { x: 0.5, y: 2, w: '90%', h: 1, fontSize: 44, bold: true, align: 'center' });
    slide1.addText(`Project: ${projectName}`, { x: 0.5, y: 3.2, w: '90%', h: 0.5, fontSize: 24, align: 'center' });
    slide1.addText(`Date Range: ${this.dateFrom} - ${this.dateTo}`, { x: 0.5, y: 3.8, w: '90%', h: 0.5, fontSize: 18, align: 'center' });

    // Slide 2 - Summary
    const slide2 = pptx.addSlide();
    slide2.addText('Quality Gate Summary', { x: 0.5, y: 0.3, w: '90%', h: 0.5, fontSize: 28, bold: true });

    const status = scanData?.qualityGate === 'OK' ? 'Passed' : (scanData ? 'Failed' : 'N/A');

    const rows: any[] = [
      ['Status', status],
      ['Reliability', this.formatRating(scanData?.metrics?.reliabilityRating)],
      ['Security', this.formatRating(scanData?.metrics?.securityRating)],
      ['Maintainability', this.formatRating(scanData?.metrics?.maintainabilityRating)],
      ['Bugs', String(scanData?.metrics?.bugs ?? 0)],
      ['Vulnerabilities', String(scanData?.metrics?.vulnerabilities ?? 0)]
    ];

    slide2.addTable(rows, { x: 1, y: 1.2, w: 8, h: 3, border: { type: 'solid', color: 'CFCFCF' } });

    // Slide 3 - Security Analysis (if selected)
    const includeSecurityAnalysis = this.sections.find(s => s.key === 'SecurityAnalysis')?.selected;
    if (includeSecurityAnalysis) {
      const securityIssues = this.sharedDataService.securityIssuesValue as SecurityIssueDTO[];
      const metrics = this.securityService.calculate(securityIssues);
      const owaspCoverage = this.securityService.calculateOwaspCoverage(securityIssues);
      const hotIssues = this.sharedDataService.hotIssuesValue;

      const slide3 = pptx.addSlide();
      slide3.addText('Security Analysis', { x: 0.5, y: 0.3, w: '90%', h: 0.5, fontSize: 28, bold: true });

      // Vulnerability Severity Table
      slide3.addText('Vulnerability Severity', { x: 0.5, y: 1, w: 4, h: 0.4, fontSize: 16, bold: true });
      const vulnRows: any[] = metrics.vulnerabilities.map(v => [v.severity, String(v.count)]);
      slide3.addTable(vulnRows, { x: 0.5, y: 1.5, w: 4, h: 1.5, border: { type: 'solid', color: 'CFCFCF' } });

      // Top Hotspots
      slide3.addText('Top 5 Security Hotspots', { x: 5, y: 1, w: 4, h: 0.4, fontSize: 16, bold: true });
      const top5 = hotIssues.slice(0, 5);
      const hotRows: any[] = top5.length > 0
        ? top5.map(h => [h.name, String(h.count)])
        : [['No hotspots', '-']];
      slide3.addTable(hotRows, { x: 5, y: 1.5, w: 4, h: 1.5, border: { type: 'solid', color: 'CFCFCF' } });

      // OWASP Coverage
      slide3.addText('OWASP Top 10 Issues', { x: 0.5, y: 3.5, w: '90%', h: 0.4, fontSize: 16, bold: true });
      const owaspWithIssues = owaspCoverage.filter(o => o.count > 0);
      const owaspRows: any[] = owaspWithIssues.length > 0
        ? owaspWithIssues.map(o => [o.name, String(o.count), o.status === 'fail' ? 'FAIL' : 'WARN'])
        : [['No OWASP issues', '-', 'PASS']];
      slide3.addTable(owaspRows, { x: 0.5, y: 4, w: 9, h: 1.5, border: { type: 'solid', color: 'CFCFCF' } });
    }

    const filename = `report-${projectName}-${this.dateFrom}-to-${this.dateTo}.pptx`;
    pptx.writeFile({ fileName: filename }).then(() => {
      this.loading = false;
    });
  }

  private downloadFile(blob: Blob, filename: string) {
    const ext = blob.type === 'application/zip' ? 'zip' : this.outputFormat;
    const link = document.createElement('a');
    const url = window.URL.createObjectURL(blob);
    link.href = url;
    link.download = `report-${filename}.${ext}`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  onGenerate(form: NgForm) {
    if (this.isFormValid(form)) {
      this.generateReport();
    } else {
      console.warn('Form is invalid');
    }
  }

  formatMap: Record<string, string> = {
    "PDF": "pdf",
    "Excel": "xlsx",
    "Word": "docx",
    "PowerPoint": "pptx"
  };
}
