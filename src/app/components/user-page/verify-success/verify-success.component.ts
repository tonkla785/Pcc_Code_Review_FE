import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-verify-success',
  standalone: true,
  imports: [],
  templateUrl: './verify-success.component.html',
  styleUrl: './verify-success.component.css'
})
export class VerifySuccessComponent {
  already = false;

  constructor(private router: Router, private route: ActivatedRoute) {
    this.already = this.route.snapshot.queryParamMap.get('status') === 'already';
  }

  goToWebsite() {
    this.router.navigate(['/']);
  }

}
