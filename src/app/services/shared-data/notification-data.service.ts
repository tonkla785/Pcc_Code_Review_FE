import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Notification } from '../../interface/notification_interface';

// Re-export interfaces for convenience
export type { Notification, NotificationRequest } from '../../interface/notification_interface';

@Injectable({
    providedIn: 'root'
})
export class NotificationDataService {
    // Notifications list
    private notificationsSubject = new BehaviorSubject<Notification[]>([]);
    notifications$ = this.notificationsSubject.asObservable();

    // Unread count
    private unreadCountSubject = new BehaviorSubject<number>(0);
    unreadCount$ = this.unreadCountSubject.asObservable();

    // Loading state
    private loadingSubject = new BehaviorSubject<boolean>(false);
    loading$ = this.loadingSubject.asObservable();

    /**
     * Set notifications list
     */
    setNotifications(notifications: Notification[]): void {
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount();
    }

    /**
     * Add a notification to the beginning of the list
     */
    addNotification(notification: Notification): void {
        const current = this.notificationsSubject.value;
        this.notificationsSubject.next([notification, ...current]);
        if (!notification.isRead) {
            this.unreadCountSubject.next(this.unreadCountSubject.value + 1);
        }
    }

    /**
     * Mark notification as read
     */
    markAsRead(id: string): void {
        const current = this.notificationsSubject.value;
        const notification = current.find(n => n.id === id);
        if (notification && !notification.isRead) {
            const updated = current.map(n => n.id === id ? { ...n, isRead: true } : n);
            this.notificationsSubject.next(updated);
            this.unreadCountSubject.next(Math.max(0, this.unreadCountSubject.value - 1));
        }
    }

    /**
     * Mark all notifications as read
     */
    markAllAsRead(): void {
        const current = this.notificationsSubject.value;
        const updated = current.map(n => ({ ...n, isRead: true }));
        this.notificationsSubject.next(updated);
        this.unreadCountSubject.next(0);
    }

    /**
     * Remove notification from the list
     */
    removeNotification(id: string): void {
        const current = this.notificationsSubject.value;
        const toDelete = current.find(n => n.id === id);
        if (toDelete && !toDelete.isRead) {
            this.unreadCountSubject.next(Math.max(0, this.unreadCountSubject.value - 1));
        }
        this.notificationsSubject.next(current.filter(n => n.id !== id));
    }

    /**
     * Update unread count based on current notifications
     */
    private updateUnreadCount(): void {
        const unread = this.notificationsSubject.value.filter(n => !n.isRead).length;
        this.unreadCountSubject.next(unread);
    }

    /**
     * Set loading state
     */
    setLoading(loading: boolean): void {
        this.loadingSubject.next(loading);
    }

    /**
     * Get current notifications value
     */
    get notifications(): Notification[] {
        return this.notificationsSubject.value;
    }

    /**
     * Get current unread count value
     */
    get unreadCount(): number {
        return this.unreadCountSubject.value;
    }

    /**
     * Get loading state
     */
    get isLoading(): boolean {
        return this.loadingSubject.value;
    }

    /**
     * Clear all data (on logout)
     */
    clearAll(): void {
        this.notificationsSubject.next([]);
        this.unreadCountSubject.next(0);
    }
}
