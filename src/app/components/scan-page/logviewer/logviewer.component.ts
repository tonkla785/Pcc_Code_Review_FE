import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { ActivatedRoute } from '@angular/router';
import { Scan, ScanService } from '../../../services/scanservice/scan.service';
import { DebtTimePipe } from '../../../pipes/debt-time.pipe';
import { ThbCurrencyPipe } from '../../../pipes/thb-currency.pipe';
import { ScannerType, ScanLog, Severity, GroupedIssues } from '../../../interface/scan_page_interface';

@Component({
  selector: 'app-logviewer',
  standalone: true,
  imports: [CommonModule, DebtTimePipe, ThbCurrencyPipe],
  templateUrl: './logviewer.component.html',
  styleUrl: './logviewer.component.css'
})
export class LogviewerComponent {
  constructor(private sharedData: SharedDataService, private route: ActivatedRoute, private readonly scanService: ScanService) { }


  groupedIssues!: GroupedIssues;
  majorIssues: any[] = [];
  criticalIssues: any[] = [];
  scanResult: ScanResponseDTO | null = null;
  pageSize = 5;
  currentPageMajor = 1;
  currentPageCritical = 1;

  ngOnInit(): void {
    // Subscribe to selected scan for real-time updates
    this.sharedData.selectedScan$.subscribe(data => {
      this.scanResult = data;
      if (data) {
        this.groupedIssues = this.countIssues(data.issueData ?? []);
        this.majorIssues = this.groupedIssues.MAJOR;
        this.criticalIssues = this.groupedIssues.CRITICAL;
      }
    });

    // Subscribe to scans history for real-time updates when new scans are added
    this.sharedData.scansHistory$.subscribe(scans => {
      if (!scans || !this.scanResult?.id) return;

      // Check if current scan was updated in history
      const updatedScan = scans.find(s => s.id === this.scanResult?.id);
      if (updatedScan && updatedScan !== this.scanResult) {
        this.scanResult = updatedScan;
        this.sharedData.ScansDetail = updatedScan;
        this.groupedIssues = this.countIssues(updatedScan.issueData ?? []);
        this.majorIssues = this.groupedIssues.MAJOR;
        this.criticalIssues = this.groupedIssues.CRITICAL;
      }
    });

    this.route.paramMap.subscribe(pm => {
      const id = pm.get('scanId');
      if (!id) return;

      console.log('log from route:', id);

      // ถ้ามี cache และเป็น id เดียวกัน  ไม่ต้อง fetch
      const cached = this.sharedData.ScansDetail;
      if (cached?.id === id) {
        this.scanResult = cached;
        this.groupedIssues = this.countIssues(cached.issueData ?? []);
        this.majorIssues = this.groupedIssues.MAJOR;
        this.criticalIssues = this.groupedIssues.CRITICAL;
        return;
      }
      // ถ้าไม่ตรง → โหลดใหม่
      this.loadScanDetails(id);
    });
  }

  loadScanDetails(scanId: string) {
    this.sharedData.setLoading(true);
    this.scanService.getScanById(scanId).subscribe({
      next: (data) => {
        this.sharedData.ScansDetail = data;
        this.sharedData.setLoading(false);
        this.groupedIssues = this.countIssues(data.issueData ?? []);
        this.majorIssues = this.groupedIssues.MAJOR;
        this.criticalIssues = this.groupedIssues.CRITICAL;
      },
      error: () => this.sharedData.setLoading(false)
    });
  }

  countIssues(issues: any[]): GroupedIssues {
    return issues.reduce<GroupedIssues>((acc, issue) => {
      const sev = issue.severity as Severity;
      if (sev === 'MAJOR') acc.MAJOR.push(issue);
      if (sev === 'CRITICAL') acc.CRITICAL.push(issue);

      return acc;
    }, { MAJOR: [], CRITICAL: [] });
  }

  getDurationSeconds(startedAt?: string, completedAt?: string): string | null {
    if (!startedAt || !completedAt) return null;

    const diffSec = Math.floor(
      Math.abs(
        new Date(completedAt).getTime() -
        new Date(startedAt).getTime()
      ) / 1000
    );

    const minutes = Math.floor(diffSec / 60);
    const seconds = diffSec % 60;

    return `${minutes} minutes :${seconds.toString().padStart(2, '0')} seconds `;
  }

  get totalPagesMajor(): number {
    return Math.ceil(this.majorIssues.length / this.pageSize);
  }
  get totalPagesCritical(): number {
    return Math.ceil(this.criticalIssues.length / this.pageSize);
  }

  get pagedMajorIssues() {
    const start = (this.currentPageMajor - 1) * this.pageSize;
    return this.majorIssues.slice(start, start + this.pageSize);
  }
  get pagedCritical() {
    const start = (this.currentPageCritical - 1) * this.pageSize;
    return this.criticalIssues.slice(start, start + this.pageSize);
  }

