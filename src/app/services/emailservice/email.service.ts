import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) { }

  registerEmail(payload: { type: 'Register'; email: string; username: string }) {
    return this.http.post(`${this.base}/api/email`, payload);
  }

  passwordResetEmail(payload: { type: 'PasswordReset'; email: string; link: string }) {
    return this.http.post(`${this.base}/api/email`, payload);
  }

  requestPasswordReset(email: string) {
    return this.http.post(`${this.base}/user/forgot-password`, { email });
  }
}
