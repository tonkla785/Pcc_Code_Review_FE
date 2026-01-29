export type ScannerType = 'npm sonar' | 'mvn sonar' | 'gradle sonar';

export interface ScanLog {
    applicationName: string;
    timestamp: Date;
    filename: string;
    content: {
        scannerType: ScannerType;
    };
}

export type Severity = 'MAJOR' | 'CRITICAL';

export interface GroupedIssues {
    MAJOR: any[];
    CRITICAL: any[];
}
