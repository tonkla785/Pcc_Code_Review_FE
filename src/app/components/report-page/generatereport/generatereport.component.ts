import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RepositoryService, Repository } from '../../../services/reposervice/repository.service';
import { ExportreportService, ReportRequest } from '../../../services/exportreportservice/exportreport.service';
import { AuthService } from '../../../services/authservice/auth.service';

interface Project {
  id: string;      // id จริงจาก backend
  name: string;    // ชื่อโปรเจกต์
  selected: boolean;
}

interface Section {
  name: string;
  selected: boolean;
}

interface OutputFormat {
  value: string;
  label: string;
  icon: string;
}


@Component({
  selector: 'app-generatereport',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './generatereport.component.html',
  styleUrl: './generatereport.component.css'
})
export class GeneratereportComponent {

  reportType: string = '';
  projects: Project[] = [];  // จะเติมมาจาก backend
  dateFrom?: string;
  dateTo?: string;
  outputFormat: string = '';
  email: string = '';
  loading = false;


  sections = [
    { name: "Quality Gate Summary", key: "QualityGateSummary", selected: true },
    { name: "Issue Breakdown", key: "IssueBreakdown", selected: true },
    // { name: 'Security Analysis', selected: true },
    // { name: 'Technical Debt', selected: true },
    // { name: 'Trend Analysis', selected: true },
    // { name: 'Recommendations', selected: true }
  ];

  constructor(private readonly route: ActivatedRoute, private readonly repositoryService: RepositoryService, private readonly exportreportService: ExportreportService, private readonly router: Router,
    private readonly authService: AuthService) { }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.route.queryParams.subscribe(params => {
      if (params['reportType']) {
        this.reportType = params['reportType'];
      }
    });
    this.repositoryService.getAllRepo().subscribe(repos => {
      this.projects = repos.map(repo => ({
        id: repo.projectId!,      // ต้องมี id ด้วย
        name: repo.name,
        selected: false
      }));
    });
  }

  onSelectProject(selected: Project) {
    this.projects.forEach(p => {
      // ให้เลือกได้เพียง 1 โปรเจกต์
      p.selected = (p === selected);
    });
  }

  hasSelectedProjects(): boolean {
    return this.projects.some(p => p.selected);
  }

  // selectAllProjects(select: boolean) {
  //   this.projects.forEach(p => p.selected = select);
  // }

  today: string = new Date().toISOString().split('T')[0]; // yyyy-mm-dd

  onDateFromChange() {
    if (this.dateTo && this.dateFrom! > this.dateTo) {
      this.dateTo = this.dateFrom;
    }
  }

  onDateToChange() {
    if (this.dateFrom && this.dateTo! < this.dateFrom) {
      this.dateFrom = this.dateTo;
    }
  }



  isFormValid(form: any): boolean {
    form.form.markAllAsTouched();
    //if (!this.reportType) return false;
    if (!this.hasSelectedProjects()) return false;
    if (!this.dateFrom || !this.dateTo) return false;
    if (this.dateFrom > this.dateTo) return false;
    if (this.dateFrom > this.today || this.dateTo > this.today) return false; // ป้องกันวันอนาคต
    if (!this.outputFormat) return false;
    //if (this.email && form.controls['email']?.invalid) return false;
    return true;
  }
  cancel(form?: any) {
    if (form) {
      form.resetForm();  // เคลียร์ค่าฟอร์ม
    }
    //this.reportType = '';
    this.projects.forEach(p => p.selected = false);
    this.sections.forEach(s => s.selected = true); // หรือ false ตาม default
    this.dateFrom = '';
    this.dateTo = '';
    this.outputFormat = '';
    //this.email = '';

    console.log('Form cancelled and cleared.');
  }




  generateReport() {
    if (this.hasSelectedProjects() && this.dateFrom && this.dateTo && this.outputFormat) {

      const selectedProject = this.projects.find(p => p.selected);

      const req: ReportRequest = {
        projectId: selectedProject!.id,
        dateFrom: this.dateFrom!,
        dateTo: this.dateTo!,
        outputFormat: this.formatMap[this.outputFormat]
        , // map ให้ตรงกับ backend
        includeSections: this.sections
          .filter(s => s.selected)
          .map(s => s.key) // ตาม mapping ที่เราทำก่อนหน้า
      };


      console.log('Request to backend:', req);
      this.loading = true;

      this.exportreportService.generateReport(req).subscribe({
        next: (blob) => {
          console.log('Generate report success', blob);
          this.downloadFile(blob, `report-${req.projectId}.${req.outputFormat}`);
          this.loading = false;
        },
        error: (err) => {
          console.error('Generate report failed', err);
          this.loading = false;
          alert('Failed to generate report');
        }
      });
    }
  }

  private downloadFile(blob: Blob, filename: string) {
    const ext = blob.type === 'application/zip' ? 'zip' : this.outputFormat;
    const link = document.createElement('a');
    const url = window.URL.createObjectURL(blob);
    link.href = url;
    link.download = `report-${filename}.${ext}`;
    link.click();
    window.URL.revokeObjectURL(url);
  }


  // onPreview(form: any) {
  //   // if (this.isFormValid(form)) this.previewReport();
  // }

  onGenerate(form: NgForm) {
    if (this.isFormValid(form)) {
      this.generateReport();
    } else {
      console.warn('Form is invalid');
    }
  }

  formatMap: Record<string, string> = {
    "PDF": "pdf",
    "Excel": "xlsx",
    "Word": "docx",
    "PowerPoint": "pptx"
  };







}
