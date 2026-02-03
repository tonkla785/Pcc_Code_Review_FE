import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { AuthService } from '../authservice/auth.service';
import { SharedDataService } from '../shared-data/shared-data.service';
import { environment } from '../../environments/environment';
import {
    SecurityIssueDTO,
    SecurityMetrics,
    OwaspCategory,
    VulnerabilitySeverity
} from '../../interface/security_interface';

const severityConfig: Record<string, { label: string; deduction: number }> = {
    BLOCKER: { label: 'Critical', deduction: 20 },
    CRITICAL: { label: 'High', deduction: 10 },
    MAJOR: { label: 'Medium', deduction: 5 },
    MINOR: { label: 'Low', deduction: 1 }
};

const riskLevels = [
    { level: 'CRITICAL', hasSeverity: 'BLOCKER' },
    { level: 'HIGH', hasSeverity: 'CRITICAL' },
    { level: 'MEDIUM', hasSeverity: 'MAJOR' },
    { level: 'LOW', hasSeverity: 'MINOR' }
] as const;

const ruleToHotIssue: Record<string, string> = {
    S3649: 'SQL Injection',
    S5131: 'XSS Vulnerability',
    S2068: 'Hardcoded Secrets',
    S6418: 'Hardcoded Secrets',
    S327: 'Weak Encryption',
    S4423: 'Weak Encryption',
    S4426: 'Weak Encryption',
    S4790: 'Weak Encryption',
    S2083: 'Path Traversal',
    S6096: 'Path Traversal'
};

const hotIssueNames = [
    'SQL Injection',
    'XSS Vulnerability',
    'Hardcoded Secrets',
    'Weak Encryption',
    'Path Traversal'
] as const;

const owaspCategories = [
    { id: 'A01', name: 'A01 Broken Access' },
    { id: 'A02', name: 'A02 Crypto Failures' },
    { id: 'A03', name: 'A03 Injection' },
    { id: 'A04', name: 'A04 Insecure Design' },
    { id: 'A05', name: 'A05 Security Config' },
    { id: 'A06', name: 'A06 Vulnerable Comp' },
    { id: 'A07', name: 'A07 Auth Failures' },
    { id: 'A08', name: 'A08 Data Integrity' },
    { id: 'A09', name: 'A09 Logging Fails' },
    { id: 'A10', name: 'A10 SSRF' }
] as const;

const ruleToOwasp: Record<string, string> = {
    S4502: 'A01', S2612: 'A01', S5122: 'A01', S2083: 'A01', S6096: 'A01', S5876: 'A01', S4601: 'A01', S6357: 'A01',
    S2068: 'A02', S327: 'A02', S6418: 'A02', S4426: 'A02', S4790: 'A02', S2245: 'A02', S5542: 'A02', S3329: 'A02', S4423: 'A02',
    S3649: 'A03', S2076: 'A03', S5131: 'A03', S5334: 'A03', S2077: 'A03', S5696: 'A03',S5247: 'A03', S6351: 'A03', S5146: 'A03',
    S4792: 'A04', S5804: 'A04', S125: 'A04', S2259: 'A04',  S3338: 'A04',
    S3330: 'A05', S1523: 'A05', S5332: 'A05', S2096: 'A05', S4507: 'A05', S1313: 'A05',
    S2078: 'A06', S6362: 'A06',
    S4433: 'A07', S3403: 'A07', S3011: 'A07',
    S5042: 'A08', S2658: 'A08',
    S2250: 'A09', S2228: 'A09', S1148: 'A09', S2139: 'A09',
    S5144: 'A10', S9301: 'A10', S6289: 'A10',
};

@Injectable({ providedIn: 'root' })
export class SecurityService {
    private readonly http = inject(HttpClient);
    private readonly auth = inject(AuthService);
    private readonly sharedData = inject(SharedDataService);
    private readonly baseUrl = environment.apiUrl;

