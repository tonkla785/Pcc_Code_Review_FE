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

/** === เพิ่มสำหรับคอมเมนต์ === */
import { CommentService, IssueCommentModel, AddIssueCommentPayload } from '../../../services/commentservice/comment';

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

  newComment = { mention: '', comment: '' };

  /** === state คอมเมนต์ === */
  comments: IssueComment[] = [];
  loadingComments = false;
  sendingComment = false;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly issueApi: IssueService,
    private readonly repositoryService: RepositoryService,
    private readonly assignService: AssignhistoryService,
    private readonly commentService: CommentService,
    private readonly authService: AuthService,
  ) { }

  ngOnInit(): void {

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
      next: (list: IssueCommentModel[]) =>
        this.comments = (list ?? []).map((x: IssueCommentModel) => this.mapComment(x)),
      error: (e: unknown) => console.error('loadComments error:', e),
      complete: () => (this.loadingComments = false),
    });
  }


  postComment() {
    const text = (this.newComment.comment || '').trim();
    if (!text || !this.issue?.id) return;

    const userId = this.currentUserId;
    if (!userId) { this.error = 'กรุณาเข้าสู่ระบบก่อนแสดงความคิดเห็น'; return; }

    this.sendingComment = true;

    // optimistic append
    const temp: IssueComment = {
      issueId: this.issue.id,
      userId: this.currentUserName || userId,
      comment: text,
      timestamp: new Date()
    };
    this.comments = [...this.comments, temp];

    const payload: AddIssueCommentPayload = { comment: text };
    this.commentService.addIssueComment(this.issue.id, userId, payload).subscribe({
      next: (saved: IssueCommentModel) => {
        const mapped = this.mapComment(saved);
        this.comments[this.comments.length - 1] = mapped;
        this.comments = [...this.comments];
        this.newComment.comment = '';
      },
      error: (e: unknown) => {
        console.error('addComment error:', e);
        this.comments = this.comments.slice(0, -1); // rollback
      },
      complete: () => (this.sendingComment = false),
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
    if (this.issue.assignedTo) {
      this.assignModal.openEditAssign({
        issueId: this.issue.id,
        assignedTo: this.issue.assignedTo,
        dueDate: this.issue.dueDate
      });
    } else {
      this.assignModal.openAddAssign(this.issue.id);
    }
  }

  openStatusModal() {
    this.autoUpdateStatus(this.issue);
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
        console.log('Assigned successfully:', res);
      },
      error: (err: any) => console.error('Error:', err),
    });
  }

  // auto-update status ตาม logic เดิม
  autoUpdateStatus(issue: Issue) {
    let nextStatus: string;

    switch (issue.status) {
      case 'open':
        alert('กรุณา Assign ก่อนเปลี่ยนสถานะ');
        return;
      case 'pending':
        alert('กรุณายืนยัน assignment ก่อนเปลี่ยนสถานะ');
        return;
      case 'in-progress': nextStatus = 'DONE'; break;
      case 'done':
        alert('ยินดีด้วยค่ะ งานมอบหมายนี้ของคุณเสร็จสมบูรณ์เรียบร้อยแล้ว');
        return;
      default: nextStatus = issue.status;
    }

    this.assignModal.openStatus(issue, nextStatus);
    console.log('🟩 openStatus called with:', issue.status, '->', nextStatus);
  }

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
}
