import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/authservice/auth.service';
import { SonarQubeService } from '../../../services/sonarqubeservice/sonarqube.service';
import {
  AngularSettings,
  SpringSettings,
  QualityGates
} from '../../../interface/sonarqube_interface';
import Swal from 'sweetalert2';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { UserSettingService } from '../../../services/usersettingservice/user-setting.service';
import { UserSettingsDataService } from '../../../services/shared-data/user-settings-data.service';
import { SonarQubeConfig } from '../../../interface/user_settings_interface';
import { Subscription } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-sonarqubeconfig',
  standalone: true,
  imports: [FormsModule, CommonModule, TranslatePipe],
  templateUrl: './sonarqubeconfig.component.html',
  styleUrl: './sonarqubeconfig.component.css'
})
export class SonarqubeconfigComponent implements OnInit, OnDestroy {
  serverUrl = '';
  authToken = '';
  organization = '';
  gitAccessToken = '';
  showToken = false;
  showGitToken = false;
  isTestingConnection = false;

  angularSettings: AngularSettings = {
    runNpm: false,
    coverage: false,
    tsFiles: false,
    exclusions: '**/node_modules/**,**/dist/**,**/*.spec.ts'
  };

  springSettings: SpringSettings = {
    runTests: false,
    jacoco: false,
    buildTool: 'maven',
    jdkVersion: 21
  };

  jdkVersions = [8, 11, 17, 21, 25];

  readonly DEFAULT_QUALITY_GATES = { failOnError: false };
  readonly ACTIVE_QUALITY_GATES = { failOnError: true };

  qualityGates: QualityGates = {
    failOnError: false,
    coverageThreshold: 0,
    maxBugs: 0,
    maxVulnerabilities: 0,
    maxCodeSmells: 0,
    maxDuplications: 0,
    maxSecurityHotspots: 0
  };

