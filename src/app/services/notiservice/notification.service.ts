import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface Notification {
  id: string;
  notiId: string;
  projectId: string;
  scanId: string;
  typeNoti: string;
  message: string;
  read: boolean;
  createdAt: Date;
  timestamp: Date;
}
@Injectable({
  providedIn: 'root'
})
export class NotificationService {
private readonly http = inject(HttpClient);
private readonly base = environment.apiUrl + '/Notification';

getAllNotification() {
  return this.http.get<Notification[]>(`${this.base}`);
}

checkNotification(id: string) {
  return this.http.put<Notification>(`${this.base}/read/${id}`, {});
}


}
