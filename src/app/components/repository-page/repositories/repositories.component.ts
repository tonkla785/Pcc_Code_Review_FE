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
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { WebSocketService, ScanEvent } from '../../../services/websocket/websocket.service';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-repositories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './repositories.component.html',
  styleUrl: './repositories.component.css'
})
export class RepositoriesComponent implements OnInit {
  private wsSub?: any; //กัน subscribe ซ้ำ/ค้างเวลาเปลี่ยนหน้า
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
    private sharedData: SharedDataService,
    private readonly router: Router,
    private readonly repoService: RepositoryService,
    private readonly scanService: ScanService,
    private readonly authService: AuthService,
    private readonly issueService: IssueService,
    private readonly snack: MatSnackBar,
    private readonly ws: WebSocketService
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    const nav = this.router.getCurrentNavigation();
    const message = nav?.extras?.state?.['message'];

    if (message) {
      this.snack.open(message, '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-green']
      });
    }

    // 1. Subscribe รับข้อมูลจาก SharedDataService
    this.sharedData.repositories$.subscribe(repos => {
      this.repositories = repos;

      this.filteredRepositories = this.sortRepositories([...repos]);
      this.updateSummaryStats();
    });

    // 2. ถ้ายังไม่มี data Cache Fetch API ใหม่ (ถ้ามีแล้วใช้ของเดิม เพื่อรักษา Status 'Scanning')
    if (!this.sharedData.hasRepositoriesCache) {
      this.loadRepositories();
    }

    // ฟังการเปลี่ยนแปลง Quality Gates
    this.sharedData.qualityGates$
      .subscribe(gates => {
        if (!gates) return;

        console.log('QualityGates updated:', gates);

        if (!gates.failOnError) {
          this.repoService.getAllRepo().subscribe(repos => {
            this.sharedData.setRepositories(repos);
          });
          return;
        }

        //recalculated quality gate ใหม่
        const recalculated = this.repositories.map(repo => {
          if (!repo.metrics) return repo;

          return {
            ...repo,
            qualityGate: this.repoService.evaluateQualityGate(repo.metrics, gates)
          };
        });

        this.repositories = recalculated;
        this.filteredRepositories = this.sortRepositories([...recalculated]);
        this.updateSummaryStats();
      });


    // WebSocket logic moved to AppComponent for global updates

  }

  loadRepositories() {
    this.sharedData.setLoading(true);

    this.repoService.getAllRepo().subscribe({
      next: (repos) => {
        // เก็บข้อมูลลง SharedDataService
        this.sharedData.setRepositories(repos);
        this.sharedData.setLoading(false);
        console.log('Repositories loaded:', repos);

        this.filteredRepositories = this.sortRepositories([...repos]);
        this.updateSummaryStats();
      },
      error: (err) => {
        console.error('Failed to load repositories:', err);
        this.sharedData.setLoading(false);
      }
    });
  }

  goToAddRepository() {
    this.router.navigate(['/addrepository']);
  }

  searchRepositories(event: Event): void {
    const keyword = (event.target as HTMLInputElement).value
      .trim()
      .toLowerCase();

    this.searchText = keyword;
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
    // 1. Filter by Tab & Status first (Base List)
    const baseList = this.repositories.filter(repo =>
      (this.activeFilter === 'all' || repo.projectType?.toLowerCase().includes(this.activeFilter.toLowerCase())) &&
      (this.selectedStatus === 'all' || repo.status === this.selectedStatus)
    );

    // 2. Handle Search Logic
    if (this.searchText) {
      const matched = baseList.filter(repo =>
        repo.name.toLowerCase().includes(this.searchText) ||
        repo.projectType?.toLowerCase().includes(this.searchText)
      );

      const others = baseList.filter(repo =>
        !repo.name.toLowerCase().includes(this.searchText) &&
        !repo.projectType?.toLowerCase().includes(this.searchText)
      );

      if (matched.length > 0) {
        // ถ้าเจอ: เอาตัวที่เจอขึ้นก่อน + ตามด้วยตัวที่ไม่เจอ (Reorder)
        this.filteredRepositories = [
          ...this.sortRepositories(matched),
          ...this.sortRepositories(others)
        ];
      } else {
        // ถ้าไม่เจอเลย: ให้เป็นว่าง (เพื่อขึ้น No Data)
        this.filteredRepositories = [];
      }
    } else {
      // No search: Show all filtered by Tab/Status
      this.filteredRepositories = this.sortRepositories(baseList);
    }

    this.updateSummaryStats();
  }

  countByType(framework: 'ANGULAR' | 'SPRING_BOOT'): number {
    return this.repositories.filter(
      repo => repo.projectType === framework
    ).length;
  }


  updateSummaryStats(): void {
    this.summaryStats = [
      {
        label: 'Total Repositories',
        count: this.repositories.length,
        icon: 'bi bi-database',
        bg: 'bg-primary'
      },
      {
        label: 'Active',
        count: this.repositories.filter(r => r.status === 'Active').length,
        icon: 'bi bi-check-circle-fill',
        bg: 'bg-success'
      },
      {
        label: 'Scanning',
        count: this.repositories.filter(r => r.status === 'Scanning').length,
        icon: 'bi bi-arrow-repeat',
        bg: 'bg-info'
      },
      {
        label: 'Error',
        count: this.repositories.filter(r => r.status === 'Error').length,
        icon: 'bi bi-exclamation-circle-fill',
        bg: 'bg-danger'
      }
    ];
  }

  private mapStatus(
    wsStatus: string
  ): 'Active' | 'Scanning' | 'Error' {
    switch (wsStatus) {
      case 'SCANNING':
        return 'Scanning';
      case 'SUCCESS':
        return 'Active';
      case 'FAILED':
        return 'Error';
      default:
        return 'Active'; // fallback ที่ปลอดภัย
    }
  }

  runScan(repo: Repository) {
    if (repo.status === 'Scanning') return;

    if (!repo.projectId) {
      console.warn('No projectId for repo, cannot start scan');
      return;
    }

    // update UI
    repo.status = 'Scanning';
    repo.scanningProgress = 0;
    this.updateSummaryStats();

    this.repoService.startScan(repo.projectId, 'main').subscribe({
      next: () => {
        this.snack.open(`Scan started: ${repo.name}`, '', {
          duration: 2500,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-green']
        });

        // ตอนนี้ยังไม่รู้ว่า scan เสร็จเมื่อไร
        // ปล่อย status เป็น Scanning ไว้
      },
      error: (err) => {
        console.error('Scan failed:', err);
        repo.status = 'Error';
        repo.scanningProgress = 0;
        this.updateSummaryStats();

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

  //ตัวแปรใน class
  showScanModal: boolean = false;
  selectedRepo: Repository | null = null;
  scanUsername: string = '';
  scanPassword: string = '';

  //เปิด modal
  openScanModal(repo: Repository) {
    this.selectedRepo = repo;
    this.scanUsername = '';
    this.scanPassword = '';
    this.showScanModal = true;
  }

  //ปิด modal
  closeScanModal() {
    this.showScanModal = false;
    this.selectedRepo = null;
  }

  //กด Start Scan
  confirmScan(form: any) {
    if (!form.valid || !this.selectedRepo) return;

    // เรียก runScan
    this.runScan(this.selectedRepo);

    // ปิด modal
    this.closeScanModal();
  }

  editRepo(repo: Repository) {
    this.router.navigate(['/settingrepo', repo.projectId]);
    console.log('Editing repo:', repo.projectId);
  }

  viewRepo(repo: Repository): void {
    this.router.navigate(['/detailrepo', repo.projectId, repo.scanId]);
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
  onDelete(repo: Repository) {
    // กัน null / undefined แบบชัดเจน
    if (!repo?.projectId) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Data',
        text: 'Repository project ID not found',
      });
      return;
    }

    Swal.fire({
      title: 'Confirm Delete Repository',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {

        // Loading while deleting
        Swal.fire({
          title: 'Deleting...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        this.repoService.deleteRepo(repo.projectId!).subscribe({
          next: () => {
            this.sharedData.removeRepository(repo.projectId!);
            Swal.fire({
              icon: 'success',
              title: 'Deleted Successfully',
              text: 'Repository has been deleted',
              timer: 1800,
              showConfirmButton: false
            });
            this.repoService.getAllRepo().subscribe(repos => {
              this.sharedData.setRepositories(repos);
              this.router.navigate(['/repositories']);
            });
          },
          error: () => {
            Swal.fire({
              icon: 'error',
              title: 'Delete Failed',
              text: 'An error occurred while deleting the repository',
            });
          }
        });
      }
    });
  }



}