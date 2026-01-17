import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, switchMap, map, of, catchError } from 'rxjs';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { ScanService, Scan } from '../scanservice/scan.service';
import { IssueService, Issue } from '../issueservice/issue.service';
import { AuthService } from '../authservice/auth.service';


export interface Repository {
  projectId?: string;   // UUID (string)
  user: string;      // UUID (string)
  name: string;
  repositoryUrl: string;
  projectType?: 'Angular' | 'Spring Boot';
  branch?: string;
  sonarProjectKey?: string;
  createdAt?: Date;
  updatedAt?: Date;

  username?: string;
  password? : string;

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

  private readonly base = 'http://localhost:8080/api/repositories';



  /** POST /api/repositories */
  addRepo(repo: Partial<Repository>): Observable<Repository> {
    return this.http.post<Repository>(`${this.base}/add`, repo);
  }

  /** GET /api/repositories */
/** GET /api/repositories?userId=<UUID> */
getAllRepo(): Observable<Repository[]> {
  const userId = this.auth.userId || '';
  const opts = {
    ...this.authOpts(),                             // ใส่ Authorization ถ้ามี
    params: new HttpParams().set('userId', userId), // << ส่ง userId ไปด้วย
  };

  return this.http.get<Repository[]>(`${this.base}/getAll/${userId}`, opts).pipe(
    map(repos =>
      repos
        .map(r => ({
          ...r,
          createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
          updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined,
          userId: (r as any).userId || (r as any).user_id
        }))
        .sort((a, b) => {
          const aTime = a.updatedAt?.getTime() ?? a.createdAt?.getTime() ?? 0;
          const bTime = b.updatedAt?.getTime() ?? b.createdAt?.getTime() ?? 0;
          return bTime - aTime;
        })
    )
  );
}


  /** GET /api/repositories/{id} */
  getByIdRepo(projectId: string): Observable<Repository> {
    return this.http.get<Repository>(`${this.base}/detail/${projectId}`).pipe(
      map(r => ({
        ...r,
        createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
        updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined,
        userId: (r as any).userId || (r as any).user_id
      }))
    );
  }

  /** PUT /api/repositories/{id} */
  updateRepo(projectId: string, repo: Partial<Repository>): Observable<Repository> {
    return this.http.put<Repository>(`${this.base}/${projectId}`, repo);
  }

