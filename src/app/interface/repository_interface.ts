import { Issue } from "../services/issueservice/issue.service";
import { ScanResponseDTO } from "./scan_interface";

export interface Repository {
    id?: string;
    projectId?: string;// UUID (string)
    user?: string;// เทียบกับ user: string | undefined; มีก็ได้ไม่มีก็ได้
    name: string;
    repositoryUrl: string;
    projectType?: 'ANGULAR' | 'SPRING_BOOT';
    projectTypeLabel?: string;
    branch?: string;
    sonarProjectKey?: string;
    createdAt?: Date;
    updatedAt?: Date;
    scans?: ScanResponseDTO[];
    scanId?: string;
    status?: 'Active' | 'Scanning' | 'Error';
    lastScan?: Date;
    scanningProgress?: number;
    qualityGate?: string;
    metrics?: {
        bugs?: number;
        vulnerabilities?: number;
        codeSmells?: number;
        coverage?: number;
        duplications?: number;
    };
    issues?: Issue[];
}

// ตัว test Issue (เก็บไว้ด้วยเผื่อใช้)
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
