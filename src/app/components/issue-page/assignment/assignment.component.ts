import { Component, OnInit, ViewChild } from '@angular/core';
import { NgForm, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IssuemodalComponent } from '../issuemodal/issuemodal.component';
import { AssignHistory, AssignhistoryService, UpdateStatusRequest } from '../../../services/assignservice/assignhistory.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { Issue, IssueService } from '../../../services/issueservice/issue.service';

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
  const userId = this.auth.userId;
  if (!userId || !issueId) return;

  this.router.navigate(
    ['/issuedetail', issueId],
    { queryParams: { userId } }        // ✅ ส่ง userId ไปกับ URL
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

  constructor(
    private readonly router: Router,
    private readonly assignService: AssignhistoryService,
    private readonly auth: AuthService,
    private readonly issue: IssueService
  ) { }

  
  ngOnInit() {
    const userId = this.auth.userId;
    if (!userId) { this.router.navigate(['/login']); return; }
    this.loadAssignments();
  }

  // ฟังก์ชันโหลดข้อมูล assignment ทั้งหมด
  loadAssignments() {
    const userId = this.auth.userId;
    if (!userId) return;

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


  openAssignModal() {
    this.assignModal.openAddAssign();
  }

  updateStatus(assign: AssignHistory, status: string) {
    this.assignModal.openStatus(assign, status);
  }

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
  const userId = this.auth.userId;
  const { issueId, status, annotation } = update;

  if (!userId || !issueId) {
    console.error('Missing userId or issueId');
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

    switch (status.toLowerCase()) {
      case 'open':
        return 'status-open';
      case 'in progress':
      case 'in-progress':
        return 'status-in-progress';
      case 'done':
        return 'status-done';
      case 'reject':
        return 'status-reject';
      default:
        return 'status-unknown';
    }
  }
}


