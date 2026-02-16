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
import { Subscription, bufferTime, filter, of } from 'rxjs';
import { switchMap, catchError, distinctUntilChanged, map } from 'rxjs/operators';
import { UserService } from './services/userservice/user.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, MatSnackBarModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'codereviewFE';
  darkMode = false;

  private wsSub?: Subscription;
  private notiSub?: Subscription;
  private verifySub?: Subscription;

  // ✅ new
  private loginUserSub?: Subscription;
  private bootstrapSub?: Subscription;
  private projectSub?: Subscription;
  private issueSub?: Subscription;

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
    private snack: MatSnackBar,
    private userService: UserService,
  ) {}

  ngOnInit() {
    // Theme restore
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.darkMode = true;
      document.body.classList.add('dark-mode');
    }

    /**
     * ✅ สำคัญสุด: ผูก WS + state กับ loginUser$ (แก้เคส login ใหม่ๆ แล้วไม่ connect / connect user เก่าค้าง)
     * - ได้ user -> connect ws
     * - sync เข้ากับ SharedData
     * - bootstrap ดึง user ล่าสุดจาก API 1 ครั้ง (กัน status ไม่ขยับเพราะยังไม่มี WS event)
     */
    this.loginUserSub = this.tokenStorage.loginUser$
      .pipe(
        map(u => u?.id || null),
        distinctUntilChanged(),
      )
      .subscribe((userId) => {
        if (!userId) return;

        // 1) connect websocket ให้แน่
        this.ws.connect(userId);
        this.notificationService.connectWebSocket(userId);

        // 2) restore shared data จาก localStorage (ทันที)
        const savedUser = this.tokenStorage.getLoginUser();
        if (savedUser) {
          this.sharedData.LoginUserShared = savedUser;
          console.log('[AppComponent] loginUser$ -> connect WS, restore user:', savedUser.status);
        }

        // 3) bootstrap: ดึง user ล่าสุดจาก backend 1 ครั้ง (กัน status stale)
        this.bootstrapSub?.unsubscribe();
        this.bootstrapSub = this.userService.getUserById(userId).pipe(
          catchError(err => {
            console.error('[AppComponent] bootstrap getUserById failed:', err);
            return of(null);
          }),
          filter(u => !!u),
        ).subscribe((freshUser: any) => {
          const current = this.tokenStorage.getLoginUser();
          if (!current) return;

          const merged = { ...current, ...freshUser, status: freshUser.status };
          this.tokenStorage.setLoginUser(merged);
          this.sharedData.LoginUserShared = merged;

          console.log('[AppComponent] bootstrap fresh user:', merged.status);
        });
      });

    /**
     * ✅ เคส refresh page แล้วมี token อยู่แต่ login_user ยังไม่ set:
     * AuthService.reconnectWebSocket() ของมึงทำแค่ connect แต่ไม่ได้ set login_user เสมอ
     * ดังนั้น call เดิมไว้ได้ แต่หลักๆให้ loginUser$ เป็นตัวคุม
     */
    if (this.authService.isLoggedIn) {
      this.authService.reconnectWebSocket();

      const savedUser = this.tokenStorage.getLoginUser();
      if (savedUser) {
        this.sharedData.LoginUserShared = savedUser;
        console.log('[AppComponent] Restored user from localStorage:', savedUser.status);
      }
    }

    this.subscribeToNotifications();

    // Global WebSocket Listener - Scan
    this.wsSub = this.ws.subscribeScanStatus().subscribe((event) => {
      console.log('[AppComponent] WS Event:', event);

      const mappedStatus = this.mapStatus(event.status);

      this.sharedData.updateRepoStatus(
        event.projectId,
        mappedStatus,
        event.status === 'SCANNING' ? 0 : event.status === 'SUCCESS' ? 100 : 0,
      );

      if (event.status === 'SCANNING') {
        this.fetchScanData(event.projectId, event.status);
      } else if (event.status === 'SUCCESS' || event.status === 'FAILED') {
        const settings = this.userSettingsData.notificationSettings;
        const showScanAlert = !settings || settings.scansEnabled;

        if (showScanAlert && this.authService.isLoggedIn) {
          this.snack.open(
            event.status === 'SUCCESS' ? 'Scan Successful' : 'Scan Failed',
            '',
            {
              duration: 3000,
              horizontalPosition: 'right',
              verticalPosition: 'top',
              panelClass: [
                'app-snack',
                event.status === 'SUCCESS' ? 'app-snack-green' : 'app-snack-red',
              ],
            },
          );
        }

        this.fetchScanDataAndNotify(event.projectId, event.status);
        this.fetchAndOverwriteIssues();
      }
    });

    // Global WebSocket Listener - Project Changes
    this.projectSub = this.ws.subscribeProjectChanges().subscribe((event) => {
      console.log('[AppComponent] Project change event:', event);

      if (event.action === 'DELETED') {
        this.sharedData.removeRepository(event.projectId);
        this.technicalDebtData.clearAllDebtData();

        if (this.authService.isLoggedIn) {
          this.snack.open(`Project "${event.projectName}" was deleted`, '', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['app-snack', 'app-snack-red'],
          });
        }
      } else {
        this.repoService.getAllRepo().subscribe({
          next: (repos: any[]) => {
            this.sharedData.setRepositories(repos);
            console.log('[AppComponent] Repositories refreshed after project change:', event.action);

            if (this.authService.isLoggedIn) {
              const actionText = event.action === 'ADDED' ? 'added' : 'updated';
              this.snack.open(`Project "${event.projectName}" was ${actionText}`, '', {
                duration: 3000,
                horizontalPosition: 'right',
                verticalPosition: 'top',
                panelClass: ['app-snack', 'app-snack-blue'],
              });
            }
          },
          error: (err: any) => console.error('[AppComponent] Failed to refresh repos:', err),
        });
      }
    });

    // ✅ Verify status realtime
    // NOTE: ใช้ currentUserId จาก loginUser$ เพื่อลด race (อย่าไปอ่าน getLoginUser() ตอน filter แล้วคาดหวังว่าจะทัน)
    this.verifySub = this.ws
      .subscribeVerifyStatus()
      .pipe(
        switchMap((event: any) => {
          const currentUserId = this.tokenStorage.getLoginUser()?.id;
          const ok = !!currentUserId && currentUserId === event.userId;

          if (!ok) {
            console.warn('[AppComponent] Verify status ignored - userId mismatch.',
              'Event userId:', event.userId, 'Current userId:', currentUserId);
            return of(null);
          }

          return this.userService.getUserById(event.userId).pipe(
            catchError((err) => {
              console.error('[AppComponent] getUserById failed:', err);
              return of(null);
            }),
          );
        }),
        filter((freshUser: any) => !!freshUser),
      )
      .subscribe((freshUser: any) => {
        console.log('[AppComponent] Fresh user from API:', freshUser);

        const current = this.tokenStorage.getLoginUser();
        if (!current) return;

        const merged = { ...current, ...freshUser, status: freshUser.status };
        this.tokenStorage.setLoginUser(merged);
        this.sharedData.LoginUserShared = merged;

        if (this.authService.isLoggedIn) {
          this.snack.open(
            freshUser.status === 'VERIFIED'
              ? '✅ Email Verified'
              : freshUser.status === 'PENDING_VERIFICATION'
                ? '⏳ Verification Pending'
                : '❌ Email Unverified',
            '',
            {
              duration: 3000,
              horizontalPosition: 'right',
              verticalPosition: 'top',
              panelClass: ['app-snack', 'app-snack-blue'],
            },
          );
        }
      });

    // Global WebSocket Listener - Issue Changes
    this.issueSub = this.ws.subscribeIssueChanges().subscribe((event) => {
      console.log('[AppComponent] Issue change event:', event);

      if (event.action === 'UPDATED') {
        this.issueService.getAllIssues().subscribe({
          next: (allIssues) => {
            this.sharedData.IssuesShared = allIssues;
            console.log('[AppComponent] Issues refreshed after issue change');
          },
          error: (err: any) => console.error('[AppComponent] Failed to refresh issues:', err),
        });

        const currentSelected = this.sharedData.selectIssueValue;
        if (currentSelected && currentSelected.id === event.issueId) {
          this.issueService.getAllIssuesById(event.issueId).subscribe({
            next: (updatedIssue) => {
              this.sharedData.SelectedIssues = updatedIssue;
              console.log('[AppComponent] Selected issue refreshed:', event.issueId);
            },
            error: (err: any) =>
              console.error('[AppComponent] Failed to refresh selected issue:', err),
          });
        }
      }
    });
  }

  private subscribeToNotifications(): void {
    this.notiSub = this.notificationData.newNotification$
      .pipe(bufferTime(2000), filter((list) => list.length > 0))
      .subscribe((notifications) => {
        if (!this.authService.isLoggedIn) return;

        if (notifications.some((n) => n.type === 'Issues')) {
          const settings = this.userSettingsData.notificationSettings;
          if (!settings || settings.issuesEnabled) {
            this.snack.open('🔔 You have new Issues', '', {
              duration: 4000,
              horizontalPosition: 'right',
              verticalPosition: 'top',
              panelClass: ['app-snack', 'app-snack-blue'],
            });
          }
        }

        const systemNotis = notifications.filter((n) => n.type === 'System');
        if (systemNotis.length > 0) {
          const settings = this.userSettingsData.notificationSettings;
          if (!settings || settings.systemEnabled) {
            const hasQualityGate = systemNotis.some((n) =>
              n.title.toLowerCase().includes('quality gate'),
            );
            const hasComment = systemNotis.some((n) =>
              n.title.toLowerCase().includes('comment'),
            );
            const hasAssigned = systemNotis.some((n) =>
              n.title.toLowerCase().includes('assigned'),
            );

            if (hasQualityGate) {
              this.snack.open('🔔 Quality Gate is failed', '', {
                duration: 4000,
                horizontalPosition: 'right',
                verticalPosition: 'top',
                panelClass: ['app-snack', 'app-snack-blue'],
              });
            } else if (hasComment) {
              this.snack.open('🔔 You have new comment', '', {
                duration: 4000,
                horizontalPosition: 'right',
                verticalPosition: 'top',
                panelClass: ['app-snack', 'app-snack-blue'],
              });
            } else if (hasAssigned) {
              this.snack.open('🔔 You have new assigned', '', {
                duration: 4000,
                horizontalPosition: 'right',
                verticalPosition: 'top',
                panelClass: ['app-snack', 'app-snack-blue'],
              });
            } else {
              this.snack.open('🔔 New System Notification', '', {
                duration: 4000,
                horizontalPosition: 'right',
                verticalPosition: 'top',
                panelClass: ['app-snack', 'app-snack-blue'],
              });
            }
          }
        }
      });
  }

  private fetchScanData(projectId: string, wsStatus: string) {
    this.repoService.getFullRepository(projectId).subscribe({
      next: (fullRepo) => {
        if (!fullRepo) {
          console.warn('[AppComponent] Full Repo is null for project:', projectId);
          return;
        }

        const mergedRepos = this.sharedData.repositoriesValue.map((repo) => {
          if (repo.projectId === projectId) {
            return { ...repo, ...fullRepo, status: this.mapStatus(wsStatus) };
          }
          return repo;
        });
        this.sharedData.setRepositories(mergedRepos);

        if (fullRepo.scans && fullRepo.scans.length > 0) {
          const latestScan = fullRepo.scans.reduce((prev, current) =>
            new Date(current.startedAt).getTime() > new Date(prev.startedAt).getTime()
              ? current
              : prev,
          );

          if (latestScan.status === 'PENDING') {
            if (wsStatus === 'SUCCESS' || wsStatus === 'FAILED') {
              latestScan.status = wsStatus as 'PENDING' | 'SUCCESS' | 'FAILED';
            }
          }

          const repoIndex = this.sharedData.repositoriesValue.findIndex(
            (r) => r.projectId === projectId,
          );
          if (repoIndex >= 0) {
            const currentRepos = this.sharedData.repositoriesValue;
            currentRepos[repoIndex] = {
              ...currentRepos[repoIndex],
              scanId: latestScan.id,
            };
            this.sharedData.setRepositories(currentRepos);
          }

          this.sharedData.upsertScan(latestScan);
        }
      },
      error: (err) => console.error('Failed to refresh full repo', err),
    });
  }

  private fetchScanDataAndNotify(projectId: string, wsStatus: string) {
    this.repoService.getFullRepository(projectId).subscribe({
      next: (fullRepo) => {
        if (!fullRepo) return;

        const projectName = fullRepo.name || 'Unknown Project';

        const mergedRepos = this.sharedData.repositoriesValue.map((repo) => {
          if (repo.projectId === projectId) {
            return { ...repo, ...fullRepo, status: this.mapStatus(wsStatus) };
          }
          return repo;
        });
        this.sharedData.setRepositories(mergedRepos);

        if (fullRepo.scans && fullRepo.scans.length > 0) {
          const latestScan = fullRepo.scans.reduce((prev, current) =>
            new Date(current.startedAt).getTime() > new Date(prev.startedAt).getTime()
              ? current
              : prev,
          );

          if (latestScan.status === 'PENDING') {
            if (wsStatus === 'SUCCESS' || wsStatus === 'FAILED') {
              latestScan.status = wsStatus as 'PENDING' | 'SUCCESS' | 'FAILED';
            }
          }

          const repoIndex = this.sharedData.repositoriesValue.findIndex(
            (r) => r.projectId === projectId,
          );
          if (repoIndex >= 0) {
            const currentRepos = this.sharedData.repositoriesValue;
            currentRepos[repoIndex] = {
              ...currentRepos[repoIndex],
              scanId: latestScan.id,
            };
            this.sharedData.setRepositories(currentRepos);
          }

          this.sharedData.upsertScan(latestScan);
          this.createScanNotification(projectId, latestScan.id, wsStatus, projectName);
        }
      },
      error: (err) => console.error('Failed to refresh full repo for notification', err),
    });
  }

  private fetchAndOverwriteIssues() {
    this.issueService.getAllIssues().subscribe({
      next: (allIssues) => {
        this.sharedData.IssuesShared = allIssues;
      },
      error: (err) => console.error('[AppComponent] Failed to fetch issues', err),
    });
  }

  private createScanNotification(
    projectId: string,
    scanId: string,
    status: string,
    projectName?: string,
  ): void {
    const userId = this.tokenStorage.getLoginUser()?.id;
    if (!userId) return;

    const name =
      projectName ||
      this.sharedData.repositoriesValue.find((r) => r.projectId === projectId)?.name ||
      'Unknown Project';

    const isSuccess = status === 'SUCCESS';
    const title = isSuccess ? '✅ Scan Completed' : '❌ Scan Failed';
    const message = isSuccess ? `${name} scan completed successfully` : `${name} scan failed`;

    this.notificationService
      .createNotification({
        userId,
        type: 'Scans',
        title,
        message,
        relatedProjectId: projectId,
        relatedScanId: scanId,
        isBroadcast: true,
      })
      .subscribe({
        next: (noti) => console.log('[AppComponent] Scan notification created:', noti),
        error: (err) => console.error('[AppComponent] Failed to create scan notification:', err),
      });
  }


  private mapStatus(wsStatus: string): 'Active' | 'Scanning' | 'Error' {
    switch (wsStatus) {
      case 'SCANNING':
        return 'Scanning';
      case 'SUCCESS':
        return 'Active';
      case 'FAILED':
        return 'Error';
      default:
        return 'Active';
    }
  }

  toggleTheme() {
    this.darkMode = !this.darkMode;

    if (this.darkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }
}
