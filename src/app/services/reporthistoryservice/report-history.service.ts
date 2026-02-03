import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ReportHistory, ReportHistoryRequest } from '../../interface/report_history_interface';
import { ReportHistoryDataService } from '../shared-data/report-history-data.service';

// Re-export interfaces for convenience
export type { ReportHistory, ReportHistoryRequest } from '../../interface/report_history_interface';

@Injectable({
    providedIn: 'root'
})
export class ReportHistoryService {
    private readonly baseUrl = environment.apiUrl + '/report-history';

    constructor(
        private http: HttpClient,
        private reportHistoryData: ReportHistoryDataService
    ) { }

    /**
     * Get all report history and store in shared data
     */
    getAllReportHistory(): Observable<ReportHistory[]> {
        this.reportHistoryData.setLoading(true);
        return this.http.get<ReportHistory[]>(this.baseUrl)
            .pipe(
                tap({
                    next: (reports) => {
                        this.reportHistoryData.setReportHistory(reports);
                        this.reportHistoryData.setLoading(false);
                    },
                    error: () => this.reportHistoryData.setLoading(false)
                })
            );
    }

    /**
     * Get report history by ID
     */
    getReportById(id: string): Observable<ReportHistory> {
        return this.http.get<ReportHistory>(`${this.baseUrl}/${id}`);
    }

    /**
     * Get report history by project ID
     */
    getReportsByProject(projectId: string): Observable<ReportHistory[]> {
        return this.http.get<ReportHistory[]>(`${this.baseUrl}/project/${projectId}`);
    }

    /**
     * Search report history by project name
     */
    searchByProjectName(keyword: string): Observable<ReportHistory[]> {
        return this.http.get<ReportHistory[]>(`${this.baseUrl}/search`, {
            params: { keyword }
        });
    }

    /**
     * Create new report history
     */
    createReportHistory(request: ReportHistoryRequest): Observable<ReportHistory> {
        return this.http.post<ReportHistory>(this.baseUrl, request)
            .pipe(
                tap((newReport) => this.reportHistoryData.addReport(newReport))
            );
    }

    /**
     * Delete report history
     */
    deleteReportHistory(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${id}`)
            .pipe(
                tap(() => this.reportHistoryData.removeReport(id))
            );
    }

    /**
     * Load all report history (convenience method)
     */
    loadReportHistory(): void {
        this.getAllReportHistory().subscribe();
    }
}
