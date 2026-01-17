import { Component} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink} from '@angular/router';
import { NgApexchartsModule, ApexOptions } from 'ng-apexcharts';
import { AuthService } from '../../../services/authservice/auth.service';

@Component({
  selector: 'app-securitydashboard',
  standalone: true,
  imports: [NgApexchartsModule,CommonModule,RouterLink],
  templateUrl: './securitydashboard.component.html',
  styleUrl: './securitydashboard.component.css'
})
export class SecuritydashboardComponent{


  securityScore = 85;
  riskLevel = 'MEDIUM';

  vulnerabilities = [
    { severity: 'Critical', count: 2, color: 'bg-danger' },
    { severity: 'High', count: 5, color: 'bg-warning' },
    { severity: 'Medium', count: 12, color: 'bg-medium'},
    { severity: 'Low', count: 8, color: 'bg-success' }
  ];

  owaspCoverage = [
    { name: 'A01 Broken Access', status: 'pass' },
    { name: 'A02 Crypto Failures', status: 'warning' },
    { name: 'A03 Injection', status: 'fail' },
    { name: 'A04 Insecure Design', status: 'pass' },
    { name: 'A05 Security Config', status: 'pass' },
    { name: 'A06 Vulnerable Comp', status: 'warning' },
    { name: 'A07 Auth Failures', status: 'pass' },
    { name: 'A08 Data Integrity', status: 'pass' },
    { name: 'A09 Logging Fails', status: 'warning' },
    { name: 'A10 SSRF', status: 'pass' }
  ];
  

  hotIssues = [
    'SQL Injection (3)',
    'XSS Vulnerability (2)',
    'Hardcoded Secrets (2)',
    'Weak Encryption (1)',
    'Path Traversal (1)'
  ];

  constructor(
      private readonly router: Router,
      private readonly authService: AuthService,
    ) { }
    
ngOnInit(): void {
    const userId = this.authService.userId;
    console.log(userId);
    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }
  }
  // ปุ่มย้อนกลับ
  goBack(): void {
    window.history.back();
  }
  
  get totalVulnerabilities(): number {
    return this.vulnerabilities.reduce((acc, v) => acc + v.count, 0);
  }
  

 // ตัวอย่างข้อมูล chart
 chartSeries = [
  {
    name: 'Security Issues',
    data: [5, 10, 15, 20, 15, 10, 7]
  }
];
chartOptions: ApexOptions = {
  chart: { type: 'line', height: 200, toolbar: { show: false } },
  stroke: { curve: 'smooth', width: 3 },
  xaxis: { categories: ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7'] },
  yaxis: { min: 0 },
  dataLabels: { enabled: false },
  tooltip: { enabled: true },
  title: { text: 'Security Trend (7 Days)', align: 'left' },
  colors: ['#008FFB'] 
};




}
