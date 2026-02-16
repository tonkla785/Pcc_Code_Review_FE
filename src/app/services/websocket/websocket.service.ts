import { Injectable } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, ReplaySubject, Subject, BehaviorSubject } from 'rxjs';

import {
  BackendScanStatus,
  UiScanStatus,
  ScanEvent,
  NotificationEvent,
  GlobalNotificationEvent,
  ProjectChangeEvent,
  IssueChangeEvent,
  UserVerifyStatusEvent,
} from '../../interface/websocket_interface';

function mapToUiStatus(status: BackendScanStatus): UiScanStatus {
  if (status === 'PENDING') return 'SCANNING';
  return status;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private client: Client;
  private connected = false;

  private notificationSubject = new Subject<NotificationEvent>();
  private globalNotificationSubject = new Subject<GlobalNotificationEvent>();
  private scanSubject = new ReplaySubject<ScanEvent>(1);
  private projectSubject = new Subject<ProjectChangeEvent>();
  private issueSubject = new Subject<IssueChangeEvent>();

  private userId: string | null = null;

  private subscribed = false;
  private userTopicSubscribed = false;
  private globalTopicSubscribed = false;
  private projectTopicSubscribed = false;
  private issueTopicSubscribed = false;

  private connectionState$ = new BehaviorSubject<boolean>(false);

  // status
  private verifyStatusSubject = new ReplaySubject<UserVerifyStatusEvent>(1);
  private verifyTopicSubscribed = false;

  // ✅ keep private subscriptions so we can unsubscribe when user changes
  private userNotiSub?: StompSubscription;
  private verifySub?: StompSubscription;

  constructor() {
    this.client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 5000,
      debug: (str) => console.log('[WS]', str),
    });

    this.client.onConnect = () => {
      this.connected = true;
      this.connectionState$.next(true);
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
      this.connectionState$.next(false);
      this.resetSubscriptions();
    };
  }

  private resetSubscriptions() {
    // ✅ unsubscribe private topics
    this.userNotiSub?.unsubscribe();
    this.verifySub?.unsubscribe();
    this.userNotiSub = undefined;
    this.verifySub = undefined;

    // reset flags
    this.subscribed = false;
    this.userTopicSubscribed = false;
    this.globalTopicSubscribed = false;
    this.projectTopicSubscribed = false;
    this.issueTopicSubscribed = false;
    this.verifyTopicSubscribed = false;
  }

  /**
   * Connect and set user ID for personal notifications
   */
  connect(userId: string): void {
    const changedUser = !!this.userId && this.userId !== userId;
    this.userId = userId;

    // ✅ if user changed, resubscribe private topics
    if (changedUser) {
      this.userNotiSub?.unsubscribe();
      this.verifySub?.unsubscribe();
      this.userNotiSub = undefined;
      this.verifySub = undefined;

      this.userTopicSubscribed = false;
      this.verifyTopicSubscribed = false;
    }

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
    // 1) scan status (Public)
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
            status: mapToUiStatus(raw.status),
          };

          console.log('WS scan event:', event);
          this.scanSubject.next(event);
        } catch (e) {
          console.error('Failed to parse scan WS message', e);
        }
      });

      this.subscribed = true;
    }

    // 2) personal notifications (Private)
    if (this.userId && !this.userTopicSubscribed) {
      console.log(`Subscribing to private notifications for user: ${this.userId}`);

      this.userNotiSub = this.client.subscribe(
        `/topic/notifications/${this.userId}`,
        (message: IMessage) => {
          try {
            const notification: NotificationEvent = JSON.parse(message.body);
            console.log('WS notification:', notification);
            this.notificationSubject.next(notification);
          } catch (e) {
            console.error('Failed to parse notification WS message', e);
          }
        },
      );

      this.userTopicSubscribed = true;
    }

    // 3) global notifications (Public)
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

    // 4) project changes (Public)
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

    // 5) verify status (Private-ish)
    if (this.userId && !this.verifyTopicSubscribed) {
      console.log(`Subscribing to verify status for user: ${this.userId}`);

      this.verifySub = this.client.subscribe(
        `/topic/user/${this.userId}/verify-status`,
        (message: IMessage) => {
          try {
            const event = JSON.parse(message.body);
            console.log('WS verify status event:', event);
            this.verifyStatusSubject.next(event);
          } catch (e) {
            console.error('Failed to parse verify status WS message', e);
          }
        },
      );

      this.verifyTopicSubscribed = true;
    }

    // 6) issue changes (Public)
    if (!this.issueTopicSubscribed) {
      console.log('Subscribing to issue changes');

      this.client.subscribe('/topic/issues', (message: IMessage) => {
        try {
          const event: IssueChangeEvent = JSON.parse(message.body);
          console.log('WS issue change:', event);
          this.issueSubject.next(event);
        } catch (e) {
          console.error('Failed to parse issue WS message', e);
        }
      });

      this.issueTopicSubscribed = true;
    }
  }

  // ====== Observables ======

  subscribeScanStatus(): Observable<ScanEvent> {
    return this.scanSubject.asObservable();
  }

  subscribeNotifications(): Observable<NotificationEvent> {
    return this.notificationSubject.asObservable();
  }

  subscribeGlobalNotifications(): Observable<GlobalNotificationEvent> {
    return this.globalNotificationSubject.asObservable();
  }

  subscribeProjectChanges(): Observable<ProjectChangeEvent> {
    return this.projectSubject.asObservable();
  }

  subscribeVerifyStatus(): Observable<UserVerifyStatusEvent> {
    return this.verifyStatusSubject.asObservable();
  }

  subscribeIssueChanges(): Observable<IssueChangeEvent> {
    return this.issueSubject.asObservable();
  }

  /**
   * Subscribe to comments for a specific issue
   * Waits for connection to be established
   */
  subscribeToIssueComments(issueId: string): Observable<any> {
    const subject = new Subject<any>();
    let stompSubscription: any = null;

    const connectionSub = this.connectionState$.subscribe((isConnected) => {
      if (isConnected) {
        console.log(`[WS] Connected. Subscribing to comments for issue: ${issueId}`);
        if (stompSubscription) {
          stompSubscription.unsubscribe();
        }

        try {
          stompSubscription = this.client.subscribe(
            `/topic/issue/${issueId}/comments`,
            (message: IMessage) => {
              try {
                const comment = JSON.parse(message.body);
                console.log('WS comment received:', comment);
                subject.next(comment);
              } catch (e) {
                console.error('Failed to parse comment WS message', e);
              }
            },
          );
        } catch (err) {
          console.error('[WS] Subscribe failed', err);
        }
      } else {
        console.log(`[WS] Waiting for connection to subscribe to issue: ${issueId}`);
      }
    });

    return new Observable((observer) => {
      const sub = subject.subscribe(observer);

      return () => {
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
