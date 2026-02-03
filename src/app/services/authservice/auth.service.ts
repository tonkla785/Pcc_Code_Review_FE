import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { tap } from 'rxjs/operators';
import {
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  RegisterRequest,
  UserInfo,
} from '../../interface/user_interface';
import { TokenStorageService } from '../tokenstorageService/token-storage.service';
import { BehaviorSubject } from 'rxjs';
import { NotificationService } from '../notiservice/notification.service';
import { UserSettingsDataService } from '../shared-data/user-settings-data.service';
import { ReportHistoryDataService } from '../shared-data/report-history-data.service';
import { NotificationDataService } from '../shared-data/notification-data.service';
import { UserSettingService } from '../usersettingservice/user-setting.service';
import { ReportHistoryService } from '../reporthistoryservice/report-history.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly base = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private tokenStorage: TokenStorageService,
    private notificationService: NotificationService,
    private userSettingsData: UserSettingsDataService,
    private reportHistoryData: ReportHistoryDataService,
    private notificationData: NotificationDataService,
    private userSettingService: UserSettingService,
    private reportHistoryService: ReportHistoryService
  ) { }

  get token() {
    return this.tokenStorage.getAccessToken();
  }

  get isLoggedIn(): boolean {
    return this.tokenStorage.hasToken();
  }

  login(payload: LoginRequest) {
    return this.http
      .post<LoginResponse>(`${this.base}/user/login`, payload, {
        withCredentials: true,
      })
      .pipe(
        tap((res) => {
          this.tokenStorage.setAccessToken(res.accessToken);
          // Connect WebSocket after login
          const userId = this.getUserIdFromToken(res.accessToken);
          if (userId) {
            this.notificationService.connectWebSocket(userId);
            // Load all user data after login
            this.loadAllUserData();
          }
        })
      );
  }

  /**
   * Load all user data after login
   */
  private loadAllUserData(): void {
    // Load notifications
    this.notificationService.loadNotifications();

    // Load user settings (notification settings + sonarqube config)
    this.userSettingService.loadAllSettings();

    // Load report history
    this.reportHistoryService.loadReportHistory();

    // Load user profile
    this.loadMyProfile().subscribe();
  }

  /**
   * Extract user ID from JWT token
   */
  private getUserIdFromToken(token: string): string | null {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded.sub || decoded.userId || null;
    } catch (e) {
      console.error('Failed to decode token:', e);
      return null;
    }
  }

  register(payload: RegisterRequest) {
    return this.http.post(`${this.base}/user/register`, payload);
  }

  resetPassword(payload: { token: string; newPassword: string }) {
    return this.http.post(`${this.base}/user/reset-password`, payload);
  }

  refresh() {
    return this.http
      .post<RefreshResponse>(
        `${this.base}/user/refresh`,
        {},
        { withCredentials: true },
      )
      .pipe(tap((res) => this.tokenStorage.setAccessToken(res.accessToken)));
  }

  logout() {
    return this.http
      .post(
        `${this.base}/user/logout`,
        {},
        { withCredentials: true, responseType: 'text' as const },
      )
      .pipe(
        tap(() => {
          // Disconnect WebSocket on logout
          this.notificationService.disconnect();

          // Clear all shared data
          this.userSettingsData.clearAll();
          this.reportHistoryData.clearAll();
          this.notificationData.clearAll();

          this.tokenStorage.clear();
        })
      );
  }

  private userProfileSubject = new BehaviorSubject<UserInfo | null>(null);
  userProfile$ = this.userProfileSubject.asObservable();

  loadMyProfile() {
    return this.http
      .get<UserInfo>(`${this.base}/user/search-user`)
      .pipe(tap((profile) => this.userProfileSubject.next(profile)));
  }

  get userProfile(): UserInfo | null {
    return this.userProfileSubject.value;
  }

  /**
   * Reconnect WebSocket and reload all data (call this if user was already logged in on page load)
   */
  reconnectWebSocket(): void {
    const token = this.tokenStorage.getAccessToken();
    if (token) {
      const userId = this.getUserIdFromToken(token);
      if (userId) {
        this.notificationService.connectWebSocket(userId);
        // Load all user data
        this.loadAllUserData();
      }
    }
  }
}


