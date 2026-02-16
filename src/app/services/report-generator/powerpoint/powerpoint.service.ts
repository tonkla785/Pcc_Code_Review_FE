import { Injectable } from '@angular/core';
import pptxgen from 'pptxgenjs';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SecurityMetrics, OwaspCategory, HotSecurityIssue } from '../../../interface/security_interface';

export interface PptReportContext {
    projectName: string;
    dateFrom: string;
    dateTo: string;
    scans: ScanResponseDTO[];
    issues: any[];
    securityData?: {
        metrics: SecurityMetrics;
        owaspCoverage: OwaspCategory[];
        hotIssues: HotSecurityIssue[];
    };
    selectedSections: {
        qualityGate: boolean;
        issueBreakdown: boolean;
        securityAnalysis: boolean;
        technicalDebt: boolean;
        trendAnalysis?: boolean;
        recommendations: boolean;
    };
    recommendationsData?: any[];
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

        //qualityGate
        if (context.selectedSections.qualityGate) {
            this.addSummarySlide(pptx, context);
        }

        //issueBreakdown    
        if (context.selectedSections.issueBreakdown) {
            this.addIssueSlide(pptx, context);
        }

        //securityAnalysis
        if (context.selectedSections.securityAnalysis && context.securityData) {
            this.addSecuritySlide(pptx, context);
        }

        // Technical Debt
        if (context.selectedSections.technicalDebt) {
            this.addTechnicalDebtSlide(pptx, context);
        }

        // Recommendations
        if (context.selectedSections.recommendations && context.recommendationsData) {
            this.addRecommendationsSlide(pptx, context);
        }

