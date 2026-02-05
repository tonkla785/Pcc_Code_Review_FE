import { Injectable } from '@angular/core';
import { ScanResponseDTO } from '../../interface/scan_interface';

export interface ReportSnapshot {
    id: string;
    metadata: {
        project: string;
        dateFrom: string;
        dateTo: string;
        format: string;
        generatedBy: string;
        generatedAt: string;
    };
    data: {
        scans: ScanResponseDTO[];
        issues: any[];
        securityData?: any;
        selectedSections: {
            qualityGate: boolean;
            issueBreakdown: boolean;
            securityAnalysis: boolean;
            technicalDebt?: boolean;
            trendAnalysis?: boolean;
            recommendations?: boolean;
        };
        recommendationsData?: any[];
    };
}

@Injectable({
    providedIn: 'root'
})
export class HistoryDataService {
    private readonly STORAGE_KEY = 'report_snapshots';
    private readonly MAX_SNAPSHOTS = 20;

    constructor() { }

    saveReportSnapshot(snapshot: ReportSnapshot): void {
        const stored = this.getReportSnapshots();
        stored.push(snapshot);
        const recent = stored.slice(-this.MAX_SNAPSHOTS);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recent));
    }

    getReportSnapshots(): ReportSnapshot[] {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    }

    getReportSnapshotById(id: string): ReportSnapshot | null {
        const snapshots = this.getReportSnapshots();
        return snapshots.find(s => s.id === id) || null;
    }

    clearAllSnapshots(): void {
        localStorage.removeItem(this.STORAGE_KEY);
    }

    removeSnapshotById(id: string): void {
        const snapshots = this.getReportSnapshots();
        const filtered = snapshots.filter(s => s.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    }
}
