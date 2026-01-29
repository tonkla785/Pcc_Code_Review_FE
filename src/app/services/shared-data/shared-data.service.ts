import { IssuesRequestDTO } from './../../interface/issues_interface';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TokenStorageService } from '../tokenstorageService/token-storage.service';
import { Repository } from '../reposervice/repository.service';
import { Scan } from '../scanservice/scan.service';
import { LoginUser, UserInfo } from '../../interface/user_interface';
import { ScanResponseDTO } from '../../interface/scan_interface';
import { Issue } from '../issueservice/issue.service';
import { IssuesResponseDTO } from '../../interface/issues_interface';
import { commentRequestDTO, commentResponseDTO } from '../../interface/comment_interface';

/**
 * SharedDataService - Central state management using RxJS BehaviorSubject
 * 
 * ใช้สำหรับ share ข้อมูลระหว่าง components โดยไม่ต้อง fetch API ซ้ำ
 * 
 * Pattern:
 * 1. Component subscribe รับข้อมูลจาก BehaviorSubject
 * 2. ถ้าไม่มีข้อมูล (empty) -> fetch API แล้ว set ข้อมูลเข้า BehaviorSubject
 * 3. เมื่อข้อมูลเปลี่ยน (add/update/delete) -> update BehaviorSubject
 * 4. ทุก Component ที่ subscribe จะได้รับข้อมูลใหม่อัตโนมัติ
 */
@Injectable({ providedIn: 'root' })
export class SharedDataService {

    // ==================== USER STATE ====================
    private _currentUser$ = new BehaviorSubject<UserInfo | null>(null);
    readonly currentUser$ = this._currentUser$.asObservable();

    get currentUserValue(): UserInfo | null {
        return this._currentUser$.getValue();
    }

    get userId(): string | null {
        return this._currentUser$.getValue()?.id ?? null;
    }

    get isAdmin(): boolean {
        return this._currentUser$.getValue()?.role === 'ADMIN';
    }

    // ==================== REPOSITORIES STATE ====================
    private _repositories$ = new BehaviorSubject<Repository[]>([]);
    readonly repositories$ = this._repositories$.asObservable();

    get repositoriesValue(): Repository[] {
        return this._repositories$.getValue();
    }

    get hasRepositoriesCache(): boolean {
        return this._repositories$.getValue().length > 0;
    }

    // ==================== SELECTED REPOSITORY ====================
    private _selectedRepository$ = new BehaviorSubject<Repository | null>(null);
    readonly selectedRepository$ = this._selectedRepository$.asObservable();

    get selectedRepositoryValue(): Repository | null {
        return this._selectedRepository$.getValue();
    }

    // ==================== SCANS STATE ====================
    private readonly scansHistory =
    new BehaviorSubject<ScanResponseDTO[] | null>(null);

    readonly scansHistory$ = this.scansHistory.asObservable();

    //เคยโหลดแล้วหรือยัง (ไม่สนว่าข้อมูลว่างไหม) 
    get hasScansHistoryLoaded(): boolean {
    return this.scansHistory.value !== null;
    }
    // มีข้อมูลจริง ๆ ไหม (length > 0) 
    get hasScansHistoryCache(): boolean {
    const data = this.scansHistory.value;
    return data !== null;
    }
    //update cache 
    set Scans(data: ScanResponseDTO[]) {
    this.scansHistory.next(data ?? []);
    }
    get scanValue(): ScanResponseDTO[] {
            return this.scansHistory.value ?? [];
            }
    addScan(newScan: ScanResponseDTO) {
            const next = [newScan, ...this.scanValue];
            this.scansHistory.next(next);
            }
    private readonly selectedScan = new BehaviorSubject<ScanResponseDTO | null>(null);
        readonly selectedScan$ = this.selectedScan.asObservable();
      
        get hasScansDetailsLoaded(): boolean {
        return this.selectedScan.value !== null;
        }
   
        get hasScansDetailsCache(): boolean {
        const data = this.selectedScan.value;
        return data !== null;
        }
  
