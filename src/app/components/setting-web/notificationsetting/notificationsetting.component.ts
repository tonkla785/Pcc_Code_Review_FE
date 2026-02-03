import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/authservice/auth.service';
import { UserSettingService } from '../../../services/usersettingservice/user-setting.service';
import { UserSettingsDataService, NotificationSettings } from '../../../services/shared-data/user-settings-data.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

interface LocalNotificationSettings {
  scans: boolean;
  issues: boolean;
  system: boolean;
  reports: boolean;
}

@Component({
  selector: 'app-notificationsetting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notificationsetting.component.html',
  styleUrl: './notificationsetting.component.css'
})
export class NotificationsettingComponent implements OnInit, OnDestroy {
  // Local form settings
  settings: LocalNotificationSettings = {
    scans: true,
    issues: true,
    system: true,
    reports: true,
  };

  saving = false;
  loading = false;

  private settingsSubscription?: Subscription;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly userSettingService: UserSettingService,
    private readonly userSettingsData: UserSettingsDataService
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    // Subscribe to real-time notification settings from shared data
    this.settingsSubscription = this.userSettingsData.notificationSettings$.subscribe((data) => {
      if (data) {
        // Map from API interface to local form - use actual values, not defaults
        this.settings = {
          scans: data.scansEnabled,
          issues: data.issuesEnabled,
          system: data.systemEnabled,
          reports: data.reportsEnabled,
        };
        console.log('[NotificationSettings] Loaded from SharedData:', this.settings);
      }
      // If data is null, keep current settings (don't override with defaults)
    });

    // Always load settings from API to get fresh data
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.settingsSubscription?.unsubscribe();
  }

  saveSettings(): void {
    this.saving = true;

    // Map local form to API interface - use correct field names for backend
    const updatePayload = {
      scansEnabled: this.settings.scans,
      issuesEnabled: this.settings.issues,
      systemEnabled: this.settings.system,
      reportsEnabled: this.settings.reports
    };

    this.userSettingService.updateNotificationSettings(updatePayload).subscribe({
      next: () => {
        this.saving = false;
        Swal.fire({
          icon: 'success',
          title: 'Saved!',
          text: 'Notification settings saved successfully.',
          confirmButtonColor: '#3085d6'
        });
      },
      error: (err) => {
        this.saving = false;
        console.error('Failed to save notification settings:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to save settings. Please try again.',
          confirmButtonColor: '#d33'
        });
      }
    });
  }

  loadSettings(): void {
    this.loading = true;
    this.userSettingService.getNotificationSettings().subscribe({
      next: () => {
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        console.error('Failed to load notification settings:', err);
        // Use default values on error
        this.settings = {
          scans: true,
          issues: true,
          system: true,
          reports: true,
        };
      }
    });
  }

  resetSettings(): void {
    // Reset to default (all enabled)
    this.settings = {
      scans: true,
      issues: true,
      system: true,
      reports: true,
    };

    Swal.fire({
      icon: 'info',
      title: 'Reset',
      text: 'Settings reset to default. Click Save to apply.',
      confirmButtonColor: '#3085d6'
    });
  }
}
