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
