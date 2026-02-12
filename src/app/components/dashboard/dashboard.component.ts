import { QualityGates } from './../../interface/sonarqube_interface';
import { AuthService } from './../../services/authservice/auth.service';
import { Dashboard } from './../../services/dashboardservice/dashboard.service';
import { Component, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  NgApexchartsModule,
  ApexOptions,
  ApexYAxis,
  ApexMarkers,
  ApexStroke,
  ApexXAxis,
  ApexChart,
  ApexAxisChartSeries,
} from 'ng-apexcharts';
import { DashboardService } from '../../services/dashboardservice/dashboard.service';
import { ScanService, Scan } from '../../services/scanservice/scan.service';
import {
  UserService,
  ChangePasswordData,
} from '../../services/userservice/user.service';
import { forkJoin, scan, Subscription } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { IssueService } from '../../services/issueservice/issue.service';
import { NotificationService } from '../../services/notiservice/notification.service';
import { Notification } from '../../interface/notification_interface';
import { ScanResponseDTO } from '../../interface/scan_interface';
import { SharedDataService } from '../../services/shared-data/shared-data.service';
import { LoginUser, UserInfo } from '../../interface/user_interface';
import { TokenStorageService } from '../../services/tokenstorageService/token-storage.service';
import { WebSocketService } from '../../services/websocket/websocket.service';
import {
  Repository,
  RepositoryService,
} from '../../services/reposervice/repository.service';
import { IssuesResponseDTO } from '../../interface/issues_interface';
import Swal from 'sweetalert2';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  TopIssue,
  Condition,
  Issue,
  SecurityHotspot,
  ScanHistory,
  DashboardData,
  NotificationTab,
  UserProfile
} from '../../interface/dashboard_interface';
import {
  getTimeAgo,
  formatISODate,
  getGradeColor,
  isValidGrade,
  notEmpty
} from '../../utils/format.utils';
import {
  getPasswordRules,
  isPasswordValid,
  isPasswordMismatch,
  getPasswordError
} from '../../utils/password-validator.utils';
import {
  buildQualityGatePieChart,
  buildCoverageTrendChart,
  generateLast30DaysLabels
} from '../../utils/chart.utils';
import { UserStatusPipe } from '../../pipes/user-status.pipe';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  stroke: ApexStroke;
  markers: ApexMarkers;
  yaxis: ApexYAxis;
  colors: string[];
};
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, RouterModule, FormsModule, MatSnackBarModule, UserStatusPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent {
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.showNotifications) {
      this.showNotifications = false;
    }
    if (this.showProfileDropdown) {
      this.showProfileDropdown = false;
    }
  }
  constructor(
    private readonly router: Router,
    private readonly dash: DashboardService,
    private readonly auth: AuthService,
    private readonly userService: UserService,
    private readonly scanService: ScanService,
    private readonly issueService: IssueService,
    private readonly notificationService: NotificationService,
    private readonly dashboardService: DashboardService,
    private readonly sharedData: SharedDataService,
    private readonly tokenStorage: TokenStorageService,
    private readonly repoService: RepositoryService,
    private readonly snack: MatSnackBar,
    private readonly ws: WebSocketService,
    private readonly cdr: ChangeDetectorRef,
  ) { }

  loading = true;

  // ================== STATE หลัก ==================
  dashboardData: DashboardData = {
    id: '',
    name: '',
    qualityGate: { status: 'OK', conditions: [] },
    metrics: {
      bugs: 0,
      vulnerabilities: 0,
      codeSmells: 0,
      coverage: 0,
      duplications: 0,
      technicalDebt: '0',
    },
    issues: [],
    securityHotspots: [],
    history: [],
    coverageHistory: [],
    maintainabilityGate: '',
    days: [],
  };
  isNewPasswordFocused = false;

  Data = { passedCount: 0, failedCount: 0 };
  pieChartOptions!: ApexOptions;
  totalProjects = 0;
  grade = '';
  gradePercent = 0;

  recentScans: Scan[] = [];
  topIssues: { message: string; count: number }[] = [];
  maxTop = 5;

  userProfile: UserInfo | null = null;
  user: any = {};
  editedUser: any = {};
  showEditModal = false;
  showProfileDropdown = false;

  notifications: Notification[] = [];
  DashboardData: ScanResponseDTO[] = [];
  UserLogin: LoginUser | null = null;
  passedCountBug = 0;
  securityCount = 0;
  codeSmellCount = 0;
  coverRateCount = 0;
  passedCount = 0;
  failedCount = 0;
  coverageChartSeries!: ApexAxisChartSeries;
  coverageChartOptions!: Partial<ChartOptions>;
  repositories: Repository[] = [];
  allIssues: IssuesResponseDTO[] = [];
  filteredRepositories: Repository[] = [];
  latestScans = this.getLatestScanByProject();
  // verify
  private verifySub?: Subscription;


  /** ตัวอักษรเกรดเฉลี่ยจาก backend (A–E) */
  avgGateLetter: 'A' | 'B' | 'C' | 'D' | 'E' = 'A';
  AllScan: ScanResponseDTO[] = [];
  // ================== LIFE CYCLE ==================
  ngOnInit() {
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    const user = this.tokenStorage.getLoginUser();
    if (user) {
      this.sharedData.LoginUserShared = user;
    }

    if (user?.id) {
      this.ws.connect(user.id);

      // Subscribe to personal notifications
      this.ws.subscribeNotifications().subscribe((noti) => {
        console.log('Realtime notification:', noti);

        const exists = this.notifications.some(n => n.id === noti.id);
        if (exists) return;

        this.notifications = [noti as any, ...this.notifications];
        this.cdr.detectChanges();
      });

      // Subscribe to global notifications (broadcast for all users)
      // These include: scan complete, quality gate failed, new critical issues
      this.ws.subscribeGlobalNotifications().subscribe((noti) => {
        console.log('Global broadcast notification:', noti);

        // Avoid duplicates (in case user also gets personal notification)
        const exists = this.notifications.some(n => n.id === noti.id);
        if (exists) return;

        this.notifications = [noti as any, ...this.notifications];
        this.cdr.detectChanges();
      });
    }

    // ==================== STEP 1: Setup all subscriptions FIRST ====================
    this.sharedData.scansHistory$.subscribe((data) => {
      // Sort data: Pending (null completedAt) or Newest first
      this.DashboardData = (data || []).sort((a, b) => {
        const timeA = a.completedAt ? new Date(a.completedAt).getTime() : Date.now();
        const timeB = b.completedAt ? new Date(b.completedAt).getTime() : Date.now();
        return timeB - timeA;
      });

      this.countQualityGate();
      this.buildPieChart(); // Rebuild pie chart when data changes
      this.loadDashboardData();
      this.countBug();
      this.mockCoverageTrend();
      this.generateQualityGateNotifications(this.DashboardData);
    });

    this.sharedData.LoginUser$.subscribe((data) => {
      this.UserLogin = data;
      console.log('User Login in Dashboard:', this.UserLogin);
    });

    this.sharedData.repositories$.subscribe((repos) => {
      this.repositories = repos;
      console.log('Repositories loaded from sharedData:', this.repositories);
      this.calculateProjectDistribution();
    });

    this.sharedData.AllIssues$.subscribe((data) => {
      const all = data ?? [];

      // Filter for notification-worthy issues (exclude MINOR and INFO)
      const notifiableIssues = all.filter((issue) =>
        ['CRITICAL', 'BLOCKER', 'MAJOR'].includes(issue.severity)
      );

      this.allIssues = notifiableIssues.filter((issue) => issue.severity === 'CRITICAL');

      // Generate notifications for filtered issues
      this.generateIssueNotifications(notifiableIssues);
    });

    // ==================== STEP 2: Load data from API AFTER subscriptions are ready ====================
    // Always load scan data on page refresh to ensure dashboard has data
    this.loadDashboard();

    if (!this.sharedData.hasRepositoriesCache) {
      this.loadRepositories();
    }

    if (!this.sharedData.hasIssuesCache) {
      console.log('No cache - load from server');
      this.loadIssues();
    }

    // Load existing notifications from DB on page load
    this.loadNotifications();


    // Verify status is now handled via SharedDataService (updated by AppComponent)


  }

  loadRepositories() {
    this.sharedData.setLoading(true);

    this.repoService.getAllRepo().subscribe({
      next: (repos) => {
        // เก็บข้อมูลลง SharedDataService
        this.sharedData.setRepositories(repos);
        this.sharedData.setLoading(false);
        console.log('Repositories loaded:', repos);
      },
      error: (err) => {
        console.error('Failed to load repositories:', err);
        this.sharedData.setLoading(false);
      },
    });
  }

  loadDashboard() {
    this.scanService.getScansHistory().subscribe({
      next: (res: any[]) => {
        this.sharedData.Scans = res ?? [];
        this.countQualityGate();
        this.buildPieChart();
        this.countBug();
        this.mockCoverageTrend();
        this.loadDashboardData();
        console.log('Dashboard Data (All Scans)', this.DashboardData);
      },
      error: (err) => {
        console.error('โหลด ประวัติการสแกน ล้มเหลว', err);
      },
    });
  }

  loadIssues() {
    this.sharedData.setLoading(true);
    this.issueService.getAllIssues().subscribe({
      next: (data) => {
        this.sharedData.IssuesShared = data;
        this.sharedData.setLoading(false);
        console.log('Issues loaded:', data);
      },
      error: () => this.sharedData.setLoading(false),
    });
  }
  countQualityGate() {
    const scans = this.getLatestScanByProject() ?? [];
    console.log('Latest Scans for Quality Gate Count:', scans);
    this.passedCount = scans.filter(s => (s?.qualityGate ?? '').toUpperCase() === 'OK').length;
    // ถ้าไม่ใช่ OK ให้เป็น failed ทั้งหมด
    this.failedCount = scans.filter(s => (s?.qualityGate ?? '').toUpperCase() !== 'OK').length;
    console.log('Passed:', this.passedCount, 'Failed:', this.failedCount);
  }
  countBug() {
    const bugs = this.getLatestScanByProject() ?? [];
    this.passedCountBug = bugs.reduce((sum, s) => sum + (s?.metrics?.bugs ?? 0), 0);
    this.securityCount = bugs.reduce((sum, s) => sum + (s?.metrics?.securityHotspots ?? 0) + (s?.metrics?.vulnerabilities ?? 0), 0);
    this.codeSmellCount = bugs.reduce((sum, s) => sum + (s?.metrics?.codeSmells ?? 0), 0);
    this.coverRateCount = bugs.reduce((sum, s) => sum + (s?.metrics?.coverage ?? 0), 0);
    console.log('Bug:', this.passedCountBug, 'Security:', this.securityCount, 'CodeSmells:', this.codeSmellCount, 'Coverage:', this.coverRateCount);
  }

  // ใช้ formatISODate จาก utils แทน
  private dateTH = formatISODate;

  countQuality(date: string): number {
    return (this.DashboardData ?? []).filter(s => {
      if (!s?.completedAt) return false;
      const scanDate = formatISODate(s.completedAt);
      console.log('Date:', scanDate, 'QualityGate:', s.qualityGate);
      console.log('latestScans', this.getLatestScanByProject());
      return scanDate === date && s.qualityGate === 'OK';

    }).length;

  }
  getLatestScanByProject(): any[] {
    const rows = (this.DashboardData ?? [])
      .filter((s): s is any => typeof s?.completedAt === 'string')
      .filter(s => !!(s?.project?.id));

    const latestByProject = new Map<string, any>();

    for (const s of rows) {
      const projectId = s.project?.id ?? s.projectId;

      const prev = latestByProject.get(projectId);
      if (!prev) {
        latestByProject.set(projectId, s);
        continue;
      }

      const prevTime = new Date(prev.completedAt).getTime();
      const curTime = new Date(s.completedAt).getTime();

      if (curTime > prevTime) {
        latestByProject.set(projectId, s);
      }
    }
    console.log('Latest by Project:', Array.from(latestByProject.values()));
    return Array.from(latestByProject.values());
  }




  // ใช้ chart utils สำหรับ Pie Chart
  buildPieChart() {
    this.pieChartOptions = buildQualityGatePieChart(this.passedCount, this.failedCount);
  }
  // ================== FETCH FROM SERVER ==================
  fetchFromServer(userId: string | number) {
    this.loading = true;

    forkJoin({
      overview: this.dash.getOverview(userId),
      history: this.dash.getHistory(userId),
      trends: this.dash.getTrendsWithAvg(userId),
      scans: this.scanService.getAllScan(),
      issues: this.issueService.getAllIssues(), // ✅ เพิ่ม
    }).subscribe({
      next: ({ overview, history, trends, scans, issues }) => {
        // 1) metrics จาก overview
        const metrics = this.dash.getMetricsSummary(overview);
        this.dashboardData.metrics = {
          ...metrics,
          technicalDebt: this.dashboardData.metrics.technicalDebt ?? '0',
        };
        console.log('[overview] metrics summary:', metrics);

        // 2. history -> map
        this.dashboardData.history = this.dash.mapHistory(history);

        // 3. avg grade จาก trends
        if (trends?.length && this.isValidGateLetter(trends[0].avgGrade)) {
          this.avgGateLetter = trends[0].avgGrade.toUpperCase() as any;
          console.log('[trends] avgGrade from API =', trends[0].avgGrade);
        } else {
          // ... fallback เดิมของคุณ ...
          const latestMap = this.dashboardData.history.reduce((m, h) => {
            const cur = m.get(h.projectId);
            const tNew = new Date(h.time).getTime();
            const tCur = cur ? new Date(cur.time).getTime() : 0;
            if (!cur || tNew > tCur) m.set(h.projectId, h);
            return m;
          }, new Map<string, any>());
          const rows = Array.from(latestMap.values());

          const scoreMap: Record<'A' | 'B' | 'C' | 'D' | 'E', number> = {
            A: 5,
            B: 4,
            C: 3,
            D: 2,
            E: 1,
          };
          const score = (g: string) =>
            scoreMap[(g || 'E').toUpperCase() as keyof typeof scoreMap] || 1;

          const grades = rows
            .map((r) => (r.grade || 'E').toUpperCase())
            .filter((g) => this.isValidGateLetter(g));

          const avgScore = grades.length
            ? grades.map(score).reduce((a, b) => a + b, 0) / grades.length
            : 1;

          const revMap: Record<1 | 2 | 3 | 4 | 5, 'A' | 'B' | 'C' | 'D' | 'E'> =
          {
            1: 'E',
            2: 'D',
            3: 'C',
            4: 'B',
            5: 'A',
          };

          const rounded = Math.max(1, Math.min(5, Math.round(avgScore))) as
            | 1
            | 2
            | 3
            | 4
            | 5;
          this.avgGateLetter = revMap[rounded];
          console.log('[fallback] avgGateLetter =', this.avgGateLetter);
        }

        // 4. recent scans (เอา 5 อันล่าสุด)
        this.recentScans = scans
          .sort((a, b) => {
            const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 5);

        // 5. นับ passed / failed จาก history
        this.recomputeStatusCountsFromHistory();

        // 6. สรุป project distribution
        this.calculateProjectDistribution();

        // 7. คำนวณ donut / เกรด
        this.loadDashboardData();

        // 8. ตรงนี้คือของใหม่: คำนวณ Top Issues จากรายการ issues ที่ดึงมา
        // Filter out issues from deleted projects (which are not in history)
        const activeProjectIds = new Set(this.dashboardData.history.map(h => h.projectId));
        const activeIssues = (issues || []).filter(issue => issue.projectId && activeProjectIds.has(issue.projectId));

        this.buildTopIssues(activeIssues);

        console.log(
          '[donut] pass/fail ->',
          this.Data,
          'totalProjects =',
          this.totalProjects,
        );
        console.log('[donut] center =', this.avgGateLetter);

        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching dashboard data:', err);
        this.loading = false;
      },
    });
  }

  private buildTopIssuesFromDashboard() {
    const list = this.dashboardData?.issues || [];
    const counter: Record<string, number> = {};

    for (const it of list) {
      // backend บางทีส่ง message, บางทีส่ง title ก็กันไว้
      const msgRaw = it?.message || '(no message)';
      const msg = String(msgRaw).trim();

      // ถ้าจะนับเฉพาะที่ยัง open ก็เช็กตรงนี้ได้
      // if (it.status && it.status.toLowerCase() !== 'open') continue;

      counter[msg] = (counter[msg] || 0) + 1;
    }

    const arr: TopIssue[] = Object.entries(counter)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count);

    this.topIssues = arr.slice(0, this.maxTop);
  }
  private buildTopIssues(rawIssues: any[]) {
    if (!rawIssues || !rawIssues.length) {
      this.topIssues = [];
      return;
    }

    const counter: Record<string, number> = {};

    for (const it of rawIssues) {
      // ดึงเฉพาะหัวข้อ
      const msg = (it.message || '(no message)').trim();

      // ถ้าอยากตัดตัวที่ DONE / REJECT ออก ให้ uncomment 3 บรรทัดนี้
      // const st = (it.status || '').toUpperCase();
      // if (st === 'DONE' || st === 'REJECT') continue;

      counter[msg] = (counter[msg] || 0) + 1;
    }

    this.topIssues = Object.entries(counter)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count) // มาก -> น้อย
      .slice(0, this.maxTop);
  }

  // ================== PROFILE & USER ==================
  toggleProfileDropdown() {
    this.showProfileDropdown = !this.showProfileDropdown;
    if (this.showProfileDropdown) {
      this.showNotifications = false;
    }
  }

  showChangePasswordModal = false;
  passwordData: ChangePasswordData = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  };
  submitted = false;

  openChangePasswordModal() {
    this.showChangePasswordModal = true;
    this.resetForm();
  }

  closeChangePasswordModal() {
    this.showChangePasswordModal = false;
  }

  resetForm() {
    this.passwordData = {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    };
    this.submitted = false;
  }

  // ==== NEW PASSWORD VALIDATION (ใช้ utils) ====
  get newPasswordRules() {
    return getPasswordRules(this.passwordData?.newPassword || '');
  }

  get newPasswordValid() {
    return isPasswordValid(this.passwordData?.newPassword || '');
  }

  get newPasswordsMismatch() {
    return isPasswordMismatch(
      this.passwordData?.newPassword || '',
      this.passwordData?.confirmPassword || ''
    );
  }

  get newPasswordError() {
    return getPasswordError(this.passwordData?.newPassword || '');
  }

  submitChangePassword(form: any) {
    this.submitted = true;

    if (form.invalid || this.newPasswordsMismatch || !this.newPasswordValid) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid password',
        text: 'Please meet all password requirements.',
        confirmButtonColor: '#d33',
      });
      return;
    }

    this.userService.changePassword(this.passwordData).subscribe({
      next: () => {
        this.closeChangePasswordModal();
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Password changed successfully',
          confirmButtonColor: '#3085d6',
        });
      },
      error: (err) => {
        const backendMsg = (() => {
          // 1) ถ้า backend ส่งเป็น object
          if (
            err?.error &&
            typeof err.error === 'object' &&
            err.error.message
          ) {
            return err.error.message;
          }

          // 2) ถ้าส่งเป็น string (เช่น JSON string)
          if (typeof err?.error === 'string') {
            try {
              const parsed = JSON.parse(err.error);
              if (parsed?.message) return parsed.message;
            } catch (_) { }
            // ถ้าไม่ใช่ JSON ก็ใช้ string ตรงๆ
            return err.error;
          }

          // 3) fallback
          return err?.message || 'Failed to change password';
        })();

        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: backendMsg,
          confirmButtonColor: '#d33',
        });
      },
    });
  }

  // verifyEmail() {
  //   this.userService.verifyEmail(this.userProfile.email).subscribe({
  //     next: () => alert('Verification email sent successfully!'),
  //     error: (err) => {
  //       console.error('Error sending verification email:', err);
  //       alert('Failed to send verification email.');
  //     }
  //   });
  // }

  // ================== NOTIFICATIONS ==================
  showNotifications = false;
  isMobile = false;
  activeTab: NotificationTab = 'All';
  displayCount = 5;
  loadNotifications() {
    this.notificationService.getAllNotifications().subscribe({
      next: (data) => {
        this.notifications = data;
      },
      error: (err) => {
        console.error('Error loading notifications:', err);
      },
    });
  }

  // ใช้ getTimeAgo จาก utils (export เพื่อใช้ใน template)
  getTimeAgo = getTimeAgo;

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.showProfileDropdown = false;
    }
  }

  closeNotifications() {
    this.showNotifications = false;
  }

  markAllRead() {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications.forEach((n) => ((n as any).isRead = true));
      },
      error: (err) => console.error('Failed to mark all as read:', err)
    });
  }

  selectTab(tab: NotificationTab) {
    this.activeTab = tab;
    this.displayCount = 5;
  }

  viewNotification(n: Notification) {
    // อัปเดต UI ก่อนทันที (ไม่ต้องรอ API)
    (n as any).isRead = true;

    // เรียก API แบบ fire-and-forget
    this.notificationService.markAsRead(n.id).subscribe({
      next: () => {
        console.log('Notification marked as read');
      },
      error: (err) => {
        console.error('Failed to mark as read:', err);
        // ไม่ต้อง revert เพราะ navigation ทำไปแล้ว
      },
    });
  }

  /**
   * Handle View Issue click - validate issue exists before navigating
   */
  handleViewIssue(n: Notification) {
    // Mark notification as read first
    this.viewNotification(n);

    // Check if issue exists
    if (!n.relatedIssueId) {
      this.snack.open('Can not open issue', '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-red']
      });
      return;
    }

    // Validate issue existence via API
    this.issueService.getAllIssuesById(n.relatedIssueId).subscribe({
      next: (issue) => {
        if (issue) {
          // Issue exists - navigate to issue detail
          this.router.navigate(['/issuedetail', n.relatedIssueId]);
        } else {
          // Issue data is empty
          this.snack.open('Can not open issue', '', {
            duration: 2500,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['app-snack', 'app-snack-red']
          });
        }
      },
      error: (err) => {
        console.error('Failed to fetch issue:', err);
        // Issue not found or error occurred
        this.snack.open('Can not open issue', '', {
          duration: 2500,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-red']
        });
      },
    });
  }

  /**
   * Handle View Scan click - navigate to scan results
   */
  handleViewScan(n: Notification) {
    this.viewNotification(n);

    if (!n.relatedScanId) {
      this.snack.open('Can not open scan results', '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-red']
      });
      return;
    }

    // Navigate to scan result page
    this.router.navigate(['/scanresult', n.relatedScanId]);
  }

  /**
   * Handle View System notification - navigate based on context
   */
  handleViewSystem(n: Notification) {
    this.viewNotification(n);

    // Report generation notification - navigate to report history
    if (n.title?.includes('Generate') || n.title?.includes('Report')) {
      this.router.navigate(['/reporthistory']);
      return;
    }

    // Quality Gate Failed notification - navigate to detail repo
    if (n.title?.includes('Quality Gate')) {
      if (n.relatedProjectId) {
        this.router.navigate(['/detailrepo', n.relatedProjectId]);
      } else {
        this.snack.open('Cannot open project details', '', {
          duration: 2500,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-red']
        });
      }
      return;
    }

    // Navigate based on what's related
    if (n.relatedCommentId && n.relatedIssueId) {
      // Comment notification - go to issue detail
      this.router.navigate(['/issuedetail', n.relatedIssueId]);
    } else if (n.relatedIssueId) {
      // Assign issue notification - go to issue detail
      this.router.navigate(['/issuedetail', n.relatedIssueId]);
    } else if (n.relatedScanId) {
      // Quality Gate notification - go to scan result
      this.router.navigate(['/scanresult', n.relatedScanId]);
    } else if (n.relatedProjectId) {
      // Project related - go to repository detail
      this.router.navigate(['/detailrepo', n.relatedProjectId]);
    } else {
      this.snack.open('No details available', '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-red']
      });
    }
  }

  get filteredNotifications() {
    let filtered = this.notifications;
    if (this.activeTab === 'Unread') {
      filtered = filtered.filter((n) => !n.isRead);
    } else if (this.activeTab !== 'All') {
      filtered = filtered.filter((n) => n.type === this.activeTab);
    }
    filtered = filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return filtered.slice(0, this.displayCount);
  }

  get unreadCount() {
    return this.notifications.filter((n) => !n.isRead).length;
  }

  loadMore() {
    this.displayCount += 5;
  }

  onNotificationScroll(event: any) {
    const element = event.target;
    // Check if scrolled to near bottom (within 20px)
    if (element.scrollHeight - element.scrollTop <= element.clientHeight + 20) {
      if (this.displayCount < this.totalFilteredCount) {
        this.loadMore();
      }
    }
  }

  get totalFilteredCount() {
    if (this.activeTab === 'All') return this.notifications.length;
    if (this.activeTab === 'Unread')
      return this.notifications.filter((n) => !n.isRead).length;
    return this.notifications.filter((n) => n.type === this.activeTab)
      .length;
  }

  /**
   * Generate issue notifications (ใช้ NotificationService)
   */
  generateIssueNotifications(issues: IssuesResponseDTO[]): void {
    this.notificationService.generateIssueNotifications(issues);
    // Refresh notification list after generating
    setTimeout(() => this.loadNotifications(), 1000);
  }

  /**
   * Generate quality gate notifications (ใช้ NotificationService)
   */
  generateQualityGateNotifications(scans: ScanResponseDTO[]): void {
    this.notificationService.generateQualityGateNotifications(scans);
  }

  // ================== PROJECT DISTRIBUTION ==================
  projectDistribution: { type: string; count: number; percent: number }[] = [];

  calculateProjectDistribution() {
    const typeCounts: Record<string, number> = {};
    const total = this.repositories.length || 1;
    this.repositories.forEach((h) => {
      typeCounts[h.projectType ?? 'Unknown'] =
        (typeCounts[h.projectType ?? 'Unknown'] || 0) + 1;
    });
    this.projectDistribution = Object.entries(typeCounts).map(
      ([type, count]) => ({
        type,
        count,
        percent: Math.round((count / total) * 100),
      }),
    );
  }

  // ================== ช่วยนับ passed / failed ==================
  /** ✅ แก้ตรงนี้ให้ normalize แล้ว */
  private recomputeStatusCountsFromHistory() {
    const norm = (s?: string) => (s || '').trim().toUpperCase();

    const passed = this.dashboardData.history.filter((h) => {
      const st = norm(h.status);
      return ['PASSED', 'OK', 'SUCCESS', 'PASS'].includes(st);
    }).length;

    const failed = this.dashboardData.history.filter((h) => {
      const st = norm(h.status);
      return ['FAILED', 'ERROR', 'FAIL', 'FAILURE'].includes(st);
    }).length;

    this.Data = { passedCount: passed, failedCount: failed };
    this.totalProjects = passed + failed;
  }

  // ================== HELPERS ==================
  private getLatestPerProject(rows: ScanHistory[]): ScanHistory[] {
    const map = new Map<string, ScanHistory>();
    for (const h of rows) {
      if (!h?.projectId || !h?.time) continue;
      const cur = map.get(h.projectId);
      const tNew = new Date(h.time).getTime();
      const tCur = cur ? new Date(cur.time).getTime() : 0;
      if (!cur || tNew > tCur) map.set(h.projectId, h);
    }
    return Array.from(map.values());
  }

  // ใช้ utility functions จาก format.utils.ts
  private notEmpty = notEmpty;
  private isValidGateLetter = isValidGrade;  // isValidGrade ใน utils เหมือนกันกับ isValidGateLetter
  private getGradeColor = getGradeColor;

  // ================== โหลดข้อมูลสำหรับโดนัทและการ์ด ==================
  loadDashboardData() {
    const latest = this.getLatestScanByProject();
    const norm = (s?: string) => (s || '').trim().toUpperCase();
    // Filter scans that have a qualityGate result
    const validLatest = latest.filter((s) => this.notEmpty(s.qualityGate));

    // ✅ pass = qualityGate is 'OK'
    const passedCount = validLatest.filter((s) => {
      const qg = norm(s.qualityGate);
      return qg === 'OK';
    }).length;

    // ✅ failed = qualityGate is NOT 'OK' (e.g. ERROR, WARN, NONE etc.)
    const failedCount = validLatest.filter((s) => {
      const qg = norm(s.qualityGate);
      return qg !== 'OK' && qg !== 'NONE' && qg !== '';
    }).length;
    console.log('QG Passed Count:', passedCount, 'QG Failed Count:', failedCount);
    // ใช้เฉพาะที่จบแล้ว (pass+fail) มาหาร
    const finishedTotal = passedCount + failedCount;

    this.Data = { passedCount, failedCount };
    this.totalProjects = finishedTotal;

    const ratio = finishedTotal > 0 ? passedCount / finishedTotal : 0;

    this.grade =
      ratio >= 0.8
        ? 'A'
        : ratio >= 0.7
          ? 'B'
          : ratio >= 0.6
            ? 'C'
            : ratio >= 0.5
              ? 'D'
              : ratio >= 0.4
                ? 'E'
                : 'F';

    this.gradePercent = Math.round(ratio * 100);

    // Use the computed grade directly for the center letter
    const centerLetter: 'A' | 'B' | 'C' | 'D' | 'E' =
      (this.grade === 'F' ? 'E' : this.grade) as 'A' | 'B' | 'C' | 'D' | 'E';

    // ถ้าไม่มีข้อมูล ให้แสดง E สีเทา
    const hasData = this.totalProjects > 0;
    const displayGrade = hasData ? this.grade : 'E';
    const displayPercent = hasData ? this.gradePercent : 0;
    const successColor = hasData ? '#10B981' : '#E5E7EB'; // grey-400
    const failedColor = hasData ? '#EF4444' : '#E5E7EB'; // grey-200 when no data

    this.pieChartOptions = {
      chart: { type: 'donut', height: 300 },
      series: hasData ? [displayPercent, 100 - displayPercent] : [0, 100],
      labels: ['PASSED', 'FAILED'],
      colors: [successColor, failedColor],
      states: {
        hover: {
          filter: {
            type: 'darken',
            value: 0.15
          }
        },
        active: {
          filter: {
            type: 'darken',
            value: 0.2
          }
        }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              name: { show: false },
              value: {
                show: true,
                formatter: () => displayGrade,
                fontSize: '50px',
                fontWeight: 700,
                color: 'var(--text-main)',
              },
              total: {
                show: true,
                formatter: () => displayGrade,
                fontSize: '50px',
                fontWeight: 700,
                color: 'var(--text-main)',
              },
            },
          },
        },
      },
      dataLabels: { enabled: true },
      legend: {
        show: true,
        markers: {
          fillColors: ['#10B981', '#EF4444']
        }
      },
      tooltip: {
        enabled: true,
        y: {
          formatter: (val: number) => `${Math.round(val)}%`
        }
      },
    };
  }

  // ================== EXPORT PDF ==================
  onExport() {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const margin = 12;
    let y = 15;

    pdf.setFontSize(20);
    pdf.setTextColor(33, 37, 41);
    pdf.text(
      'Dashboard Overview Report',
      pdf.internal.pageSize.getWidth() / 2,
      y,
      { align: 'center' },
    );
    y += 12;

    const today = new Date();
    const username = this.UserLogin?.username || 'Unknown User';
    pdf.setFontSize(11);
    pdf.setTextColor(85, 85, 85);
    pdf.text(
      `Date: ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`,
      margin,
      y,
    );
    pdf.text(
      `Username: ${username}`,
      pdf.internal.pageSize.getWidth() - margin,
      y,
      { align: 'right' },
    );
    y += 10;

    pdf.setDrawColor(180);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, pdf.internal.pageSize.getWidth() - margin, y);
    y += 8;

    // Quality Gate
    pdf.setFontSize(14);
    pdf.setTextColor(0, 123, 255);
    pdf.text('Quality Gate Status', margin, y);
    y += 7;
    pdf.setFontSize(11);
    pdf.setTextColor(0);
    pdf.text(`Passed: ${this.passedCount}`, margin, y);
    y += 6;
    pdf.text(`Failed: ${this.failedCount}`, margin, y);
    y += 10;

    // Recent scans
    pdf.setFontSize(14);
    pdf.setTextColor(0, 123, 255);
    pdf.text('Recent Scans', margin, y);
    y += 6;

    const scansColumns = ['Project Name', 'Status', 'Completed At'];
    const scansRows = this.DashboardData.map((s) => [
      s.project.name || 'N/A',
      s.status || 'N/A',
      new Date(s.completedAt ?? '').toLocaleString(),
    ]);

    (autoTable as any)(pdf, {
      head: [scansColumns],
      body: scansRows,
      startY: y,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: {
        fillColor: [0, 123, 255],
        textColor: 255,
        halign: 'center',
      },
      bodyStyles: { textColor: 50 },
      margin: { left: margin, right: margin },
    });

    y = (pdf as any).lastAutoTable?.finalY + 8;

    // Metrics
    pdf.setFontSize(14);
    pdf.setTextColor(0, 123, 255);
    pdf.text('Metrics Summary', margin, y);
    y += 6;
    pdf.setFontSize(11);
    pdf.setTextColor(0);
    pdf.text(`Bugs: ${this.passedCountBug}`, margin, y);
    y += 5;
    pdf.text(`Security: ${this.securityCount}`, margin, y);
    y += 5;
    pdf.text(`Code Smells: ${this.codeSmellCount}`, margin, y);
    y += 5;
    pdf.text(`Coverage: ${this.coverRateCount}%`, margin, y);
    y += 10;

    // Top issues
    pdf.setFontSize(14);
    pdf.setTextColor(220, 53, 69);
    pdf.text('Top Issues', margin, y);
    y += 6;

    pdf.setFontSize(11);
    pdf.setTextColor(0);
    if (this.dashboardData.issues?.length > 0) {
      this.dashboardData.issues.forEach((i) => {
        pdf.text(
          `- [${i.severity || 'N/A'}] ${i.type || 'Unknown'}: ${i.message || ''}`,
          margin,
          y,
        );
        y += 5;
      });
    } else {
      pdf.text('No critical issues found.', margin, y);
      y += 5;
    }
    y += 5;

    // Project distribution
    pdf.setFontSize(14);
    pdf.setTextColor(0, 123, 255);
    pdf.text('Project Distribution', margin, y);
    y += 6;
    pdf.setFontSize(11);
    pdf.setTextColor(0);

    this.projectDistribution.forEach((p) => {
      pdf.text(`${p.type}: ${p.percent}%`, margin, y);
      pdf.setFillColor(0, 123, 255);
      pdf.rect(margin + 40, y - 3, p.percent * 1.2, 5, 'F');
      y += 8;
    });

    const pageHeight = pdf.internal.pageSize.height;
    pdf.setFontSize(9);
    pdf.setTextColor(150);
    pdf.text(
      'Generated automatically by PCCTH Automate Code Review',
      pdf.internal.pageSize.getWidth() / 2,
      pageHeight - 10,
      { align: 'center' },
    );

    const fileName = `Dashboard_Report_${today.getFullYear()}${(
      today.getMonth() + 1
    )
      .toString()
      .padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}.pdf`;
    pdf.save(fileName);
  }

  // ================== ACTIONS อื่น ๆ ==================
  onRefresh() {
    // TODO: Get userId from token when available
    this.fetchFromServer('');
  }

  isSendingVerifyEmail = false;

  sendVerifyEmail() {
    const userId = (this.UserLogin as any)?.id; // if LoginUser type doesn't have id yet
    if (!userId) {
      Swal.fire({
        icon: 'error',
        title: 'Missing userId',
        text: 'Cannot send verification email (userId not found).',
        confirmButtonColor: '#d33',
      });
      return;
    }

    if (this.isSendingVerifyEmail) return;
    this.isSendingVerifyEmail = true;

    // ✅ Loading popup
    Swal.fire({
      title: 'Sending...',
      text: 'Please wait a moment.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    this.userService.sendVerifyEmail(userId).subscribe({
      next: () => {
        this.isSendingVerifyEmail = false;

        Swal.fire({
          icon: 'success',
          title: 'Sent',
          text: 'Verification email has been sent. Please check your inbox.',
          confirmButtonColor: '#3085d6',
        });
      },
      error: (err) => {
        this.isSendingVerifyEmail = false;

        const msg =
          err?.error?.message ||
          err?.error ||
          err?.message ||
          'Failed to send verification email';

        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: msg,
          confirmButtonColor: '#d33',
        });
      },
    });
  }

  viewDetail(scan: ScanResponseDTO) {
    this.sharedData.ScansDetail = scan;
    this.router.navigate(['/scanresult', scan.id]);
  }

  // ใช้ chart utils สำหรับ Coverage Trend
  mockCoverageTrend() {
    const { dates, dateKeys } = generateLast30DaysLabels();
    const coverageValues = dateKeys.map(dateKey => this.countQuality(dateKey));

    const chartConfig = buildCoverageTrendChart(dates, coverageValues);
    this.coverageChartSeries = chartConfig.series as any;
    this.coverageChartOptions = chartConfig.options as any;
  }

  // ngOnDestroy() {
  //   this.ws.disconnect();
  // }
}
