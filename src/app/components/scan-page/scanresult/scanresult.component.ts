import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { Scan, ScanService } from '../../../services/scanservice/scan.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuthService } from '../../../services/authservice/auth.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';

import { ActivatedRoute } from '@angular/router';
@Component({
  selector: 'app-scanresult',
  standalone: true,
  imports: [RouterLink, CommonModule, RouterOutlet],
  templateUrl: './scanresult.component.html',
  styleUrl: './scanresult.component.css'
})
export class ScanresultComponent {

  constructor(private readonly router: Router, private readonly scanService: ScanService,
    private readonly authService: AuthService, private sharedData: SharedDataService, private route: ActivatedRoute,) { }

  goBack() { window.history.back(); }

  scanInfo: Scan | null = null;
  scanResult: ScanResponseDTO | null = null;

  ngOnInit(): void {
    // Subscribe to cached data for real-time updates
    this.sharedData.selectedScan$.subscribe(data => {
      if (data) {
        this.scanResult = data;
      }
    });

    // Check route params and decide whether to use cache or fetch from API
    this.route.paramMap.subscribe(pm => {
      const id = pm.get('scanId');
      if (!id) return;

      console.log('scanId from route:', id);

      // Check if current cache matches the requested scanId
      const cachedScan = this.sharedData.selectedScanValue;
      if (cachedScan && cachedScan.id === id) {
        console.log('Using cached scan data');
        this.scanResult = cachedScan;
      } else {
        // Fetch fresh data from API
        console.log('No matching cache - loading from server');
        this.loadScanDetails(id);
      }
    });
  }

  loadScanDetails(scanId: string) {
    this.sharedData.setLoading(true);
    this.scanService.getScanById(scanId).subscribe({
      next: (data) => {
        this.sharedData.ScansDetail = data;
        this.sharedData.setLoading(false);
        console.log('Scan history loaded:', data);
      },
      error: () => this.sharedData.setLoading(false)
    });
  }

  hasOverallOrMetrics(scan: any): boolean {
    const isValid = (v: any) => v !== null && v !== undefined && v !== '' && v !== 'null';

    const overallGates = [
      scan.reliabilityGate,
      scan.securityGate,
      scan.maintainabilityGate,
      scan.securityReviewGate
    ];

    const metrics = scan.metrics ? [
      scan.metrics.bugs,
      scan.metrics.vulnerabilities,
      scan.metrics.codeSmells,
      scan.metrics.coverage
    ] : [];

    return overallGates.some(isValid) || metrics.some(isValid);
  }

  generatePDF(): jsPDF {
    const doc = new jsPDF();
    const scan = this.scanInfo;

    doc.setFontSize(18);
    doc.text('Scan Report', 14, 20);
    doc.setFontSize(12);
    doc.text(`Project: ${scan?.projectName ?? '-'}`, 14, 30);
    doc.text(`Quality Gate: ${scan?.qualityGate ?? '-'}`, 14, 37);
    doc.text(`Started At: ${scan?.startedAt ?? '-'}`, 14, 44);
    doc.text(`Completed At: ${scan?.completedAt ?? '-'}`, 14, 51);
    doc.line(14, 55, 195, 55);

    // Overall Gates Table
    autoTable(doc, {
      startY: 60,
      head: [['Gate', 'Grade']],
      body: [
        ['Reliability', scan?.reliabilityGate ?? '-'],
        ['Security', scan?.securityGate ?? '-'],
        ['Maintainability', scan?.maintainabilityGate ?? '-'],
        ['Security Review', scan?.securityReviewGate ?? '-']
      ]
    });

    // Metrics Table
    if (scan?.metrics) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Metric', 'Value']],
        body: [
          ['Bugs', scan.metrics.bugs ?? '-'],
          ['Vulnerabilities', scan.metrics.vulnerabilities ?? '-'],
          ['Code Smells', scan.metrics.codeSmells ?? '-'],
          ['Coverage (%)', scan.metrics.coverage ?? '-']
        ]
      });
    }

    return doc;
  }

  downloadReport() {
    this.router.navigate(['/generatereport']);
  }

  /** ✅ ปุ่มส่ง Email (จำลอง) */
  emailReport() {
    if (!this.scanInfo) {
      alert('No scan data available');
      return;
    }
    const doc = this.generatePDF();
    const pdfBlob = doc.output('blob');

    // ในระบบจริง คุณจะส่ง pdfBlob ไป backend
    console.log('PDF ready to send by email', pdfBlob);
    alert('Report prepared for email (demo only)');
  }

  viewIssues() {
    this.router.navigate(['/issues', this.scanInfo?.scanId]);
  }

  // คำนวณค่าเฉลี่ย rating จาก reliability, security, maintainability
  getAverageRating(): string {
    const metrics = this.scanResult?.metrics;
    if (!metrics) return '-';

    const ratingToNumber = (rating: string | undefined): number | null => {
      if (!rating) return null;
      const map: { [key: string]: number } = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
      return map[rating.toUpperCase()] ?? null;
    };

    const numberToRating = (num: number): string => {
      if (num <= 1.5) return 'A';
      if (num <= 2.5) return 'B';
      if (num <= 3.5) return 'C';
      if (num <= 4.5) return 'D';
      return 'E';
    };

    const ratings = [
      ratingToNumber(metrics.reliabilityRating),
      ratingToNumber(metrics.securityRating),
      ratingToNumber(metrics.maintainabilityRating)
    ].filter((r): r is number => r !== null);

    if (ratings.length === 0) return '-';

    const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    return numberToRating(average);
  }
}