  /** DELETE /api/repositories/{id} */
  deleteRepo(projectId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${projectId}`);
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
    return this.getAllRepo().pipe(
      switchMap(repos => {
        if (!repos.length) return of<Repository[]>([]);
        return forkJoin(
          repos.map(repo => {
            if (!repo.projectId) return of(repo); // ✅ ป้องกัน undefined
            return this.scanService.getScansByProjectId(repo.projectId).pipe(
              map(scans => {
                const latest = scans.length ? scans[scans.length - 1] : undefined;
                return {
                  ...repo,
                  status: latest ? this.scanService.mapStatus(latest.status) : 'Active',
                  lastScan: latest?.completedAt ? new Date(latest.completedAt) : undefined,
                  scanningProgress: latest?.status === 'Scanning' ? 50 : 100,
                  qualityGate: latest?.qualityGate,
                  metrics: latest?.metrics,
                } as Repository;
              })
            );
          })
        ).pipe(
          map(reposWithScans =>
            reposWithScans.sort((a, b) => {
              const aTime = a.lastScan?.getTime()
                ?? a.updatedAt?.getTime()
                ?? a.createdAt?.getTime()
                ?? 0;
              const bTime = b.lastScan?.getTime()
                ?? b.updatedAt?.getTime()
                ?? b.createdAt?.getTime()
                ?? 0;
              return bTime - aTime;
            })
          )
        );
      })
    );
  }
  
  getFullRepository(projectId: string): Observable<Repository | undefined> {
    return this.getByIdRepo(projectId).pipe(
      switchMap(repo => {
        if (!repo) return of(undefined);

        // ดึง Scan ของ repository
        const scans$ = this.scanService.getScansByProjectId(projectId).pipe(
          map(scans =>
            scans.map(s => ({
              ...s,
              startedAt: s.startedAt ? new Date(s.startedAt) : undefined,
              completedAt: s.completedAt ? new Date(s.completedAt) : undefined
            }))
          )
        );

        // ดึง Issue ของ repository
        const issues$ = this.issueService.getIssueByProjectId(projectId).pipe(
          map(allIssues => allIssues.filter(i => i.projectId === projectId))
        );

        // รวม Scan + Issue เข้ากับ repo
        return forkJoin({ scans: scans$, issues: issues$ }).pipe(
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
  // return this.getByIdRepo(projectId).pipe(
  //   switchMap(repo => {
  //     if (!repo) return of(undefined);

  //     // ดึง Scan ของ repository
  //     const scans$ = this.scanService.getScansByProjectId(projectId).pipe(
  //       map(scans =>
  //         scans.map(s => ({
  //           ...s,
  //           startedAt: s.started_at ? new Date(s.started_at) : undefined,
  //           completedAt: s.completed_at ? new Date(s.completed_at) : undefined
  //         }))
  //       )
  //     );

  //     // ดึง Issue ของ repository
  //     const issues$ = this.issueService.getIssueByProjectId(projectId).pipe(
  //       map(allIssues => allIssues.filter(i => i.projectId === projectId))
  //     );

  //     // รวม Scan + Issue เข้ากับ repo
  //     return forkJoin({ scans: scans$, issues: issues$ }).pipe(
  //       map(({ scans, issues }) => {
  //         const latest = scans.reduce((prev, curr) => {
  //           return (curr.completedAt?.getTime() ?? 0) > (prev.completedAt?.getTime() ?? 0)
  //             ? curr
  //             : prev;
  //         }, scans[0]);

  //         return {
  //           ...repo,
  //           scans,
  //           issues,
  //           status: latest?.status ?? 'Active',
  //           lastScan: latest?.completedAt,
  //           scanningProgress: latest?.status === 'Scanning' ? 50 : 100,
  //           qualityGate: latest?.quality_gate,
  //           metrics: latest?.metrics
  //         } as Repository;
  //       })
  //     );
  //   })
  // );
}




  // private repositories: Repository[] = [
  //   {
  //     project_id: '111',
  //     user_id: 'u1-uuid-1111',
  //     name: 'E-Commerce Platform',
  //     repository_url: 'https://github.com/pccth/ecommerce-frontend.git',
  //     project_type: 'Angular',
  //     branch: 'main',
  //     sonar_project_key: 'SONAR_ECOMMERCE',
  //     created_at: new Date(),
  //     updated_at: new Date()
  //   },
  //   {
  //     project_id: '222',
  //     user_id: 'u2-uuid-2222',
  //     name: 'Payment API Service',
  //     repository_url: 'https://github.com/pccth/payment-service.git',
  //     project_type: 'Spring Boot',
  //     branch: 'main',
  //     sonar_project_key: 'SONAR_PAYMENT',
  //     created_at: new Date(),
  //     updated_at: new Date()
  //   },
  //   {
  //     project_id: '333',
  //     user_id: 'u1-uuid-1111',
  //     name: 'Inventory Management',
  //     repository_url: 'https://github.com/pccth/inventory-frontend.git',
  //     project_type: 'Angular',
  //     branch: 'main',
  //     sonar_project_key: 'SONAR_INVENTORY',
  //     created_at: new Date(),
  //     updated_at: new Date()
  //   },
  //   {
  //     project_id: '444',
  //     user_id: 'u3-uuid-3333',
  //     name: 'User Authentication Service',
  //     repository_url: 'https://github.com/pccth/auth-service.git',
  //     project_type: 'Spring Boot',
  //     branch: 'main',
  //     sonar_project_key: 'SONAR_AUTH',
  //     created_at: new Date(),
  //     updated_at: new Date()
  //   },
  //   {
  //     project_id: '555',
  //     user_id: 'u4-uuid-4444',
  //     name: 'Marketing Dashboard',
  //     repository_url: 'https://github.com/pccth/marketing-dashboard.git',
  //     project_type: 'Angular',
  //     branch: 'main',
  //     sonar_project_key: 'SONAR_MARKETING',
  //     created_at: new Date(),
  //     updated_at: new Date()
  //   }
  // ];

  // constructor(
  //   private readonly scanService: ScanService,
  //   private readonly issueService: IssueService
  // ) {}

  // /** POST /api/repositories */
  // addRepo(repo: Partial<Repository>, autoScan: boolean = false): Observable<Repository> {
  //   const newRepo: Repository = {
  //     ...repo,
  //     project_id: (Math.max(...this.repositories.map(r => +r.project_id)) + 1).toString(),
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //     status: autoScan ? 'Scanning' : 'Active',
  //     scanningProgress: autoScan ? 0 : 100,
  //     scans: [],
  //     issues: []
  //   } as Repository;

  //   this.repositories.push(newRepo);

  //   if (autoScan) {
  //     this.scanService.startScan({ project_id: newRepo.project_id }).subscribe(() => {
  //       this.simulateScan(newRepo);
  //     });
  //   }

  //   return of(newRepo);
  // }

  // /** mock scan progress */
  // private simulateScan(repo: Repository) {
  //   const interval = setInterval(() => {
  //     if ((repo.scanningProgress ?? 0) >= 100) {
  //       repo.scanningProgress = 100;
  //       repo.status = 'Active';
  //       repo.updated_at = new Date();
  //       clearInterval(interval);
  //     } else {
  //       repo.scanningProgress = (repo.scanningProgress ?? 0) + 20;
  //     }
  //   }, 500);
  // }

  // /** GET /api/repositories */
  // getAllRepo(): Observable<Repository[]> {
  //   return of(this.repositories);
  // }

  // /** GET /api/repositories/{id} */
  // getByIdRepo(id: string): Observable<Repository | undefined> {
  //   const repo = this.repositories.find(r => r.project_id === id);
  //   return of(repo);
  // }

  // /** PUT /api/repositories/{id} */
  // updateRepo(id: string, repo: Partial<Repository>): Observable<Repository | undefined> {
  //   const index = this.repositories.findIndex(r => r.project_id === id);
  //   if (index > -1) {
  //     this.repositories[index] = {
  //       ...this.repositories[index],
  //       ...repo,
  //       updated_at: new Date()
  //     };
  //     return of(this.repositories[index]);
  //   }
  //   return of(undefined);
  // }

  // /** DELETE /api/repositories/{id} */
  // deleteRepo(id: string): Observable<void> {
  //   this.repositories = this.repositories.filter(r => r.project_id !== id);
  //   return of(void 0);
  // }

  // /** POST /api/repositories/clone?projectId=UUID */
  // clone(projectId: string): Observable<string> {
  //   const repo = this.repositories.find(r => r.project_id === projectId);
  //   if (!repo) return of('Not found');

  //   const newRepo: Repository = {
  //     ...repo,
  //     project_id: (Math.max(...this.repositories.map(r => +r.project_id)) + 1).toString(),
  //     name: repo.name + ' (Clone)',
  //     created_at: new Date(),
  //     updated_at: new Date()
  //   };
  //   this.repositories.push(newRepo);
  //   return of(`Cloned repo: ${newRepo.project_id}`);
  // }
  
//}

