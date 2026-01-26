import { Component, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-sonarqubeconfig',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './sonarqubeconfig.component.html',
  styleUrl: './sonarqubeconfig.component.css'
})
export class SonarqubeconfigComponent {
  serverUrl = 'https://code.pccth.com';
  authToken = '';
  organization = 'PCCTH';
  showToken = false;
  isTestingConnection = false;

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

  private storageKey = 'sonarConfig_v1';

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sonarQubeService: SonarQubeService,
    private readonly sharedData: SharedDataService
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadFromLocal();
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
    localStorage.removeItem(this.storageKey);
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
    // ไม่เก็บ jdkVersion ลง localStorage
    const springSettingsToSave = {
      runTests: this.springSettings.runTests,
      jacoco: this.springSettings.jacoco,
      buildTool: this.springSettings.buildTool
    };

    const payload = {
      serverUrl: this.serverUrl,
      authToken: this.authToken,
      organization: this.organization,
      angularSettings: this.angularSettings,
      springSettings: springSettingsToSave,
      qualityGates: this.qualityGates
    };

    localStorage.setItem(this.storageKey, JSON.stringify(payload));
    //แชร์ quality gates ให้ทั้งแอป
    this.sharedData.setQualityGates(this.qualityGates);
    console.log('Saved settings:', payload);
    Swal.fire({
      icon: 'success',
      title: 'Settings Saved',
      text: 'Settings have been saved successfully.',
      confirmButtonColor: '#28a745'
    });
  }

  private loadFromLocal() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const obj = JSON.parse(raw);
      this.serverUrl = obj.serverUrl ?? this.serverUrl;
      this.authToken = obj.authToken ?? this.authToken;
      this.organization = obj.organization ?? this.organization;
      this.angularSettings = obj.angularSettings ?? this.angularSettings;

      // โหลด springSettings แต่ไม่เอา jdkVersion (ใช้ค่า default)
      if (obj.springSettings) {
        this.springSettings = {
          ...this.springSettings,
          runTests: obj.springSettings.runTests ?? this.springSettings.runTests,
          jacoco: obj.springSettings.jacoco ?? this.springSettings.jacoco,
          buildTool: obj.springSettings.buildTool ?? this.springSettings.buildTool
        };
      }

      // โหลด qualityGates
      if (obj.qualityGates) {
        this.qualityGates = obj.qualityGates;
      } else {
        this.qualityGates = { ...this.DEFAULT_QUALITY_GATES };
      }
    } catch (e) {
      console.warn('Failed to load sonar config from localStorage', e);
    }
  }

}
