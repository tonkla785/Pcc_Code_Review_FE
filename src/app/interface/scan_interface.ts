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
  metrics: Record<string, any>;       
  logFilePath?: string | null;
  issueData: [];     
}