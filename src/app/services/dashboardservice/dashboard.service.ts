// src/app/services/dashboardservice/dashboard.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from '../authservice/auth.service';

export interface Dashboard {
  id: string;
  name: string;
  metrics: {
    bugs: number;
    vulnerabilities: number;
    codeSmells: number;
    coverage: number;
    duplications: number;
  };
}

export interface History {
  projectId: string;
  projectName: string;
  projectType: string;
  createdAt: string;
  scanId?: string;
  status?: 'Passed' | 'Failed';
  grade?: string;
  maintainabilityGate?: string | null;
}

export interface Trends {
  id: string;
  qualityGate: string;
  reliabilityGate: string;       // A–E
  securityGate: string;          // A–E
  maintainabilityGate: string;   // A–E
  securityReviewGate: string;    // A–E
  startTime?: string;
}

export type LetterUpper = 'A'|'B'|'C'|'D'|'E';
export type LetterLower = 'a'|'b'|'c'|'d'|'e';

export interface TrendsWithAvg extends Trends {
  avgGrade: LetterLower; // a–e
}

export interface ScanHistoryRow {
  scanId: string;
  projectId: string;
  project: string;
  typeproject: 'Angular' | 'SpringBoot';
  status: 'Passed' | 'Failed';
  grade: string;
  time: string;
  maintainabilityGate: string | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiUrl + '/dashboard';

