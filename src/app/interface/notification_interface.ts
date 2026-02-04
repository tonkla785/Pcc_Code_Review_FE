// Notification Interfaces

export interface Notification {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
    relatedProjectId?: string;
    relatedScanId?: string;
    relatedIssueId?: string;
    relatedCommentId?: string;
}

export interface NotificationRequest {
    userId: string;
    type: string;
    title: string;
    message: string;
    relatedProjectId?: string;
    relatedScanId?: string;
    relatedIssueId?: string;
    relatedCommentId?: string;
}
