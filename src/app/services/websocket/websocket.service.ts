import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, ReplaySubject, Subject } from 'rxjs';

import { BackendScanStatus, UiScanStatus, ScanEvent, NotificationEvent, GlobalNotificationEvent, ProjectChangeEvent } from '../../interface/websocket_interface';

function mapToUiStatus(status: BackendScanStatus): UiScanStatus {
  if (status === 'PENDING') {
    return 'SCANNING';
  }
  return status;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {

  private client: Client;
  private connected = false;
  private notificationSubject = new Subject<NotificationEvent>();
  private globalNotificationSubject = new Subject<GlobalNotificationEvent>();
  private scanSubject = new ReplaySubject<ScanEvent>(1); // ReplaySubject to ensure late subscribers get the last event
  private projectSubject = new Subject<ProjectChangeEvent>(); // Project add/edit/delete events
  private userId: string | null = null;
  private subscribed = false;
  private userTopicSubscribed = false;
  private globalTopicSubscribed = false;
  private projectTopicSubscribed = false;

  constructor() {
    this.client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 5000,
      debug: (str) => console.log('[WS]', str)
    });

    this.client.onConnect = () => {
      this.connected = true;
      console.log('WebSocket connected');
      this.subscribeToTopics();
    };

    this.client.onStompError = (frame) => {
      console.error('WS error:', frame);
      this.resetSubscriptions();
    };

    this.client.onWebSocketClose = () => {
      console.warn('WS connection closed');
      this.connected = false;
      this.resetSubscriptions();
    };
  }

  private resetSubscriptions() {
    this.subscribed = false;
    this.userTopicSubscribed = false;
    this.globalTopicSubscribed = false;
    this.projectTopicSubscribed = false;
  }

  /**
   * Connect and set user ID for personal notifications
   */
  connect(userId: string): void {
    this.userId = userId;
    if (!this.client.active) {
      this.client.activate();
    } else if (this.connected) {
      this.subscribeToTopics();
    }
  }

  /**
   * Subscribe to all relevant topics
   */
  private subscribeToTopics(): void {

    // 1. Subscribe to scan status updates (Public)
    if (!this.subscribed) {
      this.client.subscribe('/topic/scan-status', (message: IMessage) => {
        try {
          const raw = JSON.parse(message.body) as {
            projectId: string;
            scanId?: string;
            id?: string;
            status: BackendScanStatus;
          };

          const event: ScanEvent = {
            projectId: raw.projectId,
            scanId: raw.scanId || raw.id || '',
            status: mapToUiStatus(raw.status)
          };

          console.log('WS scan event:', event);
          this.scanSubject.next(event);
        } catch (e) {
          console.error('Failed to parse scan WS message', e);
        }
      });
      this.subscribed = true;
    }

    // 2. Subscribe to personal notifications (Private)
    if (this.userId && !this.userTopicSubscribed) {
      console.log(`Subscribing to private notifications for user: ${this.userId}`);
      this.client.subscribe(`/topic/notifications/${this.userId}`, (message: IMessage) => {
        try {
          const notification: NotificationEvent = JSON.parse(message.body);
          console.log('WS notification:', notification);
          this.notificationSubject.next(notification);
        } catch (e) {
          console.error('Failed to parse notification WS message', e);
        }
      });
      this.userTopicSubscribed = true;
    }

    // 3. Subscribe to global notifications (Public - for all users)
    // These include: scan complete, quality gate failed, new critical issues
    if (!this.globalTopicSubscribed) {
      console.log('Subscribing to global notifications');
      this.client.subscribe('/topic/notifications/global', (message: IMessage) => {
        try {
          const notification: GlobalNotificationEvent = JSON.parse(message.body);
          console.log('WS global notification:', notification);
          this.globalNotificationSubject.next(notification);
        } catch (e) {
          console.error('Failed to parse global notification WS message', e);
        }
      });
      this.globalTopicSubscribed = true;
    }

    // 4. Subscribe to project changes (Public - for all users)
    // These include: project added, updated, deleted
    if (!this.projectTopicSubscribed) {
      console.log('Subscribing to project changes');
      this.client.subscribe('/topic/projects', (message: IMessage) => {
        try {
          const event: ProjectChangeEvent = JSON.parse(message.body);
          console.log('WS project change:', event);
          this.projectSubject.next(event);
        } catch (e) {
          console.error('Failed to parse project WS message', e);
        }
      });
      this.projectTopicSubscribed = true;
    }
  }

  /**
   * Get observable for scan status updates
   */
  subscribeScanStatus(): Observable<ScanEvent> {
    return this.scanSubject.asObservable();
  }

  /**
   * Get observable for personal notifications
   */
  subscribeNotifications(): Observable<NotificationEvent> {
    return this.notificationSubject.asObservable();
  }

  /**
   * Get observable for global notifications (broadcast to all users)
   */
  subscribeGlobalNotifications(): Observable<GlobalNotificationEvent> {
    return this.globalNotificationSubject.asObservable();
  }

  /**
   * Get observable for project changes (add/edit/delete broadcast to all users)
   */
  subscribeProjectChanges(): Observable<ProjectChangeEvent> {
    return this.projectSubject.asObservable();
  }

  /**
   * Disconnect WebSocket
   */
  // disconnect(): void {
  //   if (this.connected) {
  //     this.client.deactivate();
  //     this.connected = false;
  //     this.subscribed = false;
  //     this.userTopicSubscribed = false;
  //     this.globalTopicSubscribed = false;
  //     this.projectTopicSubscribed = false;
  //   }
  // }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