    constructor() {
        this.sharedData.securityIssues$.subscribe(issues => {
            if (issues) {
                const metrics = this.calculate(issues);
                this.sharedData.updateSecurityState({
                    score: metrics.score,
                    riskLevel: metrics.riskLevel,
                    hotIssues: metrics.hotIssues
                });
            }
        });
    }

    private authOpts() {
        const token = this.auth.token;
        return token
            ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
            : {};
    }

    getSecurityIssues(): Observable<SecurityIssueDTO[]> {
        return this.http.get<SecurityIssueDTO[]>(
            `${this.baseUrl}/api/get-issue-by-security`,
            this.authOpts()
        );
    }

    loadAndCalculate(): Observable<SecurityIssueDTO[]> {
        if (this.sharedData.hasSecurityIssuesCache) {
            return of(this.sharedData.securityIssuesValue);
        }

        return this.getSecurityIssues().pipe(
            tap(issues => {
                this.sharedData.setSecurityIssues(issues);
                this.calculateAndStore(issues);
            })
        );
    }

    calculateAndStore(issues: SecurityIssueDTO[]): SecurityMetrics {
        const metrics = this.calculate(issues);

        this.sharedData.updateSecurityState({
            score: metrics.score,
            riskLevel: metrics.riskLevel,
            hotIssues: metrics.hotIssues
        });

        return metrics;
    }

    calculate(issues: SecurityIssueDTO[]): SecurityMetrics {
        let totalDeduction = 0;
        const severitySet = new Set<string>();
        const severityCounts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };

        for (const issue of issues) {
            const sev = issue.severity?.toUpperCase() || '';
            const config = severityConfig[sev];
            if (config) {
                totalDeduction += config.deduction;
                severityCounts[config.label]++;
            }
            if (sev) severitySet.add(sev);
        }

        const score = Math.max(0, 100 - totalDeduction);

        let riskLevel = 'SAFE';
        for (const risk of riskLevels) {
            if (severitySet.has(risk.hasSeverity)) {
                riskLevel = risk.level;
                break;
            }
        }

        const hotCounts: Record<string, number> = {};
        for (const name of hotIssueNames) {
            hotCounts[name] = 0;
        }

        for (const issue of issues) {
            const ruleId = this.extractRuleId(issue.ruleKey);
            const category = ruleToHotIssue[ruleId];
            if (category) hotCounts[category]++;
        }

        const hotIssues = hotIssueNames
            .map(name => ({ name, count: hotCounts[name] }))
            .filter(item => item.count > 0)
            .sort((a, b) => b.count - a.count);

        const vulnerabilities: VulnerabilitySeverity[] = [
            { severity: 'Critical', count: severityCounts['Critical'], color: 'bg-critical' },
            { severity: 'High', count: severityCounts['High'], color: 'bg-high' },
            { severity: 'Medium', count: severityCounts['Medium'], color: 'bg-medium' },
            { severity: 'Low', count: severityCounts['Low'], color: 'bg-low' }
        ];

        return { score, riskLevel, hotIssues, vulnerabilities };
    }

    calculateOwaspCoverage(issues: SecurityIssueDTO[]): OwaspCategory[] {
        const categoryCounts: Record<string, number> = {};
        for (const cat of owaspCategories) {
            categoryCounts[cat.id] = 0;
        }

        for (const issue of issues) {
            const ruleId = this.extractRuleId(issue.ruleKey);
            const category = ruleToOwasp[ruleId];
            if (category) categoryCounts[category]++;
        }

        return owaspCategories.map(cat => ({
            name: cat.name,
            count: categoryCounts[cat.id],
            status: this.getOwaspStatus(categoryCounts[cat.id])
        }));
    }

    private extractRuleId(ruleKey: string): string {
        const match = ruleKey?.match(/S\d+/i);
        return match ? match[0].toUpperCase() : '';
    }

    private getOwaspStatus(count: number): 'pass' | 'warning' | 'fail' {
        if (count === 0) return 'pass';
        if (count === 1) return 'warning';
        return 'fail';
    }
}
