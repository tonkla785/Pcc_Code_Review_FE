import { UserInfo } from './../../interface/user_interface';
import { inject, Injectable } from '@angular/core';
import { AuthService } from '../authservice/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { ScanResponseDTO } from '../../interface/scan_interface';

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
  private readonly base = environment.apiUrl + '/user';
  private readonly baseverify = environment.apiUrl + '/auth';
  private baseUrl = environment.apiUrl;

  private authOpts() {
    const token = this.auth.token;
    return token
      ? { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) }
      : {};
  }


//  updateUserProfile(user: Partial<{ username: string; email: string; phoneNumber: string }>): Observable<User> {
//   return this.http.put<User>(`${this.base}/update-user-profile`, user, this.authOpts());
// }

changePassword(data: ChangePasswordData) {
  return this.http.put(
    `${this.baseUrl}/user/change-password`,
    {
      currentPassword: data.oldPassword,
      newPassword: data.newPassword,
    },
    {
      ...this.authOpts(),
      responseType: 'text' as const,
    }
  );
}

sendVerifyEmail(userId: string) {
  return this.http.post<void>(
    `${this.baseUrl}/api/email-verification/send`,
    { userId },
    this.authOpts()
  );
}

confirmVerifyEmail(token: string) {
  return this.http.post<void>(
    `${this.baseUrl}/api/email-verification/confirm`,
    { token },
    this.authOpts()
  );
}

getUserById(id: string): Observable<User> {
  return this.http.get<User>(`${this.base}/search-user/${id}`, this.authOpts());
}


verifyEmail(email: string): Observable<User> {
  console.log(email);
  return this.http.post<User>(`${this.baseverify}/verify/resend`, { email }, this.authOpts());
}


  getUser(): Observable<UserInfo[]> {
    return this.http.get<UserInfo[]>(
      `${this.baseUrl}/user/all-user`,
      this.authOpts()
    );
  }
  AddNewUser(userInfo: UserInfo): Observable<UserInfo[]> {
    return this.http.post<UserInfo[]>(
      `${this.baseUrl}/user/new-user`,
      userInfo,
      this.authOpts()
    );
  }
    DeleteUser(id: string): Observable<UserInfo[]> {
    return this.http.delete<UserInfo[]>(
      `${this.baseUrl}/user/delete-user/` + id,
      this.authOpts()
    );
  }
    EditUser(User: UserInfo): Observable<UserInfo[]> {
    return this.http.put<UserInfo[]>(
      `${this.baseUrl}/user/update-user/` + User.id,
      User,
      this.authOpts()
  
    );
  }

  
  
}



