import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, tap } from 'rxjs';
import { WebSocketService, NotificationEvent } from '../websocket/websocket.service';
import { NotificationDataService } from '../shared-data/notification-data.service';
import { Notification } from '../../interface/notification_interface';
import { TokenStorageService } from '../tokenstorageService/token-storage.service';

// Re-export interfaces for convenience
export type { Notification, NotificationRequest } from '../../interface/notification_interface';

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
   * Disconnect WebSocket
   */
  disconnect(): void {
    this.webSocketService.disconnect();
  }
}

