import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { Issue } from '../../../services/issueservice/issue.service';
import { User, UserService } from '../../../services/userservice/user.service';
import { AuthService } from '../../../services/authservice/auth.service';



@Component({
  selector: 'app-issuemodal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './issuemodal.component.html',
  styleUrl: './issuemodal.component.css'
})
export class IssuemodalComponent {
  constructor(private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) { }

  showAssign = false;
  showStatus = false;
  isEdit = false;
  today: string = '';
  currentAssigneeId: string | null = null;

  // @Input() showAssign = false;
  // @Input() showStatus = false;
  @Input() users: User[] = [];
  @Input() issue: Partial<Issue> = {
    issueId: '',
    assignedTo: '',
    dueDate: '',
  };

  @Output() assignSubmit = new EventEmitter<any>();
  @Output() statusSubmit = new EventEmitter<any>();
  @Output() closed = new EventEmitter<void>();



  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadUsers();

    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    this.today = `${now.getFullYear()}-${month}-${day}`;
  }

  loadUsers() {
    this.userService.getAllUser().subscribe({
      next: (data) => {
        console.log(data);
        this.users = data;
      },
      error: (err) => {
        console.error('Error loading users:', err);
      }
    });
  }

  /** เปิด modal สำหรับเพิ่ม assign */
  openAddAssign(existingIssueId?: string) {
    this.isEdit = false;
    this.issue = {
      issueId: existingIssueId ?? '',  // ถ้ามี issueId ให้ใช้
      assignedTo: '',
      dueDate: ''
    };
    this.showAssign = true;
  }


  /** เปิด modal สำหรับแก้ไข assign */
  openEditAssign(existingIssue: Partial<Issue>) {
    this.isEdit = true;
    this.issue = { ...existingIssue };
    //this.currentAssigneeId = existingIssue.assignedTo ?? null;
    this.showAssign = true;
  }

  openStatus(assign: any, status: string) {
    this.isEdit = true;
    this.issue = { ...assign, status }; // ตั้งค่าจาก parent
    this.showStatus = true;
  }



  close() {
    this.showAssign = false;
    this.showStatus = false;
    this.closed.emit();
  }


  submitAssign(form: NgForm) {
    if (form.invalid) return; // เช็คก่อน
    this.assignSubmit.emit({ issue: this.issue, isEdit: this.isEdit });
    console.log(this.isEdit ? 'Change assign:' : 'Add assign:', this.issue);
    this.close();
  }



  submitStatus(form: NgForm) {
    if (form.invalid) return;

    if (this.issue.status === 'REJECT' && !this.issue.annotation) return;

    const payload: any = {
      issueId: this.issue.issueId,
      status: this.issue.status
    };

    if (this.issue.annotation) {
      payload.annotation = this.issue.annotation;
    }

    this.statusSubmit.emit(payload);
    this.close();
  }




}
