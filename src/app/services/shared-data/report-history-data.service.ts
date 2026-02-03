import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ReportHistory } from '../../interface/report_history_interface';

// Re-export interfaces for convenience
export type { ReportHistory, ReportHistoryRequest } from '../../interface/report_history_interface';

@Injectable({
    providedIn: 'root'
})
export class ReportHistoryDataService {
    // Report history list
    private reportHistorySubject = new BehaviorSubject<ReportHistory[]>([]);
    reportHistory$ = this.reportHistorySubject.asObservable();

    // Loading state
    private loadingSubject = new BehaviorSubject<boolean>(false);
    loading$ = this.loadingSubject.asObservable();

    /**
     * Set report history list
     */
    setReportHistory(reports: ReportHistory[]): void {
        this.reportHistorySubject.next(reports);
    }

    /**
     * Add a report to the list
     */
    addReport(report: ReportHistory): void {
        const current = this.reportHistorySubject.value;
        this.reportHistorySubject.next([report, ...current]);
    }

    /**
     * Remove a report from the list
     */
    removeReport(id: string): void {
        const current = this.reportHistorySubject.value;
        this.reportHistorySubject.next(current.filter(r => r.id !== id));
    }

    /**
     * Set loading state
     */
    setLoading(loading: boolean): void {
        this.loadingSubject.next(loading);
    }

    /**
     * Get current report history value
     */
    get reportHistory(): ReportHistory[] {
        return this.reportHistorySubject.value;
    }

    /**
     * Get loading state
     */
    get isLoading(): boolean {
        return this.loadingSubject.value;
    }

    /**
     * Clear all data (on logout)
     */
    clearAll(): void {
        this.reportHistorySubject.next([]);
    }
}
