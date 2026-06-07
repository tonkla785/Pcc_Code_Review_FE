import { Component } from '@angular/core';
import { FormBuilder, Validators, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/authservice/auth.service';
import { EmailService } from '../../../services/emailservice/email.service';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  standalone: true,
  selector: 'app-forgot-password',
  imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule, TranslatePipe],
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
    private readonly emailService: EmailService,
    private readonly router: Router,
    private readonly snack: MatSnackBar,
    private readonly translate: TranslateService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  submit(): void {
    this.submitted = true;

    if (this.form.invalid) {
      this.snack.open(this.translate.instant('FORGOT_PASSWORD.SNACK_VALID_EMAIL'), '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-red'],
      });
      return;
    }

    this.loading = true;
    const email = this.form.value.email as string;

    this.emailService.requestPasswordReset(email).subscribe({
      next: () => {
        this.loading = false;
        this.form.reset();
        this.submitted = false;
        this.snack.open(this.translate.instant('FORGOT_PASSWORD.SNACK_LINK_SENT'), '', {
          duration: 2500,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-green'],
        });
      },
      error: () => {
        this.loading = false;
        this.snack.open(this.translate.instant('FORGOT_PASSWORD.SNACK_ERROR'), '', {
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
