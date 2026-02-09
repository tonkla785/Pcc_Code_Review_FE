import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Scan, ScanService } from '../../../services/scanservice/scan.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { Repository } from '../../../interface/repository_interface';
import { RepositoryService } from '../../../services/reposervice/repository.service';

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

  // Pagination
  pageSize: number = 5;
  currentPage: number = 1;
  totalPages: number = 1;
  pagedScans: ScanResponseDTO[] = [];
  pages: number[] = [];
  ScanHistory: ScanResponseDTO[] = [];
  originalData: ScanResponseDTO[] = [];
  filteredScan:  ScanResponseDTO[] = [];
  showGrade = true;
showBugs = true;
showCodeSmells = true;
showCoverage = false;
showDuplications = false;
  filterProject = 'All Projects';
  filterType = 'ALL';
    repositories: Repository[] = [];
  constructor(private readonly router: Router, private readonly scanService: ScanService, private authService: AuthService,
    private sharedData: SharedDataService, private repoService: RepositoryService
  ) {
  }


  ngOnInit(): void {
    if (!this.sharedData.hasScansHistoryCache) {
      this.loadScanHistory();
    }
    if (!this.sharedData.hasRepositoriesCache) {
      this.loadRepositories();
    }
    this.sharedData.scansHistory$.subscribe(data => {
      this.originalData = data || [];
      this.ScanHistory = [...this.originalData];
      this.applyFilterStatus();
      console.log('Scan history loaded from sharedData:', data);
    });
        this.sharedData.repositories$.subscribe((repos) => {
      this.repositories = repos;
      console.log('Repositories loaded from sharedData:', this.repositories);
    });
  }

  loadScanHistory() {

    this.sharedData.setLoading(true);
    this.scanService.getScansHistory().subscribe({
      next: (data) => {
        this.sharedData.Scans = data;
        this.sharedData.setLoading(false);
        this.applyFilterStatus();
      },
      error: () => this.sharedData.setLoading(false)
    });
  }

  applyFilter() {

    if (this.searchDate) {
      const searchDay = new Date(this.searchDate);
      this.ScanHistory = this.ScanHistory.filter(item => {
        const d = new Date(item.startedAt);
        return d.getFullYear() === searchDay.getFullYear() &&
          d.getMonth() === searchDay.getMonth() &&
          d.getDate() === searchDay.getDate();
      });
    }
    else if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      end.setHours(23, 59, 59, 999);
      this.ScanHistory = this.ScanHistory.filter(item => {
        const d = new Date(item.startedAt);
        return d >= start && d <= end;
      });
    }

    if (this.statusFilter !== 'ALL') {
      this.ScanHistory = this.ScanHistory.filter(item => item.status?.toUpperCase() === this.statusFilter);
    }

    this.filteredScan = this.ScanHistory;
    this.currentPage = 1;
    this.updatePage();
  }
  loadRepositories() {
    this.sharedData.setLoading(true);

    this.repoService.getAllRepo().subscribe({
      next: (repos) => {
        // เก็บข้อมูลลง SharedDataService
        this.sharedData.setRepositories(repos);
        this.sharedData.setLoading(false);
        console.log('Repositories loaded:', repos);
      },
      error: (err) => {
        console.error('Failed to load repositories:', err);
        this.sharedData.setLoading(false);
      },
    });
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

  updatePage() {
    this.totalPages = Math.ceil(this.ScanHistory.length / this.pageSize);
    if (this.totalPages === 0) this.totalPages = 1;
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    this.updatePagedScans();
    
  }

  updatePagedScans() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.pagedScans = this.filteredScan.slice(start, end);
    
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
      case 'PENDING': return 'text-warning';
      default: return '';
    }
  }

  statusIcon(status: string) {
    switch (status) {
      case 'SUCCESS': return 'bi-check-circle';
      case 'FAILED': return 'bi-x-circle';
      case 'PENDING': return 'bi-exclamation-circle';
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
      Swal.fire({
        icon: 'warning',
        title: 'Please select items',
        text: 'Please select at least 1 item to export',
        confirmButtonText: 'OK'
      });
      return;
    }

    const flatData = this.selectedScans.map((scan, index) => {
      const completedAt = scan.completedAt ? new Date(scan.completedAt) : undefined;

      // แปลง qualityGate: OK → Pass, ERROR → Fail
      let grade = scan.qualityGate ?? '';
      if (grade === 'OK') grade = 'Pass';
      else grade = 'Fail';

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
      Swal.fire({
        icon: 'info',
        title: 'No data',
        text: 'No data available for export',
        confirmButtonText: 'OK'
      });
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
      Swal.fire({
        icon: 'warning',
        title: 'Not enough items selected',
        text: 'Please select at least 2 items to compare',
        confirmButtonText: 'OK'
      });
      return;
    }
    // if (this.selectedScans.length > 3) {
    //   Swal.fire({
    //     icon: 'warning',
    //     title: 'Too many items selected',
    //     text: 'You can compare up to 3 items maximum',
    //     confirmButtonText: 'OK'
    //   });
    //   return;
    // }
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
applyFilterStatus() {
  const matchType = (this.filterType || 'ALL').toLowerCase();
  const matchProject = (this.filterProject || 'All Projects').toLowerCase();
  this.filteredScan = this.ScanHistory.filter(item => {
    const d = new Date(item.startedAt);

    let matchDate = true;
    console.log('Applying filters:', item?.project?.name)
    if (this.startDate && !this.endDate) {
      const searchDay = new Date(this.startDate);
      matchDate =
        d.getFullYear() === searchDay.getFullYear() &&
        d.getMonth() === searchDay.getMonth() &&
        d.getDate() === searchDay.getDate();
    }

    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      end.setHours(23, 59, 59, 999);
      matchDate = d >= start && d <= end;
    }

    const matchStatus =
      matchType === 'all' ||
      (item.status || '').toLowerCase() === matchType;

      const projectName = (item?.project?.name || '').toLowerCase();
      const project = matchProject === 'all projects' || projectName === matchProject;
    return matchDate && matchStatus && project;
  });

  this.currentPage = 1;
  this.updatePage();
}
metricsConfig = [
  { key: 'grade', label: 'Grade', selected: true },
  { key: 'bugs', label: 'Bugs', selected: true },
  { key: 'codeSmells', label: 'Code Smells', selected: true },
  { key: 'coverage', label: 'Coverage (%)', selected: false },
  { key: 'duplicatedLinesDensity', label: 'Duplications', selected: false },
];

diffMetric(metric: string): number | null {
  if (this.selectedScans.length < 2) return null;

  const first = this.selectedScans[0];
  const last = this.selectedScans[this.selectedScans.length - 1];
  console.log('Diff metric calculation:', { metric, first, last });
  const getValue = (scan: any) => {
    if (metric === 'grade') return scan.qualityGate;
    return scan.metrics?.[metric] ?? 0;
  };

  const oldVal = getValue(first);
  const newVal = getValue(last);

  if (typeof oldVal !== 'number' || typeof newVal !== 'number') {
    return null;
  }
  const result = (newVal - oldVal);
  console.log('Diff metric result:', result);
  return result ;
}

}

