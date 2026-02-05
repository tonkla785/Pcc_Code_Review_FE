// Report History Interfaces

export interface ReportHistory {
    id: string;
    userId: string;
    projectId: string;
    projectName: string;
    dateFrom: string;
    dateTo: string;
    format: string;
    generatedBy: string;
    generatedAt: Date;
    includeQualityGate: boolean;
    includeIssueBreakdown: boolean;
    includeSecurityAnalysis: boolean;
    includeTechnicalDebt: boolean;
    includeRecommendations: boolean;
    snapshotData: any;
    fileSizeBytes: number;
}

export interface ReportHistoryRequest {
    projectId: string;
    projectName: string;
    dateFrom: string;
    dateTo: string;
    format: string;
    generatedBy?: string;
    includeQualityGate?: boolean;
    includeIssueBreakdown?: boolean;
    includeSecurityAnalysis?: boolean;
    includeTechnicalDebt?: boolean;
    includeRecommendations?: boolean;
    snapshotData?: any;
    fileSizeBytes?: number;
}

