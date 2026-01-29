import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Scan, ScanService } from '../../../services/scanservice/scan.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-scanhistory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scanhistory.component.html',
  styleUrls: ['./scanhistory.component.css']
})
export class ScanhistoryComponent {

  startDate: string | null = null; // yyyy-MM-dd
  endDate: string | null = null;
  minEndDate: string | null = null;

  searchDate: string | null = null; // Specific date search
  statusFilter: string = 'ALL'; // Status filter

  scans: ScanResponseDTO[] = [];
  filteredScans: ScanResponseDTO[] = [];

  // Pagination
  pageSize: number = 5;
  currentPage: number = 1;
  totalPages: number = 1;
  pagedScans: ScanResponseDTO[] = [];
  pages: number[] = [];
  ScanHistory: ScanResponseDTO[] = [];
  originalData: ScanResponseDTO[] = [];


  constructor(private readonly router: Router, private readonly scanService: ScanService, private authService: AuthService,
    private sharedData: SharedDataService,
  ) {
  }


  ngOnInit(): void {
    if (!this.sharedData.hasScansHistoryCache) {
      this.loadScanHistory();
    }
    this.sharedData.scansHistory$.subscribe(data => {
      this.originalData = data || [];
      this.ScanHistory = [...this.originalData];
      this.applyFilter();
    });

  }

  loadScanHistory() {

    this.sharedData.setLoading(true);
    this.scanService.getScansHistory().subscribe({
      next: (data) => {
        this.sharedData.Scans = data;
        this.sharedData.setLoading(false);
      },
      error: () => this.sharedData.setLoading(false)
    });
  }

  applyFilter() {
    let data = [...this.originalData];

    // 1. Specific Date
    if (this.searchDate) {
      const searchDay = new Date(this.searchDate);
      data = data.filter(item => {
        const d = new Date(item.startedAt);
        return d.getFullYear() === searchDay.getFullYear() &&
          d.getMonth() === searchDay.getMonth() &&
          d.getDate() === searchDay.getDate();
      });
    }
    // 2. Date Range (only if specific date is not set)
    else if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      end.setHours(23, 59, 59, 999);
      data = data.filter(item => {
        const d = new Date(item.startedAt);
        return d >= start && d <= end;
      });
    }

    // 3. Status Filter
    if (this.statusFilter !== 'ALL') {
      data = data.filter(item => item.status?.toUpperCase() === this.statusFilter);
    }

