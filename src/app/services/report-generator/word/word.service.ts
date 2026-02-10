import { saveAs } from 'file-saver';
import { Injectable } from '@angular/core';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType, PageBreak } from 'docx';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SecurityMetrics, OwaspCategory, HotSecurityIssue } from '../../../interface/security_interface';
export interface WordReportContext {
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
        recommendations: boolean;
    };
    recommendationsData?: any[];
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

        // Issue Breakdown
        if (context.selectedSections.issueBreakdown) {
            children.push(...this.createIssueSection(context));
        }

        // Security Analysis
        if (context.selectedSections.securityAnalysis && context.securityData) {
            children.push(...this.createSecuritySection(context));
        }

        // Technical Debt
        if (context.selectedSections.technicalDebt) {
            children.push(...this.createTechnicalDebtSection(context));
        }

        // Recommendations
        if (context.selectedSections.recommendations && context.recommendationsData) {
            children.push(...this.createRecommendationsSection(context));
        }

        const doc = new Document({ sections: [{ children }] });

        const filename = `report-${context.projectName}-${context.dateFrom}-to-${context.dateTo}.docx`;
        Packer.toBlob(doc).then(blob => {
            saveAs(blob, filename);
        });
    }

    private createIssueSection(context: WordReportContext): (Paragraph | Table)[] {
        const elements: (Paragraph | Table)[] = [];

        elements.push(new Paragraph({ text: 'Issue Breakdown', heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 } }));
        elements.push(new Paragraph({ text: 'Showing only Bugs and Vulnerabilities.', spacing: { after: 200 } }));

        const tableRows = [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Type', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Severity', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Issue', bold: true })] })] }),
                ],
            }),
        ];

        if (context.issues && context.issues.length > 0) {
            context.issues.forEach(issue => {
                let type = (issue.type || '').toLowerCase();
                if (type === 'bug') type = 'Bug';
                if (type === 'vulnerability') type = 'Vulnerability';

                tableRows.push(
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph(type)] }),
                            new TableCell({ children: [new Paragraph(issue.severity || '-')] }),
                            new TableCell({ children: [new Paragraph(issue.message || '-')] }),
                        ],
                    })
                );
            });
        } else {
            tableRows.push(new TableRow({
                children: [
                    new TableCell({ columnSpan: 3, children: [new Paragraph("No issues found")] })
                ]
            }));
        }

        elements.push(new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
        }));

        return elements;
    }

    private createSummarySection(context: WordReportContext): (Paragraph | Table)[] {
        const elements: (Paragraph | Table)[] = [];

        elements.push(new Paragraph({ text: 'Quality Gate Summary', heading: HeadingLevel.HEADING_2, spacing: { after: 200 } }));

        // Table Header
        const tableRows = [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Date', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'QG', bold: true })] })] }), // Shortened Quality Gate
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Rel', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Sec', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Main', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Bugs', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Vuln', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Smells', bold: true })] })] }),
                ],
            }),
        ];

        // Table Rows
        if (context.scans && context.scans.length > 0) {
            context.scans.forEach(scan => {
                const scanDate = this.formatScanDate(scan.startedAt);
                const status = scan.status || '-';
                const qg = scan.qualityGate === 'OK' ? 'Pass' : (scan.qualityGate ? 'Fail' : 'N/A');
                const m = scan.metrics;

                tableRows.push(
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph(scanDate)] }),
                            new TableCell({ children: [new Paragraph(status)] }),
                            new TableCell({ children: [new Paragraph(qg)] }),
                            new TableCell({ children: [new Paragraph(m?.reliabilityRating || '-')] }),
                            new TableCell({ children: [new Paragraph(m?.securityRating || '-')] }),
                            new TableCell({ children: [new Paragraph(m?.maintainabilityRating || '-')] }),
                            new TableCell({ children: [new Paragraph(m?.bugs?.toString() || '0')] }),
                            new TableCell({ children: [new Paragraph(m?.vulnerabilities?.toString() || '0')] }),
                            new TableCell({ children: [new Paragraph(m?.codeSmells?.toString() || '0')] }),
                        ],
                    })
                );
            });
        } else {
            tableRows.push(
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph('No scans found in range')] }),
                        new TableCell({ children: [] }),
                        new TableCell({ children: [] }),
                        new TableCell({ children: [] }),
                        new TableCell({ children: [] }),
                        new TableCell({ children: [] }),
                        new TableCell({ children: [] }),
                        new TableCell({ children: [] }),
                        new TableCell({ children: [] }),
                    ]
                })
            );
        }

        elements.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        return elements;
    }

    private formatScanDate(date: string | undefined): string {
        if (!date) return 'N/A';
        return new Date(date).toLocaleString('en-GB', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    }

    private createSecuritySection(context: WordReportContext): (Paragraph | Table)[] {
        const paragraphs: (Paragraph | Table)[] = [];
        const { metrics, owaspCoverage, hotIssues } = context.securityData!;

        paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
        paragraphs.push(new Paragraph({ text: 'Security Analysis', heading: HeadingLevel.HEADING_2 }));

        paragraphs.push(new Paragraph({ text: 'OWASP Top 10 Breakdown:', spacing: { before: 200, after: 100 } }));

        const owaspRows = [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Category', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Issue Count', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Status', bold: true })] })] }),
                ],
            }),
        ];

        owaspCoverage.forEach(owasp => {
            const statusText = owasp.status === 'pass' ? 'PASS' : owasp.status === 'warning' ? 'WARN' : 'FAIL';
            owaspRows.push(
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph(owasp.name)] }),
                        new TableCell({ children: [new Paragraph(owasp.count.toString())] }),
                        new TableCell({ children: [new Paragraph(statusText)] }),
                    ],
                })
            );
        });

        paragraphs.push(new Table({
            rows: owaspRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
        }));

        paragraphs.push(new Paragraph({ text: 'Vulnerability Severity:', spacing: { before: 200, after: 100 } }));

        const severityRows = [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Severity', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Count', bold: true })] })] }),
                ],
            }),
        ];

        metrics.vulnerabilities.forEach(v => {
            severityRows.push(
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph(v.severity)] }),
                        new TableCell({ children: [new Paragraph(v.count.toString())] }),
                    ],
                })
            );
        });

        paragraphs.push(new Table({
            rows: severityRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
        }));

        paragraphs.push(new Paragraph({ text: 'Top 5 Security Hotspots:', spacing: { before: 200, after: 100 } }));
        const top5 = hotIssues.slice(0, 5);

        const hotspotsRows = [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Hotspot', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Count', bold: true })] })] }),
                ],
            }),
        ];

        if (top5.length > 0) {
            top5.forEach(h => {
                hotspotsRows.push(
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph(h.name)] }),
                            new TableCell({ children: [new Paragraph(h.count.toString())] }),
                        ],
                    })
                );
            });
        } else {
            hotspotsRows.push(
                new TableRow({
                    children: [
                        new TableCell({ columnSpan: 2, children: [new Paragraph('No hotspots detected')] }),
                    ],
                })
            );
        }

        paragraphs.push(new Table({
            rows: hotspotsRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
        }));

        return paragraphs;
    }

    private createRecommendationsSection(context: WordReportContext): (Paragraph | Table)[] {
        if (!context.recommendationsData || context.recommendationsData.length === 0) return [];

        const elements: (Paragraph | Table)[] = [];

        elements.push(new Paragraph({
            text: "Recommendations",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
        }));

        const tableRows = [
            new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ text: "Severity", style: "TableHeader" })], width: { size: 15, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ text: "Type", style: "TableHeader" })], width: { size: 15, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ text: "Issue", style: "TableHeader" })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ text: "Recommended Fix", style: "TableHeader" })], width: { size: 40, type: WidthType.PERCENTAGE } }),
                ],
            }),
        ];

        context.recommendationsData.slice(0, 10).forEach(rec => {
            tableRows.push(
                new TableRow({
                    children: [
                        new TableCell({ children: [new Paragraph(rec.severity)] }),
                        new TableCell({ children: [new Paragraph(rec.type)] }),
                        new TableCell({ children: [new Paragraph(rec.message)] }),
                        new TableCell({ children: [new Paragraph(rec.recommendedFix)] }),
                    ],
                })
            );
        });

        elements.push(new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
        }));

        elements.push(new Paragraph({ text: "", spacing: { after: 200 } })); // Spacer

        return elements;
    }

    private createTechnicalDebtSection(context: WordReportContext): (Paragraph | Table)[] {
        const elements: (Paragraph | Table)[] = [];

        elements.push(new Paragraph({
            text: 'Technical Debt Analysis',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 }
        }));

        // Header row
        const headerRow = new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Scan Date', bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Project', bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Technical Debt', bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Cost (THB)', bold: true })] })] }),
            ]
        });

        const dataRows = context.scans.map(scan => {
            const debtMinutes = scan.metrics?.technicalDebtMinutes || 0;
            const costPerDay = scan.project?.costPerDay || 1000;
            const cost = (debtMinutes / 480) * costPerDay;

            return new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ text: this.formatScanDate(scan.startedAt) })] }),
                    new TableCell({ children: [new Paragraph({ text: context.projectName })] }),
                    new TableCell({ children: [new Paragraph({ text: this.formatTechnicalDebt(debtMinutes) })] }),
                    new TableCell({ children: [new Paragraph({ text: `THB ${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` })] }),
                ]
            });
        });

        elements.push(new Table({
            rows: [headerRow, ...dataRows],
            width: { size: 100, type: WidthType.PERCENTAGE },
        }));

        elements.push(new Paragraph({ text: "", spacing: { after: 200 } }));

        return elements;
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