import { Component, inject, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IssuemodalComponent } from '../issuemodal/issuemodal.component';
import { IssueService, Issue as ApiIssue } from '../../../services/issueservice/issue.service';
import { filter, map } from 'rxjs/operators';
import { AuthService } from '../../../services/authservice/auth.service';
import { RepositoryService } from '../../../services/reposervice/repository.service';
import { AssignhistoryService } from '../../../services/assignservice/assignhistory.service';
import { LoginUser, UserInfo } from '../../../interface/user_interface';
import { TokenStorageService } from '../../../services/tokenstorageService/token-storage.service';
import { UserService } from '../../../services/userservice/user.service';
import { WebSocketService } from '../../../services/websocket/websocket.service';
import { Subscription } from 'rxjs';
/** === เพิ่มสำหรับคอมเมนต์ === */
import { CommentService, IssueCommentModel, AddIssueCommentPayload } from '../../../services/commentservice/comment.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { IssuesDetailResponseDTO, IssuesRequestDTO, IssuesResponseDTO } from '../../../interface/issues_interface';
import { commentRequestDTO, commentResponseDTO } from '../../../interface/comment_interface';
type SortOrder = 'ASC' | 'DESC';
interface Attachment { filename: string; url: string; }
interface IssueComment {
  issueId: string; userId: string; comment: string; timestamp: Date | string;
  attachments?: Attachment[]; mentions?: string[];
}
interface Issue {
  id: string;
  type: string;
  title: string;
  severity: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'open' | 'in-progress' | 'done' | 'reject' | 'pending';
  project: string; file: string; line: number; created: string;
  assignedTo?: string; dueDate: string; description: string;
  assignedName?: string;
  vulnerableCode: string; recommendedFix: string; comments: IssueComment[];
}

interface StatusUpdate {
  id: string;                  // Issue ID
  status: Issue['status'];     // New status
  annotation?: string;         // Optional remark
}

const isUUID = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

@Component({
  selector: 'app-issuedetail',
  standalone: true,
  imports: [CommonModule, FormsModule, IssuemodalComponent],
  templateUrl: './issuedetail.component.html',
  styleUrl: './issuedetail.component.css',
})
export class IssuedetailComponent implements OnInit {

  @ViewChild(IssuemodalComponent) assignModal!: IssuemodalComponent;

  trackByComment = (_: number, c: any) => c?.id || c?.timestamp || _;

  // FE options (เดิม)
  priorityLevels: Array<'Low' | 'Medium' | 'High' | 'Critical'> = ['Low', 'Medium', 'High', 'Critical'];

  loading = true;
  error: string | null = null;
  issue!: Issue;
  nextStatus: Issue['status'] | undefined;
  private readonly auth = inject(AuthService);

  currentUserId = '';
  currentUserName = '';

  newComment: commentRequestDTO = { comment: '' };

  /** === state คอมเมนต์ === */
  comments: IssueComment[] = [];
  loadingComments = false;
  sendingComment = false;
  issuesResult: IssuesResponseDTO | null = null;
  issueForModal: IssuesRequestDTO = { id: '', status: '', assignedTo: '' };
  UserLogin: LoginUser | null = null;
  UserData: UserInfo[] = [];
  filteredUsers: UserInfo[] = [];
  issuesDetails: IssuesDetailResponseDTO | null = null;
  rootComments: commentResponseDTO[] = [];
  replies = new Map<string, commentResponseDTO[]>();
  replyTo: { commentId: string; username: string, parentCommentId: string } | null = null;
  sortedComments: commentResponseDTO[] = [];
  selectedScans: any[] = [];
  showMock = false;
  isAiLoading = false;

