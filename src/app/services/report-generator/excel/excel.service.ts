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
    };
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

    // Helpers
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

    private extractLineFromComponent(component: string | undefined): string {
        if (!component) return '';
        const match = component.match(/:(\d+)$/);
        return match ? match[1] : '';
    }
}
