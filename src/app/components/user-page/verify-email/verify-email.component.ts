import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../../../services/userservice/user.service';
@Component({
  selector: 'app-verify-email',
  standalone: true,
  template: `<div style="padding:16px">Verifying email...</div>`,
})
export class VerifyEmailComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService
  ) { }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.router.navigate(['/verify-failed']);
      return;
    }

    this.userService.confirmVerifyEmail(token).subscribe({
      next: () => this.router.navigate(['/verify-success']),
      error: () => this.router.navigate(['/verify-failed']),
    });
  }
}
