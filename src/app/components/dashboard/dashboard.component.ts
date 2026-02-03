import { QualityGates } from './../../interface/sonarqube_interface';
import { AuthService } from './../../services/authservice/auth.service';
import { Dashboard } from './../../services/dashboardservice/dashboard.service';
import { Component } from '@angular/core';
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
import { forkJoin, scan } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { IssueService } from '../../services/issueservice/issue.service';
import {
  NotificationService,
  Notification,
} from '../../services/notiservice/notification.service';
import { ScanResponseDTO } from '../../interface/scan_interface';
import { SharedDataService } from '../../services/shared-data/shared-data.service';
import { LoginUser, UserInfo } from '../../interface/user_interface';
import { TokenStorageService } from '../../services/tokenstorageService/token-storage.service';
import {
  Repository,
  RepositoryService,
} from '../../services/reposervice/repository.service';
import { IssuesResponseDTO } from '../../interface/issues_interface';
import Swal from 'sweetalert2';
interface TopIssue {
  message: string;
  count: number;
}

interface Condition {
  metric: string;
  status: 'OK' | 'ERROR';
  actual: number;
  threshold: number;
}

interface Issue {
  id: number;
  type: string;
  severity: 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR';
  message: string;
  project: string;
}

interface SecurityHotspot {
  id: number;
  status: 'REVIEWED' | 'TO_REVIEW';
  description: string;
  project: string;
}

interface ScanHistory {
  scanId: string;
  projectId: string;
  project: string;
  typeproject: 'Angular' | 'SpringBoot';
  status: 'Passed' | 'Failed' | ''; // เผื่อว่าง
  grade: string | null;
  time: string;
  maintainabilityGate: string | null;
}

interface DashboardData {
  id: string;
  name: string;
  qualityGate: { status: 'OK' | 'ERROR'; conditions: Condition[] };
  metrics: {
    bugs: number;
    vulnerabilities: number;
    codeSmells: number;
    coverage: number;
    duplications?: number;
    technicalDebt?: string;
  };
  issues: Issue[];
  securityHotspots: SecurityHotspot[];
  history: ScanHistory[];
  coverageHistory: number[];
  maintainabilityGate: string;
  days: number[];
}

type NotificationTab = 'All' | 'Unread' | 'Scans' | 'Issues' | 'System';

