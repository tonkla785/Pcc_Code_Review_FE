import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import{FormsModule} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/authservice/auth.service';


interface NotificationSettings {
  scans: boolean;
  issues: boolean;
  system: boolean;
  reports: boolean;
  channel: string;     // push | email | slack
  frequency: string;   // immediate | daily | weekly
}

@Component({
  selector: 'app-notificationsetting',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './notificationsetting.component.html',
  styleUrl: './notificationsetting.component.css'
})
export class NotificationsettingComponent implements OnInit {
  settings: NotificationSettings = {
    scans: true,
    issues: true,
    system: true,
    reports: false,
    channel: 'push',
    frequency: 'immediate'
  };

  saving = false;

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
    this.loadSettings();
  }

  saveSettings(): void {
    this.saving = true;
    localStorage.setItem('notification-settings', JSON.stringify(this.settings));
    setTimeout(() => {
      this.saving = false;
      alert('Settings saved!');
    }, 500);
  }

  loadSettings(): void {
    const raw = localStorage.getItem('notification-settings');
    if (raw) {
      try {
        this.settings = JSON.parse(raw);
      } catch {
        // ใช้ default
      }
    }
  }

  resetSettings(): void {
    localStorage.removeItem('notification-settings');
    this.settings = {
      scans: true,
      issues: true,
      system: true,
      reports: false,
      channel: 'push',
      frequency: 'immediate'
    };
  }

}
