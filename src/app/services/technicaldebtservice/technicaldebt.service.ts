import { Injectable, inject } from '@angular/core';
import { SharedDataService } from '../shared-data/shared-data.service';
import { TechnicalDebtDataService, DebtItem, TotalDebt, Priority } from '../shared-data/technicaldebt-data.service';
import { ScanResponseDTO } from '../../interface/scan_interface';
import { ScanService } from '../scanservice/scan.service';
import { filter, pairwise, startWith, delay } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TechnicalDebtService {
    private readonly sharedData = inject(SharedDataService);
    private readonly techDebtData = inject(TechnicalDebtDataService);
    private readonly scanService = inject(ScanService);

    constructor() {
        this.sharedData.scansHistory$.subscribe(scans => {
            if (scans && scans.length > 0) {
                this.calculateAndStore(scans);
            }
        });
        this.sharedData.scansHistory$.pipe(
            startWith(null),
            pairwise(),
            filter(([prev, curr]) => {
                if (!curr || curr.length === 0) return false;
                if (!prev) return false;
                const currLatest = curr[0];
                const prevScan = prev.find(s => s.id === currLatest?.id);
                return prevScan?.status !== 'SUCCESS' && currLatest?.status === 'SUCCESS';
            }),
            delay(3000)
        ).subscribe(() => {
            this.refreshScanHistory();
        });
    }

    private refreshScanHistory() {
        this.scanService.getScansHistory().subscribe({
            next: (data: ScanResponseDTO[]) => {
                this.sharedData.Scans = data;
            },
            error: (err: any) => console.error('[TechnicalDebtService] Failed to refetch history', err)
        });
    }

    calculateAndStore(scans: ScanResponseDTO[]): TotalDebt {
        const latestScans = this.latestScanPerProject(scans);

        const totalMinutes = latestScans.reduce((sum, s) => sum + (s.metrics?.technicalDebtMinutes || 0), 0);
        const totalCost = latestScans.reduce((sum, s) => sum + (s.metrics?.debtRatio || 0), 0);

        const days = Math.floor(totalMinutes / 480);
        const remainingAfterDays = totalMinutes % 480;
        const hours = Math.floor(remainingAfterDays / 60);
        const minutes = remainingAfterDays % 60;

        const totalDebt: TotalDebt = { days, hours, minutes, cost: totalCost };
        this.techDebtData.setTotalDebt(totalDebt);

        const topItems = this.calculateTopDebtItems(latestScans);
        this.techDebtData.setTopDebtItems(topItems);

        return totalDebt;
    }

    private calculateTopDebtItems(latestScans: ScanResponseDTO[]): DebtItem[] {
        const maxCost = latestScans.reduce((max, scan) => Math.max(max, scan.metrics?.debtRatio || 0), 0);
        const step = maxCost / 3;

        const items = latestScans.map(scan => {
            const debtMinutes = scan.metrics?.technicalDebtMinutes || 0;
            const cost = scan.metrics?.debtRatio || 0;
            const name = scan.project?.name || scan.project?.id || 'Unknown';

            let priority: Priority = 'Low';
            let colorClass = 'low';

            if (cost > (step * 2)) {
                priority = 'High';
                colorClass = 'high';
            } else if (cost > step) {
                priority = 'Med';
                colorClass = 'med';
            }

            return { priority, colorClass, item: name, time: debtMinutes, cost };
        });

        return items.sort((a, b) => b.cost - a.cost).slice(0, 5);
    }

    private latestScanPerProject(scans: ScanResponseDTO[]): ScanResponseDTO[] {
        const byProject = new Map<string, ScanResponseDTO>();

        for (const s of scans) {
            const pid = s.project?.id;
            if (!pid) continue;

            const prev = byProject.get(pid);
            if (!prev) {
                byProject.set(pid, s);
                continue;
            }
            const sTime = new Date(s.completedAt ?? s.startedAt ?? 0).getTime();
            const pTime = new Date(prev.completedAt ?? prev.startedAt ?? 0).getTime();

            if (sTime > pTime) {
                byProject.set(pid, s);
            }
        }
        return Array.from(byProject.values());
    }
}
