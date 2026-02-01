import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RepositoryService } from '../../../services/reposervice/repository.service';
import { ScanService } from '../../../services/scanservice/scan.service';
import { Issue, IssueService } from '../../../services/issueservice/issue.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { WebSocketService, ScanEvent } from '../../../services/websocket/websocket.service';
import { RepositoryAll } from '../../../interface/repository_interface';
import { getLatestScanByStartedAt } from '../../../utils/format.utils';


@Component({
  selector: 'app-repositories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './repositories.component.html',
  styleUrl: './repositories.component.css'
})
export class RepositoriesComponent implements OnInit {
  private wsSub?: any; //กัน subscribe ซ้ำ/ค้างเวลาเปลี่ยนหน้า

  repositories: RepositoryAll[] = [];
  filteredRepositories: RepositoryAll[] = [];

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
    private readonly authService: AuthService,
    private readonly snack: MatSnackBar,
    private readonly ws: WebSocketService,
    private readonly scanService: ScanService
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

    // 2. เช็คว่ามีข้อมูลแล้วหรือยัง
    if (!this.sharedData.hasRepositoriesCache) {
      // 3. ถ้ายังไม่มี → Fetch API
      this.loadRepositoriesTest();
    }


    // ฟังการเปลี่ยนแปลง Quality Gates
    // this.sharedData.qualityGates$
    //   .subscribe(gates => {
    //     if (!gates) return;

    //     console.log('QualityGates updated:', gates);

    //     if (!gates.failOnError) {
    //       this.repoService.getAllRepo().subscribe(repos => {
    //         this.sharedData.setRepositories(repos);
    //       });
    //       return;
    //     }

    //     //recalculated quality gate ใหม่
    //     const recalculated = this.repositories.map(repo => {
    //       if (!repo.metrics) return repo;

    //       return {
    //         ...repo,
    //         qualityGate: this.repoService.evaluateQualityGate(repo.metrics, gates)
    //       };
    //     });

    //     this.repositories = recalculated;
    //     this.filteredRepositories = this.sortRepositories([...recalculated]);
    //     this.updateSummaryStats();
    //   });


