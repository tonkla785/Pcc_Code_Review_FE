import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, switchMap, map, of, catchError } from 'rxjs';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { ScanService, Scan } from '../scanservice/scan.service';
import { IssueService, Issue } from '../issueservice/issue.service';
import { AuthService } from '../authservice/auth.service';
import { environment } from '../../environments/environment';
import { QualityGates } from '../../interface/sonarqube_interface';
import { SonarQubeService } from '../sonarqubeservice/sonarqube.service';
import { getLatestScan } from '../../utils/format.utils';

export interface Repository {
  id?: string;
  projectId?: string;// UUID (string)
  user?: string;// เทียบกับ user: string | undefined; มีก็ได้ไม่มีก็ได้
  name: string;
  repositoryUrl: string;
  projectType?: 'ANGULAR' | 'SPRING_BOOT';
  projectTypeLabel?: string;
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
  private readonly SonarQubeService = inject(SonarQubeService);

  // สร้าง interface สำหรับ request
  private getSonarConfigFromStorage() {
    try {
      const raw = localStorage.getItem('sonarConfig_v1');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load sonar config from localStorage', e);
      return null;
    }
  }

  // เริ่มสแกน - ส่ง settings จาก localStorage ไปด้วย
  startScan(projectId: string, branch: string = 'main'): Observable<any> {
    console.log('[ScanService] Starting scan for projectId:', projectId, 'branch:', branch);

    // ดึง settings จาก localStorage
    const sonarConfig = this.getSonarConfigFromStorage();

    // สร้าง request body
    const requestBody: any = {
      branch: branch,
      sonarToken: sonarConfig?.authToken || ''
    };

    // เพิ่ม Angular settings ถ้ามี
    if (sonarConfig?.angularSettings) {
      requestBody.angularSettings = {
        runNpm: sonarConfig.angularSettings.runNpm || false,
        coverage: sonarConfig.angularSettings.coverage || false,
        tsFiles: sonarConfig.angularSettings.tsFiles || false,
        exclusions: sonarConfig.angularSettings.exclusions || '**/node_modules/**,**/*.spec.ts'
      };
    }

    // เพิ่ม Spring settings ถ้ามี
    if (sonarConfig?.springSettings) {
      requestBody.springSettings = {
        runTests: sonarConfig.springSettings.runTests || false,
        jacoco: sonarConfig.springSettings.jacoco || false,
        buildTool: sonarConfig.springSettings.buildTool || 'maven'
      };
    }

    console.log('[ScanService] Request body:', requestBody);

    return this.http.post(
      `${environment.apiUrl}/${projectId}/scan`,
      requestBody,
      this.authOpts()
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

  //เทียบ config กับ metric qualityGate
  evaluateQualityGate(
    metrics: {
      bugs?: number;
      vulnerabilities?: number;
      codeSmells?: number;
      coverage?: number;
    },
    gates: QualityGates
  ): 'Passed' | 'Failed' {
    console.log('Evaluating quality gate with metrics:', metrics, 'and gates:', gates);

    if ((metrics.coverage ?? 0) > gates.coverageThreshold) {
      return 'Failed';
    }

    if ((metrics.bugs ?? 0) > gates.maxBugs) {
      return 'Failed';
    }

    if ((metrics.vulnerabilities ?? 0) > gates.maxVulnerabilities) {
      return 'Failed';
    }

    if ((metrics.codeSmells ?? 0) > gates.maxCodeSmells) {
      return 'Failed';
    }

    return 'Passed';
  }

  private mapProjectTypeLabel(
    type?: 'ANGULAR' | 'SPRING_BOOT'
  ): string | undefined {
    if (!type) return undefined;

    switch (type) {
      case 'SPRING_BOOT':
        return 'SPRING BOOT';
      case 'ANGULAR':
        return 'ANGULAR';
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

          // map scans แปลง Date ให้เรียบร้อย
          const mappedScans = scans.map(scan => ({
            ...scan,
            startedAt: scan.startedAt ? new Date(scan.startedAt) : undefined,
            completedAt: scan.completedAt ? new Date(scan.completedAt) : undefined
          }));

          // ใช้ util หา scan ล่าสุด
          const latestScan = getLatestScan(
            mappedScans,
            s => s.startedAt
          );
          const cachedStatus = this.getCachedStatus(project.id);
          const gates = this.SonarQubeService.getQualityGates();
          console.log('Repo QualityGates from config:', gates);

          return {
            projectId: project.id,
            name: project.name,
            repositoryUrl: project.repositoryUrl,
            projectType: project.projectType,
            projectTypeLabel: this.mapProjectTypeLabel(project.projectType),
            sonarProjectKey: project.sonarProjectKey,
            createdAt: project.createdAt ? new Date(project.createdAt) : undefined,
            updatedAt: project.updatedAt ? new Date(project.updatedAt) : undefined,
            scanId: latestScan?.id, //เอาไว้ส่งให้หน้า detailrepo
            scans: mappedScans.map(scan => ({
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

            lastScan: latestScan?.startedAt,

            qualityGate: gates.failOnError
              ? (latestScan?.metrics
                ? this.evaluateQualityGate(latestScan.metrics, gates)
                : undefined)
              : (latestScan?.qualityGate
                ? this.scanService.mapQualityStatus(latestScan.qualityGate)
                : undefined),

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

        const latest = getLatestScan(
          mappedScans,
          s => s.completedAt
        );

        const gates = this.SonarQubeService.getQualityGates();

        return {
          projectId: project.id,
          name: project.name,
          repositoryUrl: project.repositoryUrl,
          projectType: project.projectType,
          projectTypeLabel: this.mapProjectTypeLabel(project.projectType),
          sonarProjectKey: project.sonarProjectKey,
          createdAt: project.createdAt ? new Date(project.createdAt) : undefined,
          updatedAt: project.updatedAt ? new Date(project.updatedAt) : undefined,

          scans: mappedScans,

          status: latest?.status ?? 'Active',
          lastScan: latest?.completedAt,

          qualityGate: gates.failOnError
            ? (latest?.metrics
              ? this.evaluateQualityGate(latest.metrics, gates)
              : undefined)
            : latest?.qualityGate,


          metrics: latest?.metrics
        } as Repository;
      })
    );
  }


}



