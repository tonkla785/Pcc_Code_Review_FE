
export interface ReportGenerateSections {
    qualityGate: boolean;
    issueBreakdown: boolean;
    securityAnalysis: boolean;
    technicalDebt: boolean;
    recommendations: boolean;
}

export interface ReportGenerateRequest {
    projectId: string;
    dateFrom: string;   
    dateTo: string;     
    format: 'pdf';
    sections: ReportGenerateSections;
    userId?: string;        
    generatedBy?: string;
}

export interface ReportGenerateResponse {
    fileName: string;
    mimeType: string;
    base64: string;
    fileSizeBytes: number;
    generatedAt: string;
}
