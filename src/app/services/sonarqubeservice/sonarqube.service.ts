import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../authservice/auth.service';
import { environment } from '../../environments/environment';
import { QualityGates, SonarQubeTestConnectRequest, SonarQubeTestConnectResponse } from '../../interface/sonarqube_interface';

@Injectable({ providedIn: 'root' })
export class SonarQubeService {
    private readonly http = inject(HttpClient);
    private readonly auth = inject(AuthService);
    private readonly baseUrl = environment.apiUrl;
    private readonly KEY = 'sonarConfig_v1';
    private readonly DEFAULT_QUALITY_GATES: QualityGates = {
        failOnError: false,
        coverageThreshold: 0,
        maxBugs: 0,
        maxVulnerabilities: 0,
        maxCodeSmells: 0
    };


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

    getQualityGates(): QualityGates {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (!raw) return { ...this.DEFAULT_QUALITY_GATES };

            const parsed = JSON.parse(raw);
            return parsed?.qualityGates
                ? { ...this.DEFAULT_QUALITY_GATES, ...parsed.qualityGates }
                : { ...this.DEFAULT_QUALITY_GATES };
        } catch {
            return { ...this.DEFAULT_QUALITY_GATES };
        }
    }

}
