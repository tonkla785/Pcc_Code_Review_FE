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
    },
    {
      reportType: 'Detailed Analysis',
      projects: ['Intelligent Farming'],
      dateRange: '2025-07-15 to 2025-08-15',
      generatedBy: 'Nut',
      generatedAt: new Date('2025-09-04T14:20:00'),
      format: 'Excel'
    },
    {
      reportType: 'User Activity',
      projects: ['Leave System'],
      dateRange: '2025-08-20 to 2025-08-30',
      generatedBy: 'Tester',
      generatedAt: new Date('2025-09-03T11:45:00'),
      format: 'Word'
    },
    {
      reportType: 'Error Logs',
      projects: ['Frontend Automate Code'],
      dateRange: '2025-09-01 to 2025-09-02',
      generatedBy: 'DevOps',
      generatedAt: new Date('2025-09-02T20:10:00'),
      format: 'Powerpoint'
    },
    {
      reportType: 'System Health',
      projects: ['Sleep Health Dataset'],
      dateRange: '2025-08-25 to 2025-08-31',
      generatedBy: 'System',
      generatedAt: new Date('2025-09-01T08:30:00'),
      format: 'PDF'
    },
    {
      reportType: 'Financial Report',
      projects: ['Commu T-POP', 'E-Commerce'],
      dateRange: '2025-08-01 to 2025-08-31',
      generatedBy: 'Finance',
      generatedAt: new Date('2025-08-30T16:50:00'),
      format: 'Excel'
    },
    {
      reportType: 'Bug Report',
      projects: ['Frontend Automate Code Review'],
      dateRange: '2025-08-20 to 2025-08-28',
      generatedBy: 'QA',
      generatedAt: new Date('2025-08-29T10:05:00'),
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
