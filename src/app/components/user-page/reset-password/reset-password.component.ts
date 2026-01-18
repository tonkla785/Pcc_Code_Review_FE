import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../../services/authservice/auth.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  standalone: true,
  selector: 'app-reset-password',
  imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.scss']
})
export class ResetPasswordComponent implements OnInit {
  token: string | null = null;
  loading = false;
  form: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly svc: AuthService,
    private readonly snack: MatSnackBar
  ) {
    this.form = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  // Custom validator for password match
  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return newPassword === confirmPassword ? null : { mismatch: true };
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(p => {
      const tk = p.get('token');
      if (tk) {
        this.token = tk; // เก็บ token ไว้ใน state
        this.router.navigate([], {
          queryParams: { token: null },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      }
    });
  }
  goBack() {
    this.router.navigate(['/forgot-password']);
  }

  submit() {
    if (!this.token) {
      this.showToast('Cannot reset password: invalid or missing token');
      return;
    }

    if (this.form.invalid) {
      if (this.form.errors?.['mismatch']) {
        this.showToast('Passwords do not match');
      } else if (this.form.get('newPassword')?.errors?.['minlength']) {
        this.showToast('Password must be at least 8 characters');
      } else {
        this.showToast('Please fill in all required fields');
      }
      return;
    }
    const { newPassword } = this.form.value;
    this.loading = true;
    // TODO: Implement reset password API when available in AuthService
    setTimeout(() => {
      this.loading = false;
      this.showToast('Password reset successfully!', 'blue');
      setTimeout(() => this.router.navigateByUrl('/login'), 1200);
    }, 1000);
  }

  private showToast(message: string, color: 'red' | 'blue' = 'red') {
    this.snack.open(message, '', {
      duration: 2500,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['app-snack', color === 'red' ? 'app-snack-red' : 'app-snack-blue']
    });
  }
}
