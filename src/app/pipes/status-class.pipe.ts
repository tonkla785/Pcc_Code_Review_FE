import { Pipe, PipeTransform } from '@angular/core';

/**
 * Get CSS class สำหรับ Issue/Assignment Status
 * 
 * Usage: [ngClass]="status | statusClass"
 * Output: 'status-open', 'status-in-progress', 'status-done', etc.
 */
@Pipe({
    name: 'statusClass',
    standalone: true
})
export class StatusClassPipe implements PipeTransform {
    transform(status: string | null | undefined): string {
        if (!status) return '';

        switch (status.toLowerCase()) {
            case 'open': return 'status-open';
            case 'in-progress':
            case 'in progress': return 'status-in-progress';
            case 'done': return 'status-done';
            case 'reject': return 'status-reject';
            case 'pending': return 'status-pending';
            default: return 'status-unknown';
        }
    }
}
