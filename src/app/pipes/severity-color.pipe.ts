import { Pipe, PipeTransform } from '@angular/core';

/**
 * Get color hex สำหรับ Severity (inline style)
 * 
 * Usage: [style.background-color]="severity | severityColor"
 * Output: '#FBC02D', '#FF9800', '#E64A19', '#C62828'
 */
@Pipe({
    name: 'severityColor',
    standalone: true
})
export class SeverityColorPipe implements PipeTransform {
    transform(severity: string | null | undefined): string {
        if (!severity) return '#757575';

        switch (severity.trim().toUpperCase()) {
            case 'MINOR': return '#FBC02D';     // Yellow
            case 'MAJOR': return '#FF9800';     // Orange
            case 'CRITICAL': return '#E64A19';  // Deep Orange
            case 'BLOCKER': return '#C62828';   // Red
            default: return '#757575';          // Grey
        }
    }
}
