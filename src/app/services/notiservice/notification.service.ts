import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, tap } from 'rxjs';
import { WebSocketService, NotificationEvent } from '../websocket/websocket.service';
import { NotificationDataService } from '../shared-data/notification-data.service';
import { Notification } from '../../interface/notification_interface';
import { TokenStorageService } from '../tokenstorageService/token-storage.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly webSocketService = inject(WebSocketService);
  private readonly notificationData = inject(NotificationDataService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly base = environment.apiUrl + '/notifications';

  constructor() {
    this.subscribeToWebSocket();
  }

  private getUserId(): string {
    const user = this.tokenStorage.getLoginUser();
    return user?.id || '';
  }

  /**
   * Subscribe to WebSocket notifications
   */
  private subscribeToWebSocket(): void {
    this.webSocketService.subscribeNotifications().subscribe({
      next: (event: NotificationEvent) => {
        // Add new notification to shared data
        const notification: Notification = {
          id: event.id,
          userId: event.userId,
          type: event.type,
          title: event.title,
          message: event.message,
          isRead: event.isRead,
          createdAt: new Date(event.createdAt),
          relatedProjectId: event.relatedProjectId,
          relatedScanId: event.relatedScanId,
          relatedIssueId: event.relatedIssueId,
          relatedCommentId: event.relatedCommentId
        };
        this.notificationData.addNotification(notification);
      },
      error: (err) => console.error('WebSocket notification error:', err)
    });
  }

  /**
   * Connect WebSocket with user ID
   */
  connectWebSocket(userId: string): void {
    this.webSocketService.connect(userId);
  }

  /**
   * Fetch all notifications from API and store in shared data
   */
  getAllNotifications(): Observable<Notification[]> {
    const userId = this.getUserId();
    this.notificationData.setLoading(true);
    return this.http.get<Notification[]>(`${this.base}/${userId}`)
      .pipe(
        tap({
          next: (notifications) => {
            this.notificationData.setNotifications(notifications);
            this.notificationData.setLoading(false);
          },
          error: () => this.notificationData.setLoading(false)
        })
      );
  }

  /**
   * Load notifications from API
   */
  loadNotifications(): void {
    this.getAllNotifications().subscribe();
  }

  /**
   * Mark notification as read
   */
  markAsRead(id: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/read`, {})
      .pipe(
        tap(() => this.notificationData.markAsRead(id))
      );
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): Observable<void> {
    const userId = this.getUserId();
    return this.http.patch<void>(`${this.base}/${userId}/read-all`, {})
      .pipe(
        tap(() => this.notificationData.markAllAsRead())
      );
  }

  /**
   * Create a new notification
   */
  createNotification(request: {
    userId: string;
    type: string;
    title: string;
    message: string;
    relatedProjectId?: string;
    relatedScanId?: string;
    relatedIssueId?: string;
    relatedCommentId?: string;
  }): Observable<Notification> {
    return this.http.post<Notification>(this.base, request)
      .pipe(
        tap((notification) => this.notificationData.addNotification(notification))
      );
  }

  // Track notified issue and scan IDs to prevent duplicates
  private notifiedIssueIds = new Set<string>();
  private notifiedQualityGateScanIds = new Set<string>();

  /**
   * Generate notifications for issues (prevent duplicates)
   * Returns Observable that completes when all notifications are created
   */
  generateIssueNotifications(
    issues: { id: string; severity: string; type: string; message: string; projectData?: { id: string } }[]
  ): void {
    if (!issues?.length) return;

    const userId = this.getUserId();
    if (!userId) return;

    this.getAllNotifications().subscribe({
      next: (existingNotifications) => {
        const existingIssueIds = new Set(
          existingNotifications
            .filter(n => n.relatedIssueId)
            .map(n => n.relatedIssueId)
        );

        existingIssueIds.forEach(id => this.notifiedIssueIds.add(id!));

        const newIssues = issues.filter(issue =>
          !this.notifiedIssueIds.has(issue.id) && !existingIssueIds.has(issue.id)
        );

        if (!newIssues.length) {
          console.log('No new issues to notify');
          return;
        }

        for (const issue of newIssues) {
          const isHighSeverity = issue.severity === 'CRITICAL' || issue.severity === 'BLOCKER';
          const title = `${isHighSeverity ? '🔴' : '🟠'} ${issue.severity} ${issue.type} Issue`;

          this.createNotification({
            userId,
            type: 'Issues',
            title,
            message: issue.message,
            relatedIssueId: issue.id,
            relatedProjectId: issue.projectData?.id
          }).subscribe({
            next: () => {
              this.notifiedIssueIds.add(issue.id);
              console.log(`Notification created for issue: ${issue.id}`);
            },
            error: (err) => console.error('Failed to create notification:', err)
          });
        }
      },
      error: (err) => console.error('Failed to load notifications:', err)
    });
  }

  /**
   * Generate notifications for failed quality gates (prevent duplicates)
   */
  generateQualityGateNotifications(
    scans: { id: string; qualityGate?: string | null; project?: { id: string; name?: string } }[]
  ): void {
    if (!scans?.length) return;

    const userId = this.getUserId();
    if (!userId) return;

    const failedScans = scans.filter(scan =>
      scan.qualityGate &&
      scan.qualityGate.toUpperCase() !== 'OK' &&
      scan.qualityGate.toUpperCase() !== 'NONE'
    );

    if (!failedScans.length) return;

    this.getAllNotifications().subscribe({
      next: (existingNotifications) => {
        const existingScanIds = new Set(
          existingNotifications
            .filter(n => n.title?.includes('Quality Gate'))
            .map(n => n.relatedScanId)
        );

        existingScanIds.forEach(id => this.notifiedQualityGateScanIds.add(id!));

        const newFailedScans = failedScans.filter(scan =>
          !this.notifiedQualityGateScanIds.has(scan.id) && !existingScanIds.has(scan.id)
        );

        if (!newFailedScans.length) {
          console.log('No new quality gate failures to notify');
          return;
        }

        for (const scan of newFailedScans) {
          const projectName = scan.project?.name || 'Unknown';

          this.createNotification({
            userId,
            type: 'System',
            title: '⚠️ Quality Gate Failed',
            message: `${projectName} failed quality gate check`,
            relatedProjectId: scan.project?.id,
            relatedScanId: scan.id
          }).subscribe({
            next: () => {
              this.notifiedQualityGateScanIds.add(scan.id);
              console.log(`Quality Gate notification created for scan: ${scan.id}`);
            },
            error: (err) => console.error('Failed to create notification:', err)
          });
        }
      },
      error: (err) => console.error('Failed to load notifications:', err)
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    this.webSocketService.disconnect();
  }
}

