import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-verify-failed',
  standalone: true,
  imports: [],
  templateUrl: './verify-failed.component.html',
  styleUrl: './verify-failed.component.css'
})
export class VerifyFailedComponent {
  constructor(private router: Router) {}

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

}
