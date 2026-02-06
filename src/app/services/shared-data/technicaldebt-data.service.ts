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
