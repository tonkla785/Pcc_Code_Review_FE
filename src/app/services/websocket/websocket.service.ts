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
            const raw = JSON.parse(message.body) as { //รับข้อมูลมา
              projectId: string;
              status: BackendScanStatus;
            };

            const event: ScanEvent = {
              projectId: raw.projectId,
              status: mapToUiStatus(raw.status) //เรียกใช้ฟังก์ชัน เมื่อมันเจอ PENDING จะเปลี่ยนเป็น SCANNING
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
