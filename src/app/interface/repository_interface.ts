export interface RepositoryAll {
  id: string;
  name: string;
  repositoryUrl: string;
  projectType?: 'ANGULAR' | 'SPRING_BOOT';
  sonarProjectKey?: string;
  createdAt: Date;
  updatedAt: Date;
  scanData: ScanData[];
}

export interface ScanData {
  id: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  startedAt: Date;
  completedAt?: Date;
  qualityGate?: 'OK' | 'ERROR' | string;
  metrics?: ScanMetric;
  logFilePath?: string;
}

export interface ScanMetric {
  bugs?: number;
  coverage?: number;
  debtRatio?: number;
  codeSmells?: number;
  securityRating?: string;
  vulnerabilities?: number;
  securityHotspots?: number;
  reliabilityRating?: string;
  technicalDebtMinutes?: number;
  maintainabilityRating?: string;
  duplicatedLinesDensity?: number;
}

export interface RepositoryUpsertRequest {
  name: string;
  url: string;
  type: 'ANGULAR' | 'SPRING_BOOT';
}

export interface ApiMessageResponse {
  message: string;
  projectId?: string; // เผื่อกรณี addRepo
}

export interface AddRepoResponse {
  message: string;
  projectId: string;
}

export interface UpdateRepoResponse {
  message: string;
}
