import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/authservice/auth.service';
import { Router } from '@angular/router';

interface ReportHistory {
  project: string;
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


  reports: ReportHistory[] = [];

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
    this.loadHistory();
  }

  loadHistory() {
    const storageKey = 'report_history';
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const data = JSON.parse(raw);
      this.reports = data.map((item: any) => {
        // Handle migration if needed, but primarily just get the fields we want
        return {
          project: item.project || (item.projects && item.projects.length ? item.projects[0] : '-'),
          dateRange: item.dateRange,
          generatedBy: item.generatedBy,
          generatedAt: item.generatedAt,
          format: item.format
        };
      });
      this.reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    }
  }

  filteredReports() {
    return this.reports.filter(r =>
      !this.searchText ||
      r.project.toLowerCase().includes(this.searchText.toLowerCase())
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

  }
}
