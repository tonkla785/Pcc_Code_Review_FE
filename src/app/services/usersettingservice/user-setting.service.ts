import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationSettings, SonarQubeConfig } from '../../interface/user_settings_interface';
import { UserSettingsDataService } from '../shared-data/user-settings-data.service';

// Re-export interfaces for convenience
export type { NotificationSettings, SonarQubeConfig } from '../../interface/user_settings_interface';

@Injectable({
    providedIn: 'root'
})
export class UserSettingService {
    private readonly baseUrl = environment.apiUrl;

    constructor(
        private http: HttpClient,
        private userSettingsData: UserSettingsDataService
    ) { }

    /**
     * Get notification settings and store in shared data
     */
    getNotificationSettings(): Observable<NotificationSettings> {
        this.userSettingsData.setLoading(true);
        return this.http.get<NotificationSettings>(`${this.baseUrl}/settings/notification`)
            .pipe(
                tap({
                    next: (settings) => {
                        this.userSettingsData.setNotificationSettings(settings);
                        this.userSettingsData.setLoading(false);
                    },
                    error: () => this.userSettingsData.setLoading(false)
                })
            );
    }

    /**
     * Update notification settings
     */
    updateNotificationSettings(settings: Partial<NotificationSettings>): Observable<NotificationSettings> {
        return this.http.put<NotificationSettings>(`${this.baseUrl}/settings/notification`, settings)
            .pipe(
                tap((updated) => this.userSettingsData.setNotificationSettings(updated))
            );
    }

    /**
     * Get SonarQube config and store in shared data
     */
    getSonarQubeConfig(): Observable<SonarQubeConfig> {
        this.userSettingsData.setLoading(true);
        return this.http.get<SonarQubeConfig>(`${this.baseUrl}/settings/sonarqube`)
            .pipe(
                tap({
                    next: (config) => {
                        this.userSettingsData.setSonarQubeConfig(config);
                        this.userSettingsData.setLoading(false);
                    },
                    error: () => this.userSettingsData.setLoading(false)
                })
            );
    }

    /**
     * Update SonarQube config
     */
    updateSonarQubeConfig(config: Partial<SonarQubeConfig>): Observable<SonarQubeConfig> {
        return this.http.put<SonarQubeConfig>(`${this.baseUrl}/settings/sonarqube`, config)
            .pipe(
                tap((updated) => this.userSettingsData.setSonarQubeConfig(updated))
            );
    }

    /**
     * Load all settings
     */
    loadAllSettings(): void {
        this.getNotificationSettings().subscribe();
        this.getSonarQubeConfig().subscribe();
    }
}
