import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NotificationSettings, SonarQubeConfig, UserSettings } from '../../interface/user_settings_interface';

// Re-export interfaces for convenience
export type { NotificationSettings, SonarQubeConfig, UserSettings } from '../../interface/user_settings_interface';

@Injectable({
    providedIn: 'root'
})
export class UserSettingsDataService {
    // Notification Settings
    private notificationSettingsSubject = new BehaviorSubject<NotificationSettings | null>(null);
    notificationSettings$ = this.notificationSettingsSubject.asObservable();

    // SonarQube Config
    private sonarQubeConfigSubject = new BehaviorSubject<SonarQubeConfig | null>(null);
    sonarQubeConfig$ = this.sonarQubeConfigSubject.asObservable();

    // Loading state
    private loadingSubject = new BehaviorSubject<boolean>(false);
    loading$ = this.loadingSubject.asObservable();

    /**
     * Set notification settings
     */
    setNotificationSettings(settings: NotificationSettings | null): void {
        this.notificationSettingsSubject.next(settings);
    }

    /**
     * Set SonarQube config
     */
    setSonarQubeConfig(config: SonarQubeConfig | null): void {
        this.sonarQubeConfigSubject.next(config);
    }

    /**
     * Set loading state
     */
    setLoading(loading: boolean): void {
        this.loadingSubject.next(loading);
    }

    /**
     * Get current notification settings value
     */
    get notificationSettings(): NotificationSettings | null {
        return this.notificationSettingsSubject.value;
    }

    /**
     * Get current SonarQube config value
     */
    get sonarQubeConfig(): SonarQubeConfig | null {
        return this.sonarQubeConfigSubject.value;
    }

    /**
     * Get loading state
     */
    get isLoading(): boolean {
        return this.loadingSubject.value;
    }

    /**
     * Clear all settings (on logout)
     */
    clearAll(): void {
        this.notificationSettingsSubject.next(null);
        this.sonarQubeConfigSubject.next(null);
    }
}
