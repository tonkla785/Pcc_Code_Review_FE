import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Repository, RepositoryService } from '../../../services/reposervice/repository.service';
import { Scan, ScanService } from '../../../services/scanservice/scan.service';
import { Issue } from '../../../services/issueservice/issue.service';
import { AuthService } from '../../../services/authservice/auth.service';


@Component({
  selector: 'app-detailrepository',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './detailrepository.component.html',
  styleUrls: ['./detailrepository.component.css']
})
export class DetailrepositoryComponent implements OnInit, OnDestroy {

  repoId!: string;
  repo!: Repository;
  scans: Scan[] = [];
  issues: Issue[] = [];
  activeTab: 'overview' | 'bugs' | 'history' = 'overview';
  loading: boolean = true;
  private scanInterval?: any;

  constructor(
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

    if (this.repoId) {
      this.loadRepositoryFull(this.repoId);
      console.log('Loading repository with ID:', this.repoId);
    }
  }

  loadRepositoryFull(repoId: string): void {
    this.loading = true;
    this.repoService.getFullRepositoryTest(repoId).subscribe({
      next: (repo) => {
        if (repo) {
          this.repo = repo;
          this.scans = (repo.scans ?? [])
            .filter(scan => scan.completedAt)
            .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
          this.issues = repo.issues ?? [];
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load repository details', err);
        this.loading = false;
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