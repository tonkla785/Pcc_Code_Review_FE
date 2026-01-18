import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Repository, RepositoryService } from '../../../services/reposervice/repository.service';
import { ScanService } from '../../../services/scanservice/scan.service';
import { Issue, IssueService } from '../../../services/issueservice/issue.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { forkJoin } from 'rxjs';
import { SseService } from '../../../services/scanservice/sse.service';        // <-- added
import { MatSnackBar } from '@angular/material/snack-bar';


@Component({
  selector: 'app-repositories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './repositories.component.html',
  styleUrl: './repositories.component.css'
})
export class RepositoriesComponent implements OnInit {
  repositories: Repository[] = [];
  filteredRepositories: Repository[] = [];
  issues: Issue[] = [];
  summaryStats: { label: string; count: number; icon: string; bg: string }[] = [];
  searchText: string = '';
  activeFilter: string = 'all';
  selectedStatus: string = 'all';
  loading: boolean = false;
  fetch: boolean = false;
  constructor(
    private readonly router: Router,
    private readonly repoService: RepositoryService,
    private readonly scanService: ScanService,
    private readonly authService: AuthService,
    private readonly issueService: IssueService,
    private readonly snack: MatSnackBar,
    private readonly sse: SseService               // <-- added

  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    // TODO: Get userId from token when available
    this.fetchFromServer('');
  }

  fetchFromServer(userId: string | number) {
    this.loading = true;

    forkJoin({
      repositories: this.repoService.getRepositoriesWithScans(),
      issues: this.issueService.getAllIssue(String(userId)) // ดึง Issue ทั้งหมดของ user
    }).subscribe({
      next: ({ repositories, issues }) => {
        // map Issue ให้ repository
        this.repositories = repositories.map(repo => {
          const repoIssues = issues.filter(issue => issue.projectId === repo.projectId);
          return {
            ...repo,
            issues: repoIssues  // เพิ่ม field issues
          };
        });

        this.filteredRepositories = this.sortRepositories([...this.repositories]);
        this.updateSummaryStats();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching repositories/issues:', err);
        this.loading = false;
      }
    });
  }


  goToAddRepository() {
    this.router.navigate(['/addrepository']);
  }

  searchRepositories(event: Event): void {
    this.searchText = (event.target as HTMLInputElement).value.toLowerCase();
    this.applyFilters();
  }

  filterBy(framework: string): void {
    this.activeFilter = framework;
    this.applyFilters();
  }

  filterByStatus(): void {
    this.applyFilters();
  }

  private applyFilters(): void {
    this.filteredRepositories = this.repositories.filter(repo =>
      // 1. filter ตาม tab (framework)
      (this.activeFilter === 'all' || repo.projectType?.toLowerCase().includes(this.activeFilter.toLowerCase())) &&
      // 2. filter ตาม status
      (this.selectedStatus === 'all' || repo.status === this.selectedStatus) &&
      // 3. filter ตาม search text
      (this.searchText === '' ||
        repo.name.toLowerCase().includes(this.searchText) ||
        repo.projectType?.toLowerCase().includes(this.searchText))
    );

    this.filteredRepositories = this.sortRepositories(this.filteredRepositories);

    this.updateSummaryStats();
  }

  countByFramework(framework: string): number {
    return this.filteredRepositories.filter(repo =>
      repo.projectType?.toLowerCase().includes(framework.toLowerCase())
    ).length;
  }

  updateSummaryStats(): void {
    this.summaryStats = [
      { label: 'Total Repositories', count: this.filteredRepositories.length, icon: 'bi bi-database', bg: 'bg-primary' },
      { label: 'Active', count: this.filteredRepositories.filter(r => r.status === 'Active').length, icon: 'bi bi-check-circle-fill', bg: 'bg-success' },
      { label: 'Scanning', count: this.filteredRepositories.filter(r => r.status === 'Scanning').length, icon: 'bi bi-arrow-repeat', bg: 'bg-info' },
      { label: 'Error', count: this.filteredRepositories.filter(r => r.status === 'Error').length, icon: 'bi bi-exclamation-circle-fill', bg: 'bg-danger' }
    ];
  }

