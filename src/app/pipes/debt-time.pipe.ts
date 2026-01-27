import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'debtTime',
  standalone: true
})
export class DebtTimePipe implements PipeTransform {

  transform(minutes: number): string {
    if (!minutes) return '0d 0h';

    // 1 Day = 8 Hours = 480 Minutes
    const days = Math.floor(minutes / 480);
    const remainingMinutes = minutes % 480;
    const hours = Math.floor(remainingMinutes / 60);

    return `${days}d ${hours}h`;
  }

}
