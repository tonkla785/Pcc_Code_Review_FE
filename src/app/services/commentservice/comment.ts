import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../authservice/auth.service';
import { environment } from '../../environments/environment';

/** ของเดิมคุณ — เก็บไว้ได้ */
export interface Comment {
  commentId: string;   // UUID
  scanId: string;      // UUID
  filePath: string;
  lineNumber: number;
}

/** ====== ชนิดข้อมูลสำหรับ Issue Comments ====== */
export interface AddIssueCommentPayload {
  comment: string;     // ต้องชื่อ "comment" ให้ตรงกับ BE (CommentDTO)
}

export interface IssueCommentModel {
  commentId?: string;  // UUID (ถ้ามี)
  issueId: string;     // UUID
  userId: string;      // UUID หรือ username (แล้วแต่ BE)
  username?: string;
  comment: string;
  createdAt: string;   // ISO datetime
}

export type IssueCommentList = IssueCommentModel[];

@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** ใช้ apiUrl ให้ตรงกับ ScanService */
  private readonly baseUrl = `${environment.apiUrl}/issues`;

  /** รวม Auth + Content-Type ให้ถูกต้อง */
  private authHeaders(): HttpHeaders {
    const token = this.auth.token;
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }

  /** ================== ISSUE COMMENTS API ================== */

  /** ดึงคอมเมนต์ทั้งหมดของ issue */
  getIssueComments(issueId: string): Observable<IssueCommentList> {
    return this.http.get<IssueCommentList>(
      `${this.baseUrl}/${issueId}/comments`,
      { headers: this.authHeaders() }
    );
  }

  /** เพิ่มคอมเมนต์ให้ issue */
  addIssueComment(
    issueId: string,
    userId: string,
    payload: AddIssueCommentPayload
  ): Observable<IssueCommentModel> {
    const params = new HttpParams().set('userId', userId);
    return this.http.post<IssueCommentModel>(
      `${this.baseUrl}/${issueId}/comments`,
      payload,
      { headers: this.authHeaders(), params }
    );
  }

  // (ถ้าต้องการแก้/ลบคอมเมนต์ในอนาคต เปิดใช้เมธอดด้านล่างได้)
  // updateIssueComment(issueId: string, commentId: string, payload: AddIssueCommentPayload): Observable<IssueCommentModel> {
  //   return this.http.put<IssueCommentModel>(
  //     `${this.baseUrl}/${issueId}/comments/${commentId}`,
  //     payload,
  //     { headers: this.authHeaders() }
  //   );
  // }

  // deleteIssueComment(issueId: string, commentId: string): Observable<void> {
  //   return this.http.delete<void>(
  //     `${this.baseUrl}/${issueId}/comments/${commentId}`,
  //     { headers: this.authHeaders() }
  //   );
  // }
}
