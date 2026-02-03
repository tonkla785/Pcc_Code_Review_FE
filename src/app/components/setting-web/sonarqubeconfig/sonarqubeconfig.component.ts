import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/authservice/auth.service';
import { SonarQubeService } from '../../../services/sonarqubeservice/sonarqube.service';
import { UserSettingService } from '../../../services/usersettingservice/user-setting.service';
import { UserSettingsDataService, SonarQubeConfig } from '../../../services/shared-data/user-settings-data.service';
import {
  AngularSettings,
  SpringSettings,
  QualityGates
} from '../../../interface/sonarqube_interface';
import Swal from 'sweetalert2';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';

@Component({
  selector: 'app-sonarqubeconfig',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './sonarqubeconfig.component.html',
  styleUrl: './sonarqubeconfig.component.css'
})
export class SonarqubeconfigComponent implements OnInit, OnDestroy {
  serverUrl = 'https://code.pccth.com';
  authToken = '';
  organization = 'PCCTH';
  showToken = false;
  isTestingConnection = false;
  isSaving = false;

  angularSettings: AngularSettings = {
    runNpm: false,
    coverage: false,
    tsFiles: false,
    exclusions: '**/node_modules/**, **/*.spec.ts'
  };

  springSettings: SpringSettings = {
    runTests: false,
    jacoco: false,
    buildTool: 'maven',
    jdkVersion: 21
  };

  jdkVersions = [8, 11, 17, 21];

  // Default Quality Gates (ค่า 0 ทั้งหมด)
  readonly DEFAULT_QUALITY_GATES: QualityGates = {
    failOnError: false,
    coverageThreshold: 0,
    maxBugs: 0,
    maxVulnerabilities: 0,
    maxCodeSmells: 0
  };

  // ค่า Quality Gates เมื่อเลือก failOnError
  readonly ACTIVE_QUALITY_GATES: QualityGates = {
    failOnError: true,
    coverageThreshold: 80,
    maxBugs: 10,
    maxVulnerabilities: 5,
    maxCodeSmells: 100
  };

  qualityGates: QualityGates = { ...this.DEFAULT_QUALITY_GATES };

  private subscription?: Subscription;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sonarQubeService: SonarQubeService,
    private readonly sharedData: SharedDataService,
    private readonly userSettingService: UserSettingService,
    private readonly userSettingsData: UserSettingsDataService
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    // Subscribe to shared data for SonarQube config
    this.subscription = this.userSettingsData.sonarQubeConfig$.subscribe(config => {
      if (config) {
        this.loadFromConfig(config);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Load settings from SonarQubeConfig
   */
  private loadFromConfig(config: SonarQubeConfig): void {
    this.serverUrl = config.serverUrl || this.serverUrl;
    this.organization = config.organization || this.organization;

    this.angularSettings = {
      runNpm: config.angularRunNpm,
      coverage: config.angularCoverage,
      tsFiles: config.angularTsFiles,
      exclusions: config.angularExclusions || this.angularSettings.exclusions
    };

    this.springSettings = {
      runTests: config.springRunTests,
      jacoco: config.springJacoco,
      buildTool: config.springBuildTool || 'maven',
      jdkVersion: config.springJdkVersion || 21
    };

    this.qualityGates = {
      failOnError: config.qgFailOnError,
      coverageThreshold: config.qgCoverageThreshold,
      maxBugs: config.qgMaxBugs,
      maxVulnerabilities: config.qgMaxVulnerabilities,
      maxCodeSmells: config.qgMaxCodeSmells
    };
  }

  toggleShowToken() {
    this.showToken = !this.showToken;
  }

  // เมื่อ toggle failOnError checkbox
  onFailOnErrorChange() {
    if (this.qualityGates.failOnError) {
      // เมื่อติ๊ก → ใช้ค่า active
      this.qualityGates = { ...this.ACTIVE_QUALITY_GATES };
    } else {
      // เมื่อไม่ติ๊ก → ใช้ค่า default (0 ทั้งหมด)
      this.qualityGates = { ...this.DEFAULT_QUALITY_GATES };
    }
  }

  testConnection() {
    if (!this.serverUrl) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing URL',
        text: 'Please enter SonarQube Server URL.',
        confirmButtonColor: '#3085d6'
      });
      return;
    }
    if (!this.authToken) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Token',
        text: 'Please enter SonarQube Token.',
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    this.isTestingConnection = true;

    this.sonarQubeService.testConnect({
      sonarHostUrl: this.serverUrl,
      sonarToken: this.authToken
    }).subscribe({
      next: (response) => {
        this.isTestingConnection = false;
        if (response.connected) {
          Swal.fire({
            icon: 'success',
            title: 'Connection Successful',
            text: 'Successfully connected to SonarQube server!',
            confirmButtonColor: '#28a745'
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Connection Failed',
            text: 'Unable to connect to SonarQube server.',
            confirmButtonColor: '#dc3545'
          });
        }
      },
      error: (error) => {
        this.isTestingConnection = false;
        console.error('Test connection error:', error);
        const errorMessage = error.error?.message || error.message || 'Network error';
        Swal.fire({
          icon: 'error',
          title: 'Connection Failed',
          text: errorMessage,
          confirmButtonColor: '#dc3545'
        });
      }
    });
  }

  resetSettings() {
    this.serverUrl = 'https://code.pccth.com';
    this.authToken = '';
    this.organization = 'PCCTH';
    this.angularSettings = {
      runNpm: false,
      coverage: false,
      tsFiles: false,
      exclusions: '**/node_modules/**, **/*.spec.ts'
    };
    this.springSettings = {
      runTests: false,
      jacoco: false,
      buildTool: 'maven',
      jdkVersion: 21
    };
    this.qualityGates = { ...this.DEFAULT_QUALITY_GATES };
    Swal.fire({
      icon: 'success',
      title: 'Reset Complete',
      text: 'Settings have been reset to default.',
      confirmButtonColor: '#3085d6'
    });
  }

  saveSettings() {
    this.isSaving = true;

    const payload: Partial<SonarQubeConfig> = {
      serverUrl: this.serverUrl,
      organization: this.organization,
      angularRunNpm: this.angularSettings.runNpm,
      angularCoverage: this.angularSettings.coverage,
      angularTsFiles: this.angularSettings.tsFiles,
      angularExclusions: this.angularSettings.exclusions,
      springRunTests: this.springSettings.runTests,
      springJacoco: this.springSettings.jacoco,
      springBuildTool: this.springSettings.buildTool,
      springJdkVersion: this.springSettings.jdkVersion,
      qgFailOnError: this.qualityGates.failOnError,
      qgCoverageThreshold: this.qualityGates.coverageThreshold,
      qgMaxBugs: this.qualityGates.maxBugs,
      qgMaxVulnerabilities: this.qualityGates.maxVulnerabilities,
      qgMaxCodeSmells: this.qualityGates.maxCodeSmells
    };

    this.userSettingService.updateSonarQubeConfig(payload).subscribe({
      next: () => {
        this.isSaving = false;
        // Share quality gates with the app
        this.sharedData.setQualityGates(this.qualityGates);
        Swal.fire({
          icon: 'success',
          title: 'Settings Saved',
          text: 'Settings have been saved successfully.',
          confirmButtonColor: '#28a745'
        });
      },
      error: (error) => {
        this.isSaving = false;
        console.error('Failed to save settings:', error);
        Swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: 'Failed to save settings. Please try again.',
          confirmButtonColor: '#dc3545'
        });
      }
    });
  }
}
