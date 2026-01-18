import { Pipe, PipeTransform } from '@angular/core';

/**
 * Truncate string ถ้ายาวเกินไป
 * 
 * Usage: {{ longText | truncate:50 }}
 * Output: "This is a very long text that will be..."
 */
@Pipe({
    name: 'truncate',
    standalone: true
})
export class TruncatePipe implements PipeTransform {
    transform(value: string | null | undefined, maxLength: number = 50): string {
        if (!value) return '';
        return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
    }
}