  private authOpts() {
    const token = this.auth.token;
    return token ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) } : {};
  }

  // ---- Raw APIs ----
  getOverview(userId: string | number): Observable<Dashboard[]> {
    return this.http.get<Dashboard[]>(`${this.base}/${userId}`);
  }
  getHistory(userId: string | number): Observable<History[]> {
    return this.http.get<History[]>(`${this.base}/${userId}/history`);
  }
  getTrends(userId: string | number): Observable<Trends[]> {
    return this.http.get<Trends[]>(`${this.base}/${userId}/trends`);
  }

  // ---- Helpers ----
  private asNumber(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private normalizeProjectType(v?: string): 'Angular' | 'SpringBoot' {
    const s = (v || '').toLowerCase();
    if (s.includes('spring')) return 'SpringBoot';
    if (s.includes('angular')) return 'Angular';
    return 'Angular';
  }

  private letterToScore(g?: string | null): number | null {
    const k = (g || '').trim().toUpperCase() as LetterUpper;
    const map: Record<LetterUpper, number> = { A:5, B:4, C:3, D:2, E:1 };
    return (k in map) ? map[k] : null;
  }

  private scoreToLowerLetter(avg: number): LetterLower {
    const r = Math.max(1, Math.min(5, Math.round(avg)));
    return ({5:'a',4:'b',3:'c',2:'d',1:'e'} as Record<number, LetterLower>)[r];
    // 5 ดีสุด -> a
  }

  // ---- Public mappers to be used by component ----
  mapOverviewTotals(overview: Dashboard[]): {
    metrics: { bugs: number; vulnerabilities: number; codeSmells: number; coverage: number; duplications: number; };
    qualityGateStatus: 'OK' | 'ERROR';
    conditions: Array<{ metric: string; status: 'OK'|'ERROR'; actual: number; threshold: number; }>;
  } {
    if (!Array.isArray(overview) || overview.length === 0) {
      return {
        metrics: { bugs: 0, vulnerabilities: 0, codeSmells: 0, coverage: 0, duplications: 0 },
        qualityGateStatus: 'ERROR',
        conditions: [{ metric: 'Coverage', status: 'ERROR', actual: 0, threshold: 80 }]
      };
    }

    const list = overview.map(o => {
      const m = o?.metrics ?? {} as Dashboard['metrics'];
      return {
        bugs: this.asNumber(m.bugs),
        vulnerabilities: this.asNumber(m.vulnerabilities),
        codeSmells: this.asNumber(m.codeSmells),
        coverage: this.asNumber(m.coverage),
        duplications: this.asNumber(m.duplications)
      };
    });

    const n = list.length || 1;
    const sum = list.reduce((a, x) => ({
      bugs: a.bugs + x.bugs,
      vulnerabilities: a.vulnerabilities + x.vulnerabilities,
      codeSmells: a.codeSmells + x.codeSmells,
      coverage: a.coverage + x.coverage,
      duplications: a.duplications + x.duplications
    }), { bugs: 0, vulnerabilities: 0, codeSmells: 0, coverage: 0, duplications: 0 });

    const metrics = {
      bugs: sum.bugs,
      vulnerabilities: sum.vulnerabilities,
      codeSmells: sum.codeSmells,
      coverage: +(sum.coverage / n).toFixed(1),
      duplications: +(sum.duplications / n).toFixed(1)
    };

    const qg: 'OK' | 'ERROR' = metrics.coverage >= 80 ? 'OK' : 'ERROR';
    return {
      metrics,
      qualityGateStatus: qg,
      conditions: [{ metric: 'Coverage', status: qg, actual: metrics.coverage, threshold: 80 }]
    };
  }

  mapHistory(history: History[]): ScanHistoryRow[] {
    return (history || []).map(h => {
      const t = new Date(h.createdAt);
      const typeproject = this.normalizeProjectType(h.projectType);
      return {
        scanId: (h as any).scanId ?? '',
        projectId: h.projectId,
        project: h.projectName,
        typeproject,
        status: ((h as any).qualityGate ?? 'Passed') as 'Passed' | 'Failed',
        grade: ((h as any).grade ?? 'F') as string,
        time: t.toISOString().slice(0, 16).replace('T', ' '),
        maintainabilityGate: ((h as any).maintainabilityGate ?? null)
      };
    });
  }

  /** คืน trends พร้อม avgGrade (a–e) คิดจาก 4 gates */
  getTrendsWithAvg(userId: string | number): Observable<TrendsWithAvg[]> {
    return this.getTrends(userId).pipe(
      map(list => (list || []).map(t => {
        const scores = [
          this.letterToScore(t.reliabilityGate),
          this.letterToScore(t.securityGate),
          this.letterToScore(t.maintainabilityGate),
          this.letterToScore(t.securityReviewGate),
        ].filter((v): v is number => v !== null);

        const avg = (scores.length > 0)
          ? (scores.reduce((a, b) => a + b, 0) / scores.length)
          : 1; // ไม่มีข้อมูล -> แย่สุด

        return { ...t, avgGrade: this.scoreToLowerLetter(avg) };
      }))
    );
  }

getMetricsSummary(overview: any[]) {
  if (!Array.isArray(overview) || overview.length === 0) {
    return { bugs: 0, vulnerabilities: 0, codeSmells: 0, coverage: 0, duplications: 0 };
  }

  // รวมเฉพาะสแกนล่าสุดต่อโปรเจกต์
  const latestByProject = new Map<string, any>();
  for (const o of overview) {
    const pid = o.id || o.projectId || '';
    if (!pid) continue;
    latestByProject.set(pid, o);
  }

  const latest = Array.from(latestByProject.values());
  const sum = latest.reduce(
    (acc, o) => {
      const m = o.metrics || {};
      acc.bugs += Number(m.bugs ?? 0);
      acc.vulnerabilities += Number(m.vulnerabilities ?? 0);
      acc.codeSmells += Number(m.code_smells ?? m.codeSmells ?? 0);
      acc.coverage += Number(m.coverage ?? 0);
      acc.duplications += Number(m.duplicated_lines_density ?? 0);
      return acc;
    },
    { bugs: 0, vulnerabilities: 0, codeSmells: 0, coverage: 0, duplications: 0 }
  );

  const avgCoverage = +(sum.coverage / latest.length).toFixed(1);
  const avgDup = +(sum.duplications / latest.length).toFixed(1);

  return {
    bugs: sum.bugs,
    vulnerabilities: sum.vulnerabilities,
    codeSmells: sum.codeSmells,
    coverage: avgCoverage,
    duplications: avgDup
  };
}


}
