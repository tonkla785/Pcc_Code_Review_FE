import { Pipe, PipeTransform } from '@angular/core';

/**
 * แปลง Date เป็น "x ago" format
 * 
 * Usage: {{ date | timeAgo }}
 * Output: "Just now", "5m ago", "2h ago", "3d ago"
 */
@Pipe({
    name: 'timeAgo',
    standalone: true
})
export class TimeAgoPipe implements PipeTransform {
    transform(value: Date | string | number | null | undefined): string {
        if (!value) return '';

        const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
        if (Number.isNaN(t)) return 'Just now';

        let diffSec = Math.floor((Date.now() - t) / 1000);
        if (diffSec < 0) diffSec = 0;

        const m = Math.floor(diffSec / 60);
        const h = Math.floor(diffSec / 3600);
        const d = Math.floor(diffSec / 86400);

        if (m < 1) return 'Just now';
        if (m < 60) return `${m}m ago`;
        if (h < 24) return `${h}h ago`;
        return `${d}d ago`;
    }
}
