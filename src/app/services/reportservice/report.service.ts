import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
    ReportGenerateRequest,
    ReportGenerateResponse
} from '../../interface/report_generate_interface';

@Injectable({ providedIn: 'root' })
export class ReportService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = environment.apiUrl + '/api/reports';

    generatePdf(request: ReportGenerateRequest): Observable<ReportGenerateResponse> {
        return this.http.post<ReportGenerateResponse>(`${this.baseUrl}/generate`, request);
    }

    downloadBase64(base64: string, fileName: string, mimeType: string): void {
        const byteChars = atob(base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    }
}
