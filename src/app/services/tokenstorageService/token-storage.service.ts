import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { LoginUser } from '../../interface/user_interface';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly ACCESS_TOKEN_KEY = 'access_token';
  private readonly userKey = 'login_user';

  private loginUserSubject = new BehaviorSubject<LoginUser | null>(this.getLoginUser());
  loginUser$ = this.loginUserSubject.asObservable();

  constructor() {
    // sync ข้ามแท็บ / ข้ามหน้าต่าง
    fromEvent<StorageEvent>(window, 'storage')
      .pipe(filter(e => e.key === this.userKey))
      .subscribe(() => {
        this.loginUserSubject.next(this.getLoginUser());
      });
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  setAccessToken(token: string) {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
  }

  clear() {
    localStorage.clear();
    this.loginUserSubject.next(null);
  }

  hasToken(): boolean {
    return !!this.getAccessToken();
  }

  setLoginUser(user: LoginUser) {
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.loginUserSubject.next(user); // ✅ สำคัญ
  }

  getLoginUser(): LoginUser | null {
    const raw = localStorage.getItem(this.userKey);
    return raw ? (JSON.parse(raw) as LoginUser) : null;
  }
}
