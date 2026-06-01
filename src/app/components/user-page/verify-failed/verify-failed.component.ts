import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-verify-failed',
  standalone: true,
  imports: [],
  templateUrl: './verify-failed.component.html',
  styleUrl: './verify-failed.component.css'
})
export class VerifyFailedComponent {
  expired = false;

  constructor(private router: Router, private route: ActivatedRoute) {
    this.expired = this.route.snapshot.queryParamMap.get('reason') === 'expired';
  }

  goToWebsite() {
    this.router.navigate(['/']);
  }


}
