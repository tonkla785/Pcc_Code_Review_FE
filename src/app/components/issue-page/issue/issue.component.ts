<<<<<<< HEAD
import { filter } from 'rxjs/operators';
=======
>>>>>>> dev
import { scan } from 'rxjs';
import { SharedDataService } from './../../../services/shared-data/shared-data.service';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { IssueService } from '../../../services/issueservice/issue.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { Repository, RepositoryService } from '../../../services/reposervice/repository.service';
import { IssuesResponseDTO } from '../../../interface/issues_interface';
import { ScanService } from '../../../services/scanservice/scan.service';

interface Issue {
  issuesId: string;
  type: string;        // 'bug' | 'security' | 'code-smell'
  severity: string;    // 'critical' | 'high' | 'medium' | 'low'
  message: string;       // from message
  details: string;     // from component
  projectName: string;     // project name or id (fallback)
  assignee: string;    // '@user' | 'Unassigned'
  status: string;      // 'open' | 'in-progress' | 'resolved' | 'closed'
  selected?: boolean;
}
interface TopIssue {
  message: string;
  count: number;
}

@Component({
  selector: 'app-issue',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './issue.component.html',
  styleUrls: ['./issue.component.css']
})
export class IssueComponent {
  topIssues: TopIssue[] = [];
  maxTop = 5;   // อยากให้โชว์กี่อันดับ

  issueId: string | null = null;
  repositories: Repository[] = [];
  filteredRepositories: Repository[] = [];
  projects: { name: string }[] = [];
  issues:Issue [] = [];
  issuesAll: IssuesResponseDTO[] = [];
  originalData: IssuesResponseDTO[] = [];
  filteredIssue: IssuesResponseDTO[] = [];
  constructor(
    private readonly router: Router,
    private readonly issueApi: IssueService,
    private readonly auth: AuthService,
    private readonly repositoryService: RepositoryService,
    private readonly sharedData: SharedDataService,
    private readonly issuesService: IssueService,
  ) { }