        set ScansDetail(data: ScanResponseDTO) {
        this.selectedScan.next(data);
        }

    private readonly AllUser = new BehaviorSubject<UserInfo[] | null>(null);
        readonly AllUser$ = this.AllUser.asObservable();
      
        get hasUserLoaded(): boolean {
        return this.AllUser.value !== null;
        }
   
        get hasUserCache(): boolean {
        const data = this.AllUser.value;
        return data !== null;
        }
  
        set UserShared(data: UserInfo[]) {
        this.AllUser.next(data);
        }

        get usersValue(): UserInfo[] {
            return this.AllUser.value ?? [];
            }

            updateUser(updated: UserInfo) {
            const next = this.usersValue.map(u => u.id === updated.id ? updated : u);
            this.AllUser.next(next);
            }

            addUser(newUser: UserInfo) {
            const next = [newUser, ...this.usersValue];
            this.AllUser.next(next);
            }

            removeUser(userId: string) {
            const next = this.usersValue.filter(u => u.id !== userId);
            this.AllUser.next(next);
}
    private readonly AllIssues = new BehaviorSubject<IssuesResponseDTO[] | null>(null);
        readonly AllIssues$ = this.AllIssues.asObservable();
      
        get hasIssuesLoaded(): boolean {
        return this.AllIssues.value !== null;
        }
   
        get hasIssuesCache(): boolean {
        const data = this.AllIssues.value;
        return data !== null;
        }
  
        set IssuesShared(data: IssuesResponseDTO[]) {
        this.AllIssues.next(data ?? []);
        }

        get issuesValue(): IssuesResponseDTO[] {
            return this.AllIssues.value ?? [];
            }

            updateIssues(updated: IssuesResponseDTO) {
            const next = this.issuesValue.map(u => u.id === updated.id ? updated : u);
            this.AllIssues.next(next);
            }

            addIssues(newIssue: IssuesResponseDTO) {
            const next = [newIssue, ...this.issuesValue];
            this.AllIssues.next(next);
            }

            removeIssues(issueId: string) {
            const next = this.issuesValue.filter(u => u.id !== issueId);
            this.AllIssues.next(next);
}
    private readonly selectedIssues= new BehaviorSubject<IssuesResponseDTO | null>(null);
        readonly selectedIssues$ = this.selectedIssues.asObservable();
      
        get hasSelectedIssuesLoaded(): boolean {
        return this.selectedIssues.value !== null;
        }
   
        get hasSelectedIssuesCache(): boolean {
        const data = this.selectedIssues.value;
        return data !== null;
        }
  
        set SelectedIssues(data: IssuesResponseDTO) {
        this.selectedIssues.next(data);
        }
        get issueValue(): IssuesResponseDTO {
            return this.selectedIssues.value ?? null!;
            }
        updateIssue(patch: Partial<IssuesResponseDTO> & { id: string }) {
            const current = this.issueValue;
            if (!current) return;
            if (current.id !== patch.id) return;

            // merge ของเดิม + ของใหม่ แล้ว next -> ทุก component ที่ subscribe จะอัปเดตทันที
            const next: IssuesResponseDTO = { ...current, ...patch } as IssuesResponseDTO;
            this.selectedIssues.next(next);
            }
                addComments(newComment: commentResponseDTO) {
                const current = this.issueValue;
                if (!current) return;

                // กันเผื่อ backend ส่ง issue เป็น id หรือ object
                const issueId =
                    typeof newComment.issue === 'string'
                    ? newComment.issue
                    : (newComment.issue as any)?.id;

                if (current.id !== issueId) return;

                const commentData = current.commentData ?? [];

                const next: IssuesResponseDTO = {
                    ...current,
                    commentData: [...commentData, newComment],
                };

                this.selectedIssues.next(next);
                }

private readonly LoginUser = new BehaviorSubject<LoginUser | null>(null);
        readonly LoginUser$ = this.LoginUser.asObservable();
      
