import { Component } from '@angular/core';
import { FormBuilder, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/authservice/auth.service';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  standalone: true,
  selector: 'app-forgot-password',
  imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss'],
})
export class ForgotPasswordComponent {
  form: FormGroup;
  loading = false;
  submitted = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly snack: MatSnackBar
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  submit(): void {
  this.submitted = true;

  if (this.form.invalid) {
    this.snack.open('Please fill in a valid email.', '', {
      duration: 2500,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['app-snack', 'app-snack-red'],
    });
    return;
  }

  this.loading = true;
  const email = this.form.value.email as string;

  this.authService.requestPasswordReset(email).subscribe({
    next: () => {
      this.loading = false;
      this.form.reset();
      this.submitted = false;
      this.snack.open('If the account exists, a reset link has been sent.', '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-green'],
      });
    },
    error: () => {
      this.loading = false;
      this.snack.open('Something went wrong. Please try again.', '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-red'],
      });
    },
  });
}




  goBack(): void {
    this.router.navigate(['/login']); 

  }

}
