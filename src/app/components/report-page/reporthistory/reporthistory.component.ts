import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/authservice/auth.service';
import { Router } from '@angular/router';

interface ReportHistory {
  reportType: string;
  projects: string[];
  dateRange: string;
  generatedBy: string;
  generatedAt: Date;
  format: string;
}
@Component({
  selector: 'app-reporthistory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporthistory.component.html',
  styleUrl: './reporthistory.component.css'
})
export class ReporthistoryComponent {

  searchText: string = '';


  // mock data ตัวอย่าง
  reports = [
    {
      reportType: 'Executive Summary',
      projects: ['Commu T-POP', 'Intelligent Music'],
      dateRange: '2025-08-01 to 2025-08-31',
      generatedBy: 'Admin',
      generatedAt: new Date('2025-09-05T09:15:00'),
      format: 'PDF'
    }
  ];

  currentPage = 1;
  pageSize = 5;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
  ) { }
  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
  }

  filteredReports() {
    return this.reports.filter(r =>
      !this.searchText ||
      r.reportType.toLowerCase().includes(this.searchText.toLowerCase()) ||
      r.projects.some(p => p.toLowerCase().includes(this.searchText.toLowerCase()))
    );
  }

  paginatedReports() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredReports().slice(start, start + this.pageSize);
  }

  totalPages() {
    return Math.ceil(this.filteredReports().length / this.pageSize);
  }

  nextPage() {
    if (this.currentPage < this.totalPages()) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }



  downloadReport(report: ReportHistory) {
    alert(`Download report: ${report.reportType} (${report.format})`);
    // TODO: implement actual download logic
  }
}
