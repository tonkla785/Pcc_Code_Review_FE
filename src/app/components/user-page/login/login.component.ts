import { SharedDataService } from './../../../services/shared-data/shared-data.service';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/authservice/auth.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { jwtDecode } from 'jwt-decode';
import { TokenStorageService } from '../../../services/tokenstorageService/token-storage.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatSnackBarModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';
  loading = false;
  submitted = false;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly snack: MatSnackBar,
  ) { }

  ngOnInit(): void {
    // เช็คว่า user มี session อยู่แล้วหรือไม่ (ยังไม่ได้ logout)
    // ถ้ามี token อยู่แล้ว redirect ไป dashboard เลย
    if (this.auth.isLoggedIn) {
      this.snack.open('Already! Login', '', {
        duration: 2500,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-blue'],
      });
      this.router.navigate(['/dashboard']);
      return;
    }
  }

  onSubmit(form: NgForm) {
    this.submitted = true;
    this.loading = true;

    if (form.invalid) {
      this.snack.open('Login Failed. Please fill in all fields.', '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-red'],
      });
      return;
    }

    this.loading = true;
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: (user) => {
        this.loading = false;
        this.snack.open('Login Successfully!', '', {
          duration: 2500,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-blue'],
        });
        console.log('Token:', this.auth.token);
        console.log('Logged in user:', user);
        // Note: user data is already saved in auth.service.ts tap() before this callback
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.loading = false;
        this.snack.open('Login Failed. Please try again.', '', {
          duration: 2500,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-red'],
        });
      },
    });
  }
}
