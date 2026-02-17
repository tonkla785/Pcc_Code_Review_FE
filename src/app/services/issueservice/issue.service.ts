import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../authservice/auth.service';
import { environment } from '../../environments/environment';
import { IssuesDetailResponseDTO, IssuesRequestDTO, IssuesResponseDTO } from '../../interface/issues_interface';
import { ScanResponseDTO } from '../../interface/scan_interface';

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

  status: 'OPEN' | 'PENDING' | 'IN PROGRESS' | 'IN_PROGRESS' | 'DONE' | 'REJECT';
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
  private baseUrl = environment.apiUrl;
  private authOpts() {
    const token = this.auth.token;
    return token
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : {};
  }

  getAllIssues(): Observable<IssuesResponseDTO[]> {
    return this.http.get<IssuesResponseDTO[]>(
      `${this.baseUrl}/api/issues`,
      this.authOpts()
    );
  }
  getAllIssuesById(id: string): Observable<IssuesResponseDTO> {
    return this.http.get<IssuesResponseDTO>(
      `${this.baseUrl}/api/issues/${id}`,
      this.authOpts()
    );
  }
  updateIssues(issues: IssuesRequestDTO): Observable<IssuesResponseDTO> {
    return this.http.post<IssuesResponseDTO>(
      `${this.baseUrl}/api/issues/update`, issues,
      this.authOpts()
    );
  }
  getAllIssuesDetails(id: string): Observable<IssuesDetailResponseDTO> {
    return this.http.get<IssuesDetailResponseDTO>(
      `${this.baseUrl}/api/issue-details/${id}`,
      this.authOpts()
    );
  }

  triggerRecommendFixAi(projectId: string, issueId: string): Observable<{ issueId: string; message: string }> {
    return this.http.post<{ issueId: string; message: string }>(
      `${this.baseUrl}/api/recommend-fix-ai`,
      { projectId, issueId },
      this.authOpts()
    );
  }
}
