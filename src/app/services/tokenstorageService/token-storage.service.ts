import { Injectable } from "@angular/core";
import { LoginUser } from "../../interface/user_interface";

@Injectable({ providedIn: 'root' })
export class TokenStorageService {

    private readonly ACCESS_TOKEN_KEY = 'access_token';
    private readonly userKey = 'login_user';
    getAccessToken(): string | null {
        return localStorage.getItem(this.ACCESS_TOKEN_KEY);
    }

    setAccessToken(token: string) {
        localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
    }

    clear() {
        localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    }

    hasToken(): boolean {
        return !!this.getAccessToken();
    }
      
  setLoginUser(user: LoginUser) {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  getLoginUser(): LoginUser | null {
    const raw = localStorage.getItem(this.userKey);
    return raw ? (JSON.parse(raw) as LoginUser) : null;
  }
}
