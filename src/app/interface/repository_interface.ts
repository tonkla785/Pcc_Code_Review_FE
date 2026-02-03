export interface Repository {
    id?: string;
    project: {
        id: string;
        name: string;
        repositoryUrl: string;
        projectType: string;
        sonarProjectKey: string;
        createdAt?: Date;
        updatedAt?: Date;
    }
    status?: 'Active' | 'Scanning' | 'Error';
    startedAt?: string;
    completedAt?: string;
    qualityGate?: string | null;
    metrics?: {
        bugs: number;
        coverage: number;
        codeSmells: number;
        debtRatio: number;
        securityRating?: string;
        vulnerabilities: number;
        securityHotspots: number;
        reliabilityRating?: string;
        technicalDebtMinutes: number;
        maintainabilityRating?: string;
        duplicatedLinesDensity: number;
    } | null;
    logFilePath?: string | null;
    issueData?: any[];
}
