// Dashboard Interfaces

export interface TopIssue {
    message: string;
    count: number;
}

export interface Condition {
    metric: string;
    status: 'OK' | 'ERROR';
    actual: number;
    threshold: number;
}

export interface Issue {
    id: number;
    type: string;
    severity: 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR';
    message: string;
    project: string;
}

export interface SecurityHotspot {
    id: number;
    status: 'REVIEWED' | 'TO_REVIEW';
    description: string;
    project: string;
}

export interface ScanHistory {
    scanId: string;
    projectId: string;
    project: string;
    typeproject: 'Angular' | 'SpringBoot';
    status: 'Passed' | 'Failed' | '';
    grade: string | null;
    time: string;
    maintainabilityGate: string | null;
}

export interface DashboardData {
    id: string;
    name: string;
    qualityGate: { status: 'OK' | 'ERROR'; conditions: Condition[] };
    metrics: {
        bugs: number;
        vulnerabilities: number;
        codeSmells: number;
        coverage: number;
        duplications?: number;
        technicalDebt?: string;
    };
    issues: Issue[];
    securityHotspots: SecurityHotspot[];
    history: ScanHistory[];
    coverageHistory: number[];
    maintainabilityGate: string;
    days: number[];
}

export type NotificationTab = 'All' | 'Unread' | 'Scans' | 'Issues' | 'System';

export interface UserProfile {
    username: string;
    email: string;
    phoneNumber?: string;
    status: string;
}
