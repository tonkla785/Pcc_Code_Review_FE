/**
 * Utility functions สำหรับใช้ซ้ำทั้งโปรเจค
 */

// ==================== DATE & TIME ====================

/**
 * แปลง Date เป็น "x ago" format (Just now, 5m ago, 2h ago, 3d ago)
 */
export function getTimeAgo(value: Date | string | number): string {
    const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
    if (Number.isNaN(t)) return 'Just now';

    let diffSec = Math.floor((Date.now() - t) / 1000);
    if (diffSec < 0) diffSec = 0;

    const m = Math.floor(diffSec / 60);
    const h = Math.floor(diffSec / 3600);
    const d = Math.floor(diffSec / 86400);

    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
}

/**
 * แปลง Date เป็น Thai date format
 */
export function formatThaiDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * แปลง Date เป็น Thai datetime format
 */
export function formatThaiDateTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ==================== CURRENCY ====================

/**
 * แปลง number เป็น Thai Baht format (฿1,000)
 */
export function formatTHB(value: number): string {
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        maximumFractionDigits: 0,
    }).format(value);
}

/**
 * แปลง number เป็น format มี comma (1,000,000)
 */
export function formatNumber(value: number): string {
    return new Intl.NumberFormat('th-TH').format(value);
}

// ==================== STATUS & SEVERITY CLASSES ====================

/**
 * Get CSS class สำหรับ Issue Status (text color)
 */
export function getStatusTextClass(status: string): string {
    if (!status) return '';

    switch (status.toLowerCase()) {
        case 'open': return 'text-danger';
        case 'in-progress':
        case 'in progress': return 'text-warning';
        case 'done': return 'text-success';
        case 'reject': return 'text-secondary';
        case 'pending': return 'text-info';
        default: return '';
    }
}

/**
 * Get CSS class สำหรับ Issue Status (badge style)
 */
export function getStatusBadgeClass(status: string): string {
    if (!status) return '';

    switch (status.toLowerCase()) {
        case 'open': return 'status-open';
        case 'in-progress':
        case 'in progress': return 'status-in-progress';
        case 'done': return 'status-done';
        case 'reject': return 'status-reject';
        case 'pending': return 'status-pending';
        default: return 'status-unknown';
    }
}

/**
 * Get CSS class สำหรับ Scan Status
 */
export function getScanStatusClass(status: string): string {
    switch (status) {
        case 'Active': return 'text-success';
        case 'Error': return 'text-danger';
        case 'Scanning': return 'text-warning';
        default: return '';
    }
}

/**
 * Get icon class สำหรับ Scan Status
 */
export function getScanStatusIcon(status: string): string {
    switch (status) {
        case 'Active': return 'bi-check-circle';
        case 'Error': return 'bi-x-circle';
        case 'Scanning': return 'bi-exclamation-circle';
        default: return '';
    }
}

/**
 * Get CSS class สำหรับ Severity (text color)
 */
export function getSeverityClass(severity: string): string {
    switch (severity.toLowerCase()) {
        case 'critical':
        case 'blocker':
        case 'high': return 'text-danger';
        case 'major':
        case 'medium': return 'text-warning';
        case 'minor':
        case 'low': return 'text-success';
        default: return '';
    }
}

/**
 * Get color hex สำหรับ Severity (สำหรับ inline style)
 */
export function getSeverityColor(severity: string): string {
    switch (severity.trim().toUpperCase()) {
        case 'MINOR': return '#FBC02D';     // Yellow
        case 'MAJOR': return '#FF9800';     // Orange
        case 'CRITICAL': return '#E64A19';  // Deep Orange
        case 'BLOCKER': return '#C62828';   // Red
        default: return '#757575';          // Grey
    }
}

// ==================== ISSUE TYPE ====================

/**
 * Get icon class สำหรับ Issue Type
 */
export function getIssueTypeIcon(type: string): string {
    switch (type.toLowerCase()) {
        case 'bug': return 'bi-bug';
        case 'security':
        case 'vulnerability': return 'bi-shield-lock';
        case 'code-smell':
        case 'code_smell': return 'bi-code-slash';
        default: return '';
    }
}

// ==================== GRADE ====================

/**
 * Get color hex สำหรับ Grade (A-E)
 */
export function getGradeColor(grade: string): string {
    switch (grade?.toUpperCase()) {
        case 'A': return '#10B981';  // Green
        case 'B': return '#84CC16';  // Light Green
        case 'C': return '#F59E0B';  // Yellow
        case 'D': return '#FB923C';  // Orange
        case 'E': return '#EF4444';  // Red
        default: return '#6B7280';   // Grey
    }
}

/**
 * Validate ว่าเป็น Grade ที่ถูกต้องหรือไม่ (A-E)
 */
export function isValidGrade(grade: string): boolean {
    return /^[A-E]$/i.test((grade || '').trim());
}

// ==================== STRING UTILS ====================

/**
 * Truncate string และเพิ่ม ... ถ้ายาวเกินไป
 */
export function truncate(str: string, maxLength: number): string {
    if (!str) return '';
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
