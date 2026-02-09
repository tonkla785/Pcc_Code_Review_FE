import { Component, OnInit, ViewChild } from '@angular/core';
import { NgForm, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IssuemodalComponent } from '../issuemodal/issuemodal.component';
import { AssignHistory, AssignhistoryService, UpdateStatusRequest } from '../../../services/assignservice/assignhistory.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { Issue, IssueService } from '../../../services/issueservice/issue.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { IssuesResponseDTO } from '../../../interface/issues_interface';
import { TokenStorageService } from '../../../services/tokenstorageService/token-storage.service';

interface StatusUpdate {
  issueId: string;
  status: string;
  annotation?: string;
}


@Component({
  selector: 'app-assignment',
  standalone: true,
  imports: [CommonModule, FormsModule, IssuemodalComponent],
  templateUrl: './assignment.component.html',
  styleUrl: './assignment.component.css'
})
export class AssignmentComponent implements OnInit {
  @ViewChild(IssuemodalComponent) assignModal!: IssuemodalComponent;

  goToDetail(issueId: string) {
    if (!this.auth.isLoggedIn || !issueId) return;
    this.router.navigate(
      ['/issuedetail', issueId],
      { queryParams: {} }     
    );
  }
  // ปุ่มย้อนกลับ
  goBack(): void {
    window.history.back();
  }

  Assign: AssignHistory[] = [];
  showStatus = false; // สำหรับ modal status
  currentIssue: AssignHistory | null = null; // แทน issue สำหรับ modal
  remark = '';
  issues: Issue[] = [];
  issuesAll: IssuesResponseDTO[] = [];
  originalData: IssuesResponseDTO[] = [];
  constructor(
    private readonly router: Router,
    private readonly assignService: AssignhistoryService,
    private readonly auth: AuthService,
    private readonly issue: IssueService,
    private readonly issuesService: IssueService,
    private readonly sharedData: SharedDataService,
    private readonly tokenStorage: TokenStorageService,
  ) { }


  ngOnInit(): void {
    const user = this.tokenStorage.getLoginUser();
    if (user) {
      this.sharedData.LoginUserShared = user;
      console.log('Assignment Component - Loaded user from token:', user);
    }
    this.sharedData.AllIssues$.subscribe(data => {
      const all = data ?? [];
      this.originalData = all.filter(issue => issue.assignedTo?.id === user?.id);
      this.issuesAll = [...this.originalData];
      console.log('Issues loaded Assignment from sharedData:', this.issuesAll);
    });
    if (!this.sharedData.hasIssuesCache) {
      console.log("No cache - load from server");
      this.loadIssues();
    }

  }

  loadIssues() {
    this.sharedData.setLoading(true);
    this.issuesService.getAllIssues().subscribe({
      next: (data) => {
        this.sharedData.IssuesShared = data;
        this.sharedData.setLoading(false);
        console.log('Issues loaded:', this.sharedData.IssuesShared);
      },
      error: () => this.sharedData.setLoading(false)
    });
  }

  // ฟังก์ชันโหลดข้อมูล assignment ทั้งหมด
  loadAssignments() {
    if (!this.auth.isLoggedIn) return;
    // TODO: Get userId from token when available
    const userId = this.tokenStorage.getLoginUser()?.id ?? '';

    this.assignService.getAllAssign(userId).subscribe({
      next: (data: any[]) => {
        // แปลง field และ date ให้ตรงกับ interface
        this.Assign = data.map(item => ({
          userId: item.user_id || item.userId,
          assignedTo: item.assigned_to || item.assignedTo,
          assignedToName: item.assigned_to_name || item.assignedToName,
          issueId: item.issue_id || item.issueId,
          severity: item.severity,
          message: item.message,
          status: item.status,
          dueDate: item.dueDate,
          annotation: item.annotation,
          own: item.own
        }));
      },
      error: (err) => console.error('Error fetching assignments:', err)
    });
  }


  // openAssignModal() {
  //   this.assignModal.openAddAssign();
  // }

  // updateStatus(assign: AssignHistory, status: string) {
  //   this.assignModal.openStatus(assign, status);
  // }

  // ส่ง assignment ไป backend
  handleAssignSubmit(data: { issue: Partial<Issue>, isEdit: boolean }) {
    if (!data.issue.issueId || !data.issue.assignedTo || !data.issue.dueDate) return;

    const issueId = data.issue.issueId;
    const assignedTo = data.issue.assignedTo;
    const dueDate = data.issue.dueDate; // string 'YYYY-MM-DD'

    this.assignService.addassign(issueId, assignedTo, dueDate).subscribe({
      next: (res) => {
        console.log('Assigned successfully:', res);
        this.loadAssignments();
      },
      error: (err) => console.error('Error:', err),
    });
  }


  // ส่ง status update ไป backend
  handleStatusSubmit(update: StatusUpdate) {
    // TODO: Get userId from token when available
    const userId = this.tokenStorage.getLoginUser()?.id ?? '';
    const { issueId, status, annotation } = update;

    if (!this.auth.isLoggedIn || !issueId) {
      console.error('User not logged in or missing issueId');
      return;
    }

    const body: any = { status };
    if (status !== 'IN PROGRESS' && annotation) {
      body.annotation = annotation;
    }

    this.assignService.updateStatus(userId, issueId, body).subscribe({
      next: () => {
        console.log('Status updated successfully');

        this.assignModal.close();

        const idx = this.Assign.findIndex(a => a.issueId === issueId);
        if (idx >= 0) {
          this.Assign[idx].status = status === 'ACCEPT' ? 'IN PROGRESS' : status;

        }


      },
      error: (err) => console.error('Error updating status:', err),
    });
  }


  get hasActionColumn(): boolean {
    return this.Assign.some(a => a.status === 'PENDING' || a.status === 'IN PROGRESS');
  }



  getPriorityColor(severity: string): string {
    switch (severity.trim().toUpperCase()) {
      case 'MINOR':
        return '#FBC02D';
      case 'MAJOR':
        return '#FF9800';
      case 'CRITICAL':
        return '#E64A19';
      case 'BLOCKER':
        return '#C62828';
      default:
        return '#757575';
    }
  }
  statusClass(status: string) {
    if (!status) return '';

    const normalized = status.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

    // Check various formats
    if (normalized === 'open') return 'status-open';
    if (normalized === 'in progress' || normalized === 'inprogress') return 'status-in-progress';
    if (normalized === 'resolved' || normalized === 'done') return 'status-done';
    if (normalized === 'closed') return 'status-reject';

    return 'status-unknown';
  }

  formatStatus(status: string): string {
    if (!status) return '';

    // Normalize string: remove underscores, double spaces
    const clean = status.replace(/_/g, ' ').toUpperCase();

    if (clean === 'IN PROGRESS' || clean === 'INPROGRESS') return 'In Progress';
    if (clean === 'OPEN') return 'Open';
    if (clean === 'RESOLVED' || clean === 'DONE') return 'Resolved';
    if (clean === 'CLOSED') return 'Closed';

    return status;
  }
}


