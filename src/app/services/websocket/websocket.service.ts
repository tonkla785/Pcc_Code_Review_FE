import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';

type BackendScanStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
type UiScanStatus = 'SCANNING' | 'SUCCESS' | 'FAILED';

function mapToUiStatus(status: BackendScanStatus): UiScanStatus {
  if (status === 'PENDING') {
    return 'SCANNING';
  }
  return status;
}

export interface ScanEvent {
  projectId: string;
  scanId: string;
  status: UiScanStatus;
}

export interface NotificationEvent {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedProjectId?: string;
  relatedScanId?: string;
  relatedIssueId?: string;
  relatedCommentId?: string;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {

  private client: Client;
  private connected = false;
  private notificationSubject = new Subject<NotificationEvent>();
  private scanSubject = new Subject<ScanEvent>();
  private userId: string | null = null;

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
    };
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
    // Subscribe to scan status updates
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

    // Subscribe to personal notifications
    if (this.userId) {
      this.client.subscribe(`/topic/notifications/${this.userId}`, (message: IMessage) => {
        try {
          const notification: NotificationEvent = JSON.parse(message.body);
          console.log('WS notification:', notification);
          this.notificationSubject.next(notification);
        } catch (e) {
          console.error('Failed to parse notification WS message', e);
        }
      });
    }

    // Subscribe to broadcast notifications
    this.client.subscribe('/topic/notifications/all', (message: IMessage) => {
      try {
        const notification: NotificationEvent = JSON.parse(message.body);
        console.log('WS broadcast notification:', notification);
        this.notificationSubject.next(notification);
      } catch (e) {
        console.error('Failed to parse broadcast WS message', e);
      }
    });
  }

  /**
   * Get observable for scan status updates
   */
  subscribeScanStatus(): Observable<ScanEvent> {
    return this.scanSubject.asObservable();
  }

  /**
   * Get observable for notifications
   */
  subscribeNotifications(): Observable<NotificationEvent> {
    return this.notificationSubject.asObservable();
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (this.connected) {
      this.client.deactivate();
      this.connected = false;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

