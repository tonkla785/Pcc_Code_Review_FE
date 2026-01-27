import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RepositoryService, Repository } from '../../../services/reposervice/repository.service';
import { ExportreportService, ReportRequest } from '../../../services/exportreportservice/exportreport.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import * as XLSX from 'xlsx';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import pptxgen from 'pptxgenjs';

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

  DataReportTest: any[] = [
    { date: '2026-01-15', qualityGate: 'Passed', bugs: 5, vulnerabilities: 2, codeSmells: 15, coverage: '78%', duplications: '3.2%' },
    { date: '2026-01-16', qualityGate: 'Passed', bugs: 3, vulnerabilities: 1, codeSmells: 12, coverage: '82%', duplications: '2.8%' },
    { date: '2026-01-17', qualityGate: 'Failed', bugs: 8, vulnerabilities: 5, codeSmells: 25, coverage: '65%', duplications: '5.1%' },
    { date: '2026-01-18', qualityGate: 'Passed', bugs: 2, vulnerabilities: 0, codeSmells: 8, coverage: '85%', duplications: '2.1%' },
    { date: '2026-01-19', qualityGate: 'Passed', bugs: 1, vulnerabilities: 0, codeSmells: 5, coverage: '88%', duplications: '1.5%' },
  ];


  sections = [
    { name: "Quality Gate Summary", key: "QualityGateSummary", selected: true },
    { name: "Issue Breakdown", key: "IssueBreakdown", selected: true },
    // { name: 'Security Analysis', selected: true },
    // { name: 'Technical Debt', selected: true },
    // { name: 'Trend Analysis', selected: true },
    // { name: 'Recommendations', selected: true }
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly repositoryService: RepositoryService,
    private readonly exportreportService: ExportreportService,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sharedDataService: SharedDataService
  ) { }

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

    if (!this.sharedDataService.hasRepositoriesCache) {
      this.repositoryService.getAllRepo().subscribe({
        next: (repos) => {
          this.sharedDataService.setRepositories(repos);
        },
        error: (err) => console.error('Failed to load repositories', err)
      });
    }

    this.sharedDataService.repositories$.subscribe(repos => {
      this.projects = repos.map(repo => ({
        id: repo.projectId!,
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


      if (this.outputFormat === 'Excel') {
        this.exportToExcel(selectedProject!.name);
        return;
      }

      if (this.outputFormat === 'Word') {
        this.exportToWord(selectedProject!.name);
        return;
      }

      if (this.outputFormat === 'PowerPoint') {
        this.exportToPowerPoint(selectedProject!.name);
        return;
      }

      // สำหรับ format อื่นๆ → ใช้ Backend API เดิม
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

  // export ออกมาเป็น excel แบบไม่ใช้ BE
  exportToExcel(projectName: string) {
    this.loading = true;

    try {
      const filteredData = this.DataReportTest.filter(item => {
        return item.date >= this.dateFrom! && item.date <= this.dateTo!;
      });

      const dataToExport = filteredData.length > 0 ? filteredData : this.DataReportTest;

      const worksheet = XLSX.utils.aoa_to_sheet([]);

      XLSX.utils.sheet_add_aoa(worksheet, [
        ['Code Review Report'],
        [`Project: ${projectName}`],
        [`Date Range: ${this.dateFrom} - ${this.dateTo}`],
        [],
      ], { origin: 'A1' });

      // เพิ่มตารางข้อมูลต่อจากหัวข้อ (เริ่มที่ row 5)
      XLSX.utils.sheet_add_json(worksheet, dataToExport, { origin: 'A5' });

      // Merge cells สำหรับหัวข้อ (A1:G1, A2:G2, A3:G3)
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
      ];

      // ปรับความกว้าง column
      worksheet['!cols'] = [
        { wch: 12 }, // date
        { wch: 12 }, // qualityGate
        { wch: 8 },  // bugs
        { wch: 15 }, // vulnerabilities
        { wch: 12 }, // codeSmells
        { wch: 10 }, // coverage
        { wch: 12 }, // duplications
      ];

      // สร้าง workbook และเพิ่ม worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Code Review Report');

      // สร้างชื่อไฟล์
      const filename = `report-${projectName}-${this.dateFrom}-to-${this.dateTo}.xlsx`;

      // Download ไฟล์
      XLSX.writeFile(workbook, filename);

      this.loading = false;

    } catch (error) {
      this.loading = false;
    }
  }

  // export ออกมาเป็น word แบบไม่ใช้ BE
  exportToWord(projectName: string) {
    this.loading = true;

    try {
      const filteredData = this.DataReportTest.filter(item => {
        return item.date >= this.dateFrom! && item.date <= this.dateTo!;
      });

      const dataToExport = filteredData.length > 0 ? filteredData : this.DataReportTest;

      // สร้าง Header Row
      const headerRow = new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Quality Gate', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Bugs', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Vulnerabilities', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Code Smells', bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Coverage', bold: true })] })] }),
        ],
      });

      // สร้าง Data Rows
      const dataRows = dataToExport.map(item =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(item.date)] }),
            new TableCell({ children: [new Paragraph(item.qualityGate)] }),
            new TableCell({ children: [new Paragraph(String(item.bugs))] }),
            new TableCell({ children: [new Paragraph(String(item.vulnerabilities))] }),
            new TableCell({ children: [new Paragraph(String(item.codeSmells))] }),
            new TableCell({ children: [new Paragraph(item.coverage)] }),
          ],
        })
      );

      // สร้าง Document
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              text: 'Code Review Report',
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              text: `Project: ${projectName}`,
              spacing: { after: 200 },
            }),
            new Paragraph({
              text: `Date Range: ${this.dateFrom} - ${this.dateTo}`,
              spacing: { after: 400 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [headerRow, ...dataRows],
            }),
          ],
        }],
      });

      // Download
      const filename = `report-${projectName}-${this.dateFrom}-to-${this.dateTo}.docx`;
      Packer.toBlob(doc).then(blob => {
        saveAs(blob, filename);
        this.loading = false;
      });

    } catch (error) {
      this.loading = false;
    }
  }

  // export ออกมาเป็น powerpoint แบบไม่ใช้ BE
  exportToPowerPoint(projectName: string) {
    this.loading = true;

    try {
      const filteredData = this.DataReportTest.filter(item => {
        return item.date >= this.dateFrom! && item.date <= this.dateTo!;
      });

      const dataToExport = filteredData.length > 0 ? filteredData : this.DataReportTest;

      const pptx = new pptxgen();
      pptx.author = 'Code Review System';
      pptx.title = 'Code Review Report';

      // Slide 1 - Title Slide
      const slide1 = pptx.addSlide();
      slide1.addText('Code Review Report', {
        x: 0.5, y: 2, w: '90%', h: 1,
        fontSize: 44, bold: true, color: '363636',
        align: 'center'
      });
      slide1.addText(`Project: ${projectName}`, {
        x: 0.5, y: 3.2, w: '90%', h: 0.5,
        fontSize: 24, color: '666666',
        align: 'center'
      });
      slide1.addText(`Date Range: ${this.dateFrom} - ${this.dateTo}`, {
        x: 0.5, y: 3.8, w: '90%', h: 0.5,
        fontSize: 18, color: '888888',
        align: 'center'
      });

      // Slide 2 - Data Table
      const slide2 = pptx.addSlide();
      slide2.addText('Quality Gate Summary', {
        x: 0.5, y: 0.3, w: '90%', h: 0.6,
        fontSize: 28, bold: true, color: '363636'
      });

      // สร้างตาราง
      const tableData: pptxgen.TableRow[] = [
        // Header row
        [
          { text: 'Date', options: { bold: true, fill: { color: '4472C4' }, color: 'FFFFFF' } },
          { text: 'Quality Gate', options: { bold: true, fill: { color: '4472C4' }, color: 'FFFFFF' } },
          { text: 'Bugs', options: { bold: true, fill: { color: '4472C4' }, color: 'FFFFFF' } },
          { text: 'Vulnerabilities', options: { bold: true, fill: { color: '4472C4' }, color: 'FFFFFF' } },
          { text: 'Code Smells', options: { bold: true, fill: { color: '4472C4' }, color: 'FFFFFF' } },
          { text: 'Coverage', options: { bold: true, fill: { color: '4472C4' }, color: 'FFFFFF' } },
        ],
        // Data rows
        ...dataToExport.map((item, index) => [
          { text: item.date, options: { fill: { color: index % 2 === 0 ? 'F2F2F2' : 'FFFFFF' } } },
          { text: item.qualityGate, options: { fill: { color: index % 2 === 0 ? 'F2F2F2' : 'FFFFFF' }, color: item.qualityGate === 'Passed' ? '28A745' : 'DC3545' } },
          { text: String(item.bugs), options: { fill: { color: index % 2 === 0 ? 'F2F2F2' : 'FFFFFF' } } },
          { text: String(item.vulnerabilities), options: { fill: { color: index % 2 === 0 ? 'F2F2F2' : 'FFFFFF' } } },
          { text: String(item.codeSmells), options: { fill: { color: index % 2 === 0 ? 'F2F2F2' : 'FFFFFF' } } },
          { text: item.coverage, options: { fill: { color: index % 2 === 0 ? 'F2F2F2' : 'FFFFFF' } } },
        ])
      ];

      slide2.addTable(tableData, {
        x: 0.3, y: 1, w: 9.4, h: 3,
        fontSize: 12,
        border: { type: 'solid', pt: 0.5, color: 'CFCFCF' },
        align: 'center',
        valign: 'middle'
      });

      // Download
      const filename = `report-${projectName}-${this.dateFrom}-to-${this.dateTo}.pptx`;
      pptx.writeFile({ fileName: filename }).then(() => {
        this.loading = false;
      });

    } catch (error) {
      this.loading = false;
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
