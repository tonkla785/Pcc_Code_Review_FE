import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SseService {
  constructor(private readonly ngZone: NgZone) {}

  connect(repoId: string): Observable<any> {
    return new Observable(observer => {
      const url = `http://localhost:8080/api/sse/subscribe?repoId=${encodeURIComponent(repoId)}`;
      const es = new EventSource(url);

      const handleData = (raw: MessageEvent) => {
        this.ngZone.run(() => {
          let data: any = raw.data;
          try { data = JSON.parse(raw.data); } catch {}
          observer.next(data);
        });
      };

      es.addEventListener('scan-complete', handleData);
      es.onmessage = handleData;

      es.onerror = (err) => {
        this.ngZone.run(() => {
          observer.complete;  // หรือ observer.complete();
        });
        es.close();
      };

      return () => {
        es.close();
      };
    });
  }
}
