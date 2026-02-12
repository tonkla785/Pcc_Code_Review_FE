import { Routes } from '@angular/router';
import { LandingpageComponent } from './components/landingpage/landingpage.component';
import { LoginComponent } from './components/user-page/login/login.component';
import { RegisterComponent } from './components/user-page/register/register.component';
import { ResetPasswordComponent } from './components/user-page/reset-password/reset-password.component';
import { ForgotPasswordComponent } from './components/user-page/forgot-password/forgot-password.component';
import { VerifySuccessComponent } from './components/user-page/verify-success/verify-success.component';
import { VerifyFailedComponent } from './components/user-page/verify-failed/verify-failed.component';
import { LayoutComponent } from './components/layout/layout.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DetailrepositoryComponent } from './components/repository-page/detailrepository/detailrepository.component';
import { ScanhistoryComponent } from './components/scan-page/scanhistory/scanhistory.component';
import { RepositoriesComponent } from './components/repository-page/repositories/repositories.component';
import { AddrepositoryComponent } from './components/repository-page/addrepository/addrepository.component';
import { ScanresultComponent } from './components/scan-page/scanresult/scanresult.component';
import { LogviewerComponent } from './components/scan-page/logviewer/logviewer.component';
import { IssueComponent } from './components/issue-page/issue/issue.component';
import { IssuedetailComponent } from './components/issue-page/issuedetail/issuedetail.component';
import { AssignmentComponent } from './components/issue-page/assignment/assignment.component';
import { GeneratereportComponent } from './components/report-page/generatereport/generatereport.component';
import { ReporthistoryComponent } from './components/report-page/reporthistory/reporthistory.component';
import { SonarqubeconfigComponent } from './components/setting-web/sonarqubeconfig/sonarqubeconfig.component';
import { NotificationsettingComponent } from './components/setting-web/notificationsetting/notificationsetting.component';
import { UsermanagementComponent } from './components/setting-web/usermanagement/usermanagement.component';
import { AnalysisComponent } from './components/analytics-page/analysis/analysis.component';
import { SecuritydashboardComponent } from './components/analytics-page/securitydashboard/securitydashboard.component';
import { TechnicaldebtComponent } from './components/analytics-page/technicaldebt/technicaldebt.component';
import { Component } from '@angular/core';
import { roleGuard } from './services/authservice/role.guard';
import { VerifyEmailComponent } from './components/user-page/verify-email/verify-email.component';

export const routes: Routes = [

  { path: '', component: LandingpageComponent, pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'verify-email', component: VerifyEmailComponent }, // ✅ เพิ่มอันนี้
  { path: 'verify-success', component: VerifySuccessComponent },
  { path: 'verify-failed', component: VerifyFailedComponent },

  {
    path: '',
    component: LayoutComponent, // Layout มี Navbar
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'repositories', component: RepositoriesComponent },
      { path: 'addrepository', component: AddrepositoryComponent },
      { path: 'settingrepo/:projectId', component: AddrepositoryComponent },
      { path: 'detailrepo/:projectId', component: DetailrepositoryComponent },
      { path: 'scanhistory', component: ScanhistoryComponent },
      { path: 'scanresult/:scanId', component: ScanresultComponent },
      { path: 'logviewer/:scanId', component: LogviewerComponent },
      { path: 'issue', component: IssueComponent },
      { path: 'issuedetail/:issuesId', component: IssuedetailComponent },
      { path: 'assignment', component: AssignmentComponent },
      { path: 'analysis', component: AnalysisComponent },
      { path: 'security-dashboard', component: SecuritydashboardComponent },
      { path: 'technical-debt', component: TechnicaldebtComponent },
      { path: 'generatereport', component: GeneratereportComponent },
      { path: 'reporthistory', component: ReporthistoryComponent },
      { path: 'sonarqubeconfig', component: SonarqubeconfigComponent },
      { path: 'notificationsetting', component: NotificationsettingComponent },
      { path: 'usermanagement', component: UsermanagementComponent, canActivate: [roleGuard(['ADMIN'])] },
    ]
  },

  // fallback
  { path: '**', redirectTo: '' }
];

