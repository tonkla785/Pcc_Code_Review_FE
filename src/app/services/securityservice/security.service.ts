import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../authservice/auth.service';
import { environment } from '../../environments/environment';
import { SecurityIssueDTO } from '../../interface/security_interface';

@Injectable({ providedIn: 'root' })
export class SecurityService {
    private readonly http = inject(HttpClient);
    private readonly auth = inject(AuthService);
    private readonly baseUrl = environment.apiUrl;

    private authOpts() {
        const token = this.auth.token;
        return token
            ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
            : {};
    }

    //เส้น security issue
    getSecurityIssues(): Observable<SecurityIssueDTO[]> {
        return this.http.get<SecurityIssueDTO[]>(
            `${this.baseUrl}/api/get-issue-by-security`,
            this.authOpts()
        );
    }
}
