import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, switchMap, map, of, catchError } from 'rxjs';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { ScanService, Scan } from '../scanservice/scan.service';
import { IssueService, Issue } from '../issueservice/issue.service';
import { AuthService } from '../authservice/auth.service';
import { environment } from '../../environments/environment';
import { ScanProject } from '../../interface/repository-scan-issue.interface';
import { RepositoryAll, ScanData } from '../../interface/repository_interface';

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
 
  // แก้ และเช็คดีๆ
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



  // ตัวใหม่
  getAllRepositories(): Observable<RepositoryAll[]> {
    return this.http
      .get<any[]>(`${environment.apiUrl}/repository/all-repository`, this.authOpts())
      .pipe(
        map(raw =>
          raw.map((r): RepositoryAll => ({
            id: r.id,
            name: r.name,
            repositoryUrl: r.repositoryUrl,
            projectType: r.projectType,
            sonarProjectKey: r.sonarProjectKey,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
            scanData: (r.scanData ?? []).map((s: any): ScanData => ({
              id: s.id,
              status: s.status,
              startedAt: new Date(s.startedAt),
              completedAt: s.completedAt ? new Date(s.completedAt) : undefined,
              qualityGate: s.qualityGate,
              metrics: s.metrics,
              logFilePath: s.logFilePath
            }))
          }))
        )
      );
  }

  getRepositoryWithScans(projectId: string): Observable<RepositoryAll> {
    return this.http
      .get<any>(`${environment.apiUrl}/api/${projectId}`, this.authOpts())
      .pipe(
        map(p => ({
          id: p.id,
          name: p.name,
          repositoryUrl: p.repositoryUrl,
          projectType: p.projectType,
          sonarProjectKey: p.sonarProjectKey,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
          scanData: (p.scanData ?? []).map((s: any) => ({
            id: s.id,
            status: s.status,
            startedAt: new Date(s.startedAt),
            completedAt: s.completedAt ? new Date(s.completedAt) : undefined,
            qualityGate: s.qualityGate,
            metrics: s.metrics,
            logFilePath: s.logFilePath
          }))
        }))
      );
  }




}



