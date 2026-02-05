import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/authservice/auth.service';
import { EmailService } from '../../../services/emailservice/email.service';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatSnackBarModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
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
    private readonly emailService: EmailService,
    private readonly router: Router,
    private readonly snack: MatSnackBar,
  ) { }
  emailPattern = '^[^@\\s]+@[^@\\s]+\\.[a-zA-Z]{2,}$';
  phonePattern = '^[0-9]{10,15}$';

  get passwordError() {
    const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%&*]).{8,}$/;
    return this.password && !pattern.test(this.password)
      ? 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      : '';
  }

  markTouched(ctrl: any) {
    ctrl?.control?.markAsTouched();
  }

  get passwordsMismatch() {
    return (
      this.password &&
      this.confirmPassword &&
      this.password !== this.confirmPassword
    );
  }
  get passwordRules() {
    const pwd = this.password || '';
    return {
      minLength: pwd.length >= 8,
      upper: /[A-Z]/.test(pwd),
      lower: /[a-z]/.test(pwd),
      number: /\d/.test(pwd),
      special: /[!@#$%&*]/.test(pwd),
    };
  }

  get passwordValid() {
    const r = this.passwordRules;
    return r.minLength && r.upper && r.lower && r.number && r.special;
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

    if (form.invalid || this.passwordsMismatch || !this.passwordValid) {
      this.snack.open('Registration failed', '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-red'],
      });
      return;
    }

    this.loading = true;

    const username = this.username.trim();
    const email = this.email.trim();

    this.auth
      .register({
        username,
        email,
        phone: this.phoneNumber.trim(),
        password: this.password.trim(),
      })
      .pipe(
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
          this.emailService
            .registerEmail({
              type: 'Register',
              email,
              username,
            })
            .pipe(
              catchError((e) => {
                console.warn('Email webhook failed:', e);
                return of(null);
              }),
            ),
        ),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        error: (err: HttpErrorResponse) => {
          this.loading = false;

          const status = err.status;
          const rawMsg = err.error?.message ?? err.message ?? '';
          const msg = String(rawMsg).toLowerCase();

          if (
            (status === 400 || status === 409) &&
            Array.isArray(err.error?.fields)
          ) {
            (
              err.error.fields as Array<'username' | 'email' | 'phoneNumber'>
            ).forEach((f) => {
              const ctrl = form.controls[f];
              ctrl?.setErrors({ ...(ctrl.errors || {}), duplicate: true });
              ctrl?.markAsTouched();
            });

            this.snack.open(String(rawMsg) || 'Registration failed', '', {
              duration: 2500,
              horizontalPosition: 'right',
              verticalPosition: 'top',
              panelClass: ['app-snack', 'app-snack-red'],
            });
            return;
          }

          if ((status === 400 || status === 409) && msg) {
            let handled = false;

            if (msg.includes('username')) {
              const c = form.controls['username'];
              c?.setErrors({ ...(c.errors || {}), duplicate: true });
              c?.markAsTouched();
              handled = true;
            }
            if (msg.includes('email')) {
              const c = form.controls['email'];
              c?.setErrors({ ...(c.errors || {}), duplicate: true });
              c?.markAsTouched();
              handled = true;
            }
            if (msg.includes('phone')) {
              const c = form.controls['phoneNumber'];
              c?.setErrors({ ...(c.errors || {}), duplicate: true });
              c?.markAsTouched();
              handled = true;
            }

            if (handled) {
              this.snack.open(String(rawMsg), '', {
                duration: 2500,
                horizontalPosition: 'right',
                verticalPosition: 'top',
                panelClass: ['app-snack', 'app-snack-red'],
              });
              return;
            }
          }

          // 3) fallback
          this.snack.open('Registration failed', '', {
            duration: 2500,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['app-snack', 'app-snack-red'],
          });
        },
      });
  }
}
