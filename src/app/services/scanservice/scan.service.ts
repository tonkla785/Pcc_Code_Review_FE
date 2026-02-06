import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from '../authservice/auth.service';
import { environment } from '../../environments/environment';
import { ScanResponseDTO } from '../../interface/scan_interface';

export type ScanStatus = 'Active' | 'Scanning' | 'Error' | 'Cancelled';
export type YN = 'Y' | 'N';

export interface Scan {

  scanId: string;            // UUID
  projectId: string;          // UUID
  projectName: string;
  qualityGate?: string;
  startedAt?: Date;
  completedAt?: Date;
  status: ScanStatus;
  reliabilityGate?: string;
  securityGate?: string;
  maintainabilityGate?: string;
  securityReviewGate?: string;
  coverageGate?: YN;
  duplicationGate?: YN;
  // metrics?: Record<string, number>;
  metrics?: {
    bugs?: number;
    vulnerabilities?: number;
    codeSmells?: number;
    coverage?: number;
    duplications?: number;

    code_smells?: number;               // สำหรับ backend legacy
    duplicated_lines_density?: number;  // สำหรับ backend legacy
  };


  log_file_path?: string;

  // ถ้ามีจริงค่อยเติม
  log_file_name?: string;
  log_content?: string;
}

export interface ScanRequest {
  username?: string;
  password?: string;
}


// หมายเหตุ: ชนิดนี้ต้อง "ตรงกับของ Spring" จริง ๆ
// จากตัวอย่าง controller ก่อนหน้า ผมเคยเห็นหน้าตาประมาณ scanId/fileName/path/content
// ถ้า backend ของคุณคืน { scan_id, line: string[] } ก็ใช้ตามนี้ได้เลย
export interface ScanLogModel {
  scanId: string;
  line: string[];
}

@Injectable({ providedIn: 'root' })
export class ScanService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiUrl + '/scans';
  private baseUrl = environment.apiUrl;
  private authOpts() {
    const token = this.auth.token;
    return token
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : {};
  }

  /** POST /api/scans — เริ่มสแกน */
  startScan(projectId: string, req: ScanRequest): Observable<Scan> {
    console.log('[ScanService] Starting scan for repository:', req, 'projectId:', projectId);
    return this.http.post<Scan>(`${this.base}/${projectId}`, req, this.authOpts());
  }


  /** GET /api/scans — ดึงสแกนทั้งหมด */
  getAllScan(): Observable<Scan[]> {
    console.log('[ScanService] Fetching all scans...');
    // TODO: Get userId from token when available
    const userId = '';
    const opts = {
      ...this.authOpts(),                             // ใส่ Authorization ถ้ามี
      params: new HttpParams().set('userId', userId), // << ส่ง userId ไปด้วย
    };
    return this.http.get<Scan[]>(`${this.base}/getProject/${userId}`, opts).pipe(
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

  /** GET /api/scans/{scanid} — รายละเอียดสแกน */
  getByScanId(scanId: string): Observable<Scan> {
    return this.http.get<Scan>(`${this.base}/${scanId}`, this.authOpts()).pipe(
      map(s => ({
        ...s,
        status: this.mapStatus(s.status),
        qualityGate: this.mapQualityStatus(s.qualityGate ?? ''),
        metrics: s.metrics ? {
          bugs: s.metrics.bugs ?? 0,
          vulnerabilities: s.metrics.vulnerabilities ?? 0,
          codeSmells: s.metrics.codeSmells ?? s.metrics['code_smells'] ?? 0,
          coverage: s.metrics.coverage ?? 0,
          duplications: s.metrics.duplications ?? s.metrics['duplicated_lines_density'] ?? 0
        } : undefined
      }))
    );
  }


  /** GET /api/scans/{id}/log — log ของสแกน */
  getLog(id: string): Observable<ScanLogModel> {
    return this.http.get<ScanLogModel>(`${this.base}/${id}/log`, this.authOpts());
  }

  /** POST /api/scans/{id}/cancel — ยกเลิกสแกน */
  cancelScan(id: string): Observable<Scan> {
    // *** ระวัง: ใน Controller ใช้ @PostMapping("/{id}/cancel") แต่พารามิเตอร์ชื่อ scanId
    // ให้แก้ที่ฝั่ง Spring เป็น @PathVariable("id") UUID scanId
    return this.http.post<Scan>(`${this.base}/${id}/cancel`, null, this.authOpts());
  }

  /** ดึงสแกนตาม project_id (ถ้า backend ยังไม่มี endpoint แยก ใช้วิธี filter ฝั่ง client ชั่วคราว) */
  getScansByProjectId(projectId: string): Observable<Scan[]> {
    return this.getAllScan().pipe(
      map(scans => scans.filter(s => s.projectId === projectId).map(s => ({ ...s, status: this.mapStatus(s.status) })))
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
      case 'PENDING':
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

  getScansHistory(): Observable<ScanResponseDTO[]> {
    return this.http.get<ScanResponseDTO[]>(
      `${this.baseUrl}/api/scans`,
      this.authOpts()
    );
  }

  getScanById(scanId: string): Observable<ScanResponseDTO> {
    return this.http.get<ScanResponseDTO>(
      `${this.baseUrl}/api/scans/${scanId}`,
      this.authOpts()
    );
  }


}
