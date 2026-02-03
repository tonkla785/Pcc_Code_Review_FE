import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';
import { WebSocketService, NotificationEvent } from '../websocket/websocket.service';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  relatedProjectId?: string;
  relatedScanId?: string;
  relatedIssueId?: string;
  relatedCommentId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly webSocketService = inject(WebSocketService);
  private readonly base = environment.apiUrl + '/notifications';

  // Store notifications locally for real-time updates
  private notifications = new BehaviorSubject<Notification[]>([]);
  private unreadCount = new BehaviorSubject<number>(0);

  constructor() {
    this.subscribeToWebSocket();
  }

  /**
   * Subscribe to WebSocket notifications
   */
  private subscribeToWebSocket(): void {
    this.webSocketService.subscribeNotifications().subscribe({
      next: (event: NotificationEvent) => {
        // Add new notification to the list
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

        const currentNotifications = this.notifications.value;
        this.notifications.next([notification, ...currentNotifications]);

        if (!notification.isRead) {
          this.unreadCount.next(this.unreadCount.value + 1);
        }
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
   * Get all notifications (local observable)
   */
  getNotifications$(): Observable<Notification[]> {
    return this.notifications.asObservable();
  }

  /**
   * Get unread count (local observable)
   */
  getUnreadCount$(): Observable<number> {
    return this.unreadCount.asObservable();
  }

  /**
   * Fetch all notifications from API
   */
  getAllNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.base}`);
  }

  /**
   * Fetch unread notifications from API
   */
  getUnreadNotifications(): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.base}/unread`);
  }

  /**
   * Get unread count from API
   */
  getUnreadCountFromApi(): Observable<number> {
    return this.http.get<number>(`${this.base}/unread/count`);
  }

  /**
   * Load notifications from API and update local state
   */
  loadNotifications(): void {
    this.getAllNotifications().subscribe({
      next: (notifications) => {
        this.notifications.next(notifications);
        this.unreadCount.next(notifications.filter(n => !n.isRead).length);
      },
      error: (err) => console.error('Failed to load notifications:', err)
    });
  }

  /**
   * Mark notification as read
   */
  markAsRead(id: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/read`, {});
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): Observable<void> {
    return this.http.patch<void>(`${this.base}/read-all`, {});
  }

  /**
   * Delete notification
   */
  deleteNotification(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    this.webSocketService.disconnect();
  }
}

