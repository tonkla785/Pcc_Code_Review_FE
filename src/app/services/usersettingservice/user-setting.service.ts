import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationSettings, SonarQubeConfig } from '../../interface/user_settings_interface';
import { UserSettingsDataService } from '../shared-data/user-settings-data.service';
import { TokenStorageService } from '../tokenstorageService/token-storage.service';

@Injectable({
    providedIn: 'root'
})
export class UserSettingService {
    private readonly baseUrl = environment.apiUrl;

    constructor(
        private http: HttpClient,
        private userSettingsData: UserSettingsDataService,
        private tokenStorage: TokenStorageService
    ) { }

    private getUserId(): string {
        const user = this.tokenStorage.getLoginUser();
        return user?.id || '';
    }

    /**
     * Get notification settings and store in shared data
     */
    getNotificationSettings(): Observable<NotificationSettings> {
        const userId = this.getUserId();
        this.userSettingsData.setLoading(true);
        return this.http.get<NotificationSettings>(`${this.baseUrl}/settings/notification/${userId}`)
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
        const payload = { ...settings, userId: this.getUserId() };
        return this.http.put<NotificationSettings>(`${this.baseUrl}/settings/notification`, payload)
            .pipe(
                tap((updated) => this.userSettingsData.setNotificationSettings(updated))
            );
    }

    /**
     * Get SonarQube config and store in shared data
     */
    getSonarQubeConfig(): Observable<SonarQubeConfig> {
        const userId = this.getUserId();
        this.userSettingsData.setLoading(true);
        return this.http.get<SonarQubeConfig>(`${this.baseUrl}/settings/sonarqube/${userId}`)
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
        const payload = { ...config, userId: this.getUserId() };
        return this.http.put<SonarQubeConfig>(`${this.baseUrl}/settings/sonarqube`, payload)
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