  mockRecommendedFix = `
This is a MOCK recommendation provided for demonstration and testing purposes only.
Recommended Fix (Mock Version):
1. Analyze the root cause of the issue by reviewing recent code changes, configuration updates, and deployment logs. Pay special attention to any modifications that were introduced shortly before the issue started occurring
2. Verify that all required dependencies, services, and environment variables are correctly configured and available at runtime. Missing or misconfigured dependencies can often lead to unexpected failures.
3. If the issue is related to a specific feature or module, consider temporarily disabling that feature to isolate the problem. This can help determine if the issue is caused by recent changes in that area.
Note:
This mock content is intentionally verbose and does not represent an actual production fix. It is intended solely for UI testing, layout validation, and feature demonstration.
`;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly issueApi: IssueService,
    private readonly repositoryService: RepositoryService,
    private readonly assignService: AssignhistoryService,
    private readonly commentService: CommentService,
    private readonly authService: AuthService,
    private readonly sharedData: SharedDataService,
    private readonly issesService: IssueService,
    private readonly tokenStorage: TokenStorageService,
    private readonly userDataService: UserService,
    private readonly ws: WebSocketService
  ) { }

  ngOnInit(): void {
    this.sharedData.AllUser$.subscribe(data => {
      this.UserData = data ?? [];
      // this.applyFilter();
      console.log('User loaded Modal from sharedData in issuedetail:', data);
    });
    if (!this.sharedData.hasUserCache) {
      this.loadUser();
      console.log("No cache - load from server");
    }
    this.route.paramMap.subscribe(pm => {
      const id = pm.get('issuesId');
      if (!id) return;

      console.log('issuesId from route:', id);
      const cached = this.sharedData.selectIssueValue;
      const isSame = cached?.id === id;

      if (!isSame) {
        this.loadIssueDetails(id);
        this.loadIssueById(id);
        console.log('Same')
      } else {
        this.issuesResult = cached;
        this.issuesDetails = this.sharedData.selectIssueDetailValue;
        this.applyUserFilter();
        this.sortedComments = this.sortComments(this.issuesResult?.commentData ?? [], 'ASC');
        console.log("Not Same")
      }
    });

    this.sharedData.selectedIssues$.subscribe(data => {
      this.issuesResult = data;
      console.log('Issues Detail from sharedData:', this.issuesResult);
      this.replycomment(this.issuesResult?.commentData ?? []); // Update rootComments for empty state check
      this.applyUserFilter();
      this.sortedComments = this.sortComments(this.issuesResult?.commentData ?? [], 'ASC');
    });

    const user = this.tokenStorage.getLoginUser();
    if (user) {
      this.sharedData.LoginUserShared = user;
    }
    this.sharedData.LoginUser$.subscribe(data => {
      this.UserLogin = data;
      console.log('User Login in Issues:', this.UserLogin);

    });

    // Subscribe to Real-time Comments
    this.route.paramMap.subscribe(pm => {
      const id = pm.get('issuesId');
      if (id) {
        this.subscribeToRealtimeComments(id);
      }
    });
  }

  private commentSub?: Subscription;

  subscribeToRealtimeComments(issueId: string) {
    // Unsubscribe previous if exists
    if (this.commentSub) {
      this.commentSub.unsubscribe();
    }

    const topicId = issueId.toLowerCase();
    console.log('[Issuedetail] Subscribing to comments for:', topicId);

    this.commentSub = this.ws.subscribeToIssueComments(topicId).subscribe({
      next: (comment: any) => {
        console.log('Real-time comment received:', comment);
        // Add to SharedData to update UI
        this.sharedData.addComments(comment);
      },
      error: (err: any) => console.error('WS comment error:', err)
    });
  }

  ngOnDestroy() {
    if (this.commentSub) {
      this.commentSub.unsubscribe();
    }
  }

  loadIssueById(issueId: string) {
    this.sharedData.setLoading(true);
    this.issesService.getAllIssuesById(issueId).subscribe({
      next: (data) => {
        this.sharedData.SelectedIssues = data;
        this.sharedData.setLoading(false);
        this.replycomment(this.issuesResult?.commentData ?? []);
        console.log('IssuesById loaded:', data);
        this.applyUserFilter();
      },
      error: () => this.sharedData.setLoading(false)
    });
  }
  loadIssueDetails(issueId: string) {
    this.issesService.getAllIssuesDetails(issueId).subscribe({
      next: (data) => {
        this.sharedData.SelectedIssueDetail = data;
        this.sharedData.setLoading(false);
        this.issuesDetails = data;
        console.log('Issues Detail loaded:', data);
        this.applyUserFilter();
      },
      error: () => this.sharedData.setLoading(false)
    });
  }

  loadUser() {
    this.sharedData.setLoading(true);
    this.userDataService.getUser().subscribe({
      next: (data) => {
        this.sharedData.UserShared = data;
        this.sharedData.setLoading(false);
        console.log('User loaded Modal:', data);
      },
      error: () => this.sharedData.setLoading(false)
    });
  }
  applyUserFilter() {
    if (!this.issuesResult || !this.UserData.length) {
      return;
    }
    this.filteredUsers = this.UserData.filter(u =>
      this.issuesResult?.commentData?.some(c => c.user.id === u.id)
    );

    console.log('Filtered Users:', this.filteredUsers);
  }
  sortComments(list: commentResponseDTO[], order: string) {
    // 1. Deduplicate by ID to ensure UI never doubless
    const uniqueMap = new Map<string, commentResponseDTO>();
    (list ?? []).forEach(c => {
      const id = String(c.id).toLowerCase();
      if (!uniqueMap.has(id)) {
        uniqueMap.set(id, c);
      }
    });

    // 2. Sort
    return Array.from(uniqueMap.values()).sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return order === 'ASC'
        ? timeA - timeB
        : timeB - timeA;
    });
  }


  toggleMock() {
    this.isAiLoading = true;
    setTimeout(() => {
      this.isAiLoading = false;
      this.showMock = true;
    }, 3000);
  }

  /* ===================== Mapper (BE -> FE) ===================== */
  private toIssue(r: ApiIssue): Issue {
    console.log('Raw API issue:', r);
    return {
      id: (r as any).id ?? r.issueId ?? '',
      type: (r as any).type ?? 'Issue',
      title: (r as any).title ?? (r as any).message ?? '(no title)',
      severity: r.severity ?? 'Major',
      priority: 'Medium',
      status: this.mapStatusBeToFe(r.status),
      project: r.projectName ?? '',
      file: r.component ?? '',
      line: 0, // ถ้า BE มี lineNumber ให้แทนด้วย Number(r.lineNumber)
      created: (r.createdAt as any) ?? '',
      assignedTo: r.assignedTo ?? '',
      dueDate: r.dueDate ? new Date(r.dueDate).toISOString() : '',
      assignedName: r.assignedName ?? '',
      description: (r as any).description ?? '',
      vulnerableCode: (r as any).vulnerableCode ?? '',
      recommendedFix: (r as any).recommendedFix ?? '',
      comments: []
    };
  }

  private mapStatusBeToFe(s: ApiIssue['status'] | undefined): Issue['status'] {
    if (!s) return 'open';
    const clean = s.toString().trim().toUpperCase();
    switch (clean) {
      case 'OPEN': return 'open';
      case 'PENDING': return 'pending';
      case 'IN PROGRESS': return 'in-progress';
      case 'DONE': return 'done';
      case 'REJECT': return 'reject';
      default: return 'open';
    }
  }

  private mapStatusFeToBe(s: Issue['status']): ApiIssue['status'] {
    switch (s) {
      case 'open': return 'OPEN';
      case 'pending': return 'PENDING';
      case 'in-progress': return 'IN PROGRESS';
      case 'done': return 'DONE';
      case 'reject': return 'REJECT';
      default: return 'OPEN';
    }
  }

  /* ===================== Comments ===================== */
  private mapComment(r: IssueCommentModel): IssueComment {
    return {
      issueId: r.issueId,
      userId: r.username || r.userId,
      comment: r.comment,
      timestamp: r.createdAt,
    };
  }


  loadComments() {
    if (!this.issue?.id) return;
    this.loadingComments = true;
    this.commentService.getIssueComments(this.issue.id).subscribe({
      next: (list: IssueCommentModel[]) => {
        this.comments = (list ?? []).map((x: IssueCommentModel) => this.mapComment(x));
      },
      error: (e: unknown) => console.error('loadComments error:', e),
      complete: () => (this.loadingComments = false),
    });
  }


  postComment() {
    const text = (this.newComment?.comment ?? '').trim();
    if (!text || this.sendingComment) return;

    const payload: commentRequestDTO = {
      issueId: this.issuesResult?.id,
      userId: this.UserLogin?.id || '',
      comment: text,
      parentCommentId: this.replyTo?.commentId || ''
    };

    this.sendingComment = true;

    this.commentService.updateComments(payload).subscribe({
      next: (updated) => {
        this.sharedData.addComments(updated);
        this.newComment = { comment: '' };
        this.replyTo = null;
        this.sendingComment = false;
      },
      error: (err) => {
        this.sendingComment = false;
        console.error('Update comment failed:', err);
        console.error('Payload was:', payload);
      }
    });
  }


  onCommentKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.postComment();
    }
  }

  /* ===================== UI actions (เดิม) ===================== */
  goBack() { window.history.back(); }

  showAssignModal = false;
  showStatusModal = false;

  openAssignModal() {
    if (this.issuesResult?.assignedTo) {
      this.assignModal.openEditAssign({
        id: this.issuesResult.id,
        status: this.issuesResult.status,
        assignedTo: this.issuesResult.assignedTo?.id || '',
      });
    } else {
      const issueId = this.issuesResult
      if (!issueId) return;
      this.assignModal.openAddAssign(issueId);
    }
  }
  openStatusModal() {
    if (!this.issuesResult) return;
    this.assignModal.openEditStatus({
      id: this.issuesResult.id,
      status: this.issuesResult.status,
      assignedTo: this.issuesResult.assignedTo?.id || '',
    });
  }


  closeModal() {
    this.showAssignModal = false;
    this.showStatusModal = false;
  }

  handleAssignSubmit(event: { issue: Partial<Issue>, isEdit: boolean }) {
    const updated = event.issue;
    if (updated.assignedTo) this.issue.assignedTo = updated.assignedTo;
    if (updated.dueDate) this.issue.dueDate = updated.dueDate;
    this.assignModal.close();

    this.assignService.addassign(
      this.issue.id,
      this.issue.assignedTo ?? '',
      this.issue.dueDate
    ).subscribe({
      next: (res: any) => {
        this.sharedData.updateIssueSelect(res);
        console.log('Assigned successfully:', res);
      },
      error: (err: any) => console.error('Error:', err),
    });
  }

  // auto-update status ตาม logic เดิม
  // autoUpdateStatus(issue: Issue) {
  //   let nextStatus: string;

  //   switch (issue.status) {
  //     case 'open':
  //       alert('กรุณา Assign ก่อนเปลี่ยนสถานะ');
  //       return;
  //     case 'pending':
  //       alert('กรุณายืนยัน assignment ก่อนเปลี่ยนสถานะ');
  //       return;
  //     case 'in-progress': nextStatus = 'DONE'; break;
  //     case 'done':
  //       alert('ยินดีด้วยค่ะ งานมอบหมายนี้ของคุณเสร็จสมบูรณ์เรียบร้อยแล้ว');
  //       return;
  //     default: nextStatus = issue.status;
  //   }

  //   this.assignModal.openStatus(issue, nextStatus);
  //   console.log('🟩 openStatus called with:', issue.status, '->', nextStatus);
  // }

  handleStatusSubmit(updated: { id?: string, issueId?: string, status: Issue['status'], annotation?: string }) {
    const issueId = updated.id || updated.issueId;
    if (!updated.status || !issueId) return;

    const prevStatus = this.issue.status;

    if (!this.auth.isLoggedIn) {
      console.error('User not logged in');
      return;
    }

    const body: any = {
      status: this.mapStatusFeToBe(updated.status),
      annotation: updated.annotation || ''
    };

    if (this.issue.assignedTo) body.assignedTo = this.issue.assignedTo;
    if (this.issue.dueDate) body.dueDate = this.issue.dueDate;

    this.assignService.updateStatus('', issueId, body).subscribe({
      next: (res: any) => {
        this.issue = {
          ...this.issue,
          status: res.status ? this.mapStatusBeToFe(res.status) : updated.status,
          assignedTo: res.assignedTo ?? this.issue.assignedTo,
          dueDate: res.dueDate ?? this.issue.dueDate
        };
        console.log('Status updated successfully:', this.issue.status);
        this.assignModal.close();
      },
      error: (err: any) => {
        console.error('Error updating status:', err);
        this.issue = { ...this.issue, status: prevStatus }; // rollback
      }
    });
  }
  startReply(c: commentResponseDTO) {
    if (c.user?.id === this.UserLogin?.id) {
      return;
    } else {
      this.replyTo = { commentId: c.id, username: c.user?.username, parentCommentId: c.parentCommentId || '' };
      this.newComment = { comment: `@${this.replyTo?.username} `, parentCommentId: this.replyTo.commentId };
      console.log('Replying to comment:', this.replyTo);
    }
  }
  cancelReply() {
    this.replyTo = null;
    this.newComment = { comment: '' };
  }
  private replycomment(comments: commentResponseDTO[]) {
    this.rootComments = [];
    this.replies.clear();

    const list = comments ?? [];

    // เรียงตามเวลา 
    const sorted = [...list].sort((a, b) =>
      new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
    );

    for (const c of sorted) {
      const parentId = (c as commentResponseDTO).parentCommentId || null;

      if (!parentId) {
        this.rootComments.push(c);
      } else {
        const arr = this.replies.get(parentId) ?? [];
        arr.push(c);
        this.replies.set(parentId, arr);
      }
    }
  }

}
