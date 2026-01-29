import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'debtTime',
  standalone: true
})
export class DebtTimePipe implements PipeTransform {

  transform(minutes: number | undefined | null): string {
    if (!minutes) return '0h';

    // 1 Day = 8 Hours = 480 Minutes
    const days = Math.floor(minutes / 480);
    const remainingMinutes = minutes % 480;
    const hours = Math.floor(remainingMinutes / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);

    return parts.length > 0 ? parts.join(' ') : '0h';
  }

}
