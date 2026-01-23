import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { ActivatedRoute } from '@angular/router';
import { Scan, ScanService } from '../../../services/scanservice/scan.service';
interface SonarResults {
  qualityGate: 'Passed' | 'Failed';
  coverage: number;
  bugs: number;
  vulnerabilities: number;
  codeSmells: number;
}

interface ScanLog {
  applicationName: string;
  timestamp: Date;
  filename: string; // format: application-name-logYYYYMMDD.md
  content: {
    startTime: Date;
    endTime: Date;
    duration: number;
    status: 'success' | 'failed';
    scannerType: 'npm sonar' | 'mvn sonar' | 'gradle sonar';
    sonarResults?: SonarResults;
    errors?: string[];
    warnings?: string[];
    details?: string[];
  };
}
type Severity = 'MAJOR' | 'MINOR';
interface GroupedIssues {
  MAJOR: any[];
  MINOR: any[];
}
@Component({
  selector: 'app-logviewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logviewer.component.html',
  styleUrl: './logviewer.component.css'
})
export class LogviewerComponent {
constructor(private sharedData: SharedDataService, private route: ActivatedRoute, private readonly scanService: ScanService) { }


  groupedIssues!: GroupedIssues;
  majorIssues: any[] = [];
  minorIssues: any[] = [];
    scanResult: ScanResponseDTO | null = null;


     ngOnInit(): void {
      this.sharedData.selectedScan$.subscribe(data => { 
        this.scanResult = data;
      });
    this.route.paramMap.subscribe(pm => {
      const id = pm.get('scanId');
      if (!id) return;

      console.log('log from route:', id);

      // ถ้ามี cache และเป็น id เดียวกัน  ไม่ต้อง fetch
      const cached = this.sharedData.ScansDetail;
      if (cached?.id === id) {
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
      this.minorIssues = this.groupedIssues.MINOR;

      console.log('MAJOR:', this.majorIssues);
      console.log('MINOR:', this.minorIssues);
        console.log('Scan Log loaded:', data);
      },
      error: () => this.sharedData.setLoading(false)
    });
  }

  countIssues(issues: any[]): GroupedIssues {
  return issues.reduce<GroupedIssues>((acc, issue) => {
    const sev = issue.severity as Severity;
    if (sev === 'MAJOR') acc.MAJOR.push(issue);
    if (sev === 'MINOR') acc.MINOR.push(issue);

    return acc;
  }, { MAJOR: [], MINOR: [] });
}

  getDurationSeconds(startedAt?: string, completedAt?: string): number | null {
  if (!startedAt || !completedAt) return null;

  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();

  const diff = Math.abs(end - start);

  return Math.floor(diff / 1000);
}
  log: ScanLog = {
    applicationName: 'Angular-App',
    timestamp: new Date('2024-01-15T10:30:45'),
    filename: 'angular-app-log20240115.md',
    content: {
      startTime: new Date('2024-01-15T10:30:45'),
      endTime: new Date('2024-01-15T10:36:17'),
      duration: 332,
      status: 'success',
      scannerType: 'npm sonar',
      sonarResults: {
        qualityGate: 'Passed',
        coverage: 78.5,
        bugs: 3,
        vulnerabilities: 1,
        codeSmells: 45
      },
      details: [
        '[10:30:45] Starting code review process...',
        '[10:30:46] Cloning repository from GitHub...',
        '[10:31:12] Repository cloned successfully',
        '[10:31:13] Detecting project type: Angular',
        '[10:31:14] Installing dependencies...',
        '[10:32:45] Running npm sonar scanner...',
        '[10:35:30] Analysis completed successfully',
        '[10:35:32] Fetching results from SonarQube...',
        '[10:35:35] Report generation completed'
      ],
      warnings: [
        '[10:33:00] Deprecated API usage detected',
        '[10:34:12] Unused variable in module app.component.ts'
      ],
      errors: [
        '[10:31:50] Failed to fetch remote dependency',
        '[10:34:45] Type error in service user.service.ts'
      ]
    }
  };

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
    const c = this.log.content;
    const sonar = c.sonarResults;
    return `# Scan Report: ${this.log.applicationName}
## Date: ${this.log.timestamp}

### Execution Summary
- **Status**: ${c.status}
- **Duration**: ${c.duration} seconds
- **Scanner Type**: ${c.scannerType}

### SonarQube Results
- **Quality Gate**: ${sonar?.qualityGate ?? '-'}
- **Coverage**: ${sonar?.coverage ?? 0}%
- **Bugs**: ${sonar?.bugs ?? 0}
- **Vulnerabilities**: ${sonar?.vulnerabilities ?? 0}
- **Code Smells**: ${sonar?.codeSmells ?? 0}

### Details
${c.details?.join('\n') ?? 'No details'}

### Warnings
${c.warnings?.join('\n') ?? 'None'}

### Errors
${c.errors?.join('\n') ?? 'None'}
`;
  }


}
