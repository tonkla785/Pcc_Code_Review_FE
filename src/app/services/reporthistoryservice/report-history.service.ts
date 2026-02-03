import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ReportHistory, ReportHistoryRequest } from '../../interface/report_history_interface';
import { ReportHistoryDataService } from '../shared-data/report-history-data.service';
import { TokenStorageService } from '../tokenstorageService/token-storage.service';

@Injectable({
    providedIn: 'root'
})
export class ReportHistoryService {
    private readonly baseUrl = environment.apiUrl + '/report-history';

    constructor(
        private http: HttpClient,
        private reportHistoryData: ReportHistoryDataService,
        private tokenStorage: TokenStorageService
    ) { }

    private getUserId(): string {
        const user = this.tokenStorage.getLoginUser();
        return user?.id || '';
    }

    /**
     * Get all report history by user ID and store in shared data
     */
    getAllReportHistory(): Observable<ReportHistory[]> {
        const userId = this.getUserId();
        this.reportHistoryData.setLoading(true);
        return this.http.get<ReportHistory[]>(`${this.baseUrl}/${userId}`)
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
     * Search report history by project name for a specific user
     */
    searchByProjectName(keyword: string): Observable<ReportHistory[]> {
        const userId = this.getUserId();
        return this.http.get<ReportHistory[]>(`${this.baseUrl}/search/${userId}`, {
            params: { keyword }
        });
    }

    /**
     * Create new report history for a specific user
     */
    createReportHistory(request: ReportHistoryRequest): Observable<ReportHistory> {
        const userId = this.getUserId();
        return this.http.post<ReportHistory>(`${this.baseUrl}/create/${userId}`, request)
            .pipe(
                tap((newReport) => this.reportHistoryData.addReport(newReport))
            );
    }

    /**
     * Load all report history (convenience method)
     */
    loadReportHistory(): void {
        this.getAllReportHistory().subscribe();
    }
}
