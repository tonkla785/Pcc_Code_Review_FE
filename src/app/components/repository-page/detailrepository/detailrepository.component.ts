import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Repository, RepositoryService, ScanIssue } from '../../../services/reposervice/repository.service';
import { Scan, ScanService } from '../../../services/scanservice/scan.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
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
  repo!: Repository;
  scans: ScanResponseDTO[] = [];
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

    // Subscribe to SharedData for real-time updates
    this.sharedData.repositories$.subscribe(repos => {
      const currentRepo = repos.find(r => r.projectId === this.repoId);
      if (currentRepo) {
        // Updated repo found (e.g. from global WS update)
        // Only update if we already have data or if it's the first load
        if (this.repo) {
          this.repo = { ...this.repo, ...currentRepo };
          // Update logic for scans if needed, or rely on reload
          if (this.repo.status !== 'Scanning' && currentRepo.status !== 'Scanning') {
            // If status changed to non-scanning, we might want to refresh history
            // But sharedData might not have full history unless we fetch it.
            // AppComponent fetches full repo on success, so currentRepo SHOULD have full data if it was just merged.
            if (currentRepo.scans) {
              this.scans = (currentRepo.scans ?? [])
                .filter(scan => scan.completedAt)
                .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
            }
          }
        }
      }
    });

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
    this.repoService.getFullRepository(repoId).subscribe({
      next: (repo) => {
        if (repo) {
          console.log('Detail Repo loaded:', repo); // Debug costPerDay
          this.repo = repo;
          this.scans = (repo.scans ?? [])
            .filter(scan => scan.completedAt)
            .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
          this.issues = repo.issues ?? [];

          // Sync with SharedData to ensure AppComponent can update it later
          const currentRepos = this.sharedData.repositoriesValue;
          const exists = currentRepos.find(r => r.projectId === repo.projectId);
          if (exists) {
            this.sharedData.updateRepository(repo.projectId!, repo);
          } else {
            this.sharedData.addRepository(repo);
          }
        }
        this.loading = false;
      },
      error: (err) => {
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

  editRepo(repo: Repository) {
    this.router.navigate(['/settingrepo', repo.projectId]);
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