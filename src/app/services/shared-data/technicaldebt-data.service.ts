import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Priority = 'High' | 'Med' | 'Low';

export interface DebtItem {
  priority: Priority;
  colorClass: string; // 'high' | 'med' | 'low'
  item: string;
  time: number; // minutes
  cost: number;
}

export interface TotalDebt {
  days: number;
  hours: number;
  minutes: number;
  cost: number;
}

@Injectable({
  providedIn: 'root'
})
export class TechnicalDebtDataService {

  // ==================== TOTAL DEBT STATE ====================
  // Default to 0
  private _totalDebt$ = new BehaviorSubject<TotalDebt>({ days: 0, hours: 0, minutes: 0, cost: 0 });
  readonly totalDebt$ = this._totalDebt$.asObservable();

  get totalDebtValue(): TotalDebt {
    return this._totalDebt$.getValue();
  }

  setTotalDebt(data: TotalDebt): void {
    console.log('SharedData: setTotalDebt', data);
    this._totalDebt$.next(data);
  }

  // ==================== TOP DEBT ITEMS STATE ====================
  private _topDebtItems$ = new BehaviorSubject<DebtItem[]>([]);
  readonly topDebtItems$ = this._topDebtItems$.asObservable();

  get topDebtItemsValue(): DebtItem[] {
    return this._topDebtItems$.getValue();
  }

  setTopDebtItems(items: DebtItem[]): void {
    console.log('SharedData: setTopDebtItems', items.length);
    this._topDebtItems$.next(items);
  }

  // ==================== CALCULATE FROM SCANS ====================
  /**
   * คำนวณ Total Debt + Top Debt Items จาก scan data
   * ใช้สูตร: cost = (technicalDebtMinutes / 480) × costPerDay
   * เรียกได้จากทุก component เมื่อมีข้อมูล scan
   */
  calculateFromScans(scans: any[]): void {
    if (!scans || scans.length === 0) return;

    // หา latest scan ต่อ project
    const byProject = new Map<string, any>();
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

    const latestScans = Array.from(byProject.values());

    // --- Total Debt ---
    const totalDebtMinutes = latestScans.reduce(
      (sum, s) => sum + (s.metrics?.technicalDebtMinutes || 0), 0
    );
    const totalDays = Math.floor(totalDebtMinutes / 480);
    const remainingAfterDays = totalDebtMinutes % 480;
    const totalHours = Math.floor(remainingAfterDays / 60);
    const totalMinutes = remainingAfterDays % 60;

    const totalCost = latestScans.reduce((sum, scan) => {
      const debtMinutes = scan.metrics?.technicalDebtMinutes || 0;
      const costPerDay = scan.project?.costPerDay || 1000;
      return sum + ((debtMinutes / 480) * costPerDay);
    }, 0);

    this.setTotalDebt({ days: totalDays, hours: totalHours, minutes: totalMinutes, cost: totalCost });

    // --- Top Debt Items ---
    const projects = latestScans.map(scan => {
      const debtMinutes = scan.metrics?.technicalDebtMinutes || 0;
      const costPerDay = scan.project?.costPerDay || 1000;
      const cost = (debtMinutes / 480) * costPerDay;
      const name = scan.project?.name || scan.project?.id || 'Unknown';
      return { name, debtMinutes, cost };
    });

    const maxCost = Math.max(...projects.map(p => p.cost), 1);
    const step = maxCost / 3;

    const items: DebtItem[] = projects.map(p => {
      let priority: Priority = 'Low';
      let color = 'low';
      if (p.cost > (step * 2)) {
        priority = 'High';
        color = 'high';
      } else if (p.cost > step) {
        priority = 'Med';
        color = 'med';
      }
      return {
        priority, colorClass: color,
        item: p.name, time: p.debtMinutes, cost: p.cost
      };
    });

    this.setTopDebtItems(items.sort((a, b) => b.cost - a.cost).slice(0, 5));
  }

  // ==================== CLEAR DATA ====================
  /**
   * Clear all technical debt data (used when a project is deleted)
   */
  clearAllDebtData(): void {
    console.log('SharedData: clearAllDebtData - resetting all debt data');
    this._totalDebt$.next({ days: 0, hours: 0, minutes: 0, cost: 0 });
    this._topDebtItems$.next([]);
  }

}
