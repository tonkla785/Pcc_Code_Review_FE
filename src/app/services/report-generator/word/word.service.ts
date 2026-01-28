import { Injectable } from '@angular/core';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SecurityMetrics, OwaspCategory, HotSecurityIssue } from '../../../interface/security_interface';

export interface WordReportContext {
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
export class WordService {

    generateWord(context: WordReportContext) {
        const children: any[] = [];

        // Title Section
        children.push(new Paragraph({ text: 'Code Review Report', heading: HeadingLevel.HEADING_1 }));
        children.push(new Paragraph({ text: `Project: ${context.projectName}`, spacing: { after: 200 } }));
        children.push(new Paragraph({ text: `Date Range: ${context.dateFrom} - ${context.dateTo}`, spacing: { after: 400 } }));

        // Quality Gate Summary
        if (context.selectedSections.qualityGate) {
            children.push(...this.createSummarySection(context));
        }

        // Security Analysis
        if (context.selectedSections.securityAnalysis && context.securityData) {
            children.push(...this.createSecuritySection(context));
        }

        const doc = new Document({ sections: [{ children }] });

        const filename = `report-${context.projectName}-${context.dateFrom}-to-${context.dateTo}.docx`;
        Packer.toBlob(doc).then(blob => {
            saveAs(blob, filename);
        });
    }

    private createSummarySection(context: WordReportContext): Paragraph[] {
        const paragraphs: Paragraph[] = [];
        const scanData = context.scanData;
        const status = scanData?.qualityGate === 'OK' ? 'Passed' : (scanData ? 'Failed' : 'N/A');

        paragraphs.push(new Paragraph({ text: 'Quality Gate Summary', heading: HeadingLevel.HEADING_2 }));
        paragraphs.push(new Paragraph({ text: `Status: ${status}` }));
        paragraphs.push(new Paragraph({ text: `Reliability: ${this.formatRating(scanData?.metrics?.reliabilityRating)}` }));
        paragraphs.push(new Paragraph({ text: `Security: ${this.formatRating(scanData?.metrics?.securityRating)}` }));
        paragraphs.push(new Paragraph({ text: `Maintainability: ${this.formatRating(scanData?.metrics?.maintainabilityRating)}` }));
        paragraphs.push(new Paragraph({ text: `Bugs: ${scanData?.metrics?.bugs ?? 0}` }));
        paragraphs.push(new Paragraph({ text: `Vulnerabilities: ${scanData?.metrics?.vulnerabilities ?? 0}` }));

        return paragraphs;
    }

    private createSecuritySection(context: WordReportContext): Paragraph[] {
        const paragraphs: Paragraph[] = [];
        const { metrics, owaspCoverage, hotIssues } = context.securityData!;

        paragraphs.push(new Paragraph({ text: '', spacing: { after: 400 } }));
        paragraphs.push(new Paragraph({ text: 'Security Analysis', heading: HeadingLevel.HEADING_2 }));

        paragraphs.push(new Paragraph({ text: 'OWASP Top 10 Breakdown:', spacing: { before: 200 } }));
        owaspCoverage.forEach(owasp => {
            const statusIcon = owasp.status === 'pass' ? '[PASS]' : owasp.status === 'warning' ? '[WARN]' : '[FAIL]';
            paragraphs.push(new Paragraph({ text: `  ${owasp.name}: ${owasp.count} issues ${statusIcon}` }));
        });

        paragraphs.push(new Paragraph({ text: 'Vulnerability Severity:', spacing: { before: 200 } }));
        metrics.vulnerabilities.forEach(v => {
            paragraphs.push(new Paragraph({ text: `  ${v.severity}: ${v.count}` }));
        });

        paragraphs.push(new Paragraph({ text: 'Top 5 Security Hotspots:', spacing: { before: 200 } }));
        const top5 = hotIssues.slice(0, 5);
        if (top5.length > 0) {
            top5.forEach(h => {
                paragraphs.push(new Paragraph({ text: `  ${h.name}: ${h.count}` }));
            });
        } else {
            paragraphs.push(new Paragraph({ text: '  No hotspots detected' }));
        }

        return paragraphs;
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