        get hasLoginUserLoaded(): boolean {
        return this.LoginUser.value !== null;
        }
   
        get hasLoginUserCache(): boolean {
        const data = this.LoginUser.value;
        return data !== null;
        }
  
        set LoginUserShared(data: LoginUser) {
        this.LoginUser.next(data);
        }


    // ==================== LOADING STATE ====================
    private _isLoading$ = new BehaviorSubject<boolean>(false);
    readonly isLoading$ = this._isLoading$.asObservable();

    constructor(private tokenStorage: TokenStorageService) { }

    // ==================== USER METHODS ====================

    setCurrentUser(user: UserInfo | null): void {
        this._currentUser$.next(user);
    }

    /** เรียกหลัง login สำเร็จ */
    setUserFromLoginResponse(response: {
        id: string;
        username: string;
        password: string;
        email: string;
        phone?: string;
        role: string;
    }): void {
        const user: UserInfo = {
            id: response.id,
            username: response.username,
            password: response.password || '',
            email: response.email,
            phone: response.phone,
            role: (response.role?.toUpperCase() as 'USER' | 'ADMIN') || 'USER'
        };
        this._currentUser$.next(user);
    }

    clearUser(): void {
        this._currentUser$.next(null);
    }

    // ==================== REPOSITORY METHODS ====================

    /** เซ็ตรายการ repositories ทั้งหมด (หลัง fetch API) */
    setRepositories(repos: Repository[]): void {
        this._repositories$.next(repos);
    }

    /** เพิ่ม repository ใหม่ (หลัง create สำเร็จ) */
    addRepository(repo: Repository): void {
        const current = this._repositories$.getValue();
        this._repositories$.next([repo, ...current]);
    }

    /** อัปเดต repository (หลัง update สำเร็จ) */
    updateRepository(projectId: string, updates: Partial<Repository>): void {
        const current = this._repositories$.getValue();
        const index = current.findIndex(r => r.projectId === projectId);
        if (index >= 0) {
            current[index] = { ...current[index], ...updates };
            this._repositories$.next([...current]);
        }
    }

    /** ลบ repository (หลัง delete สำเร็จ) */
    removeRepository(projectId: string): void {
        const current = this._repositories$.getValue();
        this._repositories$.next(current.filter(r => r.projectId !== projectId));
    }

    /** เซ็ต repository ที่เลือก (สำหรับหน้า detail) */
    setSelectedRepository(repo: Repository | null): void {
        this._selectedRepository$.next(repo);
    }

    // ==================== SCAN METHODS ====================

    /** เซ็ตรายการ scans (หลัง fetch API) */
    setRecentScans(scans: ScanResponseDTO[]): void {
        this.scansHistory.next(scans);
    }

    /** เพิ่ม scan ใหม่ (หลัง trigger scan) */
    // addScan(scan: ScanResponseDTO): void {
    //     const current = this.scansHistory.getValue();
    //     this.scansHistory.next([scan, ...current.slice(0, 9)]);
    // }

    // ==================== LOADING & CLEAR ====================

    setLoading(isLoading: boolean): void {
        this._isLoading$.next(isLoading);
    }

    /** เรียกตอน logout - ล้างข้อมูลทั้งหมด */
    // clearAll(): void {
    //     this._currentUser$.next(null);
    //     this._repositories$.next([]);
    //     this._selectedRepository$.next(null);
    //     this._recentScans$.next([]);
    //     this._isLoading$.next(false);
    // }
        updateRepoStatus(
        projectId: string,
        status: 'Active' | 'Scanning' | 'Error',
        scanningProgress?: number
    ): void {
        const current = this._repositories$.getValue();

        const updated = current.map(repo =>
            repo.projectId === projectId
                ? {
                    ...repo,
                    status,
                    scanningProgress:
                        scanningProgress !== undefined
                            ? scanningProgress
                            : repo.scanningProgress
                }
                : repo
        );

        this._repositories$.next(updated);
    }
}
