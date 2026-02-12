import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Repository, RepositoryService, ScanIssue } from '../../../services/reposervice/repository.service';
import { Scan, ScanService } from '../../../services/scanservice/scan.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { Issue, IssueService } from '../../../services/issueservice/issue.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { IssuesResponseDTO } from '../../../interface/issues_interface';


@Component({
  selector: 'app-detailrepository',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './detailrepository.component.html',
  styleUrls: ['./detailrepository.component.css']
})
export class DetailrepositoryComponent implements OnInit, OnDestroy {

  issues: IssuesResponseDTO[] = [];
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
    private readonly authService: AuthService,
    private readonly issueService: IssueService // Injected
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
    // this.loadScanIssues(this.scanId); // Deprecated
    this.loadAllIssues(); // New method

    // Subscribe ข้อมูลจาก SharedData เพื่ออัปเดตแบบเรียลไทม์
    this.sharedData.repositories$.subscribe(repos => {
      const currentRepo = repos.find(r => r.projectId === this.repoId);
      if (currentRepo) {
        // พบ Repository ที่อัปเดต (เช่น จาก global WS update)
        // อัปเดตเฉพาะเมื่อมีข้อมูลอยู่แล้วหรือเป็นการโหลดครั้งแรก
        if (this.repo) {
          this.repo = { ...this.repo, ...currentRepo };
          // อัปเดต logic สำหรับ scan หากจำเป็น หรือพึ่งพาการ reload
          if (this.repo.status !== 'Scanning' && currentRepo.status !== 'Scanning') {
            // หากสถานะเปลี่ยนจาก scanning เป็นอย่างอื่น เราอาจต้องการรีเฟรชประวัติ
            // แต่ sharedData อาจไม่มีประวัติทั้งหมดเว้นแต่เราจะ fetch
            // AppComponent fetch repo ทั้งหมดเมื่อสำเร็จ ดังนั้น currentRepo ควรมีข้อมูลครบถ้วนหากเพิ่งถูก merge
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
          console.log('Detail Repo loaded:', repo); // Debug costPerDay (เก็บไว้ debug)
          this.repo = repo;
          this.scans = (repo.scans ?? [])
            .filter(scan => scan.completedAt)
            .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
          // this.issues = repo.issues ?? []; // Type incompatibility: Issue[] vs IssuesResponseDTO[]

          // ซิงค์กับ SharedData เพื่อให้ AppComponent สามารถอัปเดตในภายหลังได้
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

  // การแบ่งหน้า (Pagination)
  currentPage = 1;
  pageSize = 5; // จำนวนรายการต่อหน้า

  // ดึงข้อมูลที่จะแสดงในหน้าปัจจุบัน
  get paginatedIssues(): IssuesResponseDTO[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.issues.slice(startIndex, startIndex + this.pageSize);
  }

  // คำนวณจำนวนหน้าทั้งหมด
  get totalPages(): number {
    return Math.ceil(this.issues.length / this.pageSize) || 1;
  }

  // ไปหน้าถัดไป
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  // ย้อนกลับหน้าก่อนหน้า
  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  // จัดรูปแบบสถานะ (ลบเครื่องหมาย _ ออก เช่น 'IN_PROGRESS' -> 'IN PROGRESS')
  formatStatus(status: string): string {
    return (status || '').replace(/_/g, ' ');
  }

  loadAllIssues() {
    // 1. ตรวจสอบว่ามีข้อมูลใน SharedData แล้วหรือยัง
    if (!this.sharedData.hasIssuesCache) {
      console.log('ยังไม่มี Issues ใน SharedData, กำลังโหลดทั้งหมด...');
      this.issueService.getAllIssues().subscribe({
        next: (data: IssuesResponseDTO[]) => {
          this.sharedData.IssuesShared = data; // อัปเดตข้อมูลลง SharedData
          // Subscription ด้านล่างจะได้รับข้อมูลชุดนี้อัตโนมัติ
        },
        error: (err: any) => console.error('load all issues failed:', err)
      });
    }

    // 2. Subscribe ข้อมูลจาก SharedData เพื่อกรองเฉพาะของ Scan นี้
    this.sharedData.AllIssues$.subscribe(allIssues => {
      if (allIssues) {
        this.issues = allIssues
          .filter((i: IssuesResponseDTO) => {
            const matchScan = i.scanId === this.scanId;
            const matchType = ['BUG', 'VULNERABILITY'].includes(i.type);
            return matchScan && matchType;
          });
        console.log(`number of issues for scan ${this.scanId}:`, this.issues.length);
        this.currentPage = 1; // Reset to first page on new data
      }
    });
  }

  // เลิกใช้งานแล้ว - เก็บไว้ดูเป็นอ้างอิงหรือลบทิ้งได้
  // loadScanIssues(scanId: string): void { ... }

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
    // ล้าง interval เพื่อป้องกัน memory leak
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
  }
}