  private destroy$ = new Subscription();

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sonarQubeService: SonarQubeService,
    private readonly sharedData: SharedDataService,
    private readonly userSettingService: UserSettingService,
    private readonly userSettingsData: UserSettingsDataService,
    private readonly translate: TranslateService
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    // Subscribe to user settings
    this.destroy$.add(
      this.userSettingsData.sonarQubeConfig$.subscribe((config) => {
        if (config) {
          this.loadFromConfig(config);
        } else {
          // First time load or no config, try to fetch
          this.userSettingService.getSonarQubeConfig().subscribe();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.destroy$.unsubscribe();
  }

  toggleShowToken() {
    this.showToken = !this.showToken;
  }

  toggleShowGitToken() {
    this.showGitToken = !this.showGitToken;
  }

  onFailOnErrorChange() {
    this.qualityGates = {
      ...this.qualityGates,
      ...(this.qualityGates.failOnError ? this.ACTIVE_QUALITY_GATES : this.DEFAULT_QUALITY_GATES)
    };
  }

  trimFields() {
    this.serverUrl = this.serverUrl ? this.serverUrl.trim() : '';
    this.authToken = this.authToken ? this.authToken.trim() : '';
    this.organization = this.organization ? this.organization.trim() : '';
    this.gitAccessToken = this.gitAccessToken ? this.gitAccessToken.trim() : '';
    if (this.angularSettings) {
      this.angularSettings.exclusions = this.angularSettings.exclusions ? this.angularSettings.exclusions.trim() : '';
    }
  }

  testConnection(): Promise<boolean> {
    this.trimFields();
    const t = (key: string) => this.translate.instant(key);
    if (!this.serverUrl) {
      Swal.fire({
        icon: 'warning',
        title: t('SONARQUBE_CONFIG.SWAL.MISSING_URL_TITLE'),
        text: t('SONARQUBE_CONFIG.SWAL.MISSING_URL_TEXT'),
        confirmButtonColor: '#3085d6'
      });
      return Promise.resolve(false);
    }
    if (!this.authToken) {
      Swal.fire({
        icon: 'warning',
        title: t('SONARQUBE_CONFIG.SWAL.MISSING_TOKEN_TITLE'),
        text: t('SONARQUBE_CONFIG.SWAL.MISSING_TOKEN_TEXT'),
        confirmButtonColor: '#3085d6'
      });
      return Promise.resolve(false);
    }

    this.isTestingConnection = true;

    return new Promise((resolve) => {
      this.sonarQubeService.testConnect({
        sonarHostUrl: this.serverUrl,
        sonarToken: this.authToken
      }).subscribe({
        next: (response) => {
          this.isTestingConnection = false;
          if (response.connected) {
            Swal.fire({
              icon: 'success',
              title: t('SONARQUBE_CONFIG.SWAL.CONN_SUCCESS_TITLE'),
              text: t('SONARQUBE_CONFIG.SWAL.CONN_SUCCESS_TEXT'),
              confirmButtonColor: '#28a745'
            });
            resolve(true);
          } else {
            Swal.fire({
              icon: 'error',
              title: t('SONARQUBE_CONFIG.SWAL.CONN_FAILED_TITLE'),
              text: t('SONARQUBE_CONFIG.SWAL.CONN_FAILED_TEXT'),
              confirmButtonColor: '#dc3545'
            });
            resolve(false);
          }
        },
        error: (error) => {
          this.isTestingConnection = false;
          const errorMessage = error.error?.message || error.message || 'Network error';
          Swal.fire({
            icon: 'error',
            title: t('SONARQUBE_CONFIG.SWAL.CONN_FAILED_TITLE'),
            text: errorMessage,
            confirmButtonColor: '#dc3545'
          });
          resolve(false);
        }
      });
    });
  }

  resetSettings() {
    this.serverUrl = '';
    this.authToken = '';
    this.organization = '';
    this.gitAccessToken = '';
    this.angularSettings = {
      runNpm: false,
      coverage: false,
      tsFiles: false,
      exclusions: '**/node_modules/**,**/dist/**,**/*.spec.ts'
    };
    this.springSettings = {
      runTests: false,
      jacoco: false,
      buildTool: 'maven',
      jdkVersion: 21
    };
    this.qualityGates = {
      failOnError: false,
      coverageThreshold: 0,
      maxBugs: 0,
      maxVulnerabilities: 0,
      maxCodeSmells: 0,
      maxDuplications: 0,
      maxSecurityHotspots: 0
    };
    const t = (key: string) => this.translate.instant(key);
    Swal.fire({
      icon: 'success',
      title: t('SONARQUBE_CONFIG.SWAL.RESET_TITLE'),
      text: t('SONARQUBE_CONFIG.SWAL.RESET_TEXT'),
      confirmButtonColor: '#3085d6'
    });
  }

  async saveSettings() {
    this.trimFields();
    const isConnected = await this.testConnection();

    if (!isConnected) {
      return;
    }
    const t = (key: string) => this.translate.instant(key);
    const config: Partial<SonarQubeConfig> = {
      serverUrl: this.serverUrl,
      authToken: this.authToken,
      organization: this.organization,
      gitAccessToken: this.gitAccessToken,

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
      qgMaxCodeSmells: this.qualityGates.maxCodeSmells,
      qgMaxDuplications: this.qualityGates.maxDuplications,
      qgMaxSecurityHotspots: this.qualityGates.maxSecurityHotspots
    };

    this.userSettingService.updateSonarQubeConfig(config).subscribe({
      next: (updatedConfig) => {
        this.sharedData.setQualityGates(this.qualityGates);
        Swal.fire({
          icon: 'success',
          title: t('SONARQUBE_CONFIG.SWAL.SAVE_SUCCESS_TITLE'),
          text: t('SONARQUBE_CONFIG.SWAL.SAVE_SUCCESS_TEXT'),
          confirmButtonColor: '#28a745'
        });
      },
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: t('SONARQUBE_CONFIG.SWAL.SAVE_FAILED_TITLE'),
          text: t('SONARQUBE_CONFIG.SWAL.SAVE_FAILED_TEXT'),
          confirmButtonColor: '#dc3545'
        });
      }
    });
  }

  private loadFromConfig(config: SonarQubeConfig) {
    if (!config) return;



    this.serverUrl = config.serverUrl || '';
    this.authToken = config.authToken || '';
    this.organization = config.organization || '';
    this.gitAccessToken = config.gitAccessToken || '';

    this.angularSettings = {
      runNpm: config.angularRunNpm,
      coverage: config.angularCoverage,
      tsFiles: config.angularTsFiles,
      exclusions: config.angularExclusions || '**/node_modules/**,**/dist/**,**/*.spec.ts'
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
      maxCodeSmells: config.qgMaxCodeSmells,
      maxDuplications: config.qgMaxDuplications ?? 0,
      maxSecurityHotspots: config.qgMaxSecurityHotspots ?? 0
    };

    // Update SharedData for other components
    this.sharedData.setQualityGates(this.qualityGates);
  }
}
