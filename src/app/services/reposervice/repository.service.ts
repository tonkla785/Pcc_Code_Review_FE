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
import { ScanResponseDTO } from '../../interface/scan_interface';
import { UserSettingsDataService } from '../shared-data/user-settings-data.service';

import { Repository, ScanIssue } from '../../interface/repository_interface';
export type { Repository, ScanIssue };

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
  private readonly userSettingsData = inject(UserSettingsDataService);

  // เริ่มสแกน - ดึง settings จาก SharedData (SonarQube Config)
  startScan(projectId: string, branch: string = 'main', gitToken?: string | null): Observable<any> {
    console.log('[ScanService] Starting scan for projectId:', projectId, 'branch:', branch);

    const sonarConfig = this.userSettingsData.sonarQubeConfig;

    const requestBody: any = {
      branch,
      sonarToken: sonarConfig?.authToken || '',
      gitToken: (gitToken && gitToken.trim() !== '') ? gitToken.trim() : null,
    };

    requestBody.angularSettings = {
      runNpm: sonarConfig?.angularRunNpm || false,
      coverage: sonarConfig?.angularCoverage || false,
      tsFiles: sonarConfig?.angularTsFiles || false,
      exclusions: sonarConfig?.angularExclusions || '**/node_modules/**,**/*.spec.ts'
    };

    requestBody.springSettings = {
      runTests: sonarConfig?.springRunTests || false,
      jacoco: sonarConfig?.springJacoco || false,
      buildTool: sonarConfig?.springBuildTool || 'maven',
      jdkVersion: sonarConfig?.springJdkVersion || 17
    };

    requestBody.qualityGateSettings = {
      failOnError: sonarConfig?.qgFailOnError || false,
      coverageThreshold: sonarConfig?.qgCoverageThreshold || 0,
      maxBugs: sonarConfig?.qgMaxBugs || 0,
      maxVulnerabilities: sonarConfig?.qgMaxVulnerabilities || 0,
      maxCodeSmells: sonarConfig?.qgMaxCodeSmells || 0
    };

    // ถ้าจะ log ให้ mask
    // console.log('[ScanService] Request body:', { ...requestBody, gitToken: requestBody.gitToken ? '***' : null });

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
              id: scan.id,
              project: scan.project,
              status: scan.status as 'PENDING' | 'SUCCESS' | 'FAILED',
              startedAt: scan.startedAt ? scan.startedAt.toISOString() : '',
              completedAt: scan.completedAt ? scan.completedAt.toISOString() : undefined,
              qualityGate: scan.qualityGate,
              metrics: {
                bugs: scan.metrics?.bugs ?? 0,
                vulnerabilities: scan.metrics?.vulnerabilities ?? 0,
                codeSmells: scan.metrics?.codeSmells ?? 0,
                coverage: scan.metrics?.coverage ?? 0,
                debtRatio: scan.metrics?.debtRatio ?? 0,
                duplicatedLinesDensity: scan.metrics?.duplicatedLinesDensity ?? 0,
                maintainabilityRating: scan.metrics?.maintainabilityRating ?? scan.metrics?.sqale_rating ?? '',
                reliabilityRating: scan.metrics?.reliabilityRating ?? scan.metrics?.reliability_rating ?? '',
                securityHotspots: scan.metrics?.securityHotspots ?? 0,
                securityRating: scan.metrics?.securityRating ?? scan.metrics?.security_rating ?? '',
                technicalDebtMinutes: scan.metrics?.technicalDebtMinutes ?? 0,
                analysisLogs: scan.metrics?.analysisLogs ?? []
              },
              logFilePath: scan.logFilePath ? scan.logFilePath : scan.log_file_path,
              issueData: []
            } as ScanResponseDTO)),

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
                duplications: latestScan.metrics.duplicatedLinesDensity,
                debtRatio: latestScan.metrics.debtRatio,
                analysisLogs: latestScan.metrics.analysisLogs,
                securityRating: latestScan.metrics.securityRating ?? latestScan.metrics.security_rating,
                securityHotspots: latestScan.metrics.securityHotspots,
                reliabilityRating: latestScan.metrics.reliabilityRating ?? latestScan.metrics.reliability_rating,
                technicalDebtMinutes: latestScan.metrics.technicalDebtMinutes,
                maintainabilityRating: latestScan.metrics.maintainabilityRating ?? latestScan.metrics.sqale_rating,
                duplicatedLinesDensity: latestScan.metrics.duplicatedLinesDensity
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

        // Raw scans from backend
        const rawScans = project.scanData ?? [];

        // Temporary map for logical processing (finding latest, etc) with Dates
        const logicalScans = rawScans.map((s: any) => ({
          ...s,
          startedAt: s.startedAt ? new Date(s.startedAt) : undefined,
          completedAt: s.completedAt ? new Date(s.completedAt) : undefined
        }));

        const latest = getLatestScan(
          logicalScans,
          (s: any) => s.completedAt
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
          scanId: latest?.id, // Explicitly return latest scan ID for navigation support

          // Map to ScanResponseDTO for output
          scans: logicalScans.map((s: any) => ({
            id: s.id,
            project: project,
            status: s.status as 'PENDING' | 'SUCCESS' | 'FAILED',
            startedAt: s.startedAt ? s.startedAt.toISOString() : '',
            completedAt: s.completedAt ? s.completedAt.toISOString() : undefined,
            qualityGate: s.qualityGate,
            metrics: s.metrics ? {
              bugs: s.metrics.bugs ?? 0,
              vulnerabilities: s.metrics.vulnerabilities ?? 0,
              codeSmells: s.metrics.codeSmells ?? 0,
              coverage: s.metrics.coverage ?? 0,
              debtRatio: s.metrics.debtRatio ?? 0,
              duplicatedLinesDensity: s.metrics.duplicatedLinesDensity ?? 0,
              securityHotspots: s.metrics.securityHotspots ?? 0,
              technicalDebtMinutes: s.metrics.technicalDebtMinutes ?? 0,
              maintainabilityRating: s.metrics.maintainabilityRating ?? s.metrics.sqale_rating ?? '',
              reliabilityRating: s.metrics.reliabilityRating ?? s.metrics.reliability_rating ?? '',
              securityRating: s.metrics.securityRating ?? s.metrics.security_rating ?? '',
              analysisLogs: []
            } : null,
            logFilePath: s.logFilePath ?? s.log_file_path,
            issueData: []
          } as ScanResponseDTO)),

          status: this.deriveRepoStatusFromScan(latest),
          lastScan: (latest as any)?.completedAt,

          qualityGate: gates.failOnError
            ? ((latest as any)?.metrics
              ? this.evaluateQualityGate((latest as any).metrics, gates)
              : undefined)
            : ((latest as any)?.qualityGate
              ? this.scanService.mapQualityStatus((latest as any).qualityGate)
              : undefined),


          metrics: (latest as any)?.metrics
        } as Repository;
      })
    );
  }
}



