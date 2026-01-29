import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/authservice/auth.service';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatSnackBarModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  username = '';
  email = '';
  phoneNumber = '';
  password = '';
  confirmPassword = '';
  loading = false;
  submitted = false;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly snack: MatSnackBar) { }

  get passwordError() {
    const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%&*]).{8,}$/;
    return this.password && !pattern.test(this.password)
      ? 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      : '';
  }

  get passwordsMismatch() {
    return this.password && this.confirmPassword && this.password !== this.confirmPassword;
  }

  clearForm(form: NgForm) {
    this.username = '';
    this.email = '';
    this.phoneNumber = '';
    this.password = '';
    this.confirmPassword = '';
    form.resetForm();
    this.submitted = false;
  }

  checkUsername(ctrl: any): boolean {
    return !!ctrl?.errors?.duplicate;
  }

  checkEmail(ctrl: any): boolean {
    return !!ctrl?.errors?.duplicate;
  }

  checkPhoneNumber(ctrl: any): boolean {
    return !!ctrl?.errors?.duplicate;
  }




  onSubmit(form: NgForm) {
  this.submitted = true;

  if (form.invalid || this.passwordsMismatch) {
    this.snack.open('Registration failed', '', { duration: 2500, horizontalPosition: 'right', verticalPosition: 'top', panelClass: ['app-snack', 'app-snack-red'] });
    return;
  }

  this.loading = true;

  const username = this.username.trim();
  const email = this.email.trim();

  this.auth.register({
    username,
    email,
    phone: this.phoneNumber.trim(),
    password: this.password.trim()
  }).pipe(
    tap(() => {
      this.snack.open('Successfully registered!', '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-blue'],
      });
      this.router.navigate(['/login']);
    }),
    switchMap(() =>
      this.auth.registerEmail({
        type: 'Register',
        email,
        username,
      }).pipe(
        catchError((e) => {
          console.warn('Email webhook failed:', e);
          return of(null);
        })
      )
    ),
    finalize(() => this.loading = false)
  ).subscribe({
    error: (err: HttpErrorResponse) => {
      this.loading = false;

      if (err.status === 409 && Array.isArray(err.error?.fields)) {
        (err.error.fields as Array<'username' | 'email' | 'phoneNumber'>).forEach(f => {
          const ctrl = form.controls[f];
          ctrl?.setErrors({ ...(ctrl.errors || {}), duplicate: true });
          ctrl?.markAsTouched();
        });
        return;
      }

      if (err.status === 409 && err.error?.message) {
        const msg = String(err.error.message).toLowerCase();
        if (msg.includes('username')) form.controls['username']?.setErrors({ ...(form.controls['username']?.errors || {}), duplicate: true });
        if (msg.includes('email')) form.controls['email']?.setErrors({ ...(form.controls['email']?.errors || {}), duplicate: true });
        if (msg.includes('phone')) form.controls['phoneNumber']?.setErrors({ ...(form.controls['phoneNumber']?.errors || {}), duplicate: true });
      }

      this.snack.open('Registration failed', '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-red'],
      });
    }
  });
}

}