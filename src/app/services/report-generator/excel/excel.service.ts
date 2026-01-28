import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SecurityMetrics, OwaspCategory, HotSecurityIssue } from '../../../interface/security_interface';

export interface ExcelReportContext {
    projectName: string;
    dateFrom: string;
    dateTo: string;
    scanData: ScanResponseDTO | null;
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
            ['Project Name', 'Status', 'Reliability', 'Security', 'Maintainability', 'Bugs', 'Vulnerabilities'],
        ];

        if (context.scanData) {
            const status = context.scanData.qualityGate === 'OK' ? 'Passed' : 'Failed';
            summaryData.push([
                context.projectName,
                status,
                this.formatRating(context.scanData.metrics?.reliabilityRating),
                this.formatRating(context.scanData.metrics?.securityRating),
                this.formatRating(context.scanData.metrics?.maintainabilityRating),
                String(context.scanData.metrics?.bugs ?? 0),
                String(context.scanData.metrics?.vulnerabilities ?? 0)
            ]);
        } else {
            summaryData.push([context.projectName, 'No scan data in range', 'N/A', 'N/A', 'N/A', '0', '0']);
        }

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        summarySheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
            { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } },
        ];
        summarySheet['!cols'] = [
            { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    }

    private createIssueSheet(workbook: XLSX.WorkBook, context: ExcelReportContext) {
        const filteredIssues = context.issues.filter(issue => {
            if (issue.type !== 'Bug' && issue.type !== 'Vulnerability') return false;
            const issueDate = issue.createdAt ? new Date(issue.createdAt).toISOString().split('T')[0] : '';
            return issueDate >= context.dateFrom && issueDate <= context.dateTo;
        });

        const issuesData: any[][] = [
            ['Code Review Report - Issue Breakdown'],
            [`Project: ${context.projectName}`],
            [`Date Range: ${context.dateFrom} - ${context.dateTo}`],
            [],
            ['Project Name', 'Type', 'Severity', 'File Path', 'Line', 'Status'],
        ];

        if (filteredIssues.length > 0) {
            filteredIssues.forEach(issue => {
                const filePath = issue.component || 'N/A';
                const line = this.extractLineFromComponent(issue.component) || 'N/A';
                issuesData.push([
                    context.projectName,
                    issue.type,
                    issue.severity,
                    filePath,
                    line,
                    issue.status
                ]);
            });
        } else {
            issuesData.push([context.projectName, 'No issues found', '-', '-', '-', '-']);
        }

        const issuesSheet = XLSX.utils.aoa_to_sheet(issuesData);
        issuesSheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
        ];
        issuesSheet['!cols'] = [
            { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 60 }, { wch: 10 }, { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(workbook, issuesSheet, 'Issues_List');
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
