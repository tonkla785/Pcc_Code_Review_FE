import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { WebSocketService } from './services/websocket/websocket.service';
import { SharedDataService } from './services/shared-data/shared-data.service';
import { TechnicalDebtDataService } from './services/shared-data/technicaldebt-data.service';
import { NotificationDataService } from './services/shared-data/notification-data.service';
import { UserSettingsDataService } from './services/shared-data/user-settings-data.service';
import { RepositoryService } from './services/reposervice/repository.service';
import { ScanService } from './services/scanservice/scan.service';
import { IssueService } from './services/issueservice/issue.service';
import { AuthService } from './services/authservice/auth.service';
import { NotificationService } from './services/notiservice/notification.service';
import { TokenStorageService } from './services/tokenstorageService/token-storage.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, bufferTime, filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, MatSnackBarModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'codereviewFE';
  darkMode = false;
  private wsSub?: Subscription;
  private notiSub?: Subscription;
  private verifySub?: Subscription;

  constructor(
    private ws: WebSocketService,
    private sharedData: SharedDataService,
    private technicalDebtData: TechnicalDebtDataService,
    private notificationData: NotificationDataService,
    private userSettingsData: UserSettingsDataService,
    private repoService: RepositoryService,
    private scanService: ScanService,
    private issueService: IssueService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private tokenStorage: TokenStorageService,
    private snack: MatSnackBar
  ) { }

  // toggleTheme() {
  //   this.darkMode = !this.darkMode;

  //   if (this.darkMode) {
  //     document.body.classList.add('dark-mode');
  //   } else {
  //     document.body.classList.remove('dark-mode');
  //   }
  // }

  ngOnInit() {

    // Check localStorage on load / ตรวจสอบค่าจาก localStorage เมื่อโหลดหน้าเว็บ
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.darkMode = true;
      document.body.classList.add('dark-mode');
    }

    // Reconnect WebSocket if already logged in (e.g., after page refresh)
    if (this.authService.isLoggedIn) {
      this.authService.reconnectWebSocket();

      // Restore user status from localStorage into SharedDataService
      const savedUser = this.tokenStorage.getLoginUser();
      if (savedUser) {
        this.sharedData.LoginUserShared = savedUser;
        console.log('[AppComponent] Restored user from localStorage:', savedUser.status);
      }
    }

    this.subscribeToNotifications();

    // Global WebSocket Listener
    this.wsSub = this.ws.subscribeScanStatus().subscribe(event => {
      console.log('[AppComponent] WS Event:', event);
      console.log('[AppComponent] WS Event projectId:', event.projectId, 'status:', event.status);

      const mappedStatus = this.mapStatus(event.status);

      // อัปเดตสถานะ Repo ใน SharedData ทันที (UI List)
      this.sharedData.updateRepoStatus(
        event.projectId,
        mappedStatus,
        event.status === 'SCANNING' ? 0 : event.status === 'SUCCESS' ? 100 : 0
      );

      // กรณีที่ 1: เริ่มต้น Scan (SCANNING)
      if (event.status === 'SCANNING') {
        // [Refactor] ไม่เก็บ localStorage แล้ว
        // console.log('[AppComponent] Setting localStorage for:', event.projectId);
        // localStorage.setItem(`repo-status-${event.projectId}`, mappedStatus);

        // 2. ดึงข้อมูลรอบแรก (เพื่ออัปเดต UI และ History ว่ากำลังหมุน - PENDING from DB)
        this.fetchScanData(event.projectId, event.status);
      }

      // กรณีที่ 2: Scan เสร็จสิ้น (SUCCESS หรือ FAILED)
      else if (event.status === 'SUCCESS' || event.status === 'FAILED') {
        // [Refactor] ไม่ต้องลบ localStorage (เพราะไม่ได้เก็บ)
        // console.log('[AppComponent] Removing localStorage for:', event.projectId);
        // localStorage.removeItem(`repo-status-${event.projectId}`);

        // 2. แจ้งเตือน User (Snackbar)
        const settings = this.userSettingsData.notificationSettings;
        const showScanAlert = !settings || settings.scansEnabled;

        if (showScanAlert) {
          this.snack.open(
            event.status === 'SUCCESS' ? 'Scan Successful' : 'Scan Failed',
            '',
            {
              duration: 3000,
              horizontalPosition: 'right',
              verticalPosition: 'top',
              panelClass: ['app-snack', event.status === 'SUCCESS' ? 'app-snack-green' : 'app-snack-red']
            }
          );
        }

        // 3. ดึงข้อมูลรอบสอง (และสร้าง notification หลังจากได้ scanId ที่ถูกต้อง)
        this.fetchScanDataAndNotify(event.projectId, event.status);

        // 4. ดึง Issues ใหม่มาทับ (ถ้า Success หรือ Failed)
        if (event.status === 'SUCCESS' || event.status === 'FAILED') {
          this.fetchAndOverwriteIssues();
        }
      }
    });

    // Global WebSocket Listener for Project Changes
    this.ws.subscribeProjectChanges().subscribe(event => {
      console.log('[AppComponent] Project change event:', event);

      if (event.action === 'DELETED') {
        // Optimized: Remove directly from SharedData without refetching
        this.sharedData.removeRepository(event.projectId);

        // Clear technical debt data when project is deleted
        this.technicalDebtData.clearAllDebtData();

        this.snack.open(
          `Project "${event.projectName}" was deleted`,
          '',
          {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['app-snack', 'app-snack-blue']
          }
        );
      } else {
        // For ADDED / UPDATED -> Refresh repository list
        this.repoService.getAllRepo().subscribe({
          next: (repos: any[]) => {
            this.sharedData.setRepositories(repos);
            console.log('[AppComponent] Repositories refreshed after project change:', event.action);

            // Show notification to user
            const actionText = event.action === 'ADDED' ? 'added' : 'updated';
            this.snack.open(
              `Project "${event.projectName}" was ${actionText}`,
              '',
              {
                duration: 3000,
                horizontalPosition: 'right',
                verticalPosition: 'top',
                panelClass: ['app-snack', 'app-snack-blue']
              }
            );
          },
          error: (err: any) => console.error('[AppComponent] Failed to refresh repos:', err)
        });
      }
    });

    // Listen verify status realtime
    this.verifySub = this.ws.subscribeVerifyStatus().subscribe(event => {
      console.log('[AppComponent] Verify status event:', event);

      // 0. ตรวจสอบว่า userId ตรงกับ user ปัจจุบันหรือไม่
      const user = this.tokenStorage.getLoginUser();
      if (!user || user.id !== event.userId) {
        console.warn('[AppComponent] Verify status ignored - userId mismatch. Event userId:', event.userId, 'Current userId:', user?.id);
        return;
      }

      // 1. Update LocalStorage (use TokenStorageService to write to correct key 'login_user')
      user.status = event.status;
      this.tokenStorage.setLoginUser(user);

      // 2. Update SharedDataService so other components (Dashboard) update immediately
      this.sharedData.LoginUserShared = user;

      // 3. Notify User
      this.snack.open(
        event.status === 'VERIFIED'
          ? '✅ Email Verified'
          : event.status === 'PENDING_VERIFICATION'
            ? '⏳ Verification Pending'
            : '❌ Email Unverified',
        '',
        {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-blue']
        }
      );
    });

    // Global WebSocket Listener for Issue Changes (assign / status update)
    this.ws.subscribeIssueChanges().subscribe(event => {
      console.log('[AppComponent] Issue change event:', event);

      if (event.action === 'UPDATED') {
        // 1. Refresh all issues list (for issue list page)
        this.issueService.getAllIssues().subscribe({
          next: (allIssues) => {
            this.sharedData.IssuesShared = allIssues;
            console.log('[AppComponent] Issues refreshed after issue change');
          },
          error: (err: any) => console.error('[AppComponent] Failed to refresh issues:', err)
        });

        // 2. If user is on issue detail page, refresh the selected issue too
        const currentSelected = this.sharedData.selectIssueValue;
        if (currentSelected && currentSelected.id === event.issueId) {
          this.issueService.getAllIssuesById(event.issueId).subscribe({
            next: (updatedIssue) => {
              this.sharedData.SelectedIssues = updatedIssue;
              console.log('[AppComponent] Selected issue refreshed:', event.issueId);
            },
            error: (err: any) => console.error('[AppComponent] Failed to refresh selected issue:', err)
          });
        }
      }
    });
  }

  private subscribeToNotifications(): void {
    this.notiSub = this.notificationData.newNotification$.pipe(
      bufferTime(2000),
      filter(list => list.length > 0)
    ).subscribe(notifications => {

      //ตรวจIssues
      if (notifications.some(n => n.type === 'Issues')) {
        const settings = this.userSettingsData.notificationSettings;
        if (!settings || settings.issuesEnabled) {
          this.snack.open('🔔 You have new Issues', '', {
            duration: 4000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['app-snack', 'app-snack-blue']
          });
        }
      }

      //ตรวจSystem
      const systemNotis = notifications.filter(n => n.type === 'System');
      if (systemNotis.length > 0) {
        const settings = this.userSettingsData.notificationSettings;
        if (!settings || settings.systemEnabled) {
          const hasQualityGate = systemNotis.some(n => n.title.toLowerCase().includes('quality gate'));
          const hasComment = systemNotis.some(n => n.title.toLowerCase().includes('comment'));
          const hasAssigned = systemNotis.some(n => n.title.toLowerCase().includes('assigned'));

          if (hasQualityGate) {
            this.snack.open('🔔 Quality Gate is failed', '', {
              duration: 4000,
              horizontalPosition: 'right',
              verticalPosition: 'top',
              panelClass: ['app-snack', 'app-snack-blue']
            });
          } else if (hasComment) {
            this.snack.open('🔔 You have new comment', '', {
              duration: 4000,
              horizontalPosition: 'right',
              verticalPosition: 'top',
              panelClass: ['app-snack', 'app-snack-blue']
            });
          } else if (hasAssigned) {
            this.snack.open('🔔 You have new assigned', '', {
              duration: 4000,
              horizontalPosition: 'right',
              verticalPosition: 'top',
              panelClass: ['app-snack', 'app-snack-blue']
            });
          } else {
            this.snack.open('🔔 New System Notification', '', {
              duration: 4000,
              horizontalPosition: 'right',
              verticalPosition: 'top',
              panelClass: ['app-snack', 'app-snack-blue']
            });
          }
        }
      }
    });
  }

  // แยกฟังก์ชันดึงข้อมูลออกมา เพื่อให้เรียกใช้ได้ 2 รอบ (ตอนเริ่ม และ ตอนจบ Scan)
  private fetchScanData(projectId: string, wsStatus: string) {
    // ไม่ต้องหน่วงเวลาแล้ว (Backend ส่ง Event หลังจาก Commit แล้ว)
    this.repoService.getFullRepository(projectId).subscribe({
      next: (fullRepo) => {
        if (!fullRepo) {
          console.warn('[AppComponent] Full Repo is null for project:', projectId);
          return;
        }
        console.log('[AppComponent] Full Repo fetched:', fullRepo);

        // 1. อัปเดตข้อมูล Repository ในหน้า List
        const merged = this.sharedData.repositoriesValue.map(repo => {
          if (repo.projectId === projectId) {
            return {
              ...repo,
              ...fullRepo,
              status: this.mapStatus(wsStatus) // ใช้ Status ล่าสุดจาก WebSocket
            };
          }
          return repo;
        });
        this.sharedData.setRepositories(merged);

        // 2. อัปเดตประวัติการสแกน (Scan History) โดยดึงจาก list ล่าสุด
        if (fullRepo.scans && fullRepo.scans.length > 0) {
          const latestScan = fullRepo.scans.reduce((prev, current) =>
            (new Date(current.startedAt).getTime() > new Date(prev.startedAt).getTime()) ? current : prev
          );

          // แก้ไข Race condition เผื่อไว้ (ถ้า DB status ยังไม่อัปเดต ให้เชื่อ WebSocket)
          // Map WebSocket status to DB status if there's a mismatch
          if (latestScan.status === 'PENDING') {
            if (wsStatus === 'SCANNING' || wsStatus === 'SUCCESS' || wsStatus === 'FAILED') {
              // DB ยังเป็น PENDING แต่ WebSocket บอกสถานะใหม่
              // สำหรับ SCANNING ให้คง PENDING เพราะ PENDING คือสถานะที่ถูกต้องใน DB
              // สำหรับ SUCCESS/FAILED ให้ override เพราะ WebSocket เร็วกว่า DB update  
              if (wsStatus === 'SUCCESS' || wsStatus === 'FAILED') {
                latestScan.status = wsStatus as 'PENDING' | 'SUCCESS' | 'FAILED';
              }
              // Note: PENDING stays as PENDING, scanhistory UI should show this as "In Progress"
            }
          }

          // [สำคัญ] อัปเดต scanId ของ Repo ให้ชี้ไปที่ Scan ล่าสุดเสมอ
          const repoIndex = this.sharedData.repositoriesValue.findIndex(r => r.projectId === projectId);
          if (repoIndex >= 0) {
            const currentRepos = this.sharedData.repositoriesValue;
            currentRepos[repoIndex] = {
              ...currentRepos[repoIndex],
              scanId: latestScan.id // อัปเดต scanId ให้ลิงก์ไปหน้า Detail ถูกต้อง
            };
            this.sharedData.setRepositories(currentRepos);
          }

          // ส่งข้อมูล Scan ล่าสุดเข้า SharedData
          this.sharedData.upsertScan(latestScan);
          console.log('[AppComponent] Upserted latest scan from list:', latestScan);
        } else {
          console.warn('[AppComponent] No scans found in fullRepo list for project:', projectId);
        }
      },
      error: err => console.error('Failed to refresh full repo', err)
    });
  }

  /**
   * Fetch scan data AND create notification with correct scanId from API
   * (ใช้เฉพาะตอน scan เสร็จ SUCCESS/FAILED)
   */
  private fetchScanDataAndNotify(projectId: string, wsStatus: string) {
    this.repoService.getFullRepository(projectId).subscribe({
      next: (fullRepo) => {
        if (!fullRepo) {
          console.warn('[AppComponent] Full Repo is null for project:', projectId);
          return;
        }
        console.log('[AppComponent] Full Repo fetched for notification:', fullRepo);

        const projectName = fullRepo.name || 'Unknown Project';

        // 1. อัปเดตข้อมูล Repository ในหน้า List
        const merged = this.sharedData.repositoriesValue.map(repo => {
          if (repo.projectId === projectId) {
            return {
              ...repo,
              ...fullRepo,
              status: this.mapStatus(wsStatus)
            };
          }
          return repo;
        });
        this.sharedData.setRepositories(merged);

        // 2. อัปเดตประวัติการสแกน และสร้าง Notification
        if (fullRepo.scans && fullRepo.scans.length > 0) {
          const latestScan = fullRepo.scans.reduce((prev, current) =>
            (new Date(current.startedAt).getTime() > new Date(prev.startedAt).getTime()) ? current : prev
          );

          // แก้ไข Race condition เผื่อไว้ (ถ้า DB status ยังไม่อัปเดต ให้เชื่อ WebSocket)
          if (latestScan.status === 'PENDING') {
            if (wsStatus === 'SUCCESS' || wsStatus === 'FAILED') {
              latestScan.status = wsStatus as 'PENDING' | 'SUCCESS' | 'FAILED';
            }
          }

          // อัปเดต scanId
          const repoIndex = this.sharedData.repositoriesValue.findIndex(r => r.projectId === projectId);
          if (repoIndex >= 0) {
            const currentRepos = this.sharedData.repositoriesValue;
            currentRepos[repoIndex] = {
              ...currentRepos[repoIndex],
              scanId: latestScan.id
            };
            this.sharedData.setRepositories(currentRepos);
          }

          this.sharedData.upsertScan(latestScan);
          console.log('[AppComponent] Upserted latest scan:', latestScan);

          // 3. สร้าง Notification ด้วย scanId ที่ถูกต้องจาก API
          this.createScanNotification(projectId, latestScan.id, wsStatus, projectName);
        } else {
          console.warn('[AppComponent] No scans found for notification:', projectId);
        }
      },
      error: err => console.error('Failed to refresh full repo for notification', err)
    });
  }

  // ดึง Issue ทั้งหมด แล้วเอาไปทับใน SharedData เลย (สำหรับอัปเดตหน้า Issue แบบ Real-time)
  private fetchAndOverwriteIssues() {
    // ไม่ต้องหน่วงเวลาแล้ว
    this.issueService.getAllIssues().subscribe({
      next: (allIssues) => {
        console.log('[AppComponent] Fetched all issues, overwriting SharedData...');
        this.sharedData.IssuesShared = allIssues; // ทับข้อมูลเดิมทั้งหมด
      },
      error: (err) => console.error('[AppComponent] Failed to fetch issues', err)
    });
  }

  /**
   * Create scan notification and save to DB
   */
  private createScanNotification(projectId: string, scanId: string, status: string, projectName?: string): void {
    const userId = this.tokenStorage.getLoginUser()?.id;
    if (!userId) {
      console.warn('[AppComponent] Cannot create notification - no user ID');
      return;
    }

    // Use provided projectName or find from repositories
    const name = projectName || this.sharedData.repositoriesValue.find(r => r.projectId === projectId)?.name || 'Unknown Project';

    const isSuccess = status === 'SUCCESS';
    const title = isSuccess ? '✅ Scan Completed' : '❌ Scan Failed';
    const message = isSuccess
      ? `${name} scan completed successfully`
      : `${name} scan failed`;

    this.notificationService.createNotification({
      userId,
      type: 'Scans',
      title,
      message,
      relatedProjectId: projectId,
      relatedScanId: scanId,
      isBroadcast: true // Broadcast scan notifications to all users
    }).subscribe({
      next: (noti) => console.log('[AppComponent] Scan notification created:', noti),
      error: (err) => console.error('[AppComponent] Failed to create scan notification:', err)
    });
  }

  ngOnDestroy() {
    if (this.wsSub) {
      this.wsSub.unsubscribe();
    }
    if (this.verifySub) {
      this.verifySub.unsubscribe();
    }

  }

  private mapStatus(wsStatus: string): 'Active' | 'Scanning' | 'Error' {
    switch (wsStatus) {
      case 'SCANNING': return 'Scanning';
      case 'SUCCESS': return 'Active';
      case 'FAILED': return 'Error';
      default: return 'Active';
    }
  }

  toggleTheme() {
    this.darkMode = !this.darkMode;

    if (this.darkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark'); // บันทึกลง localStorage
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light'); // บันทึกลง localStorage
    }
  }

}
