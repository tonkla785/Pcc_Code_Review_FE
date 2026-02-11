
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { Issue, IssueService } from '../../../services/issueservice/issue.service';
import { User, UserService } from '../../../services/userservice/user.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { UserInfo } from '../../../interface/user_interface';
import { IssuesRequestDTO, IssuesResponseDTO } from '../../../interface/issues_interface';



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
    private readonly router: Router,
    private readonly sharedData: SharedDataService,
    private readonly userDataService: UserService,
    private readonly issuesService: IssueService
  ) { }

  showAssign = false;
  showStatus = false;
  isEdit = false;
  today: string = '';
  currentAssigneeId: string | null = null;
  UserData: UserInfo[] = [];
    editingUser: boolean = false;
  issueDraft: IssuesRequestDTO = { id: '', status: '', assignedTo: '' }; // ตัวที่ใช้ใน modal

  // @Input() showAssign = false;
  // @Input() showStatus = false;
  @Input() users: User[] = [];
  @Input({ required: true }) issue!: IssuesRequestDTO;

  @Output() assignSubmit = new EventEmitter<any>();
  @Output() statusSubmit = new EventEmitter<any>();
  @Output() closed = new EventEmitter<void>();



 ngOnInit(){
       this.sharedData.AllUser$.subscribe(data => { 
        this.UserData = data ?? [];
        // this.applyFilter();
        console.log('User loaded Modal from sharedData:', data);
      });
       if(!this.sharedData.hasUserCache){
      this.loadUser();
      console.log("No cache - load from server");
    }

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
  
onSubmitUser() {
  const payload: IssuesRequestDTO = {
    id: this.issueDraft.id,
    status: this.issueDraft.status,   
    assignedTo: this.issueDraft.assignedTo 
  };

  console.log('Submitting issue assignment payload:', payload);

  this.issuesService.updateIssues(payload).subscribe({
    next: (updated) => {
      this.sharedData.updateIssueSelect(updated);
      this.closeModal();
      console.log('Issue updated:', updated);
    },
    error: (err) => {
      console.error('Update issue failed:', err);
      console.error('Payload was:', payload);
    }
  });
}
      closeModal() {
    this.showAssign = false;
    this.showStatus = false;
    this.closed.emit();
  }

  /** เปิด modal สำหรับเพิ่ม assign */
  openAddAssign(issueId: string) {
    this.isEdit = false;
    this.issueDraft = {
      id: issueId,
      status: 'IN_PROGRESS',
      assignedTo: ''
    };
    this.showAssign = true;
  }


  /** เปิด modal สำหรับแก้ไข assign */
  openEditAssign(existingIssue: IssuesRequestDTO) {
    this.isEdit = true;
    this.issueDraft = { ...existingIssue };
    //this.currentAssigneeId = existingIssue.assignedTo ?? null;
    this.showAssign = true;
  }

  openEditStatus(issues : any) {
    this.issueDraft = { ...issues}; // ตั้งค่าจาก parent
    this.showStatus = true;
    console.log('Open status modal for issue:', this.issueDraft);
  }



  close() {
    this.showAssign = false;
    this.showStatus = false;
    this.closed.emit();
  }


  submitAssign(form: NgForm) {
    if (form.invalid) return; // เช็คก่อน
    this.assignSubmit.emit({ issue: this.issueDraft, isEdit: this.isEdit });
    console.log(this.isEdit ? 'Change assign:' : 'Add assign:', this.issueDraft);
    this.close();
  }



  // submitStatus(form: NgForm) {
  //   if (form.invalid) return;

  //   if (this.issue.status === 'REJECT' && !this.issue.annotation) return;

  //   const payload: any = {
  //     issueId: this.issue.issueId,
  //     status: this.issue.status
  //   };

  //   if (this.issue.annotation) {
  //     payload.annotation = this.issue.annotation;
  //   }

  //   this.statusSubmit.emit(payload);
  //   this.close();
  // }
}
