import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/authservice/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reporthistory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporthistory.component.html',
  styleUrl: './reporthistory.component.css'
})
export class ReporthistoryComponent {

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService
  ) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
  }

}
