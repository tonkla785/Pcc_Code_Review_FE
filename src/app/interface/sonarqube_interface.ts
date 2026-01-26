export interface SonarQubeTestConnectRequest {
    sonarHostUrl: string;
    sonarToken: string;
}

export interface SonarQubeTestConnectResponse {
    connected: boolean;
}

export interface AngularSettings {
    runNpm: boolean;
    coverage: boolean;
    tsFiles: boolean;
    exclusions: string;
}

export interface SpringSettings {
    runTests: boolean;
    jacoco: boolean;
    buildTool: string;
    jdkVersion: number;
}

export interface QualityGates {
    failOnError: boolean;
    coverageThreshold: number;
    maxBugs: number;
    maxVulnerabilities: number;
    maxCodeSmells: number;
}

export interface SonarQubeConfig {
    serverUrl: string;
    authToken: string;
    organization: string;
    angularSettings: AngularSettings;
    springSettings: SpringSettings;
    qualityGates: QualityGates;
}
