import { Injectable } from "@angular/core";

@Injectable({ providedIn: 'root' })
export class TokenStorageService {

    private readonly ACCESS_TOKEN_KEY = 'access_token';

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
}
