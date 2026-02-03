import { Injectable } from '@angular/core';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable } from 'rxjs';

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
  scanId: string;    // เพิ่ม scanId
  status: UiScanStatus;
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
            const raw = JSON.parse(message.body) as {
              projectId: string;
              scanId?: string;  // อาจจะมีหรือไม่มีก็ได้
              id?: string;      // เผื่อบางทีส่งเป็น id
              status: BackendScanStatus;
            };

            const event: ScanEvent = {
              projectId: raw.projectId,
              scanId: raw.scanId || raw.id || '', // fallback
              status: mapToUiStatus(raw.status)
            };

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
