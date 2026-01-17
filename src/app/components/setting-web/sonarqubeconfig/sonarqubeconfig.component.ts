import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/authservice/auth.service';

interface AngularSettings {
  runNpm: boolean;
  coverage: boolean;
  tsFiles: boolean;
  exclusions: string;
}

interface SpringSettings {
  runTests: boolean;
  jacoco: boolean;
  buildTool: string;
  jdkVersion: number;
}

@Component({
  selector: 'app-sonarqubeconfig',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './sonarqubeconfig.component.html',
  styleUrl: './sonarqubeconfig.component.css'
})
export class SonarqubeconfigComponent implements OnInit {
  serverUrl = 'https://code.pccth.com';
  authToken = '';
  organization = 'PCCTH';
  showToken = false;

  angularSettings: AngularSettings = {
    runNpm: true,
    coverage: true,
    tsFiles: true,
    exclusions: '**/node_modules/**, **/*.spec.ts'
  };

  springSettings: SpringSettings = {
    runTests: true,
    jacoco: true,
    buildTool: 'gradle',
    jdkVersion: 17
  };

  jdkVersions = [8, 11, 17, 21];

  qualityGates = {
    failOnError: true,
    coverageThreshold: 80,
    maxBugs: 10,
    maxVulnerabilities: 5,
    maxCodeSmells: 100
  };

  private storageKey = 'sonarConfig_v1';

  constructor(
        private readonly router: Router,
        private readonly authService: AuthService,
      ) { }

  ngOnInit(): void {
     const userId = this.authService.userId;
    console.log(userId);
    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadFromLocal();
  }

  toggleShowToken() {
    this.showToken = !this.showToken;
  }

  testConnection() {
    // ตัวอย่างการทดสอบแบบเบื้องต้น (จริงควรเรียก API)
    if (!this.serverUrl) {
      alert('Please enter SonarQube Server URL.');
      return;
    }
    const msg = `Testing connection to:\n${this.serverUrl}\nOrganization: ${this.organization || '-'}`;
    alert(msg);
  }

  resetSettings() {
    if (!confirm('Reset settings to default?')) return;
    localStorage.removeItem(this.storageKey);
    // restore defaults
    this.serverUrl = 'https://code.pccth.com';
    this.authToken = '';
    this.organization = 'PCCTH';
    this.angularSettings = {
      runNpm: true,
      coverage: true,
      tsFiles: true,
      exclusions: '**/node_modules/**, **/*.spec.ts'
    };
    this.springSettings = {
      runTests: true,
      jacoco: true,
      buildTool: 'gradle',
      jdkVersion: 17
    };
    this.qualityGates = {
      failOnError: true,
      coverageThreshold: 80,
      maxBugs: 10,
      maxVulnerabilities: 5,
      maxCodeSmells: 100
    };
    alert('Settings reset.');
  }

  saveSettings() {
    const payload = {
      serverUrl: this.serverUrl,
      authToken: this.authToken,
      organization: this.organization,
      angularSettings: this.angularSettings,
      springSettings: this.springSettings,
      qualityGates: this.qualityGates
    };
    localStorage.setItem(this.storageKey, JSON.stringify(payload));
    console.log('Saved settings:', payload);
    alert('Settings saved to localStorage.');
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
      this.springSettings = obj.springSettings ?? this.springSettings;
      this.qualityGates = obj.qualityGates ?? this.qualityGates;
    } catch (e) {
      console.warn('Failed to load sonar config from localStorage', e);
    }
  }

}
