import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/authservice/auth.service';
import { Router } from '@angular/router';
import { ReportHistoryService } from '../../../services/reporthistoryservice/report-history.service';
import { ReportHistoryDataService } from '../../../services/shared-data/report-history-data.service';
import { ReportHistory } from '../../../interface/report_history_interface';
import { ExcelService } from '../../../services/report-generator/excel/excel.service';
import { WordService } from '../../../services/report-generator/word/word.service';
import { PowerpointService } from '../../../services/report-generator/powerpoint/powerpoint.service';
import { PdfService } from '../../../services/report-generator/pdf/pdf.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-reporthistory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporthistory.component.html',
  styleUrl: './reporthistory.component.css'
})
export class ReporthistoryComponent implements OnInit, OnDestroy {

  searchText: string = '';
  reports: ReportHistory[] = [];
  currentPage = 1;
  pageSize = 5;
  loading = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly reportHistoryService: ReportHistoryService,
    private readonly reportHistoryDataService: ReportHistoryDataService,
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

    const reportSub = this.reportHistoryDataService.reportHistory$.subscribe(reports => {
      this.reports = reports;
    });
    this.subscriptions.push(reportSub);

    const loadingSub = this.reportHistoryDataService.loading$.subscribe(loading => {
      this.loading = loading;
    });
    this.subscriptions.push(loadingSub);

    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadHistory(): void {
    this.reportHistoryService.getAllReportHistory().subscribe({
      error: (err) => {
        console.error('Failed to load report history:', err);
        this.snack.open('Failed to load report history', 'close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-red']
        });
      }
    });
  }

  filteredReports(): ReportHistory[] {
    if (!this.searchText) {
      return this.reports;
    }
    const keyword = this.searchText.toLowerCase();
    return this.reports.filter(r =>
      r.projectName.toLowerCase().includes(keyword)
    );
  }

  paginatedReports(): ReportHistory[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredReports().slice(start, start + this.pageSize);
  }

  totalPages(): number {
    return Math.ceil(this.filteredReports().length / this.pageSize);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages()) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  getDateRange(report: ReportHistory): string {
    return `${report.dateFrom} to ${report.dateTo}`;
  }

  downloadReport(report: ReportHistory): void {
    if (!report.snapshotData) {
      this.snack.open('Cannot download report - no snapshot data', 'close', {
        duration: 2000,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-red']
      });
      return;
    }

    const context = {
      projectName: report.projectName,
      dateFrom: report.dateFrom,
      dateTo: report.dateTo,
      scans: report.snapshotData.scans || [],
      issues: report.snapshotData.issues || [],
      securityData: report.snapshotData.securityData,
      selectedSections: report.snapshotData.selectedSections || {},
      generatedBy: report.generatedBy
    };

    try {
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
          this.snack.open('Format not supported', 'close', {
            duration: 2000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['app-snack', 'app-snack-red']
          });
          break;
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      this.snack.open('Error downloading report', 'close', {
        duration: 2000,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-red']
      });
    }
  }
}
