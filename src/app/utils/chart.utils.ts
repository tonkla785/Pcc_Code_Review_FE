/**
 * Chart Configuration Utilities
 * ใช้สำหรับสร้าง chart configurations
 */
import { ApexOptions, ApexAxisChartSeries } from 'ng-apexcharts';

/**
 * สร้าง Pie Chart options สำหรับ Quality Gate Summary
 */
export function buildQualityGatePieChart(passedCount: number, failedCount: number): ApexOptions {
    return {
        series: [passedCount, failedCount],
        labels: ['Passed', 'Failed'],
        chart: { type: 'pie' },
        legend: { position: 'bottom' },
        states: {
            hover: {
                filter: {
                    type: 'darken',
                    value: 0.15
                }
            },
            active: {
                filter: {
                    type: 'darken',
                    value: 0.2
                }
            }
        }
    };
}

/**
 * สร้าง Line Chart options สำหรับ Coverage Trend
 * Returns chart configuration compatible with ApexCharts
 */
export function buildCoverageTrendChart(
    dates: string[],
    coverageValues: number[]
): {
    series: { name: string; data: number[] }[];
    options: {
        chart: { type: string; height: number; toolbar: { show: boolean }; zoom: { enabled: boolean } };
        xaxis: { categories: string[] };
        yaxis: { min: number; max: number; title: { text: string } };
        stroke: { curve: string; width: number };
        markers: { size: number };
        theme?: { mode: string };
        tooltip?: any;
        grid?: any;
        colors: string[];
    };
} {
    const maxY = Math.max(1, ...coverageValues);

    return {
        series: [
            {
                name: 'Quality Grade Passed',
                data: coverageValues,
            },
        ],
        options: {
            chart: {
                type: 'line',
                height: 300,
                toolbar: { show: false },
                zoom: { enabled: false }
            },
            theme: {
                mode: 'light'
            },
            // Fix tooltip: Force Light Theme Tooltip (White BG, Dark Text) always
            tooltip: {
                theme: 'light',
                style: {
                    fontSize: '12px',
                    fontFamily: undefined
                },
                x: {
                    show: true,
                    format: 'dd/MM'
                },
                marker: {
                    show: true,
                },
            },
            // Ensure X-axis and Grid lines are visible
            grid: {
                show: true,
                borderColor: '#e2e8f0', // Slate-200
                strokeDashArray: 4,
            },
            xaxis: {
                categories: dates,
            },
            yaxis: {
                min: 0,
                max: maxY,
                title: { text: 'Quality Grade Passed' },
            },
            stroke: {
                curve: 'smooth',
                width: 3,
            },
            markers: {
                size: 4,
            },
            colors: ['#0d6efd'], // bootstrap primary
        }
    };
}

/**
 * สร้างวันที่ย้อนหลัง 30 วัน (labels สำหรับ chart)
 */
export function generateLast30DaysLabels(): { dates: string[]; dateKeys: string[] } {
    const dates: string[] = [];
    const dateKeys: string[] = [];

    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);

        dateKeys.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD

        const label = d.toLocaleDateString('th-TH', {
            day: '2-digit',
            month: '2-digit',
        });
        dates.push(label);
    }

    return { dates, dateKeys };
}
