import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../authservice/auth.service';
import { environment } from '../../environments/environment';
import { SonarQubeTestConnectRequest, SonarQubeTestConnectResponse } from '../../interface/sonarqube_interface';

@Injectable({ providedIn: 'root' })
export class SonarQubeService {
    private readonly http = inject(HttpClient);
    private readonly auth = inject(AuthService);
    private readonly baseUrl = environment.apiUrl;

    private authOpts() {
        const token = this.auth.token;
        return token
            ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
            : {};
    }

    testConnect(request: SonarQubeTestConnectRequest): Observable<SonarQubeTestConnectResponse> {
        return this.http.post<SonarQubeTestConnectResponse>(
            `${this.baseUrl}/sonar/test-connect`,
            request,
            this.authOpts()
        );
    }
}
