import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, switchMap, map, of, catchError } from 'rxjs';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { ScanService, Scan } from '../scanservice/scan.service';
import { IssueService, Issue } from '../issueservice/issue.service';
import { AuthService } from '../authservice/auth.service';
import { environment } from '../../environments/environment';


export interface Repository {
  id?: string;
  projectId?: string;// UUID (string)
  user?: string;// เทียบกับ user: string | undefined; มีก็ได้ไม่มีก็ได้
  name: string;
  repositoryUrl: string;
  projectType?: 'Angular' | 'Spring Boot';
  branch?: string;
  sonarProjectKey?: string;
  createdAt?: Date;
  updatedAt?: Date;

  username?: string;
  password?: string;

  scans?: Scan[];
  status?: 'Active' | 'Scanning' | 'Error';
  lastScan?: Date;
  scanningProgress?: number;
  qualityGate?: string;
  metrics?: {
    bugs?: number;
    vulnerabilities?: number;
    codeSmells?: number;
    coverage?: number;
    duplications?: number;
  };
  issues?: Issue[];
}


@Injectable({ providedIn: 'root' })
export class RepositoryService {

  private authOpts() {
    const token = this.auth.token;
    console.log(token);
    return token
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : {};
  }

  private readonly http = inject(HttpClient);
  private readonly scanService = inject(ScanService);
  private readonly issueService = inject(IssueService);
  private readonly auth = inject(AuthService);

  private readonly base = 'http://localhost:8080/repository';
  private readonly basescan = 'http://localhost:8080/api';
  // private readonly basescanTest = 'http://localhost:8080';


  //สร้างมาเพื่อเทสงานเพราะไม่อยาก merge code กับบัง
  //เริ่มสแกน 
  startScan(projectId: string, branch: string = 'main'): Observable<any> {
    console.log('[ScanService] Starting scan for projectId:', projectId, 'branch:', branch);

    return this.http.post(
      `${environment.apiUrl}/${projectId}/scan`,
      null,
      {
        params: new HttpParams().set('branch', branch),
        ...this.authOpts()
      }
    );
  }

  //สร้างมาเพื่อเทสงานเพราะไม่อยาก merge code กับบัง
  //ดึงสแกนตาม project_id (ถ้า backend ยังไม่มี endpoint แยก ใช้วิธี filter ฝั่ง client ชั่วคราว)
  getScansByProjectId(projectId: string): Observable<Scan[]> {
    return this.getAllScan().pipe(
      map(scans => scans.filter(s => s.projectId === projectId).map(s => ({ ...s, status: this.mapStatus(s.status) })))
    );
  }

  /** GET /api/scans — ดึงสแกนทั้งหมด */
  getAllScan(): Observable<Scan[]> {
    console.log('[ScanService] Fetching all scans...');
    // TODO: Get userId from token when available
    return this.http.get<Scan[]>(`${this.basescan}/scans`).pipe(
      map(scans => {
        console.log('[ScanService] Raw scans from backend:', scans);
        const mapped = scans.map(s => ({
          ...s,
          status: this.mapStatus(s.status),
          qualityGate: this.mapQualityStatus(s.qualityGate ?? '')
        }));
        console.log('[ScanService] Mapped scans:', mapped);
        return mapped;
      })
    );
  }

  public mapStatus(status?: string | 'Active' | 'Scanning' | 'Error'): 'Active' | 'Scanning' | 'Error' {
    if (!status) return 'Error'; // fallback

    const s = status.toUpperCase();

    switch (s) {
      case 'SUCCESS':
      case 'ACTIVE':   // ถ้า backend บางครั้งส่ง Active
        return 'Active';
      case 'FAILED':
      case 'ERROR':    // ถ้า backend บางครั้งส่ง Error
        return 'Error';
      case 'SCANNING':
        return 'Scanning';
      default:
        return 'Error'; // fallback
    }
  }

   public mapQualityStatus(status: 'OK' | 'ERROR' | string): 'Passed' | 'Failed' {
    const s = String(status ?? '').trim().toUpperCase();
    return s === 'OK' ? 'Passed' : 'Failed';
  }


  // อันนี้ของ repo

  // เพิ่ม repo
  addRepo(repo: Partial<Repository>): Observable<Repository> {
    return this.http.post<Repository>(`${environment.apiUrl}/repository/new-repository`, repo);
  }

