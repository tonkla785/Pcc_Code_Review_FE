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
  scanId?: string;
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

//ตัว test lssue
export interface ScanIssue {
  id: string;
  scanId: string;
  issueKey: string;
  type: 'Bug' | 'Vulnerability' | 'Code Smell';
  severity: 'Blocker' | 'Critical' | 'Major' | 'Minor';
  component: string;
  message: string;
  status: 'OPEN' | 'PENDING' | 'IN PROGRESS' | 'DONE' | 'REJECT';
  createdAt: Date | string;
  assignedTo?: string;
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

  getScanById(scanId: string): Observable<any> {
    return this.http.get(
      `${environment.apiUrl}/api/scans/${scanId}`,
      this.authOpts()
    );
  }


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


  //เก็บ status ใน localstorage  
  private getCachedStatus(projectId: string): 'Active' | 'Scanning' | 'Error' | null {
    const value = localStorage.getItem(`repo-status-${projectId}`);
    if (value === 'Active' || value === 'Scanning' || value === 'Error') {
      return value;
    }
    return null;
  }

  private deriveRepoStatusFromScan(
    scan?: any
  ): 'Active' | 'Scanning' | 'Error' {
    if (!scan) return 'Active';

    switch (scan.status) {
      case 'SCANNING':
        return 'Scanning';
      case 'SUCCESS':
        return 'Active';
      case 'FAILED':
      case 'ERROR':
        return 'Error';
      default:
        return 'Active';
    }
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
        const repos: Repository[] = Array.from(projectMap.values()).map(({ project, scans }) => {

          const sortedScans = scans
            .slice()
            .sort((a, b) => {
              const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
              const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
              return bTime - aTime;
            });

          const latestScan = sortedScans[0];
          const cachedStatus = this.getCachedStatus(project.id);

          return {
            projectId: project.id,
            name: project.name,
            repositoryUrl: project.repositoryUrl,
            projectType: project.projectType,
            sonarProjectKey: project.sonarProjectKey,
            createdAt: project.createdAt ? new Date(project.createdAt) : undefined,
            updatedAt: project.updatedAt ? new Date(project.updatedAt) : undefined,
            scanId: latestScan?.id, //เอาไว้ส่งให้หน้า detailrepo
            scans: sortedScans.map(scan => ({
              scanId: scan.id,
              projectId: scan.project.id,
              projectName: scan.project.name,
              status: scan.status,
              startedAt: scan.startedAt ? new Date(scan.startedAt) : undefined,
              completedAt: scan.completedAt ? new Date(scan.completedAt) : undefined,
              qualityGate: this.scanService.mapQualityStatus(scan.qualityGate ?? ''),
              metrics: {
                bugs: scan.metrics?.bugs,
                vulnerabilities: scan.metrics?.vulnerabilities,
                codeSmells: scan.metrics?.codeSmells,
                coverage: scan.metrics?.coverage,
                duplications: scan.metrics?.duplicatedLinesDensity
              },
              log_file_path: scan.logFilePath
            })),

            // summary จาก startedAt ใหม่สุด
            status: cachedStatus
              ?? this.deriveRepoStatusFromScan(latestScan),


            lastScan: latestScan?.startedAt
              ? new Date(latestScan.startedAt)
              : undefined,

            qualityGate: latestScan
              ? this.scanService.mapQualityStatus(latestScan.qualityGate ?? '')
              : undefined,

            metrics: latestScan?.metrics
              ? {
                bugs: latestScan.metrics.bugs,
                vulnerabilities: latestScan.metrics.vulnerabilities,
                codeSmells: latestScan.metrics.codeSmells,
                coverage: latestScan.metrics.coverage,
                duplications: latestScan.metrics.duplicatedLinesDensity
              }
              : undefined
          };
        });

        console.log('Mapped repositories:', repos);

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
    return this.http.get<Repository>(`${environment.apiUrl}/repository/search-repositories/${projectId}`).pipe(
      map(r => ({
        ...r,
        createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
        updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined
      }))
    );
  }

  /** ดึง repo ทั้งหมด + เติมสรุป scan ล่าสุด */
  getRepositoriesWithScans(): Observable<Repository[]> {
    return this.getAllRepo();
  }

  getFullRepository(projectId: string): Observable<Repository | undefined> {
    const opts = this.authOpts();

    return this.http.get<any>(`${environment.apiUrl}/api/${projectId}`, opts).pipe(
      map(project => {
        if (!project) return undefined;

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

        const latest = mappedScans
          .filter(s => s.completedAt)
          .sort((a, b) =>
            (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)
          )[0];

        return {
          projectId: project.id,
          name: project.name,
          repositoryUrl: project.repositoryUrl,
          projectType: project.projectType,
          sonarProjectKey: project.sonarProjectKey,
          createdAt: project.createdAt ? new Date(project.createdAt) : undefined,
          updatedAt: project.updatedAt ? new Date(project.updatedAt) : undefined,

          scans: mappedScans,

          status: latest?.status ?? 'Active',
          lastScan: latest?.completedAt,
          qualityGate: latest?.qualityGate,
          metrics: latest?.metrics
        } as Repository;
      })
    );
  }


}



