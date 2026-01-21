import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Scan, ScanService } from '../../../services/scanservice/scan.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';

@Component({
  selector: 'app-scanhistory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scanhistory.component.html',
  styleUrls: ['./scanhistory.component.css']
})
export class ScanhistoryComponent {

  startDate: string = '';
  endDate: string = '';

  scans: ScanResponseDTO[] = [];

  filteredScans: ScanResponseDTO[] = [...this.scans];

  // Pagination
  pageSize: number = 5;
  currentPage: number = 1;
  totalPages: number = 1;
  pagedScans: ScanResponseDTO[] = [];
  pages: number[] = [];
  ScanHistory: ScanResponseDTO[] = [];


  constructor(private readonly router: Router, private readonly scanService: ScanService, private authService: AuthService,
    private sharedData: SharedDataService,
  ) {
  }


  ngOnInit(): void {
    this.sharedData.scansHistory$.subscribe(data => { 
      this.ScanHistory = data || [];
    });
    if(!this.sharedData.hasScansHistoryCache){
      this.loadScanHistory();
      console.log("No cache - load from server");
    }
  }

loadScanHistory() {

  this.sharedData.setLoading(true);
  this.scanService.getScansHistory().subscribe({
    next: (data) => {
      this.sharedData.Scans = data;
      this.sharedData.setLoading(false);
      console.log('Scan history loaded:', data);
    },
    error: () => this.sharedData.setLoading(false)
  });
}

  applyFilter() {
    const start = this.startDate ? new Date(this.startDate) : null;
    const end = this.endDate ? new Date(this.endDate) : null;

    this.filteredScans = this.scans.filter(scan =>
      (!start || (scan.startedAt && new Date(scan.startedAt) >= start)) &&
      (!end || (scan.completedAt && new Date(scan.completedAt) <= end))
    );
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredScans.length / this.pageSize);
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


  // Export CSV
  exportHistory(): void {

    // ✅ ถ้าไม่มีการเลือก scan ใดเลยให้แจ้งเตือน
    if (!this.selectedScans || this.selectedScans.length === 0) {
      alert('กรุณาเลือกอย่างน้อย 1 รายการสำหรับ Export');
      return;
    }

    // ✅ สร้างข้อมูลสำหรับ export จาก selectedScans
    const flatData = this.selectedScans.map((scan, index) => {
      const completedAt = scan.completedAt ? new Date(scan.completedAt) : undefined;

      return {
        No: index + 1,
        Date: completedAt ? completedAt.toLocaleDateString('en-GB') : '',  // dd/MM/yyyy
        Time: completedAt
          ? completedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          : '',
        Project: scan.project?.name ?? '',
        Status: scan.status ?? '',
        Grade: scan.qualityGate ?? '',
        Bugs: scan.metrics?.bugs ?? 0,
        Vulnerabilities: scan.metrics?.vulnerabilities ?? 0,
        CodeSmells: scan.metrics?.codeSmells ?? 0,
        Coverage: scan.metrics?.coverage ?? 0,
        DuplicatedLinesDensity: scan.metrics?.duplicatedLinesDensity ?? 0
      };
    });

    if (flatData.length === 0) {
      alert('ไม่มีข้อมูลสำหรับ export');
      return;
    }

    //สร้าง CSV header + rows
    const header = Object.keys(flatData[0]).join(',');
    const rows = flatData.map(r => Object.values(r).join(',')).join('\n');
    const csv = header + '\n' + rows;

    // สร้าง Blob สำหรับดาวน์โหลด
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // ตั้งชื่อไฟล์แบบ meaningful
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    // ดึงชื่อ project ของ scan แรกมาใส่ในชื่อไฟล์ (หรือใช้ "multiple" ถ้ามากกว่า 1 โครงการ)
    const uniqueProjects = [...new Set(this.selectedScans.map(s => s.project?.name ?? 'Unknown'))];
    const projectName =
      uniqueProjects.length === 1
        ? uniqueProjects[0].replace(/\s+/g, '_') // เปลี่ยนช่องว่างเป็น "_"
        : 'multiple_projects';

    // ใส่จำนวนรายการที่เลือกไว้ในชื่อไฟล์ด้วย
    const count = this.selectedScans.length;

    // สุดท้ายได้ชื่อไฟล์เช่น:
    //  scan_export_ProjectA_2025-10-20_3items.csv
    const fileName = `scan_export_${projectName}_${dateStr}_${count}items.csv`;

    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }


  selectedScans: ScanResponseDTO[] = [];
  showCompareModal = false;

  toggleScanSelection(scan: ScanResponseDTO, event: Event): void {
    event.stopPropagation();
    const index = this.selectedScans.findIndex(s => s.id === scan.id);

    if (index >= 0) {
      this.selectedScans.splice(index, 1);
    } else if (this.selectedScans.length < 3) {
      this.selectedScans.push(scan);
    } else {
      alert("เลือกได้สูงสุดได้ 3 รายการ");
      (event.target as HTMLInputElement).checked = false;
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
    this.showCompareModal = true;
  }


  closeCompareModal() {
    this.showCompareModal = false;
  }

  clearLogs() {
    this.startDate = '';
    this.endDate = '';
    this.filteredScans = [...this.scans];
    this.currentPage = 1;
    this.selectedScans = [];
    this.updatePagination();
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
    return this.filteredScans.length > 0 && this.filteredScans.every(scan => this.isSelected(scan));
  }

  // ✅ คลิก Select All
  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    if (checked) {
      // เลือกทั้งหมด (ถ้าอยากจำกัดเฉพาะหน้าให้เปลี่ยน filteredScans → pagedScans)
      this.selectedScans = [...this.filteredScans];
    } else {
      this.selectedScans = [];
    }
  }

}
