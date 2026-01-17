import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReportRequest {
  projectId: string;
  dateFrom: string;  
  dateTo: string;    
  outputFormat: string; 
  includeSections: string[]; 
}

@Injectable({
  providedIn: 'root'
})
export class ExportreportService {

   private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl + '/export';
   

  generateReport(req: ReportRequest): Observable<Blob> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    return this.http.post(`${this.base}/generate`, req, {
      headers,
      responseType: 'blob'
    });
  }
}
