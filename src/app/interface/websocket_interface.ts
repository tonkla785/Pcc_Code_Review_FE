export type BackendScanStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type UiScanStatus = 'SCANNING' | 'SUCCESS' | 'FAILED';

export interface ScanEvent {
    projectId: string;
    scanId: string;
    status: UiScanStatus;
}

export interface NotificationEvent {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
    relatedProjectId?: string;
    relatedScanId?: string;
    relatedIssueId?: string;
    relatedCommentId?: string;
}

// Global broadcast notification (same structure as NotificationEvent)
// These are received from /topic/notifications/global for all users
export type GlobalNotificationEvent = NotificationEvent;

// Project change event for add/edit/delete broadcasts
// Received from /topic/projects for all users
export interface ProjectChangeEvent {
    action: 'ADDED' | 'UPDATED' | 'DELETED';
    projectId: string;
    projectName: string;
}

// Issue change event for update broadcasts (assign/status)
// Received from /topic/issues for all users
export interface IssueChangeEvent {
    action: 'UPDATED';
    issueId: string;
}


export interface UserVerifyStatusEvent {
    userId: string;
    status: 'UNVERIFIED' | 'PENDING_VERIFICATION' | 'VERIFIED';
}
