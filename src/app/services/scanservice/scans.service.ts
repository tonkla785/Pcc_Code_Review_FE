import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ScanResponseDTO } from '../../interface/scan_interface';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ScanService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getScansHistory(): Observable<ScanResponseDTO[]> {
    return this.http.get<ScanResponseDTO[]>(
      `${this.baseUrl}/api/scans` 
    );
  }

  getScanById(scanId: string): Observable<ScanResponseDTO> {
    return this.http.get<ScanResponseDTO>(
      `${this.baseUrl}/scan/${scanId}` 
    );
  }
}