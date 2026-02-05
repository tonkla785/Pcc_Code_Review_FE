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
