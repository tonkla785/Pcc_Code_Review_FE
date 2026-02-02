export interface ScanRequest {
  userId: string;
  fileName: string;
  fileSize: number;
}

export interface ScanResponseDTO {
  id: string;
  project: any;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  qualityGate?: string | null;
  metrics: {
    analysisLogs: {
      message: string,
      timestamp: number
    }[];
    bugs: 0,
    codeSmells: 0,
    coverage: 0,
    debtRatio: 0,
    duplicatedLinesDensity: 0,
    maintainabilityRating?: string,
    reliabilityRating?: string,
    securityHotspots: number,
    securityRating?: string,
    technicalDebtMinutes: number,
    vulnerabilities: number,
  } | null;
  logFilePath?: string | null;
  issueData: [];
}