  ngOnInit(): void {
    this.sharedData.AllIssues$.subscribe(data => { 
       this.originalData = data || [];
       this.issuesAll = [...this.originalData];
      this.applyFilter();
    });
    if(!this.sharedData.hasIssuesCache){
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
      console.log('Issues loaded:', data);
    },
    error: () => this.sharedData.setLoading(false)
  });
}



  // ---------- Filters ----------
  filterType = 'All Types';
  filterSeverity = 'All Severity';
  filterStatus = 'All Status';
  filterProject = 'All Projects';
  searchText = '';
  selectAllCheckbox = false;

  // ---------- Pagination ----------
  currentPage = 1;
  pageSize = 5;

  get totalPages(): number {
    return Math.ceil(this.filteredIssues.length / this.pageSize) || 1;
  }

  // ---------- State ----------
  loading = false;
  errorMsg = '';

  // ดาต้าจริง (แทน mock)


  // ---------- Fetch ----------


  private buildTopIssues() {
    const counter: Record<string, number> = {};

    // นับตาม message อย่างเดียว
    for (const it of this.issues) {
      const msg = (it.message || '(no message)').trim().toLowerCase();
      counter[msg] = (counter[msg] || 0) + 1;
    }

    // แปลงเป็น array แล้ว sort
    const arr: TopIssue[] = Object.entries(counter)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count);   // มาก → น้อย

    // เก็บเฉพาะจำนวนที่อยากโชว์ป
    this.topIssues = arr.slice(0, this.maxTop);
  }

  private mapApiIssueToUi(r: import('../../../services/issueservice/issue.service').Issue): Issue {
    // type mapping: 'Bug' | 'Vulnerability' | 'Code Smell'  ->  'bug' | 'security' | 'code-smell'
    const typeMap: Record<string, string> = {
      'BUG': 'bug',
      'VULNERABILITY': 'security',
      'CODE SMELL': 'code-smell',
      'CODE_SMELL': 'code-smell'
    };
    const uiType = typeMap[(r.type || '').toUpperCase()] || (r.type || '').toLowerCase();

    // severity mapping: Blocker->critical, Critical->high, Major->medium, Minor->low
    const sevMap: Record<string, string> = {
      'BLOCKER': 'critical',
      'CRITICAL': 'high',
      'MAJOR': 'medium',
      'MINOR': 'low'
    };
    const uiSeverity = sevMap[(r.severity || '').toUpperCase()] || (r.severity || '').toLowerCase();

    // status mapping: 'Open' | 'In Progress' | 'Resolved' | 'Closed' -> 'open' | 'in-progress' | 'resolved' | 'closed'
    const st = (r.status || '').toLowerCase();
    const uiStatus =
      st.includes('open') ? 'open' :
        st.includes('in progress') ? 'in-progress' :
          st.includes('done') ? 'done' :
            st.includes('reject') ? 'reject' :
              st.includes('pending') ? 'pending' :  // <-- เพิ่มบรรทัดนี้
                'open';


    // assignee: ใช้ user_id/assignedTo ถ้ามี
    const rawAssignee = r.assignedName || '';
    const assignee = rawAssignee ? `@${rawAssignee}` : 'Unassigned';

    // project: ถ้าไม่มีชื่อให้ fallback เป็น project_id

    return {
      issuesId: r.issueId,
      type: uiType,
      severity: uiSeverity,
      message: r.message || '(no message)',
      details: r.component || '',
      projectName: r.projectName,
      assignee,
      status: uiStatus,
      selected: false
    };
  }

  // ---------- Filter / Page ----------
  filterIssues() {
    return this.issuesAll.filter(i =>
      (this.filterType === 'All Types' || i.type === this.filterType) &&
      (this.filterSeverity === 'All Severity' || i.severity === this.filterSeverity) &&
      (this.filterStatus === 'All Status' || i.status === this.filterStatus) &&
      (this.searchText === '' || i.message.toLowerCase().includes(this.searchText.toLowerCase()))
    );
  }
  applyFilter() {
    const keyword = this.searchText.trim().toLowerCase();
    const matchType = (this.filterType || 'All Types').toLowerCase();
    const matchSeverity = (this.filterSeverity || 'All Severity').toLowerCase();
    const matchStatus = (this.filterStatus || 'All Status').toLowerCase();
    const matchProject = (this.filterProject || 'All Projects').toLowerCase();

    this.filteredIssue = this.issuesAll.filter(i => {
      const type = matchType === 'all types' || (i.type || '').toLowerCase() === matchType;
      const severity = matchSeverity === 'all severity' || (i.severity || '').toLowerCase() === matchSeverity;
      const status = matchStatus === 'all status' || (i.status || '').toLowerCase() === matchStatus;
      const projectName = (i.message || i.message || '').toString().toLowerCase();
      const project = matchProject === 'all projects' || projectName === matchProject;
      const messageOk = keyword === '' || (i.message || '').toLowerCase().includes(keyword);
      return type && severity && status && project && messageOk;
    });
    this.currentPage = 1;
  }
  onSearchChange(value: string) {
  this.searchText = value;
  this.applyFilter();
}
  get filteredIssues() {
    return this.filteredIssue;
  }

  get paginatedIssues() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredIssues.slice(start, start + this.pageSize);
  }


  nextPage() {
    if (this.currentPage * this.pageSize < this.filteredIssues.length) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  // ---------- Selection ----------
  // isPageAllSelected(): boolean {
  //   return this.paginatedIssues.length > 0 && this.paginatedIssues.every(i => !!i.selected);
  // }

  // selectAll(event: any) {
  //   const checked = event.target.checked;
  //   this.paginatedIssues.forEach(i => i.selected = checked);
  // }

  // selectedCount() {
  //   return this.issuesAll.filter(i => i.selected).length;
  // }

  // ---------    //   const selectedIssues = this.issues.filter(i => i.selected);
    //   if (!selectedIssues.length) { alert('กรุณาเลือก Issue ก่อน'); return; }

    //   const developers = ['userA', 'userB', 'userC']; // สมมุติ user_id; ถ้ามี list จริงให้แทนที่
    //   const dev = prompt('เลือก Developer (พิมพ์ user id): ' + developers.join(', '));
    //   if (!dev || !developers.includes(dev)) { alert('Developer ไม่ถูกต้อง'); return; }

    //   // call API แบบทีละรายการ (คงโครงเดิมให้เบา ๆ)
    //   let ok = 0;
    //   selectedIssues.forEach(row => {
    //     this.issueApi.assignDeveloper(row.issuesId, dev).subscribe({
    //       next: () => {
    //         row.assignee = `@${dev}`;
    //         ok++;
    //       },
    //       error: (e) => console.error('assign failed', e)
    //     });
    //   });

    //   alert(`Sent assign requests for ${selectedIssues.length} issue(s).`); // แจ้งแบบง่าย ๆ- Actions (ยังคงเค้าโครงเดิม) ----------
  assignDeveloper() {

  }

  changeStatus() {
    // const selectedIssues = this.issues.filter(i => i.selected);
    // if (!selectedIssues.length) { alert('กรุณาเลือก Issue ก่อน'); return; }

    // const statusSteps = ['open', 'in-progress', 'resolved', 'closed'];
    // selectedIssues.forEach(row => {
    //   const idx = statusSteps.indexOf(row.status);
    //   const next = statusSteps[Math.min(idx + 1, statusSteps.length - 1)];
    //   // แปลงกลับเป็นรูปแบบ API
    //   const apiStatus =
    //     next === 'in-progress' ? 'In Progress' :
    //     next === 'resolved'    ? 'Resolved' :
    //     next === 'closed'      ? 'Closed' : 'Open';

    //   this.issueApi.updateStatus(row.issuesId, apiStatus as any).subscribe({
    //     next: () => row.status = next,
    //     error: (e) => console.error('update status failed', e)
    //   });
    // });

    // alert(`Requested status change for ${selectedIssues.length} issue(s).`);
  }

  exportData() {
    const selectedIssues = this.issues.filter(i => i.selected);
    const exportIssues = selectedIssues.length ? selectedIssues : this.issues;

    const datenow = new Date();
    const dateStr = datenow.toISOString().split('T')[0].replaceAll('-', '');
    const fileType = selectedIssues.length ? 'selected' : 'all';
    const fileName = `issues_${fileType}_${dateStr}.csv`;

    const csvContent = [
      ['No.', 'Title', 'Severity', 'Status', 'Assignee'].join(','),
      ...exportIssues.map((i, idx) => [
        idx + 1,
        `"${i.message.replaceAll('"', '""')}"`,
        i.severity,
        i.status,
        i.assignee || '-'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    window.URL.revokeObjectURL(url);
  }

  clearFilters() {
    this.filterType = 'All Types';
    this.filterSeverity = 'All Severity';
    this.filterStatus = 'All Status';
    this.filterProject = 'All Projects';
    this.searchText = '';
    this.currentPage = 1;
    this.selectAllCheckbox = false;
    this.issues.forEach(i => i.selected = false);
    this.applyFilter();
  }

  // ---------- Helpers (โครงเดิม) ----------
  typeIcon(type: string) {
    switch (type.toLowerCase()) {
      case 'bug': return 'bi-bug';
      case 'security': return 'bi-shield-lock';
      case 'code-smell': return 'bi-code-slash';
      default: return '';
    }
  }

  severityClass(severity: string) {
    switch (severity.toLowerCase()) {
      case 'critical':
      case 'high': return 'text-danger';
      case 'medium': return 'text-warning';
      case 'low': return 'text-success';
      default: return '';
    }
  }

  statusClass(status: string) {
    switch (status.toLowerCase()) {
      case 'open': return 'text-danger';
      case 'in-progress': return 'text-warning';
      case 'done': return 'text-success';
      case 'reject': return 'text-secondary';
      case 'pending': return 'text-info';  // <-- เพิ่ม pending
      default: return '';
    }
  }
  viewResult(issue : IssuesResponseDTO) {
  this.sharedData.SelectedIssues = issue;   
  this.router.navigate(['/issuedetail', issue.id]);
}

}
