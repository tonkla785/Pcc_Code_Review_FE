import { Injectable } from '@angular/core';
import { BehaviorSubject, fromEvent } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { LoginUser } from '../../interface/user_interface';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly userKey = 'login_user';
  private accessToken: string | null = null;
  private loginUserSubject = new BehaviorSubject<LoginUser | null>(this.getLoginUser());
  loginUser$ = this.loginUserSubject.asObservable();

  constructor() {
    fromEvent<StorageEvent>(window, 'storage')
      .pipe(filter(e => e.key === this.userKey))
      .subscribe(() => {
        this.loginUserSubject.next(this.getLoginUser());
      });
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  hasToken(): boolean {
    return !!this.accessToken;
  }

  setLoginUser(user: LoginUser) {
    sessionStorage.setItem(this.userKey, JSON.stringify(user));
    this.loginUserSubject.next(user);
  }

  getLoginUser(): LoginUser | null {
    const raw = sessionStorage.getItem(this.userKey);
    return raw ? (JSON.parse(raw) as LoginUser) : null;
  }

  clear() {
    this.accessToken = null;
    sessionStorage.removeItem(this.userKey);
    this.loginUserSubject.next(null);
  }
}
