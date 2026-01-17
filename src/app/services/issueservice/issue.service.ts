import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../authservice/auth.service';
import { environment } from '../../environments/environment';

export interface Issue {
  id: string;
  issueId: string;
  scanId: string;
  projectName: string;
  projectId: string;
  issueKey: string;
  type: 'Bug' | 'Vulnerability' | 'Code Smell';
  severity: 'Blocker' | 'Critical' | 'Major' | 'Minor';
  component: string;
  message: string;

  status: 'OPEN' |'PENDING'| 'IN PROGRESS' | 'DONE' | 'REJECT';
  annotation?: string; //remark status

  createdAt: Date | string;
  updatedAt: Date | string;

  userId?: string;         // assigned developer user_id
  assignedTo?: string;     // user_id
  assignedName?: string;   // user_name
  dueDate: string;        // due date
 
}



export interface AddCommentPayload {
  text: string;   // เนื้อคอมเมนต์
  author: string; // userId ผู้เขียน
}

@Injectable({ providedIn: 'root' })
export class IssueService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiUrl + '/issues';

  private authOpts() {
    const token = this.auth.token;
    return token
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : {};
  }

  /** GET /api/issues/user/{userId} — ดึง issues ทั้งหมดของผู้ใช้ */
  getAllIssue(userId: string): Observable<Issue[]> {
    return this.http.get<Issue[]>(`${this.base}/user/${userId}`);
  }

  /** GET /api/issues/:issues_id — ดึง issue รายตัว */
  getById(issues_id: string): Observable<Issue> {
    return this.http.get<Issue>(`${this.base}/${issues_id}`);
    console.log('getById', issues_id);
  }

  getIssueByProjectId(projectId: string): Observable<Issue[]> {
    return this.http.get<Issue[]>(`${this.base}/project/${projectId}`);
  }


  /** POST /api/issues/:issues_id/comments — เพิ่มคอมเมนต์ */
  addComment(issues_id: string, payload: AddCommentPayload): Observable<any> {
    const body = { comment: payload.text, userId: payload.author };
    return this.http.post(`${this.base}/${issues_id}/comments`, body);
  }

  /** GET /api/issues/{issues_id}/comments — ดึงคอมเมนต์ */
  getComments(issues_id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/${issues_id}/comments`);
  }
}
