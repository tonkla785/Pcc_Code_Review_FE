
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { tap } from 'rxjs/operators';
import { LoginRequest, LoginResponse, RefreshResponse, RegisterRequest } from '../../interface/user_interface';
import { TokenStorageService } from '../tokenstorageService/token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly base = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private tokenStorage: TokenStorageService
  ) { }

  get token() {
    return this.tokenStorage.getAccessToken();
  }

  get isLoggedIn(): boolean {
    return this.tokenStorage.hasToken();
  }

  login(payload: LoginRequest) {
    return this.http.post<LoginResponse>(
      `${this.base}/user/login`,
      payload,
      { withCredentials: true }
    ).pipe(
      tap(res => this.tokenStorage.setAccessToken(res.accessToken))
    );
  }

  register(payload: RegisterRequest) {
    return this.http.post(`${this.base}/user/register`, payload);
  }

  refresh() {
    return this.http.post<RefreshResponse>(
      `${this.base}/user/refresh`,
      {},
      { withCredentials: true }
    ).pipe(
      tap(res => this.tokenStorage.setAccessToken(res.accessToken))
    );
  }

  logout() {
    return this.http.post(
      `${this.base}/user/logout`,
      {},
      { withCredentials: true, responseType: 'text' as const }
    ).pipe(
      tap(() => this.tokenStorage.clear())
    );
  }
}
