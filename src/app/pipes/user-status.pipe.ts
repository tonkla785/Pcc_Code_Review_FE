import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'userStatus',
  standalone: true
})
export class UserStatusPipe implements PipeTransform {

  transform(value: string | undefined | null): string {
    if (!value) return '';

    // Replace underscores with spaces
    // Example: PENDING_VERIFICATION -> PENDING VERIFICATION
    let formatted = value.replace(/_/g, ' ');

    // Optionally handle other cases or specific text replacements
    if (formatted.toUpperCase() === 'PENDING VERIFICATION') {
        // You can customize further if needed, but replacing _ seems sufficient for the request
    }

    return formatted;
  }

}