    this.ScanHistory = data;
    this.filteredScans = data;
    this.currentPage = 1;
    this.updatePagination();
  }

  resetFilters() {
    this.searchDate = null;
    this.startDate = null;
    this.endDate = null;
    this.minEndDate = null;
    this.statusFilter = 'ALL';
    this.applyFilter();
  }

  onStartDateChange() {
    if (this.startDate) {
      this.searchDate = null; // Clear specific date if range is used
      const d = new Date(this.startDate);
      this.minEndDate = d.toISOString().split('T')[0];
    } else {
      this.minEndDate = null;
    }
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.ScanHistory.length / this.pageSize);
    if (this.totalPages === 0) this.totalPages = 1;
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    this.updatePagedScans();
  }

  updatePagedScans() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.pagedScans = this.filteredScans.slice(start, end);
  }

  goPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagedScans();
  }

  statusClass(status: string) {
    switch (status) {
      case 'SUCCESS': return 'text-success';
      case 'FAILED': return 'text-danger';
      case 'Scanning': return 'text-warning';
      default: return '';
    }
  }

  statusIcon(status: string) {
    switch (status) {
      case 'SUCCESS': return 'bi-check-circle';
      case 'FAILED': return 'bi-x-circle';
      case 'Scanning': return 'bi-exclamation-circle';
      default: return '';
    }
  }

  viewLog(scan: ScanResponseDTO) {
    this.router.navigate(['/logviewer', scan.id]);
  }

  viewResult(scan: ScanResponseDTO) {
    this.sharedData.ScansDetail = scan;
    this.router.navigate(['/scanresult', scan.id]);
  }


  // Export 
  exportHistory(): void {

    if (!this.selectedScans || this.selectedScans.length === 0) {
      alert('กรุณาเลือกอย่างน้อย 1 รายการสำหรับ Export');
      return;
    }

    const flatData = this.selectedScans.map((scan, index) => {
      const completedAt = scan.completedAt ? new Date(scan.completedAt) : undefined;

      // แปลง qualityGate: OK → Pass, ERROR → Fail
      let grade = scan.qualityGate ?? '';
      if (grade === 'OK') grade = 'Pass';
      else if (grade === 'ERROR') grade = 'Fail';

      return {
        No: index + 1,
        Date: completedAt ? completedAt.toLocaleDateString('en-GB') : '',
        Time: completedAt
          ? completedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          : '',
        Project: scan.project?.name ?? '',
        Status: scan.status ?? '',
        Grade: grade,
        Bugs: scan.metrics?.bugs ?? 0,
        Vulnerabilities: scan.metrics?.vulnerabilities ?? 0,
        CodeSmells: scan.metrics?.codeSmells ?? 0,
        Coverage: scan.metrics?.coverage ?? 0,
      };
    });

    if (flatData.length === 0) {
      alert('ไม่มีข้อมูลสำหรับ export');
      return;
    }

    // สร้าง worksheet จาก data
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(flatData);

    // กำหนดความกว้าง column เพื่อไม่ให้แสดง ###
    ws['!cols'] = [
      { wch: 5 },   // No
      { wch: 12 },  // Date
      { wch: 8 },   // Time
      { wch: 25 },  // Project
      { wch: 10 },  // Status
      { wch: 8 },   // Grade
      { wch: 8 },   // Bugs
      { wch: 15 },  // Vulnerabilities
      { wch: 12 },  // CodeSmells
      { wch: 10 },  // Coverage
    ];

    // สร้าง workbook และเพิ่ม worksheet
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Scan History');

    // ตั้งชื่อไฟล์
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    const uniqueProjects = [...new Set(this.selectedScans.map(s => s.project?.name ?? 'Unknown'))];
    const projectName =
      uniqueProjects.length === 1
        ? uniqueProjects[0].replace(/\s+/g, '_')
        : 'multiple_projects';

    const count = this.selectedScans.length;
    const fileName = `scan_export_${projectName}_${dateStr}_${count}items.xlsx`;

    // ดาวน์โหลดไฟล์ xlsx
    XLSX.writeFile(wb, fileName);
  }



  selectedScans: ScanResponseDTO[] = [];
  showCompareModal = false;

  toggleScanSelection(scan: ScanResponseDTO, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    // Toggle logic
    const index = this.selectedScans.findIndex(s => s.id === scan.id);
    if (index >= 0) {
      this.selectedScans.splice(index, 1);
    } else {
      this.selectedScans.push(scan);
    }
  }


  isSelected(scan: ScanResponseDTO): boolean {
    return this.selectedScans.some(s => s.id === scan.id);
  }


  compareScans() {
    if (this.selectedScans.length < 2) {
      alert("กรุณาเลือกอย่างน้อย 2 รายการ เพื่อเปรียบเทียบ");
      return;
    }
    if (this.selectedScans.length > 3) {
      alert("เปรียบเทียบได้สูงสุด 3 รายการ");
      return;
    }
    this.showCompareModal = true;
  }


  closeCompareModal() {
    this.showCompareModal = false;
  }

  clearOldLogs() {
    this.startDate = null;
    this.endDate = null;
    this.searchDate = null;
    this.statusFilter = 'ALL';
    this.selectedScans = [];
    this.applyFilter();
  }

  // ฟังก์ชันช่วยแปลงเป็น dd/mm/yyyy
  private formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  allSelected(): boolean {
    // Check if ALL currently displayed (paged) items are selected
    return this.pagedScans.length > 0 && this.pagedScans.every(scan => this.isSelected(scan));
  }

  // ✅ คลิก Select All
  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    if (checked) {
      // Add all currently visible items to selection if not already there
      this.pagedScans.forEach(scan => {
        if (!this.isSelected(scan)) {
          this.selectedScans.push(scan);
        }
      });
    } else {
      // Remove all currently visible items from selection
      this.selectedScans = this.selectedScans.filter(s => !this.pagedScans.some(p => p.id === s.id));
    }
  }

}