  // update
  updateRepo(projectId: string, repo: Partial<Repository>): Observable<Repository> {
    return this.http.put<Repository>(`${environment.apiUrl}/repository/update-repository/${projectId}`, repo);
  }

  // DELETE
  deleteRepo(projectId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/repository/delete-repository/${projectId}`);
  }

  // ดึง repo ทั้งหมด
  getAllRepo(): Observable<Repository[]> {
    const opts = this.authOpts(); // ใส่ Authorization header อย่างเดียว

    return this.http.get<any[]>(`${environment.apiUrl}/api/scans`, opts).pipe(
      map(scans => {
        // Group scans by project.id
        const projectMap = new Map<string, { project: any, scans: any[] }>();

        scans.forEach(scan => {
          const projectId = scan.project.id;
          if (!projectMap.has(projectId)) {
            projectMap.set(projectId, {
              project: scan.project,
              scans: []
            });
          }
          projectMap.get(projectId)!.scans.push(scan);
        });

        // Map to Repository[]
        const repos: Repository[] = Array.from(projectMap.values()).map(({ project, scans }) => ({
          projectId: project.id,
          name: project.name,
          repositoryUrl: project.repositoryUrl,
          projectType: project.projectType,
          sonarProjectKey: project.sonarProjectKey,
          createdAt: project.createdAt ? new Date(project.createdAt) : undefined,
          updatedAt: project.updatedAt ? new Date(project.updatedAt) : undefined,
          scans: scans.map(scan => ({
            scanId: scan.id,
            projectId: scan.project.id,
            projectName: scan.project.name,
            status: scan.status,
            startedAt: scan.startedAt ? new Date(scan.startedAt) : undefined,
            completedAt: scan.completedAt ? new Date(scan.completedAt) : undefined,
            qualityGate: scan.qualityGate,
            metrics: {
              bugs: scan.metrics?.bugs,
              vulnerabilities: scan.metrics?.vulnerabilities,
              codeSmells: scan.metrics?.codeSmells,
              coverage: scan.metrics?.coverage,
              duplications: scan.metrics?.duplicatedLinesDensity
            },
            log_file_path: scan.logFilePath
          })),
          // Set status, lastScan, qualityGate, metrics from latest scan
          status: scans.length ? this.scanService.mapStatus(scans[scans.length - 1].status) : 'Active',
          lastScan: scans.length && scans[scans.length - 1].completedAt ? new Date(scans[scans.length - 1].completedAt) : undefined,
          qualityGate: scans.length ? scans[scans.length - 1].qualityGate : undefined,
          metrics: scans.length ? {
            bugs: scans[scans.length - 1].metrics?.bugs,
            vulnerabilities: scans[scans.length - 1].metrics?.vulnerabilities,
            codeSmells: scans[scans.length - 1].metrics?.codeSmells,
            coverage: scans[scans.length - 1].metrics?.coverage,
            duplications: scans[scans.length - 1].metrics?.duplicatedLinesDensity
          } : undefined
        }));

        // Sort by lastScan or updatedAt
        return repos.sort((a, b) => {
          const aTime = a.lastScan?.getTime() ?? a.updatedAt?.getTime() ?? a.createdAt?.getTime() ?? 0;
          const bTime = b.lastScan?.getTime() ?? b.updatedAt?.getTime() ?? b.createdAt?.getTime() ?? 0;
          return bTime - aTime;
        });
      })
    );
  }

  // ดึง repo ตาม id
  getByIdRepo(projectId: string): Observable<Repository> {
    return this.http.get<Repository>(`${this.base}/search-repositories/${projectId}`).pipe(
      map(r => ({
        ...r,
        createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
        updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined
      }))
    );
  }

  

  /** POST /api/repositories/clone?projectId=UUID  (backend คืน text) */
  clone(projectId: string): Observable<string> {
    const params = new HttpParams().set('projectId', projectId);
    return this.http.post(`${this.base}/clone`, null, {
      params,
      responseType: 'text',
    });
  }

  /** ---------------- Enrich ด้วย Scan/Issue ---------------- */

  /** ดึง repo ทั้งหมด + เติมสรุป scan ล่าสุด */
  getRepositoriesWithScans(): Observable<Repository[]> {
    return this.getAllRepo();
  }

  getFullRepository(projectId: string): Observable<Repository | undefined> {
    return this.getByIdRepo(projectId).pipe(
      switchMap(repo => {
        if (!repo) return of(undefined);

        // ดึง Scan ของ repository
        const scans = this.getScansByProjectId(projectId).pipe(
          map(scans =>
            scans.map(s => ({
              ...s,
              startedAt: s.startedAt ? new Date(s.startedAt) : undefined,
              completedAt: s.completedAt ? new Date(s.completedAt) : undefined
            }))
          )
        );
        console.log('Fetched scans for projectId', projectId, ':', scans);

        // ดึง Issue ของ repository
        const issues$ = this.issueService.getIssueByProjectId(projectId).pipe(
          map(allIssues => allIssues.filter(i => i.projectId === projectId))
        );

        // รวม Scan + Issue เข้ากับ repo
        return forkJoin({ scans, issues: issues$ }).pipe(
          map(({ scans, issues }) => {
            const latest = scans.reduce((prev, curr) => {
              return (curr.completedAt?.getTime() ?? 0) > (prev.completedAt?.getTime() ?? 0)
                ? curr
                : prev;
            }, scans[0]);

            return {
              ...repo,
              scans,
              issues,
              status: latest?.status ?? 'Active',
              lastScan: latest?.completedAt,
              scanningProgress: latest?.status === 'Scanning' ? 50 : 100,
              qualityGate: latest?.qualityGate,
              metrics: latest?.metrics
            } as Repository;
          })
        );
      }
      ));
  }

  getFullRepositoryTest(projectId: string): Observable<Repository | undefined> {
  const opts = this.authOpts();

  return this.http.get<any>(`${environment.apiUrl}/api/${projectId}`, opts).pipe(
    map(project => {
      if (!project) return undefined;

      // ---- 1) แปลง scanData → Scan (interface เดิมของคุณ) ----
      const mappedScans: Scan[] = (project.scanData ?? []).map((s: any) => ({
        scanId: s.id,
        projectId: project.id,
        projectName: project.name,
        status: this.scanService.mapStatus(s.status),
        startedAt: s.startedAt ? new Date(s.startedAt) : undefined,
        completedAt: s.completedAt ? new Date(s.completedAt) : undefined,
        qualityGate: this.scanService.mapQualityStatus(s.qualityGate ?? ''),
        metrics: {
          bugs: s.metrics?.bugs,
          vulnerabilities: s.metrics?.vulnerabilities,
          coverage: s.metrics?.coverage,
          codeSmells: s.metrics?.codeSmells,
          duplications: s.metrics?.duplicatedLinesDensity
        },
        log_file_path: s.logFilePath
      }));

      // ---- 2) ดึง Issues (จาก latest scan) แล้ว map ให้เข้ากับ Issue เดิม ----
      const latestScan = mappedScans
        .filter(s => s.completedAt)
        .sort((a, b) =>
          (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)
        )[0];

      const mappedIssues: Issue[] = (latestScan as any)?.issueData?.map((i: any) => ({
        id: i.id,
        scanId: latestScan.scanId,
        issueKey: i.issueKey,
        type: i.type,
        severity: i.severity,
        message: i.message,
        assignedTo: i.assignedTo,
        status: i.status,
        createdAt: i.createdAt ? new Date(i.createdAt) : undefined
      })) ?? [];

      // ---- 3) หา latest scan เพื่อเติมข้อมูล summary ----
      const latest = mappedScans.length ? mappedScans[mappedScans.length - 1] : undefined;

      return {
        projectId: project.id,
        name: project.name,
        repositoryUrl: project.repositoryUrl,
        projectType: project.projectType,
        sonarProjectKey: project.sonarProjectKey,
        createdAt: project.createdAt ? new Date(project.createdAt) : undefined,
        updatedAt: project.updatedAt ? new Date(project.updatedAt) : undefined,

        // ใส่ของที่ Component เดิมคาดหวัง
        scans: mappedScans,
        issues: mappedIssues,

        // summary fields (เหมือนโค้ดตัวอย่างของคุณ)
        status: latest ? this.scanService.mapStatus(latest.status) : 'Active',
        lastScan: latest?.completedAt,
        qualityGate: latest?.qualityGate,
        metrics: latest?.metrics
      } as Repository;
    })
  );
}

}


 
