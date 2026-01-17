import { inject, Injectable } from '@angular/core';
import { AuthService } from '../authservice/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
export interface User{
  id : string;
  username: string;
  email: string;
  phoneNumber: string;
  status: string;
}

export interface ChangePasswordData {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly base = environment.apiUrl + '/users';
  private readonly baseverify = environment.apiUrl + '/auth';


  private authOpts() {
    const token = this.auth.token;
    return token
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : {};
  }

  getAllUser(): Observable< User[]> {
      return this.http.get< User[]>(`${this.base}/get-users`, this.authOpts());
    }

  getUserProfile(id: string): Observable<User> {
    console.log(id);
      return this.http.get<User>(`${this.base}/users/${id}`, this.authOpts());
    }

//  updateUserProfile(user: Partial<{ username: string; email: string; phoneNumber: string }>): Observable<User> {
//   return this.http.put<User>(`${this.base}/update-user-profile`, user, this.authOpts());
// }

changePassword(user: ChangePasswordData): Observable<User> {
  return this.http.post<User>(`${this.base}/change-password`, user, this.authOpts());
}

verifyEmail(email: string): Observable<User> {
  console.log(email);
  return this.http.post<User>(`${this.baseverify}/verify/resend`, { email }, this.authOpts());
}


}
