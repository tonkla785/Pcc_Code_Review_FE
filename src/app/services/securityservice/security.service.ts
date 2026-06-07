import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map, startWith, pairwise, filter } from 'rxjs';
import { AuthService } from '../authservice/auth.service';
import { SharedDataService } from '../shared-data/shared-data.service';
import { environment } from '../../environments/environment';
import {
    SecurityIssueDTO,
    SecurityMetrics,
    SecurityMetricsResponse,
    OwaspCategory,
    VulnerabilitySeverity,
    HotSecurityIssue
} from '../../interface/security_interface';

const SEVERITY_COLOR: Record<string, string> = {
    Critical: 'bg-critical',
    High: 'bg-high',
    Medium: 'bg-medium',
    Low: 'bg-low'
};

@Injectable({ providedIn: 'root' })
export class SecurityService {
    private readonly http = inject(HttpClient);
    private readonly auth = inject(AuthService);
    private readonly sharedData = inject(SharedDataService);
    private readonly baseUrl = environment.apiUrl;

    constructor() {
        this.sharedData.scansHistory$.pipe(
            startWith(null),
            pairwise(),
            filter(([prev, curr]) => {
                if (!curr || curr.length === 0) return false;
                const currLatest = curr[0];
                const prevScan = prev?.find((s: any) => s.id === currLatest?.id);
                return prevScan?.status !== 'SUCCESS' && currLatest?.status === 'SUCCESS';
            })
        ).subscribe(() => this.refreshAggregateState());

        this.sharedData.repositories$.subscribe(() => this.refreshAggregateState());
    }

    getMetrics(projectId?: string): Observable<SecurityMetrics> {
        const url = projectId
            ? `${this.baseUrl}/api/security/metrics/${projectId}`
            : `${this.baseUrl}/api/security/metrics`;

        return this.http.get<SecurityMetricsResponse>(url, this.authOpts()).pipe(
            map(res => this.toMetrics(res))
        );
    }

    getSecurityIssues(): Observable<SecurityIssueDTO[]> {
        return this.http.get<SecurityIssueDTO[]>(
            `${this.baseUrl}/api/get-issue-by-security`,
            this.authOpts()
        );
    }

    private refreshAggregateState(): void {
        this.getMetrics().subscribe({
            next: m => this.sharedData.updateSecurityState({
                score: m.score,
                riskLevel: m.riskLevel,
                hotIssues: m.hotIssues
            })
        });
    }

    private toMetrics(res: SecurityMetricsResponse): SecurityMetrics {
        const vulnerabilities: VulnerabilitySeverity[] = (res.vulnerabilities ?? []).map(v => ({
            severity: v.name,
            count: v.count,
            color: SEVERITY_COLOR[v.name] ?? 'bg-low'
        }));

        const hotIssues: HotSecurityIssue[] = (res.hotIssues ?? []).map(h => ({
            name: this.prettify(h.name),
            count: h.count
        }));

        const owaspCoverage: OwaspCategory[] = (res.owaspCoverage ?? []).map(o => ({
            name: this.prettify(o.name),
            count: o.count,
            status: (o.status as OwaspCategory['status']) ?? 'pass'
        }));

        return {
            score: res.score ?? 0,
            riskLevel: res.riskLevel ?? 'SAFE',
            vulnerabilities,
            hotIssues,
            owaspCoverage
        };
    }

    private prettify(slug: string): string {
        if (!slug) return '';
        const owasp = /^a(\d+)$/i.exec(slug);
        if (owasp) return 'A' + owasp[1].padStart(2, '0');
        if (slug.toLowerCase() === 'others') return 'Other';
        return slug
            .split(/[-_\s]+/)
            .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
            .join(' ');
    }

    private authOpts() {
        const token = this.auth.token;
        return token
            ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
            : {};
    }
}
