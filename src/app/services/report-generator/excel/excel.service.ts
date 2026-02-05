import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SecurityMetrics, OwaspCategory, HotSecurityIssue } from '../../../interface/security_interface';

export interface ExcelReportContext {
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
        technicalDebt?: boolean;
        trendAnalysis?: boolean;
        recommendations?: boolean;
    };
    recommendationsData?: any[];
}

@Injectable({
    providedIn: 'root'
})
export class ExcelService {

    generateExcel(context: ExcelReportContext) {
        const workbook = XLSX.utils.book_new();

        if (context.selectedSections.qualityGate) {
            this.createSummarySheet(workbook, context);
        }

        if (context.selectedSections.issueBreakdown) {
            this.createIssueSheet(workbook, context);
        }

        if (context.selectedSections.securityAnalysis && context.securityData) {
            this.createSecuritySheet(workbook, context);
        }

        if (context.selectedSections.technicalDebt) {
            this.createTechnicalDebtSheet(workbook, context);
        }

        if (context.selectedSections.recommendations && context.recommendationsData) {
            this.createRecommendationsSheet(workbook, context);
        }

        const filename = `report-${context.projectName}-${context.dateFrom}-to-${context.dateTo}.xlsx`;
        XLSX.writeFile(workbook, filename);
    }

