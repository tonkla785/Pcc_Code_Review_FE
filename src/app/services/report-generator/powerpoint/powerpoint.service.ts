import { Injectable } from '@angular/core';
import pptxgen from 'pptxgenjs';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SecurityMetrics, OwaspCategory, HotSecurityIssue } from '../../../interface/security_interface';

export interface PptReportContext {
    projectName: string;
    dateFrom: string;
    dateTo: string;
    scanData: ScanResponseDTO | null;
    securityData?: {
        metrics: SecurityMetrics;
        owaspCoverage: OwaspCategory[];
        hotIssues: HotSecurityIssue[];
    };
    selectedSections: {
        qualityGate: boolean;
        issueBreakdown: boolean;
        securityAnalysis: boolean;
    };
}

@Injectable({
    providedIn: 'root'
})
export class PowerpointService {

    generatePowerPoint(context: PptReportContext) {
        const pptx = new pptxgen();
        pptx.author = 'Code Review System';
        pptx.title = 'Code Review Report';

        // Slide 1 - Title
        const slide1 = pptx.addSlide();
        slide1.addText('Code Review Report', { x: 0.5, y: 2, w: '90%', h: 1, fontSize: 44, bold: true, align: 'center' });
        slide1.addText(`Project: ${context.projectName}`, { x: 0.5, y: 3.2, w: '90%', h: 0.5, fontSize: 24, align: 'center' });
        slide1.addText(`Date Range: ${context.dateFrom} - ${context.dateTo}`, { x: 0.5, y: 3.8, w: '90%', h: 0.5, fontSize: 18, align: 'center' });

        if (context.selectedSections.qualityGate) {
            this.addSummarySlide(pptx, context);
        }

        if (context.selectedSections.securityAnalysis && context.securityData) {
            this.addSecuritySlide(pptx, context);
        }

        const filename = `report-${context.projectName}-${context.dateFrom}-to-${context.dateTo}.pptx`;
        pptx.writeFile({ fileName: filename });
    }

    private addSummarySlide(pptx: any, context: PptReportContext) {
        const slide = pptx.addSlide();
        slide.addText('Quality Gate Summary', { x: 0.5, y: 0.3, w: '90%', h: 0.5, fontSize: 28, bold: true });

        const scanData = context.scanData;
        const status = scanData?.qualityGate === 'OK' ? 'Passed' : (scanData ? 'Failed' : 'N/A');

        const rows: any[] = [
            ['Status', status],
            ['Reliability', this.formatRating(scanData?.metrics?.reliabilityRating)],
            ['Security', this.formatRating(scanData?.metrics?.securityRating)],
            ['Maintainability', this.formatRating(scanData?.metrics?.maintainabilityRating)],
            ['Bugs', String(scanData?.metrics?.bugs ?? 0)],
            ['Vulnerabilities', String(scanData?.metrics?.vulnerabilities ?? 0)]
        ];

        slide.addTable(rows, { x: 1, y: 1.2, w: 8, h: 3, border: { type: 'solid', color: 'CFCFCF' } });
    }

    private addSecuritySlide(pptx: any, context: PptReportContext) {
        const { metrics, owaspCoverage, hotIssues } = context.securityData!;
        const slide = pptx.addSlide();
        slide.addText('Security Analysis', { x: 0.5, y: 0.3, w: '90%', h: 0.5, fontSize: 28, bold: true });

        slide.addText('Vulnerability Severity', { x: 0.5, y: 1, w: 4, h: 0.4, fontSize: 16, bold: true });
        const vulnRows: any[] = metrics.vulnerabilities.map(v => [v.severity, String(v.count)]);
        slide.addTable(vulnRows, { x: 0.5, y: 1.5, w: 4, h: 1.5, border: { type: 'solid', color: 'CFCFCF' } });

        slide.addText('Top 5 Security Hotspots', { x: 5, y: 1, w: 4, h: 0.4, fontSize: 16, bold: true });
        const top5 = hotIssues.slice(0, 5);
        const hotRows: any[] = top5.length > 0
            ? top5.map(h => [h.name, String(h.count)])
            : [['No hotspots', '-']];
        slide.addTable(hotRows, { x: 5, y: 1.5, w: 4, h: 1.5, border: { type: 'solid', color: 'CFCFCF' } });

        slide.addText('OWASP Top 10 Issues', { x: 0.5, y: 3.5, w: '90%', h: 0.4, fontSize: 16, bold: true });
        const owaspWithIssues = owaspCoverage.filter(o => o.count > 0);
        const owaspRows: any[] = owaspWithIssues.length > 0
            ? owaspWithIssues.map(o => [o.name, String(o.count), o.status === 'fail' ? 'FAIL' : 'WARN'])
            : [['No OWASP issues', '-', 'PASS']];
        slide.addTable(owaspRows, { x: 0.5, y: 4, w: 9, h: 1.5, border: { type: 'solid', color: 'CFCFCF' } });
    }

    private formatRating(value: string | number | undefined): string {
        if (value === null || value === undefined || value === '') return 'N/A';
        const s = String(value);
        if (s.startsWith('1')) return 'A';
        if (s.startsWith('2')) return 'B';
        if (s.startsWith('3')) return 'C';
        if (s.startsWith('4')) return 'D';
        if (s.startsWith('5')) return 'E';
        if (/^[A-E]$/i.test(s)) return s.toUpperCase();
        if (s === 'OK') return 'A';
        return s;
    }
}
