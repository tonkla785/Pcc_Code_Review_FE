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
  metrics?: {
  bugs: number,
  codeSmells: number,
  coverage: number,
  debtRatio: number,
  duplicatedLinesDensity: number,
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