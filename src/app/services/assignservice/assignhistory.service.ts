import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthService } from '../authservice/auth.service';
import { Issue, IssueService } from '../issueservice/issue.service';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface AssignHistory {
  userId: string;
  assignedTo: string;
  assignedToName: string;
  issueId: string;
  severity: string;
  message: string;
  status: string;
  dueDate: string | null;
  annotation: string;
  own : boolean;
}
export interface UpdateStatusRequest {
  status: string;
  annotation?: string | null;
}


@Injectable({
  providedIn: 'root'
})
export class AssignhistoryService {

  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseissue = environment.apiUrl + '/issues';
  private readonly baseassign = environment.apiUrl + '/assign';

  private authOpts() {
    const token = this.auth.token;
    return token
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : {};
  }


addassign(issueId: string, assignedTo: string, dueDate: string) {
  const body = {
    assignTo: assignedTo,
    dueDate: dueDate
  };
  return this.http.put(`${this.baseissue}/assign/${issueId}`, body);
}






 getAllAssign(userId: string): Observable<AssignHistory[]> {
  return this.http.get<AssignHistory[]>(`${this.baseassign}/${userId}`)
    .pipe(
      tap(data => console.log("Received data:", data)) // <-- log here
    );
}

updateStatus(userId: string, issueId: string, body: UpdateStatusRequest) {
  console.log(body);
  return this.http.put<AssignHistory[]>(
    `${this.baseassign}/update/${userId}/${issueId}`, 
    body,
  );
}





}
