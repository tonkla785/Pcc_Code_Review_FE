import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { RepositoryService } from '../../../services/reposervice/repository.service';
import { RepositoryAll } from '../../../interface/repository_interface';
import { ScanIssue } from '../../../interface/repository-scan-issue.interface';
import { Scan, ScanService } from '../../../services/scanservice/scan.service';
import { Issue } from '../../../services/issueservice/issue.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';


@Component({
  selector: 'app-detailrepository',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './detailrepository.component.html',
  styleUrls: ['./detailrepository.component.css']
})
export class DetailrepositoryComponent implements OnInit, OnDestroy {

  issues: ScanIssue[] = [];
  scanId!: string;
  repoId!: string;
  repo!: RepositoryAll;
  scans: Scan[] = [];

  get repoStatus(): string {
    if (!this.repo || !this.repo.scanData || this.repo.scanData.length === 0) return 'Unknown';

    const latest = this.scans[0];
    if (!latest) return 'Active';

    // latest.status is now mapped to 'Active' | 'Scanning' | 'Error'
    return latest.status;
  }

  // Helper to map API status to UI status
  private mapScanStatus(status: string): any {
    const s = (status || '').toUpperCase();
    if (s === 'PENDING' || s === 'IN_PROGRESS' || s === 'SCANNING') return 'Scanning';
    if (s === 'FAILED' || s === 'ERROR') return 'Error';
    if (s === 'SUCCESS' || s === 'ACTIVE') return 'Active';
    return 'Active'; // default
  }

  get lastScanDate(): Date | undefined {
    return this.scans[0]?.completedAt;
  }

  get currentQualityGate(): string | undefined {
    return this.scans[0]?.qualityGate;
  }

  activeTab: 'overview' | 'bugs' | 'history' = 'overview';
  loading: boolean = true;
  private scanInterval?: any;

  constructor(
    private sharedData: SharedDataService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly repoService: RepositoryService,
    private readonly scanService: ScanService,
    private readonly authService: AuthService
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    this.repoId = this.route.snapshot.paramMap.get('projectId') ?? '';
    this.scanId = this.route.snapshot.paramMap.get('scanId') ?? '';

    if (!this.repoId || !this.scanId) {
      console.warn('Missing projectId or scanId');
      return;
    }

    console.log('Loading repository:', this.repoId, 'scan:', this.scanId);

    this.loadRepositoryFull(this.repoId);
    this.loadScanIssues(this.scanId);

    // ฟังการเปลี่ยนแปลง Quality Gates
    this.sharedData.qualityGates$
      .subscribe(gates => {
        if (!gates) return;

        // reload เฉพาะ repo นี้
        this.loadRepositoryFull(this.repoId);
      });

  }


  loadRepositoryFull(repoId: string): void {
    this.loading = true;
    this.repoService.getRepositoryWithScans(repoId).subscribe({
      next: (repo: RepositoryAll) => {
        if (repo) {
          this.repo = repo;
          this.scans = (repo.scanData ?? [])
            .map((s: any) => ({
              ...s,
              // Map ScanData to match Scan interface if needed, or update usage.
              // Assuming Scan interface is compatible or we map simply:
              scanId: s.id,
              status: this.mapScanStatus(s.status), // Map status here
              startedAt: s.startedAt,
              completedAt: s.completedAt,
              qualityGate: s.qualityGate || '',
              metrics: s.metrics,
              logFilePath: s.logFilePath
            }))
            .filter((scan: any) => scan.completedAt)
            .sort((a: any, b: any) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
          this.issues = []; // ScanData doesn't carry issues directly in RepositoryAll usually, check usage
        }
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Failed to load repository details', err);
        this.loading = false;
      }
    });
  }

  loadScanIssues(scanId: string): void {
    this.scanService.getScanById(scanId).subscribe({
      next: (scan) => {
        this.issues = (scan.issueData ?? [])
          .filter((i: any) =>
            i.type === 'BUG' || i.type === 'VULNERABILITY'
          )
          .map((i: any): ScanIssue => ({
            id: i.id,
            scanId: scan.id,
            issueKey: i.issueKey,
            type: i.type,
            severity: i.severity,
            component: i.component,
            message: i.message,
            status: i.status,
            createdAt: i.createdAt,
            assignedTo: i.assignedTo
          }));

        console.log('Loaded scan issues:', this.issues);
      },
      error: (err) => {
        console.error('Failed to load scan issues', err);
      }
    });
  }



  switchTab(tab: 'overview' | 'bugs' | 'history') {
    this.activeTab = tab;
  }

  editRepo(repo: RepositoryAll) {
    this.router.navigate(['/settingrepo', repo.id]);
  }

  getStatusClass(status?: string) {
    switch (status) {
      case 'Active': case 'SUCCESS': return 'badge bg-success';
      case 'Scanning': return 'badge bg-primary';
      case 'Error': return 'badge bg-danger';
      case 'Cancelled': return 'badge bg-secondary';
      default: return 'badge bg-light text-dark';
    }
  }

  getQualityGateClass(qualityGate: string): string {
    switch (qualityGate.toLowerCase()) {
      case 'passed': return 'active';
      case 'failed': return 'failed';
      case 'warning': return 'paused';
      case 'scanning': return 'scanning';
      default: return '';
    }
  }

  ngOnDestroy(): void {
    // Clean up interval to prevent memory leaks
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
  }
}