        const filename = `report-${context.projectName}-${context.dateFrom}-to-${context.dateTo}.pptx`;
        pptx.writeFile({ fileName: filename });
    }

    private addSummarySlide(pptx: any, context: PptReportContext) {
        const slide = pptx.addSlide();
        slide.addText('Quality Gate Summary', { x: 0.5, y: 0.3, w: '90%', h: 0.5, fontSize: 28, bold: true });

        const headers = ['Date', 'Status', 'QG', 'Rel', 'Sec', 'Main', 'Bugs', 'Vulns', 'Smells'];
        const rows: any[] = [headers];

        if (context.scans && context.scans.length > 0) {
            const displayScans = context.scans.slice(0, 15);

            displayScans.forEach(scan => {
                const scanDate = this.formatScanDate(scan.startedAt);
                const status = scan.status || '-';
                const qg = scan.qualityGate === 'OK' ? 'Pass' : (scan.qualityGate ? 'Fail' : 'N/A');
                const m = scan.metrics;

                rows.push([
                    scanDate,
                    status,
                    qg,
                    m?.reliabilityRating || '-',
                    m?.securityRating || '-',
                    m?.maintainabilityRating || '-',
                    m?.bugs || 0,
                    m?.vulnerabilities || 0,
                    m?.codeSmells || 0
                ]);
            });
        } else {
            rows.push(['No scans found', '-', '-', '-', '-', '-', '-', '-', '-']);
        }

        slide.addTable(rows, {
            x: 0.7, y: 1.0, w: 9.6, h: 1,
            border: { type: 'solid', color: 'CFCFCF' },
            fontSize: 10,
            colW: [2.5, 1.2, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7]
        });
    }

    private formatScanDate(date: string | undefined): string {
        if (!date) return 'N/A';
        return new Date(date).toLocaleString('en-GB', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    }

    private addIssueSlide(pptx: any, context: PptReportContext) {
        const issues = context.issues || [];

        if (issues.length === 0) {
            const slide = pptx.addSlide();
            slide.addText('Issue Breakdown', { x: 0.5, y: 0.3, w: '90%', h: 0.5, fontSize: 24, bold: true });
            slide.addText('Showing only Bugs and Vulnerabilities.', { x: 0.5, y: 0.8, w: '90%', h: 0.4, fontSize: 14, color: '666666' });
            slide.addTable([['Type', 'Severity', 'Issue'], ['No issues found', '-', '-']], {
                x: 0.5, y: 1.3, w: 9, h: 4,
                border: { type: 'solid', color: 'CFCFCF' },
                fontSize: 11,
                colW: [1.5, 1.5, 6]
            });
            return;
        }

        const ITEMS_PER_SLIDE = 10;
        const totalSlides = Math.ceil(issues.length / ITEMS_PER_SLIDE);

        for (let i = 0; i < totalSlides; i++) {
            const slide = pptx.addSlide();
            const title = i === 0 ? 'Issue Breakdown' : 'Issue Breakdown (Cont.)';
            slide.addText(title, { x: 0.5, y: 0.3, w: '90%', h: 0.5, fontSize: 24, bold: true });

            let startY = 1.3;
            if (i === 0) {
                slide.addText('Showing only Bugs and Vulnerabilities.', { x: 0.5, y: 0.8, w: '90%', h: 0.4, fontSize: 14, color: '666666' });
            } else {
                startY = 1.0;
            }

            const headers = ['Type', 'Severity', 'Issue'];
            const rows: any[] = [headers];

            const startIdx = i * ITEMS_PER_SLIDE;
            const endIdx = startIdx + ITEMS_PER_SLIDE;
            const pageIssues = issues.slice(startIdx, endIdx);

            pageIssues.forEach((issue: any) => {
                let type = (issue.type || '').toLowerCase();
                if (type === 'bug') type = 'Bug';
                if (type === 'vulnerability') type = 'Vulnerability';
                if (type === 'code_smell') type = 'Code Smell';
                if (type === 'security_hotspot') type = 'Security Hotspot';

                rows.push([
                    type,
                    issue.severity || '-',
                    issue.message || '-'
                ]);
            });

            slide.addTable(rows, {
                x: 0.5, y: startY, w: 9,
                border: { type: 'solid', color: 'CFCFCF' },
                fontSize: 11,
                colW: [1.5, 1.5, 6]
            });
        }
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

        const slide2 = pptx.addSlide();
        slide2.addText('Security Analysis (OWASP)', { x: 0.5, y: 0.3, w: '90%', h: 0.5, fontSize: 28, bold: true });

        slide2.addText('OWASP Top 10 Issues', { x: 0.5, y: 1.0, w: '90%', h: 0.4, fontSize: 16, bold: true });

        const owaspRows: any[] = owaspCoverage.length > 0
            ? owaspCoverage.map(o => [o.name, String(o.count), o.status === 'pass' ? 'PASS' : (o.status === 'fail' ? 'FAIL' : 'WARN')])
            : [['No OWASP data', '-', '-']];

        slide2.addTable(owaspRows, { x: 0.5, y: 1.5, w: 9, fontSize: 12, border: { type: 'solid', color: 'CFCFCF' } });
    }

    private addRecommendationsSlide(pptx: any, context: PptReportContext) {
        if (!context.recommendationsData || context.recommendationsData.length === 0) return;

        let slide = pptx.addSlide();
        slide.addText('Recommendations', { x: 0.5, y: 0.5, w: '90%', h: 0.5, fontSize: 24, bold: true, color: '0088CC' });

        const rows: any[][] = [['Severity', 'Type', 'Issue', 'Fix']];
        context.recommendationsData.slice(0, 7).forEach(rec => {
            rows.push([
                rec.severity,
                rec.type,
                rec.message,
                rec.recommendedFix
            ]);
        });

        slide.addTable(rows, {
            x: 0.5,
            y: 1.2,
            w: 9.0,
            colW: [1.0, 1.0, 3.5, 3.5],
            fontSize: 10,
            border: { pt: 1, color: 'CCCCCC' },
            autoPage: true,
            startY: 1.2
        });
    }

    private addTechnicalDebtSlide(pptx: any, context: PptReportContext) {
        const slide = pptx.addSlide();
        slide.addText('Technical Debt Analysis', { x: 0.5, y: 0.3, w: '90%', h: 0.5, fontSize: 28, bold: true });

        const tableData = context.scans.map(scan => {
            const debtMinutes = scan.metrics?.technicalDebtMinutes || 0;
            const costPerDay = scan.project?.costPerDay || 1000;
            const cost = (debtMinutes / 480) * costPerDay;
            return [
                { text: this.formatScanDate(scan.startedAt), options: { align: 'center' } },
                { text: context.projectName, options: { align: 'left' } },
                { text: this.formatTechnicalDebt(debtMinutes), options: { align: 'center' } },
                { text: `THB ${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, options: { align: 'center' } }
            ];
        });

        const rows = [
            [
                { text: 'Scan Date', options: { bold: true, fill: { color: 'FF9800' }, color: 'FFFFFF' } },
                { text: 'Project', options: { bold: true, fill: { color: 'FF9800' }, color: 'FFFFFF' } },
                { text: 'Technical Debt', options: { bold: true, fill: { color: 'FF9800' }, color: 'FFFFFF' } },
                { text: 'Cost (THB)', options: { bold: true, fill: { color: 'FF9800' }, color: 'FFFFFF' } }
            ],
            ...tableData
        ];

        slide.addTable(rows, {
            x: 0.5,
            y: 1.0,
            w: 9.0,
            colW: [2.0, 3.0, 2.0, 2.0],
            fontSize: 11,
            border: { pt: 1, color: 'CCCCCC' },
            autoPage: true
        });
    }

    private formatTechnicalDebt(minutes: number): string {
        const days = Math.floor(minutes / 480);
        const remainingMinutes = minutes % 480;
        const hours = Math.floor(remainingMinutes / 60);
        const mins = remainingMinutes % 60;

        let result = '';
        if (days > 0) result += `${days}d `;
        if (hours > 0) result += `${hours}h `;
        if (mins > 0 || result === '') result += `${mins}m`;

        return result.trim();
    }
}