  prevPageMajor() {
    if (this.currentPageMajor > 1) {
      this.currentPageMajor--;
    }
  }

  nextPageMajor() {
    if (this.currentPageMajor < this.totalPagesMajor) {
      this.currentPageMajor++;
    }
  }
  prevPageCritical() {
    if (this.currentPageCritical > 1) {
      this.currentPageCritical--;
    }
  }

  nextPageCritical() {
    if (this.currentPageCritical < this.totalPagesCritical) {
      this.currentPageCritical++;
    }
  }
  /**
   * Compute log dynamically from SharedDataService
   * scannerType is determined by:
   * - ANGULAR → 'npm sonar'
   * - SPRING_BOOT with maven → 'mvn sonar'  
   * - SPRING_BOOT with gradle → 'gradle sonar'
   */
  get log(): ScanLog {
    const repo = this.sharedData.selectedRepositoryValue;
    const scan = this.scanResult;

    // Get projectType from repo or from scan.project
    const projectType = repo?.projectType || scan?.project?.projectType;

    // Determine scanner type based on project type and build tool
    let scannerType: ScannerType = 'npm sonar';

    if (projectType === 'SPRING_BOOT') {
      // Check buildTool from sonarConfig in localStorage
      const sonarConfig = this.getSonarConfigFromStorage();
      const buildTool = sonarConfig?.springSettings?.buildTool || 'maven';
      scannerType = buildTool === 'gradle' ? 'gradle sonar' : 'mvn sonar';
    }

    return {
      applicationName: repo?.name || scan?.project?.name || 'Unknown Project',
      timestamp: scan?.startedAt ? new Date(scan.startedAt) : new Date(),
      filename: `${(repo?.name || scan?.project?.name || 'scan').replace(/\s+/g, '-')}-log${this.formatDateForFilename(scan?.startedAt)}.md`,
      content: {
        scannerType
      }
    };
  }

  private getSonarConfigFromStorage(): any {
    try {
      const raw = localStorage.getItem('sonarConfig_v1');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private formatDateForFilename(dateStr?: string): string {
    const date = dateStr ? new Date(dateStr) : new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  // ปุ่มย้อนกลับ
  goBack(): void {
    window.history.back();
  }

  // ปุ่มดาวน์โหลด Markdown
  downloadLog(): void {
    const content = this.generateMarkdown();
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const appName = this.log.applicationName?.replace(/\s+/g, '_') ?? 'scan';
    const date = new Date(this.log.timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    const filename = `Log_${appName}_${y}${m}${d}.md`;

    a.href = url;
    a.download = filename;
    a.click();

    window.URL.revokeObjectURL(url);
  }

  // ปุ่มส่งอีเมล (mailto)
  sendEmail(): void {
  const subject = `Scan Report: ${this.log.applicationName}`;
  const body = encodeURIComponent(this.generateMarkdown());
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}


  // ปุ่มปริ้น
  printLog(): void {
    window.print();
  }

  // แปลง log → Markdown
  generateMarkdown(): string {
    const scan = this.scanResult;
    const metrics = scan?.metrics;

    // คำนวณ duration (วินาที)
    let duration = '-';
    if (scan?.startedAt && scan?.completedAt) {
      const start = new Date(scan.startedAt).getTime();
      const end = new Date(scan.completedAt).getTime();
      const diffMs = end - start;
      duration = (diffMs / 1000).toFixed(2);
    }

    // Format date
    const formatDate = (date: string | number | undefined) => {
      if (!date) return '-';
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    };

    // Quality Gate: แปลง OK → Passed
    const qualityGate = scan?.qualityGate === 'OK' ? 'Passed' : (scan?.qualityGate === 'ERROR' ? 'Failed' : scan?.qualityGate ?? '-');

    // Details Analysis logs
    let detailsAnalysis = '';
    if (metrics?.analysisLogs && metrics.analysisLogs.length > 0) {
      detailsAnalysis = metrics.analysisLogs.map(log => {
        const timestamp = log.timestamp ? formatDate(log.timestamp) : '';
        return `- ${log.message} (${timestamp})`;
      }).join('\n');
    } else {
      detailsAnalysis = 'No analysis logs available.';
    }

    return `# Scan Report: ${this.log.applicationName}
## Date: ${formatDate(scan?.startedAt)}

### Execution Summary
- **Status**: ${scan?.status ?? '-'}
- **Duration**: ${duration} seconds
- **Scanner Type**: ${this.log.content.scannerType}

### SonarQube Results
- **Quality Gate**: ${qualityGate}
- **Coverage**: ${metrics?.coverage ?? '-'}%
- **Bugs**: ${metrics?.bugs ?? '-'}
- **Vulnerabilities**: ${metrics?.vulnerabilities ?? '-'}
- **Code Smells**: ${metrics?.codeSmells ?? '-'}

### Details Analysis
${detailsAnalysis}
`;
  }

  
}
