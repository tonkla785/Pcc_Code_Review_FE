import { Pipe, PipeTransform } from '@angular/core';

/**
 * แปลง number เป็น Thai Baht format
 * 
 * Usage: {{ 1000000 | thbCurrency }}
 * Output: ฿1,000,000
 */
@Pipe({
    name: 'thbCurrency',
    standalone: true
})
export class ThbCurrencyPipe implements PipeTransform {
    transform(value: number | null | undefined): string {
        if (value === null || value === undefined) return '';

        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
            maximumFractionDigits: 0,
        }).format(value);
    }
}