interface UserProfile {
  username: string;
  email: string;
  phoneNumber?: string;
  status: string;
}
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
  imports: [CommonModule, NgApexchartsModule, RouterModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent {
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

  /** ตัวอักษรเกรดเฉลี่ยจาก backend (A–E) */
  avgGateLetter: 'A' | 'B' | 'C' | 'D' | 'E' = 'A';
  AllScan: ScanResponseDTO[] = [];
  // ================== LIFE CYCLE ==================
  ngOnInit() {
    if (!this.auth.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    if (!this.sharedData.hasScansHistoryCache) {
      console.log('@');
      this.loadDashboard();
    }
    const user = this.tokenStorage.getLoginUser();
    if (user) {
      this.sharedData.LoginUserShared = user;
    }
    this.sharedData.scansHistory$.subscribe((data) => {
      this.DashboardData = data || [];
      this.countQualityGate();
      this.loadDashboardData();
      this.countBug();
      this.mockCoverageTrend();
    });
    this.sharedData.LoginUser$.subscribe((data) => {
      this.UserLogin = data;
      console.log('User Login in Dashboard:', this.UserLogin);
    });

    // 1. Subscribe รับข้อมูลจาก SharedDataService
    this.sharedData.repositories$.subscribe((repos) => {
      this.repositories = repos;
      console.log('Repositories loaded from sharedData:', this.repositories);
      this.calculateProjectDistribution();
    });

    // 2. เช็คว่ามีข้อมูลแล้วหรือยัง
    if (!this.sharedData.hasRepositoriesCache) {
      // 3. ถ้ายังไม่มี → Fetch API
      this.loadRepositories();
    }

    this.sharedData.AllIssues$.subscribe((data) => {
      const all = data ?? [];

      this.allIssues = all.filter((issue) => issue.severity == 'CRITICAL');
    });
    if (!this.sharedData.hasIssuesCache) {
      console.log('No cache - load from server');
      this.loadIssues();
    }
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
    this.dashboardService.getDashboard().subscribe({
      next: (res: any[]) => {
        this.sharedData.Scans = res ?? [];
        this.countQualityGate();
        this.buildPieChart();
        this.countBug();
        this.mockCoverageTrend();
        this.loadDashboardData();
        console.log('Dashboard Data', this.DashboardData);
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
    this.failedCount = scans.filter(s => (s?.qualityGate ?? '').toUpperCase() === 'FAILED').length;
    console.log('Passed:', this.passedCount, 'Failed:', this.failedCount);
  }
  countBug() {
    const bugs = this.getLatestScanByProject() ?? [];
    this.passedCountBug = bugs.reduce((sum, s) => sum + (s?.metrics?.bugs ?? 0), 0);
    this.securityCount = bugs.reduce((sum, s) => sum + (s?.metrics?.securityHotspots ?? 0), 0);
    this.codeSmellCount = bugs.reduce((sum, s) => sum + (s?.metrics?.codeSmells ?? 0), 0);
    this.coverRateCount = bugs.reduce((sum, s) => sum + (s?.metrics?.coverage ?? 0), 0);
    console.log('Bug:', this.passedCountBug, 'Security:', this.securityCount, 'CodeSmells:', this.codeSmellCount, 'Coverage:', this.coverRateCount);
  }
  private dateTH(iso?: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
    // ได้ YYYY-MM-DD
  }

  countQuality(date: string): number {
    return (this.DashboardData ?? []).filter(s => {
      if (!s?.completedAt) return false;
      const scanDate = this.dateTH(s.completedAt);
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




  buildPieChart() {
    this.pieChartOptions = {
      series: [this.passedCount, this.failedCount],
      labels: ['Success', 'Failed'],
      chart: { type: 'pie' },
      legend: { position: 'bottom' }
    };
  }
  // ================== FETCH FROM SERVER ==================
  fetchFromServer(userId: string | number) {
    this.loading = true;

    forkJoin({
      overview: this.dash.getOverview(userId),
      history: this.dash.getHistory(userId),
      trends: this.dash.getTrendsWithAvg(userId),
      scans: this.scanService.getAllScan(),
      issues: this.issueService.getAllIssue(String(userId)), // ✅ เพิ่ม
    }).subscribe({
      next: ({ overview, history, trends, scans, issues }) => {
        // 1) metrics จาก overview
        const metrics = this.dash.getMetricsSummary(overview);
        this.dashboardData.metrics = {
          ...metrics,
          technicalDebt: this.dashboardData.metrics.technicalDebt ?? '0',
        };
        console.log('[overview] metrics summary:', metrics);

        // 2) history -> map
        this.dashboardData.history = this.dash.mapHistory(history);

        // 3) avg grade จาก trends
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

        // 4) recent scans (เอา 5 อันล่าสุด)
        this.recentScans = scans
          .sort((a, b) => {
            const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 5);

        // 5) นับ passed / failed จาก history
        this.recomputeStatusCountsFromHistory();

        // 6) สรุป project distribution
        this.calculateProjectDistribution();

        // 7) คำนวณ donut / เกรด
        this.loadDashboardData();

        // 8) ✅ ตรงนี้คือของใหม่: คำนวณ Top Issues จากรายการ issues ที่ดึงมา
        this.buildTopIssues(issues);

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
  }

  // ==== NEW PASSWORD VALIDATION (Change Password Modal) ====
  get newPasswordRules() {
    const pwd = this.passwordData?.newPassword || '';
    return {
      minLength: pwd.length >= 8,
      upper: /[A-Z]/.test(pwd),
      lower: /[a-z]/.test(pwd),
      number: /\d/.test(pwd),
      special: /[!@#$%&*]/.test(pwd),
    };
  }

  get newPasswordValid() {
    const r = this.newPasswordRules;
    return r.minLength && r.upper && r.lower && r.number && r.special;
  }

  get newPasswordsMismatch() {
    return (
      !!this.passwordData?.newPassword &&
      !!this.passwordData?.confirmPassword &&
      this.passwordData.newPassword !== this.passwordData.confirmPassword
    );
  }

  get newPasswordError() {
    const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%&*]).{8,}$/;
    const pwd = this.passwordData?.newPassword || '';
    return pwd && !pattern.test(pwd)
      ? 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      : '';
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
        Swal.fire({
          icon: 'success',
          title: 'Success',
          text: 'Password changed successfully',
          confirmButtonColor: '#3085d6',
        }).then(() => {
          this.closeChangePasswordModal();
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
    this.notificationService.getAllNotification().subscribe({
      next: (data) => {
        // แปลง createdAt เป็น Date object
        this.notifications = data.map((n) => ({
          ...n,
          timestamp: new Date(n.createdAt), // ใช้ field timestamp ใน template
        }));
      },
      error: (err) => {
        console.error('Error loading notifications:', err);
      },
    });
  }

  getTimeAgo(value: Date | string | number): string {
    const t =
      value instanceof Date ? value.getTime() : new Date(value).getTime();
    if (Number.isNaN(t)) return 'Just now';
    let diffSec = Math.floor((Date.now() - t) / 1000);
    if (diffSec < 0) diffSec = 0;
    const m = Math.floor(diffSec / 60),
      h = Math.floor(diffSec / 3600),
      d = Math.floor(diffSec / 86400);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  }

  toggleNotifications() {
    this.showNotifications = !this.showNotifications;
  }

  closeNotifications() {
    this.showNotifications = false;
  }

  markAllRead() {
    this.notifications.forEach((n) => (n.read = true));
  }

  selectTab(tab: NotificationTab) {
    this.activeTab = tab;
    this.displayCount = 5;
  }

  viewNotification(n: Notification) {
    this.notificationService.checkNotification(n.notiId).subscribe({
      next: (res) => {
        n.read = true; // อัปเดตสถานะใน frontend หลังจาก backend ตอบกลับสำเร็จ
        console.log('Notification marked as read:', res);
      },
      error: (err) => {
        console.error('Failed to mark as read:', err);
      },
    });
  }

  get filteredNotifications() {
    let filtered = this.notifications;
    if (this.activeTab === 'Unread') {
      filtered = filtered.filter((n) => !n.read);
    } else if (this.activeTab !== 'All') {
      filtered = filtered.filter((n) => n.typeNoti === this.activeTab);
    }
    filtered = filtered.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
    return filtered.slice(0, this.displayCount);
  }

  get unreadCount() {
    return this.notifications.filter((n) => !n.read).length;
  }

  loadMore() {
    this.displayCount += 5;
  }

  get totalFilteredCount() {
    if (this.activeTab === 'All') return this.notifications.length;
    if (this.activeTab === 'Unread')
      return this.notifications.filter((n) => !n.read).length;
    return this.notifications.filter((n) => n.typeNoti === this.activeTab)
      .length;
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

  private notEmpty(v: unknown): boolean {
    return v !== null && v !== undefined && String(v).trim() !== '';
  }

  private isValidGateLetter(v?: string): boolean {
    return /^[A-E]$/i.test((v || '').trim());
  }

  private getGradeColor(grade: string): string {
    switch (grade?.toUpperCase()) {
      case 'A':
        return '#10B981'; // เขียว
      case 'B':
        return '#84CC16';
      case 'C':
        return '#F59E0B';
      case 'D':
        return '#FB923C';
      case 'E':
        return '#EF4444';
      default:
        return '#6B7280'; // เทา
    }
  }

  // ================== โหลดข้อมูลสำหรับโดนัทและการ์ด ==================
  loadDashboardData() {
    const latest = this.getLatestScanByProject();
    const norm = (s?: string) => (s || '').trim().toUpperCase();
    const validLatest = latest.filter((s) => this.notEmpty(s.status));

    // ✅ pass ได้เฉพาะ 3 ตัวนี้เท่านั้น
    const passedCount = validLatest.filter((s) => {
      const st = norm(s.status);
      return st === 'PASSED' || st === 'OK' || st === 'SUCCESS';
    }).length;

    // ✅ ที่เหลือคือ failed ทั้งหมด
    const failedCount = validLatest.filter((s) => {
      const st = norm(s.status);
      return !(st === 'PASSED' || st === 'OK' || st === 'SUCCESS');
    }).length;
    console.log('Passed Count:', passedCount, 'Failed Count:', failedCount);
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

    let centerLetter: 'A' | 'B' | 'C' | 'D' | 'E';
    if (this.isValidGateLetter(this.avgGateLetter)) {
      centerLetter = this.avgGateLetter;
    } else {
      centerLetter = (this.grade === 'F' ? 'E' : this.grade) as
        | 'A'
        | 'B'
        | 'C'
        | 'D'
        | 'E';
    }

    this.pieChartOptions = {
      chart: { type: 'donut', height: 300 },
      series: [this.gradePercent, 100 - this.gradePercent],
      labels: ['SUCCESS', 'FAILED'],
      colors: [this.getGradeColor(centerLetter), '#EF4444'],
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              name: { show: false },
              value: {
                show: true,
                // ใช้ formatter แทน label ตรง ๆ
                formatter: () => this.grade,
                fontSize: '50px',
                fontWeight: 700,
                color: 'var(--text-main)',
              },
              total: {
                show: true,
                // ใช้ formatter แทน label ตรง ๆ
                formatter: () => this.grade,
                fontSize: '50px',
                fontWeight: 700,
                color: 'var(--text-main)',
              },
            },
          },
        },
      },
      dataLabels: { enabled: true },

      legend: { show: true },
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
    pdf.text(`Coverage: ${this.codeSmellCount}`, margin, y);
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

  viewDetail(scan: ScanResponseDTO) {
    this.sharedData.ScansDetail = scan;
    this.router.navigate(['/scanresult', scan.id]);
  }
  mockCoverageTrend() {
    // mock วันที่ย้อนหลัง 30 วัน
    const dates: string[] = [];
    const coverageValues: number[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);

      const dateKey = d.toISOString().slice(0, 10); // YYYY-MM-DD

      const label = d.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
      });

      dates.push(label);

      coverageValues.push(this.countQuality(dateKey));
    }
    const maxY = Math.max(1, ...coverageValues);
    this.coverageChartSeries = [
      {
        name: 'Quality Grade',
        data: coverageValues,
      },
    ];

    this.coverageChartOptions = {
      chart: {
        type: 'line',
        height: 300,
        toolbar: { show: false },
        zoom: { enabled: false }
      },
      xaxis: {
        categories: dates,
      },
      yaxis: {
        min: 0,
        max: maxY,
        title: { text: 'Quality Grade' },
      },
      stroke: {
        curve: 'smooth',
        width: 3,
      },
      markers: {
        size: 4,
      },
      colors: ['#0d6efd'], // bootstrap primary
    };
  }

}