    // WebSocket รอฟังสถานะสแกน
    this.wsSub = this.ws.subscribeScanStatus().subscribe(event => {
      const mappedStatus = this.mapStatus(event.status);

      //เก็บข้อมูลลง localstorage
      localStorage.setItem(
        `repo-status-${event.projectId}`,
        mappedStatus
      );

      //เก็บข้อมูลลง shared data
      this.sharedData.updateRepoStatus(
        event.projectId,
        mappedStatus
      );


      console.log('WS Scan Event:', event);

      if (event.status === 'SCANNING') {
        localStorage.setItem(`repo-status-${event.projectId}`, 'Scanning');
        this.updateSummaryStats();
      }

      // scan เสร็จ แจ้งผล
      if (event.status === 'SUCCESS' || event.status === 'FAILED') {
        localStorage.removeItem(`repo-status-${event.projectId}`);

        this.snack.open(
          event.status === 'SUCCESS' ? 'Scan Successful' : 'Scan Failed',
          '',
          {
            duration: 2500,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: [
              'app-snack',
              event.status === 'SUCCESS' ? 'app-snack-green' : 'app-snack-red'
            ]
          }
        );

        this.repoService.getRepositoryWithScans(event.projectId).subscribe(fullRepo => {
          if (!fullRepo) return;

          this.repositories = this.repositories.map(r =>
            r.id === event.projectId ? fullRepo : r
          );

          this.filteredRepositories = this.sortRepositories([...this.repositories]);
          this.updateSummaryStats();
        });
      }
    });
  }

  loadRepositoriesTest() {
    this.loading = true;

    this.repoService.getAllRepositories().subscribe({
      next: repos => {
        this.sharedData.setRepositories(repos);
        this.loading = false;
      },
      error: err => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  getEffectiveRepoStatus(
    repo: RepositoryAll
  ): 'Active' | 'Scanning' | 'Error' {

    const cached = localStorage.getItem(`repo-status-${repo.id}`);

    switch (cached) {
      case 'Scanning':
        return 'Scanning';
      case 'Error':
        return 'Error';
      case 'Active':
      default:
        return 'Active';
    }
  }


  getLastScanDate(repo: RepositoryAll): Date | undefined {
    return getLatestScanByStartedAt(repo.scanData)?.startedAt;
  }

  getLatestMetrics(repo: RepositoryAll) {
    return getLatestScanByStartedAt(repo.scanData)?.metrics;
  }

  getQualityGate(repo: RepositoryAll) {
    const latest = getLatestScanByStartedAt(repo.scanData);
    return latest?.qualityGate;
  }

  getQualityGateLabel(repo: RepositoryAll) {
    const latest = getLatestScanByStartedAt(repo.scanData);

    if (!latest?.qualityGate) return undefined;
    return this.scanService.mapQualityStatus(latest.qualityGate);
  }

  getProjectTypeLabel(type?: 'ANGULAR' | 'SPRING_BOOT'): string {
    if (!type) return '-';

    switch (type) {
      case 'ANGULAR':
        return 'ANGULAR';
      case 'SPRING_BOOT':
        return 'SPRING BOOT';
      default:
        return type;
    }
  }

  goToAddRepository() {
    this.router.navigate(['/addrepository']);
  }

  searchRepositories(event: Event): void {
    this.searchText = (event.target as HTMLInputElement).value
      .trim()
      .toLowerCase();

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
    // 1. filter framework status
    let result = this.repositories.filter(repo =>
      (this.activeFilter === 'all'
        || repo.projectType?.toLowerCase().includes(this.activeFilter.toLowerCase())) &&
      (this.selectedStatus === 'all'
        || this.getEffectiveRepoStatus(repo) === this.selectedStatus)
    );

    // 2. reorder ตาม search
    if (this.searchText) {
      const matched: RepositoryAll[] = [];
      const others: RepositoryAll[] = [];

      result.forEach(repo => {
        if (repo.name.toLowerCase().includes(this.searchText)) {
          matched.push(repo);
        } else {
          others.push(repo);
        }
      });

      result = [
        ...this.sortRepositories(matched),
        ...this.sortRepositories(others)
      ];
    } else {
      result = this.sortRepositories(result);
    }

    this.filteredRepositories = result;
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
        count: this.repositories.filter(r => this.getEffectiveRepoStatus(r) === 'Active').length,
        icon: 'bi bi-check-circle-fill',
        bg: 'bg-success'
      },
      {
        label: 'Scanning',
        count: this.repositories.filter(r => this.getEffectiveRepoStatus(r) === 'Scanning').length,
        icon: 'bi bi-arrow-repeat',
        bg: 'bg-info'
      },
      {
        label: 'Error',
        count: this.repositories.filter(r => this.getEffectiveRepoStatus(r) === 'Error').length,
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

  runScan(repo: RepositoryAll) {

    // trigger change detection
    this.repositories = this.repositories.map(r =>
      r.id === repo.id ? { ...r } : r
    );
    this.updateSummaryStats();

    this.repoService.startScan(repo.id, 'main').subscribe({
      next: () => {
        this.snack.open(`Scan started: ${repo.name}`, '', {
          duration: 2500,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-green']
        });
      },
      error: err => {
        console.error('Scan failed:', err);

        // rollback
        localStorage.removeItem(`repo-status-${repo.id}`);
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


  resumeScan(repo: RepositoryAll) {
    this.runScan(repo);
  }

  //ตัวแปรใน class
  showScanModal: boolean = false;
  selectedRepo: RepositoryAll | null = null;
  scanUsername: string = '';
  scanPassword: string = '';

  //เปิด modal
  openScanModal(repo: RepositoryAll) {
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


  editRepo(repo: RepositoryAll) {
    this.router.navigate(['/settingrepo', repo.id]);
    console.log('Editing repo:', repo.id);
  }

  viewRepo(repo: RepositoryAll): void {
    const latest = getLatestScanByStartedAt(repo.scanData);
    this.router.navigate(['/detailrepo', repo.id, latest?.id]);
  }

  sortRepositories(list: RepositoryAll[]): RepositoryAll[] {
    return [...list].sort((a, b) => {

      // อยู่ใน localStorage มาก่อน
      const inLocalA = localStorage.getItem(`repo-status-${a.id}`) !== null;
      const inLocalB = localStorage.getItem(`repo-status-${b.id}`) !== null;

      if (inLocalA && !inLocalB) return -1;
      if (!inLocalA && inLocalB) return 1;

      // ถ้าทั้งคู่ไม่อยู่ (หรืออยู่ทั้งคู่) → เทียบเวลา scan ล่าสุดของ project
      const timeA =
        getLatestScanByStartedAt(a.scanData)?.startedAt?.getTime()
        ?? a.createdAt.getTime();

      const timeB =
        getLatestScanByStartedAt(b.scanData)?.startedAt?.getTime()
        ?? b.createdAt.getTime();

      return timeB - timeA; // ล่าสุดอยู่บน
    });
  }





}