    private createSummarySheet(workbook: XLSX.WorkBook, context: ExcelReportContext) {
        const summaryData: any[][] = [
            ['Code Review Report - Quality Gate Summary'],
            [`Project: ${context.projectName}`],
            [`Date Range: ${context.dateFrom} - ${context.dateTo}`],
            [`Generated: ${new Date().toLocaleString()}`],
            [],
            ['Scan Date', 'Status', 'Quality Gate', 'Reliability', 'Security', 'Maintainability', 'Bugs', 'Vulnerabilities', 'Code Smells'],
        ];

        if (context.scans && context.scans.length > 0) {
            context.scans.forEach(scan => {
                const scanDate = this.formatScanDate(scan.startedAt);
                const status = scan.status || '-';
                let qualityGate = scan.qualityGate || 'N/A';
                if (qualityGate === 'OK') qualityGate = 'Pass';
                if (qualityGate === 'ERROR') qualityGate = 'Fail';
                const metrics = scan.metrics;

                summaryData.push([
                    scanDate,
                    status,
                    qualityGate,
                    metrics?.reliabilityRating || 'N/A',
                    metrics?.securityRating || 'N/A',
                    metrics?.maintainabilityRating || 'N/A',
                    metrics?.bugs !== undefined ? metrics.bugs : 'N/A',
                    metrics?.vulnerabilities !== undefined ? metrics.vulnerabilities : 'N/A',
                    metrics?.codeSmells !== undefined ? metrics.codeSmells : 'N/A'
                ]);
            });
        } else {
            summaryData.push(['No scans found in this date range', '-', '-', '-', '-', '-', '-', '-', '-']);
        }

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        summarySheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } },
        ];
        summarySheet['!cols'] = [
            { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    }

    private formatScanDate(date: string | undefined): string {
        if (!date) return 'N/A';
        return new Date(date).toLocaleString('en-GB', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    }

    private createIssueSheet(workbook: XLSX.WorkBook, context: ExcelReportContext) {
        const issueData: any[][] = [
            ['Code Review Report - Issue Breakdown'],
            [`Project: ${context.projectName}`],
            [`Date Range: ${context.dateFrom} - ${context.dateTo}`],
            [],
            ['Type', 'Severity', 'Message', 'Created At'],
        ];

        if (context.issues && context.issues.length > 0) {
            context.issues.forEach((issue: any) => {
                let type = (issue.type || '').toLowerCase();
                if (type === 'bug') type = 'Bug';
                if (type === 'vulnerability') type = 'Vulnerability';
                if (type === 'code_smell') type = 'Code Smell';

                issueData.push([
                    type,
                    issue.severity || '-',
                    issue.message || '-',
                    issue.createdAt ? new Date(issue.createdAt).toLocaleDateString('en-GB') : '-'
                ]);
            });
        } else {
            issueData.push(['No issues found matching criteria', '-', '-', '-']);
        }

        const issuesSheet = XLSX.utils.aoa_to_sheet(issueData);
        issuesSheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
        ];
        issuesSheet['!cols'] = [
            { wch: 20 }, { wch: 15 }, { wch: 100 }, { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(workbook, issuesSheet, 'Issue Breakdown');
    }

    private createSecuritySheet(workbook: XLSX.WorkBook, context: ExcelReportContext) {
        const { metrics, owaspCoverage, hotIssues } = context.securityData!;

        const securityData: any[][] = [
            ['Code Review Report - Security Analysis'],
            [`Generated: ${new Date().toLocaleString()}`],
            [],
            ['OWASP Top 10 Breakdown'],
            ['Category', 'Issue Count', 'Status'],
        ];

        owaspCoverage.forEach(owasp => {
            const statusText = owasp.status === 'pass' ? 'Pass' : owasp.status === 'warning' ? 'Warning' : 'Fail';
            securityData.push([owasp.name, String(owasp.count), statusText]);
        });

        securityData.push([]);
        securityData.push(['Vulnerability Severity']);
        securityData.push(['Severity', 'Count']);

        metrics.vulnerabilities.forEach(v => {
            securityData.push([v.severity, String(v.count)]);
        });

        securityData.push([]);
        securityData.push(['Top 5 Security Hotspots']);
        securityData.push(['Issue', 'Count']);

        const top5Hotspots = hotIssues.slice(0, 5);
        if (top5Hotspots.length > 0) {
            top5Hotspots.forEach(h => {
                securityData.push([h.name, String(h.count)]);
            });
        } else {
            securityData.push(['No hotspots detected', '-']);
        }

        const securitySheet = XLSX.utils.aoa_to_sheet(securityData);
        securitySheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
        ];
        securitySheet['!cols'] = [
            { wch: 30 }, { wch: 15 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(workbook, securitySheet, 'Security_Report');
    }

    private createRecommendationsSheet(workbook: XLSX.WorkBook, context: ExcelReportContext) {
        if (!context.recommendationsData || context.recommendationsData.length === 0) return;

        const data: any[][] = [
            ['Recommendations'],
            [],
            ['Severity', 'Type', 'Issue Description', 'Component', 'Line', 'Recommended Fix']
        ];

        context.recommendationsData.forEach(rec => {
            data.push([
                rec.severity,
                rec.type,
                rec.message,
                rec.component,
                rec.line,
                rec.recommendedFix
            ]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(data);

        worksheet['!cols'] = [
            { wch: 10 }, // Severity
            { wch: 10 }, // Type
            { wch: 100 }, // Description
            { wch: 50 }, // Component
            { wch: 10 }, // Line
            { wch: 100 }  // Fix
        ];

        const range = XLSX.utils.decode_range(worksheet['!ref']!);
        for (let R = range.s.r + 2; R <= range.e.r; ++R) {
            ['C', 'F'].forEach(col => {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: col === 'C' ? 2 : 5 });
                if (!worksheet[cellRef]) return;

                if (!worksheet[cellRef].s) worksheet[cellRef].s = {};
                worksheet[cellRef].s.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
            });
        }

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Recommendations');
    }

    private createTechnicalDebtSheet(workbook: XLSX.WorkBook, context: ExcelReportContext) {
        const debtData: any[][] = [
            ['Code Review Report - Technical Debt Analysis'],
            [`Project: ${context.projectName}`],
            [`Date Range: ${context.dateFrom} - ${context.dateTo}`],
            [`Generated: ${new Date().toLocaleString()}`],
            [],
            ['Scan Date', 'Project Name', 'Technical Debt Time', 'Cost (THB)'],
        ];

        if (context.scans && context.scans.length > 0) {
            context.scans.forEach(scan => {
                const scanDate = this.formatScanDate(scan.startedAt);
                const debtMinutes = scan.metrics?.technicalDebtMinutes || 0;
                const debtRatio = scan.metrics?.debtRatio || 0;
                const debtTimeStr = this.formatTechnicalDebt(debtMinutes);

                debtData.push([
                    scanDate,
                    context.projectName,
                    debtTimeStr,
                    `THB ${debtRatio.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                ]);
            });
        } else {
            debtData.push(['No scans found', '-', '-', '-']);
        }

        const sheet = XLSX.utils.aoa_to_sheet(debtData);
        sheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
        ];
        sheet['!cols'] = [
            { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(workbook, sheet, 'Technical Debt');
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
