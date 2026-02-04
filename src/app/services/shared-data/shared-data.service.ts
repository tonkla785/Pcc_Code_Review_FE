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
import { QualityGates } from '../../interface/sonarqube_interface';

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

    private _isScansLoaded = false; // Track if full history has been loaded from API

    readonly scansHistory$ = this.scansHistory.asObservable();

    //เคยโหลดแล้วหรือยัง (ไม่สนว่าข้อมูลว่างไหม) 
    get hasScansHistoryLoaded(): boolean {
        return this._isScansLoaded;
    }
    // มีข้อมูลจริง ๆ ไหม (length > 0) 
    get hasScansHistoryCache(): boolean {
        return this._isScansLoaded;
    }
    //update cache 
    set Scans(data: ScanResponseDTO[]) {
        this.scansHistory.next(data ?? []);
        this._isScansLoaded = true; // Mark as fully loaded
    }
    get scanValue(): ScanResponseDTO[] {
        return this.scansHistory.value ?? [];
    }
    addScan(newScan: ScanResponseDTO) {
        const next = [newScan, ...this.scanValue];
        this.scansHistory.next(next);
    }

    /** Update existing scan or Add if new (prevents duplicates) */
    upsertScan(scan: ScanResponseDTO): void {
        if (!scan.id) {
            return;
        }
        const current = this.scanValue;
        const index = current.findIndex(s => s.id === scan.id);

        if (index > -1) {
            // Update existing
            const next = [...current];
            next[index] = { ...next[index], ...scan };
            this.scansHistory.next(next);
        } else {
            // Add new (prepend)
            this.scansHistory.next([scan, ...current]);
        }
    }
    removeScansByProject(projectId: string): void {
        const current = this.scanValue;
        const next = current.filter(s => s.project?.id !== projectId && s.project.id);
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

    get selectedScanValue(): ScanResponseDTO | null {
        return this.selectedScan.getValue();
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

    updateIssues(updated: IssuesResponseDTO | IssuesResponseDTO[]) {
        const list = Array.isArray(updated) ? updated : [updated];
        const Id = new Map(list.map(i => [i.id, i]));

        const next = this.issuesValue.map(u => Id.get(u.id) ?? u);
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

    removeIssuesByProject(projectId: string) {
        // 1. Find all scan IDs for this project from Scan History
        const projectScanIds = new Set(
            this.scanValue
                .filter(s =>
                    // Fix: รองรับทั้ง project.id และ projectId (Flat)
                    (s.project?.id === projectId) ||
                    ((s as any).projectId === projectId)
                )
                .map(s => s.id)
        );

        // 2. Filter out issues that belong to these scans OR match project ID directly
        const currentIssues = this.issuesValue;
        const nextIssues = currentIssues.filter(issue => {
            // Check direct project mapping (Works even if Scans are not loaded)
            if (issue.projectData?.id === projectId) return false;
            if ((issue as any).projectId === projectId) return false;

            // Check nested scan mapping
            if (projectScanIds.has(issue.scanId)) return false;

            return true;
        });

        console.log(`[SharedData] Removing issues for project ${projectId}. Removed: ${currentIssues.length - nextIssues.length}`);
        this.AllIssues.next(nextIssues);
    }
    private readonly selectedIssues = new BehaviorSubject<IssuesResponseDTO | null>(null);
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

        // merge ของเดิม + ของใหม่ แล้ว next  ทุก component ที่ subscribe จะอัปเดตทันที
        const next: IssuesResponseDTO = { ...current, ...patch } as IssuesResponseDTO;
        this.selectedIssues.next(next);
    }
    private readonly Comments = new BehaviorSubject<commentResponseDTO | null>(null);
    readonly Comments$ = this.Comments.asObservable();

    get hasSelectedCommentLoaded(): boolean {
        return this.Comments.value !== null;
    }

    get hasSelectedCommentCache(): boolean {
        const data = this.Comments.value;
        return data !== null;
    }

    set SelectedComment(data: commentResponseDTO) {
        this.Comments.next(data);
    }
    get commentValue(): commentResponseDTO {
        return this.Comments.value ?? null!;
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
        console.log('Updated Issue with new comment:', next);
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
    // setUserFromLoginResponse(response: {
    //     id: string;
    //     username: string;
    //     password: string;
    //     email: string;
    //     phone?: string;
    //     role: string;
    // }): void {
    //     const user: UserInfo = {
    //         id: response.id,
    //         username: response.username,
    //         password: response.password || '',
    //         email: response.email,
    //         phone: response.phone,
    //         role: (response.role?.toUpperCase() as 'USER' | 'ADMIN') || 'USER'
    //     };
    //     this._currentUser$.next(user);
    // }

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
        // Prevent Duplicates: Check if projectId already exists
        const exists = current.some(r => r.projectId === repo.projectId);

        if (exists) {
            // If exists, update instead of adding duplicate
            this.updateRepository(repo.projectId!, repo);
        } else {
            this._repositories$.next([repo, ...current]);
        }
    }

    /** อัปเดต repository (หลัง update สำเร็จ) */
    updateRepository(projectId: string, updates: Partial<Repository>): void {
        const current = this._repositories$.getValue();
        const index = current.findIndex(r => r.projectId === projectId);
        if (index >= 0) {
            current[index] = { ...current[index], ...updates };
            this._repositories$.next([...current]);

            // Sync changes to Scans History (e.g. Project Name change)
            if (this.hasScansHistoryCache) {
                const currentScans = this.scanValue;
                const updatedScans = currentScans.map(scan => {
                    // Check ID map (sometimes scan.project has id or projectId)
                    const p = scan.project;
                    if (p && (p.id === projectId || p.projectId === projectId)) {
                        return {
                            ...scan,
                            project: { ...p, ...updates } // Sync Reponame/Type changes
                        };
                    }
                    return scan;
                });
                this.scansHistory.next(updatedScans);
            }
        }
    }

    /** ลบ repository (หลัง delete สำเร็จ) */
    removeRepository(projectId: string): void {
        const current = this._repositories$.getValue();
        this._repositories$.next(current.filter(r => r.projectId !== projectId));
        this.removeIssuesByProject(projectId); // ✅ Remove issues first
        this.removeScansByProject(projectId);
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

    // ==================== QUALITY GATES STATE ====================
    private _qualityGates$ = new BehaviorSubject<QualityGates | null>(null);
    readonly qualityGates$ = this._qualityGates$.asObservable();

    get qualityGatesValue(): QualityGates | null {
        return this._qualityGates$.getValue();
    }

    setQualityGates(gates: QualityGates): void {
        this._qualityGates$.next(gates);
    }


    // ==================== SECURITY DASHBOARD STATE  ====================
    private readonly securityIssuesSubject = new BehaviorSubject<any[]>([]);
    readonly securityIssues$ = this.securityIssuesSubject.asObservable();

    private readonly securityScoreSubject = new BehaviorSubject<number>(0);
    readonly securityScore$ = this.securityScoreSubject.asObservable();

    private readonly riskLevelSubject = new BehaviorSubject<string>('SAFE');
    readonly riskLevel$ = this.riskLevelSubject.asObservable();

    private readonly hotIssuesSubject = new BehaviorSubject<{ name: string; count: number }[]>([]);
    readonly hotIssues$ = this.hotIssuesSubject.asObservable();

    get securityIssuesValue(): any[] {
        return this.securityIssuesSubject.value;
    }

    get securityScoreValue(): number {
        return this.securityScoreSubject.value;
    }

    get riskLevelValue(): string {
        return this.riskLevelSubject.value;
    }

    get hotIssuesValue(): { name: string; count: number }[] {
        return this.hotIssuesSubject.value;
    }

    get hasSecurityIssuesCache(): boolean {
        return this.securityIssuesSubject.value.length > 0;
    }

    setSecurityIssues(issues: any[]): void {
        this.securityIssuesSubject.next(issues);
    }

    setSecurityScore(score: number): void {
        this.securityScoreSubject.next(score);
    }

    setRiskLevel(level: string): void {
        this.riskLevelSubject.next(level);
    }

    setHotIssues(issues: { name: string; count: number }[]): void {
        this.hotIssuesSubject.next(issues);
    }

    updateSecurityState(data: {
        issues?: any[];
        score?: number;
        riskLevel?: string;
        hotIssues?: { name: string; count: number }[];
    }): void {
        if (data.issues) this.securityIssuesSubject.next(data.issues);
        if (data.score !== undefined) this.securityScoreSubject.next(data.score);
        if (data.riskLevel) this.riskLevelSubject.next(data.riskLevel);
        if (data.hotIssues) this.hotIssuesSubject.next(data.hotIssues);
    }

}


