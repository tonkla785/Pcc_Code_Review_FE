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
  completedAt?: string | null;        
  qualityGate?: string | null;
  metrics:  {
  bugs: 0,
  codeSmells: 0,
  coverage: 0,
  debtRatio: 0,
  duplicatedLinesDensity: 0,
  maintainabilityRating?: string,
  reliabilityRating?: string,
  securityHotspots: 0,
  securityRating?: string,
  technicalDebtMinutes: 0,
  vulnerabilities: 0,
};
  logFilePath?: string | null;
  issueData: [];     
}