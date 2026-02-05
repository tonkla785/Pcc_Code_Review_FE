import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, ReplaySubject, Subject, BehaviorSubject } from 'rxjs';

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

  private connectionState$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 5000,
      debug: (str) => console.log('[WS]', str)
    });

    this.client.onConnect = () => {
      this.connected = true;
      this.connectionState$.next(true); // Notify connected
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
      this.connectionState$.next(false); // Notify disconnected
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
   * Subscribe to comments for a specific issue
   * Waits for connection to be established
   */
  subscribeToIssueComments(issueId: string): Observable<any> {
    const subject = new Subject<any>();
    let stompSubscription: any = null;

    // Observe connection state
    const connectionSub = this.connectionState$.subscribe(isConnected => {
      if (isConnected) {
        // Correctly subscribe once connected
        console.log(`[WS] Connected. Subscribing to comments for issue: ${issueId}`);
        if (stompSubscription) {
          stompSubscription.unsubscribe();
        }

        try {
          stompSubscription = this.client.subscribe(`/topic/issue/${issueId}/comments`, (message: IMessage) => {
            try {
              const comment = JSON.parse(message.body);
              console.log('WS comment received:', comment);
              subject.next(comment);
            } catch (e) {
              console.error('Failed to parse comment WS message', e);
              // Don't error the subject, just log
            }
          });
        } catch (err) {
          console.error('[WS] Subscribe failed', err);
        }
      } else {
        console.log(`[WS] Waiting for connection to subscribe to issue: ${issueId}`);
      }
    });

    // Return an observable that handles unsubscription logic when the caller unsubscribes
    return new Observable(observer => {
      const sub = subject.subscribe(observer);

      return () => {
        // Cleanup
        sub.unsubscribe();
        connectionSub.unsubscribe();
        if (stompSubscription) {
          stompSubscription.unsubscribe();
        }
        console.log(`Unsubscribed from comments for issue: ${issueId}`);
      };
    });
  }
}

