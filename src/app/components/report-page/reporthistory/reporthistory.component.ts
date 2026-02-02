import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/authservice/auth.service';
import { Router } from '@angular/router';
import { HistoryDataService } from '../../../services/shared-data/history-data.service';
import { ExcelService } from '../../../services/report-generator/excel/excel.service';
import { WordService } from '../../../services/report-generator/word/word.service';
import { PowerpointService } from '../../../services/report-generator/powerpoint/powerpoint.service';
import { PdfService } from '../../../services/report-generator/pdf/pdf.service';
import { MatSnackBar } from '@angular/material/snack-bar';

interface ReportHistory {
  project: string;
  dateRange: string;
  generatedBy: string;
  generatedAt: Date;
  format: string;
  snapshotId?: string;
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
    private readonly historyDataService: HistoryDataService,
    private readonly excelService: ExcelService,
    private readonly wordService: WordService,
    private readonly pptService: PowerpointService,
    private readonly pdfService: PdfService,
    private readonly snack: MatSnackBar
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
        return {
          project: item.project || (item.projects && item.projects.length ? item.projects[0] : '-'),
          dateRange: item.dateRange,
          generatedBy: item.generatedBy,
          generatedAt: item.generatedAt,
          format: item.format,
          snapshotId: item.snapshotId
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
    if (!report.snapshotId) {
      this.snack.open('Cant download report','close',
        {
          duration: 2000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-red'],
        }

      )
      return;
    }

    const snapshot = this.historyDataService.getReportSnapshotById(report.snapshotId);
    if (!snapshot) {
      this.snack.open('Cant download report','close',
        {
          duration: 2000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-red'],
        }

      )
      return;
    }

    const context = {
      projectName: snapshot.metadata.project,
      dateFrom: snapshot.metadata.dateFrom,
      dateTo: snapshot.metadata.dateTo,
      scans: snapshot.data.scans,
      issues: snapshot.data.issues,
      securityData: snapshot.data.securityData,
      selectedSections: snapshot.data.selectedSections,
      generatedBy: snapshot.metadata.generatedBy
    };

    switch (report.format) {
      case 'Excel':
        this.excelService.generateExcel(context);
        break;
      case 'Word':
        this.wordService.generateWord(context);
        break;
      case 'PowerPoint':
        this.pptService.generatePowerPoint(context);
        break;
      case 'PDF':
        this.pdfService.generatePdf(context);
        break;
      default:
        this.snack.open('Format not supported','close',
          {
            duration: 2000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['app-snack', 'app-snack-red'],
          }

        )
        break;
    }
  }
}
