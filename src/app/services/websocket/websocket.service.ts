import { Injectable } from '@angular/core';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable } from 'rxjs';

export interface ScanEvent {
  projectId: string;
  status: 'SCANNING' | 'SUCCESS' | 'FAILED';
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {

  private client: Client;
  private connected = false;

  constructor() {
    this.client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 5000,
      debug: (str) => console.log('[WS]', str)
    });

    this.client.activate();
  }

  subscribeScanStatus(): Observable<ScanEvent> {
    return new Observable(observer => {

      this.client.onConnect = () => {
        this.connected = true;
        console.log('WebSocket connected');

        this.client.subscribe('/topic/scan-status', (message: any) => {
          try {
            const event: ScanEvent = JSON.parse(message.body);
            console.log('WS event:', event);
            observer.next(event);
          } catch (e) {
            console.error('Failed to parse WS message', e);
          }
        });
      };

      this.client.onStompError = (frame) => {
        console.error('WS error:', frame);
      };

      // cleanup ตอน component ถูกทำลาย
      return () => {
        if (this.connected) {
          this.client.deactivate();
        }
      };
    });
  }
}
