import { Pipe, PipeTransform } from '@angular/core';

/**
 * Get CSS class สำหรับ Severity
 * 
 * Usage: [ngClass]="severity | severityClass"
 * Output: 'text-danger', 'text-warning', 'text-success'
 */
@Pipe({
    name: 'severityClass',
    standalone: true
})
export class SeverityClassPipe implements PipeTransform {
    transform(severity: string | null | undefined): string {
        if (!severity) return '';

        switch (severity.toLowerCase()) {
            case 'critical':
            case 'blocker':
            case 'high': return 'text-danger';
            case 'major':
            case 'medium': return 'text-warning';
            case 'minor':
            case 'low': return 'text-success';
            default: return '';
        }
    }
}