  runScan(repo: Repository) {
    if (repo.status === 'Scanning') return;

    // ถ้าไม่มียูส/พาส ให้เปิด modal เหมือนเดิม
    if (!repo.username || !repo.password) {
      this.openScanModal(repo);
      return;
    }

    // 🔑 ใช้ projectId เป็น key กลาง (ต้องไม่ null)
    const sseKey = repo.projectId;
    if (!sseKey) {
      console.warn('No projectId for repo, cannot open SSE');
      return;
    }

    console.log('[runScan] subscribe SSE with key =', sseKey);

    let sseSub: any = null;
    let interval: any = null;

    // สถานะตอนเริ่ม Scan
    repo.status = 'Scanning';
    repo.scanningProgress = 0;
    this.updateSummaryStats();

    // ✅ 1) เปิด SSE ก่อน ให้ "รอรับ" event เลย
    sseSub = this.sse.connect(sseKey).subscribe({
      next: (data) => {
        // อัปเดตตามผลจริงจาก backend
        repo.scanningProgress = 100;
        repo.status = this.scanService.mapStatus(data.status || 'SUCCESS');
        repo.lastScan = new Date();
        this.updateSummaryStats();

        this.snack.open(`Scan finished: ${repo.name}`, '', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-green']
        }); window.location.reload();;
        // เคลียร์ progress ปลอม ถ้ายังวิ่งอยู่
        if (interval) {
          clearInterval(interval);
        }

        // if (sseSub) {
        //   sseSub.unsubscribe();
        // }
      },
      error: (err) => {
        console.error('SSE error:', err);
        if (sseSub) {
          sseSub.unsubscribe();
          window.location.reload();
        }
        // ไม่ต้องเปลี่ยนหน้า แค่ปล่อยให้ progress ปลอมจบไป
      }
    });

    // ✅ 2) จากนั้นค่อยสั่ง startScan (หลังจากเปิด SSE แล้ว)
    this.scanService.startScan(
      repo.projectId!,
      {
        username: repo.username,
        password: repo.password,
      }
    ).subscribe({
      next: (res) => {
        console.log('Scan started successfully:', res);

        // progress ปลอม ๆ ไหลไปก่อน เผื่อ SSE ดีเลย์
        interval = setInterval(() => {
          repo.scanningProgress = Math.min((repo.scanningProgress ?? 0) + 15, 100);
          this.updateSummaryStats();

          // กรณี SSE ไม่มาเลย (เช่น backend ไม่ส่ง / key ไม่ตรง)
          if (repo.scanningProgress >= 100) {
            repo.status = this.scanService.mapStatus(res.status);
            repo.lastScan = new Date();
            clearInterval(interval);
            this.updateSummaryStats();
          }
        }, 1000);

        // ล้าง username/password หลัง scan เริ่ม
        setTimeout(() => {
          delete repo.username;
          delete repo.password;
        }, 1000);
      },
      error: (err) => {
        console.error('Scan failed:', err);
        repo.status = 'Error';
        repo.scanningProgress = 0;
        this.updateSummaryStats();

        if (sseSub) {
          sseSub.unsubscribe();
        }

        this.snack.open('Scan failed to start', '', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-red']
        });
      }
    });
  }







  resumeScan(repo: Repository) {
    this.runScan(repo);
  }

  // 🆕 ตัวแปรใน class
  showScanModal: boolean = false;
  selectedRepo: Repository | null = null;
  scanUsername: string = '';
  scanPassword: string = '';

  // 🆕 เปิด modal
  openScanModal(repo: Repository) {
    this.selectedRepo = repo;
    this.scanUsername = '';
    this.scanPassword = '';
    this.showScanModal = true;
  }

  // 🆕 ปิด modal
  closeScanModal() {
    this.showScanModal = false;
    this.selectedRepo = null;
  }

  // 🆕 กด Start Scan
  confirmScan(form: any) {
    if (!form.valid || !this.selectedRepo) return;

    // กำหนด username/password ชั่วคราว
    this.selectedRepo.username = this.scanUsername;
    this.selectedRepo.password = this.scanPassword;

    // เรียก runScan
    this.runScan(this.selectedRepo);

    // ปิด modal
    this.closeScanModal();
  }


  editRepo(repo: Repository) {
    this.router.navigate(['/settingrepo', repo.projectId]);
  }

  viewRepo(repo: Repository): void {
    this.router.navigate(['/detailrepo', repo.projectId]);
  }

  sortRepositories(list: Repository[]): Repository[] {
    return [...list].sort((a, b) => {
      const parseDate = (d?: string | Date): number => {
        if (!d) return 0;
        const dateStr = typeof d === 'string' ? d.split('.')[0] + 'Z' : d; // แก้ format
        const parsed = new Date(dateStr).getTime();
        return isNaN(parsed) ? 0 : parsed;
      };

      const dateA = parseDate(a.lastScan || a.createdAt);
      const dateB = parseDate(b.lastScan || b.createdAt);

      return dateB - dateA; // ล่าสุด → เก่าสุด
    });
  }


}