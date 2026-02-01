
export interface Project {
  id: string;
  name: string;
  repositoryUrl: string;
  projectType?: 'ANGULAR' | 'SPRING_BOOT';
  sonarProjectKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScanProject {
  id: string;
  project: Project;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  startedAt: Date;
  completedAt?: Date;
  qualityGate?: string;
  metrics?: {
    bugs?: number;
    coverage?: number;
    debtRatio?: number;
    codeSmells?: number;
    securityRating?: String;
    vulnerabilities?: number;
    securityHotspots?: number;
    reliabilityRating?: String;
    technicalDebtMinutes?: number;
    maintainabilityRating?: String;
    duplicatedLinesDensity?: number;
  };
  logFilePath?: string;
}

export interface ScanIssue {
  id: string;
  scanId: string;
  issueKey: string;
  type: 'Bug' | 'Vulnerability' | 'Code Smell';
  severity: 'Blocker' | 'Critical' | 'Major' | 'Minor';
  component: string;
  message: string;
  status: 'OPEN' | 'PENDING' | 'IN PROGRESS' | 'DONE' | 'REJECT';
  createdAt: Date | string;
  assignedTo?: string;
}
