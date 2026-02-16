import { filter } from 'rxjs/operators';
import { scan } from 'rxjs';
import { SharedDataService } from './../../../services/shared-data/shared-data.service';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router,ActivatedRoute } from '@angular/router';
import { IssueService } from '../../../services/issueservice/issue.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { Repository, RepositoryService } from '../../../services/reposervice/repository.service';
import { IssuesRequestDTO, IssuesResponseDTO } from '../../../interface/issues_interface';
import { ScanService } from '../../../services/scanservice/scan.service';
import { forkJoin } from 'rxjs';
import { User, UserService } from '../../../services/userservice/user.service';
import { UserInfo } from '../../../interface/user_interface';
import Swal from 'sweetalert2';
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
  issues: Issue[] = [];
  issuesAll: IssuesResponseDTO[] = [];
  originalData: IssuesResponseDTO[] = [];
  filteredIssue: IssuesResponseDTO[] = [];
  selectedIssues: IssuesResponseDTO[] = [];
  selectedIdsForAssign: string[] = [];
  paginatedIssues: IssuesResponseDTO[] = []
  issueDraft: IssuesRequestDTO = { id: '', status: 'OPEN', assignedTo: '' };
  showAssignModal = false;
  savingAssign = false;
  UserData: UserInfo[] = [];
  constructor(
    private readonly router: Router,
    private readonly issueApi: IssueService,
    private readonly auth: AuthService,
    private readonly repositoryService: RepositoryService,
    private readonly sharedData: SharedDataService,
    private readonly issuesService: IssueService,
    private readonly userDataService: UserService,
    private readonly repoService: RepositoryService,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    if (!this.sharedData.hasUserCache) {
      this.loadUser();
      console.log("No cache - load from server");
    }
    this.sharedData.AllUser$.subscribe(data => {
      this.UserData = data ?? [];
      // this.applyFilter();
      console.log('User loaded Modal from sharedData:', data);
    });
    if (!this.sharedData.hasIssuesCache) {
      this.loadIssues();
      console.log("No cache - load from server");
    }
    this.sharedData.AllIssues$.subscribe(data => {
      this.originalData = data || [];
      this.issuesAll = [...this.originalData];
      this.applyFilter();
    });
    if (!this.sharedData.hasRepositoriesCache) {
      this.loadRepositories();
      console.log("No cache - load from server");
    }
    this.sharedData.repositories$.subscribe((repos) => {
      this.repositories = repos;
      console.log('Repositories loaded from sharedData:', this.repositories);
    });
    this.route.queryParams.subscribe(params => {
        this.currentPage = +params['page'] || 1;
      })
  }

  loadIssues() {
    this.sharedData.setLoading(true);
    this.issuesService.getAllIssues().subscribe({
      next: (data) => {
        this.sharedData.IssuesShared = data;
        this.sharedData.setLoading(false);
        console.log('Issues loaded:',);
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

  loadRepositories() {
    this.sharedData.setLoading(true);

    this.repoService.getAllRepo().subscribe({
      next: (repos) => {
        // เก็บข้อมูลลง SharedDataService
        this.sharedData.setRepositories(repos);
        this.sharedData.setLoading(false);
        console.log('Repositories loaded:', repos);
      },
      error: (err) => {
        console.error('Failed to load repositories:', err);
        this.sharedData.setLoading(false);
      },
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
    return Math.ceil(this.filteredIssue.length / this.pageSize) || 1;
  }

  // ---------- State ----------
  loading = false;
  errorMsg = '';

pageAll(page: number) {
  this.pageSize = page;
  const totalPages = Math.ceil(this.filteredIssue.length / this.pageSize);

  if (this.currentPage > totalPages) {
    this.currentPage = totalPages || 1;
  }

  this.updatePage();
  this.updateUrl();
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
    this.updatePage(); 
  const keyword = this.searchText.trim().toLowerCase();
  const matchType = (this.filterType || 'All Types').toLowerCase();
  const matchSeverity = (this.filterSeverity || 'All Severity').toLowerCase();
  const matchStatus = (this.filterStatus || 'All Status').toLowerCase();
  const matchProject = (this.filterProject || 'All Projects').toLowerCase();

  this.filteredIssue = this.issuesAll
    .filter(i => {
      const typeValue = (i.type || '').toLowerCase();

      const type =
        matchType === 'all types' ||
        (
          matchType === 'security' &&
          ['vulnerability', 'security_hotspot'].includes(typeValue)
        ) ||
        typeValue === matchType;

      const severity = matchSeverity === 'all severity' || (i.severity || '').toLowerCase() === matchSeverity;
      const status = matchStatus === 'all status' || (i.status || '').toLowerCase() === matchStatus;

      const projectName = (i.projectData?.name || '').toLowerCase();
      const project = matchProject === 'all projects' || projectName === matchProject;

      const messageOk =
        keyword === '' || (i.message || '').toLowerCase().includes(keyword);

      return type && severity && status && project && messageOk;
    })
    .sort((a, b) => {
      const dateDiff =
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime();

      if (dateDiff !== 0){
        return dateDiff;
      }else{
      return a.id.localeCompare(b.id); 
      }
    });

  this.updatePage();
}

  onSearchChange(value: string) {
    this.searchText = value;
    this.applyFilter();
  }



  updatePage() {
    const start = (this.currentPage - 1) * this.pageSize;
    this.paginatedIssues = this.filteredIssue.slice(start, start + this.pageSize);
  }

  allSelected(): boolean {
    // Check if ALL currently displayed (paged) items are selected
    return this.paginatedIssues.length > 0 && this.paginatedIssues.every(issue => this.isSelected(issue));
  }
  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    if (checked) {
      // Add all currently visible items to selection if not already there
      this.paginatedIssues.forEach(issue => {
        if (!this.isSelected(issue)) {
          this.selectedIssues.push(issue);
        }
      });
    } else {
      // Remove all currently visible items from selection
      this.selectedIssues = this.selectedIssues.filter(s => !this.paginatedIssues.some(p => p.id === s.id));
    }
  }
updateUrl() {
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams: { page: this.currentPage },
  });
}


nextPage() {
  if (this.currentPage * this.pageSize < this.filteredIssue.length) {
    this.currentPage++;
    this.updatePage();
    this.updateUrl();
  }
}

prevPage() {
  if (this.currentPage > 1) {
    this.currentPage--;
    this.updatePage();
    this.updateUrl();
  }
}


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
    const ids = Array.from(this.selectedIssues);
    if (ids.length === 0) return;

  }
  openAssignModal() {
    const ids = this.selectedIssues.map(i => i.id);
    if (ids.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Data',
        text: 'Don\'t Select Issue',
      });
      this.showAssignModal = false;
      return;
    }

    this.selectedIdsForAssign = ids;
    this.issueDraft = { id: '', assignedTo: '', status: 'OPEN' };
    this.showAssignModal = true;
  }
  closeAssignModal() {
    this.showAssignModal = false;
  }
  saveAssign(form: any) {
    if (!form.valid) return;

    const reqs = this.selectedIdsForAssign.map((id) => {
      const payload: IssuesRequestDTO = {
        id,
        assignedTo: this.issueDraft.assignedTo,
        status: 'IN_PROGRESS'
      };
      return this.issuesService.updateIssues(payload);
    });

    this.savingAssign = true;

    forkJoin(reqs).subscribe({
      next: (results) => {
        this.sharedData.updateIssues(results)
        console.log('Assign successful for all selected issues:', results);
        this.selectedIdsForAssign = [];
        this.savingAssign = false;
        this.closeAssignModal();
      },
      error: (err) => {
        console.error('Assign failed:', err);
        this.savingAssign = false;
      }
    });
  }

  exportData() {
    const selectedIssues = this.selectedIssues
    const exportIssues = selectedIssues.length ? selectedIssues : this.selectedIssues;

    const datenow = new Date();
    const dateStr = datenow.toISOString().split('T')[0].replaceAll('-', '');
    const fileType = selectedIssues.length ? 'selected' : 'all';
    const fileName = `issues_${fileType}_${dateStr}.csv`;
    if (this.selectedIssues.length < 2) {
      Swal.fire({
        icon: 'warning',
        title: 'Not enough items selected',
        text: 'Please select at least 1 items to export',
        confirmButtonText: 'OK'
      });
      return;
    }
    const csvContent = [
      ['No.', 'Title', 'Severity', 'Status', 'Assignee'].join(','),
      ...exportIssues.map((i, idx) => [
        idx + 1,
        `"${i.message.replaceAll('"', '""')}"`,
        i.severity,
        i.status,
        i.assignedTo?.username || '-'
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
    this.selectedIssues = [];
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
    if (!status) return '';
    const normalized = status.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    const clean = normalized.replace(/\s/g, '-'); // normalize to hyphenated for some cases if needed, but here we just check strings

    if (normalized === 'open') return 'text-danger';
    if (normalized === 'in progress' || normalized === 'inprogress' || normalized === 'in-progress') return 'text-warning'; // Handle all forms
    if (normalized === 'resolved' || normalized === 'done') return 'text-success';
    if (normalized === 'closed') return 'text-secondary';
    if (normalized === 'pending') return 'text-info';

    return '';
  }

  formatStatus(status: string): string {
    if (!status) return '';
    const normalized = status.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

    if (normalized === 'in progress' || normalized === 'inprogress' || normalized === 'in-progress') return 'In Progress';
    if (normalized === 'open') return 'Open';
    if (normalized === 'done' || normalized === 'resolved') return 'Resolved';
    if (normalized === 'reject') return 'Reject';
    if (normalized === 'pending') return 'Pending';

    return status;
  }
  viewResult(issueId: IssuesResponseDTO) {
  this.router.navigate(['/issuedetail', issueId.id], {
    queryParams: { page: this.currentPage }
  });
}
  isSelected(issue: IssuesResponseDTO): boolean {
    return this.selectedIssues.some(s => s.id === issue.id);
  }
  toggleIssueSelection(issue: IssuesResponseDTO, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    // Toggle logic
    const index = this.selectedIssues.findIndex(s => s.id === issue.id);
    if (index >= 0) {
      this.selectedIssues.splice(index, 1);
    } else {
      this.selectedIssues.push(issue);
    }
  }
}
