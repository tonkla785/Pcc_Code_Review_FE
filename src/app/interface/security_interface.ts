export interface SecurityIssueDTO {
    id: string;
    scanId: string;
    issueKey: string;
    type: string;
    severity: string;
    ruleKey: string;
    component: string;
    line: number;
    message: string;
    assignedTo: string | null;
    status: string;
    createdAt: string;
    commentData: {
        id: string;
        issue: string;
        user: string;
        comment: string;
        createdAt: string;
    }[];
}

export interface VulnerabilitySeverity {
    severity: string;
    count: number;
    color: string;
}

export interface OwaspCategory {
    name: string;
    status: 'pass' | 'warning' | 'fail';
    count: number;
}

export interface HotSecurityIssue {
    name: string;
    count: number;
}

export interface SecurityMetrics {
    score: number;
    riskLevel: string;
    hotIssues: HotSecurityIssue[];
    vulnerabilities: VulnerabilitySeverity[];
}
