// User Settings Interfaces

export interface NotificationSettings {
    id: string;
    userId: string;
    notifyOnNewScans: boolean;
    notifyOnIssues: boolean;
    notifyOnSystemUpdates: boolean;
    notifyOnReports: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface SonarQubeConfig {
    id: string;
    userId: string;
    serverUrl: string;
    authToken?: string;
    organization: string;
    angularRunNpm: boolean;
    angularCoverage: boolean;
    angularTsFiles: boolean;
    angularExclusions: string;
    springRunTests: boolean;
    springJacoco: boolean;
    springBuildTool: string;
    springJdkVersion: number;
    qgFailOnError: boolean;
    qgCoverageThreshold: number;
    qgMaxBugs: number;
    qgMaxVulnerabilities: number;
    qgMaxCodeSmells: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserSettings {
    notificationSettings: NotificationSettings | null;
    sonarQubeConfig: SonarQubeConfig | null;
}
