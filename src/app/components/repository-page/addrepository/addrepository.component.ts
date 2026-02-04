import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Repository, RepositoryService } from '../../../services/reposervice/repository.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { ScanService } from '../../../services/scanservice/scan.service';
import { SseService } from '../../../services/scanservice/sse.service';        // <-- added
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { UserSettingService } from '../../../services/usersettingservice/user-setting.service'; // <-- added
import { UserSettingsDataService } from '../../../services/shared-data/user-settings-data.service'; // <-- added
import Swal from 'sweetalert2';

@Component({
  selector: 'app-addrepository',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatSnackBarModule],
  templateUrl: './addrepository.component.html',
  styleUrls: ['./addrepository.component.css']
})
export class AddrepositoryComponent implements OnInit {

  constructor(
    private sharedData: SharedDataService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly repositoryService: RepositoryService,
    private readonly authService: AuthService,
    private readonly snack: MatSnackBar,
    private readonly scanService: ScanService,
    private readonly sse: SseService,
    private readonly userSettingService: UserSettingService,
    private readonly userSettingsData: UserSettingsDataService
  ) { }

  private extractApiError(err: any): string {
    return (
      err?.error?.message ||
      err?.error?.detail ||
      (typeof err?.error === 'string' && err.error) ||
      err?.statusText ||
      'Unknown error'
    );
  }

  authMethod: 'usernamePassword' | 'accessToken' | null = null;
  isEditMode: boolean = false;

  gitRepository: Repository = {
    projectId: undefined,
    user: '',
    name: '',
    projectType: undefined,
    repositoryUrl: ''
  };

  credentials = {
    username: '',
    password: ''
  };

  sonarConfig = {
    projectKey: '',
    projectName: '',
    projectVersion: '',
    sources: 'src',
    serverUrl: 'https://code.pccth.com',
    token: '',
    enableAutoScan: true,
    enableQualityGate: true
  };

  ngOnInit(): void {
    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    const projectId = this.route.snapshot.paramMap.get('projectId');

    if (projectId) {
      this.isEditMode = true;
      this.loadRepository(projectId);
      console.log('Edit mode for projectId:', projectId);
    }

    // TODO: Get userId from token when available
    this.gitRepository.user = '';
    this.updateProjectKey();

    // Fetch SonarQube Config to ensure we have the token for validation
    this.userSettingService.getSonarQubeConfig().subscribe();
  }

  loadRepository(projectId: string) {
    this.repositoryService.getByIdRepo(projectId).subscribe({

      next: (repo) => {
        // console.log('RAW REPO FROM API:', repo);

        if (!repo) {
          console.error('Repository not found');
          return;
        }

        const rawType = (repo.projectType || '').toLowerCase().trim();
        let normalizedType: 'ANGULAR' | 'SPRING BOOT' | undefined;

        if (rawType.includes('angular')) {
          normalizedType = 'ANGULAR';
        } else if (rawType.includes('spring')) {
          normalizedType = 'SPRING BOOT';
        } else {
          normalizedType = undefined;
        }

        this.gitRepository = {
          projectId: repo.projectId || repo.id,
          user: repo.user || '',
          name: repo.name || '',
          repositoryUrl: repo.repositoryUrl || '',
          projectTypeLabel: normalizedType,
          sonarProjectKey: repo.sonarProjectKey || ''
        };
        console.log('RAW REPO FROM API:', this.gitRepository);
        // Edit Mode: Use existing Project Key from DB
        this.sonarConfig.projectKey = this.gitRepository.sonarProjectKey || '';
      },
      error: (err) => console.error('Failed to load repository', err)
    });
  }

  updateProjectKey() {
    // Edit Mode: Don't auto-update Project Key when Name changes
    if (this.isEditMode) return;

    this.sonarConfig.projectKey = this.gitRepository.name || '';
  }

  onNameChange(newName: string) {
    this.gitRepository.name = newName;
    this.updateProjectKey();
  }

  onSubmit(form: NgForm) {
    if (!form.valid) {
      this.snack.open('Please fill in all required fields', '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-red']
      });
      return;
    }

    // Validate Duplicate Name
    const currentRepos = this.sharedData.repositoriesValue;
    const isDuplicate = currentRepos.some(r =>
      r.name.trim().toLowerCase() === this.gitRepository.name.trim().toLowerCase() &&
      r.projectId !== this.gitRepository.projectId
    );

    if (isDuplicate) {
      Swal.fire({
        icon: 'warning',
        title: 'ชื่อโปรเจกต์ซ้ำ',
        text: 'มีโปรเจกต์ชื่อนี้อยู่แล้วในระบบ กรุณาใช้ชื่ออื่น',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    // Validate SonarQube Token
    const sonarConfig = this.userSettingsData.sonarQubeConfig;
    console.log('Validating Token:', sonarConfig);

    if (!sonarConfig?.authToken || sonarConfig.authToken.trim() === '') {
      Swal.fire({
        icon: 'error',
        title: 'Missing SonarQube Token',
        text: 'Please configure your SonarQube Token in User Settings before adding a repository.',
        showCancelButton: true,
        confirmButtonText: 'Go to Settings',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        reverseButtons: true
      }).then((result: any) => {
        if (result.isConfirmed) {
          this.router.navigate(['/sonarqubeconfig']);
        }
      });
      return;
    }

    this.updateProjectKey();

    const payload = {
      name: this.gitRepository.name,
      url: this.gitRepository.repositoryUrl,
      type: this.gitRepository.projectTypeLabel === 'ANGULAR' //ทดสอบ
        ? 'ANGULAR'
        : 'SPRING_BOOT',
      username: this.credentials.username,
      password: this.credentials.password
    };

    const saveOrUpdate$ = this.isEditMode
      ? this.repositoryService.updateRepo(this.gitRepository.projectId!, payload)
      : this.repositoryService.addRepo(payload);

    saveOrUpdate$.subscribe({
      next: (savedRepo) => {
        console.log('[ADD REPO RESPONSE]', savedRepo);

        console.log('[ADD REPO RESPONSE]', savedRepo);

        // Determine the ID to fetch (prioritize existing ID for edits)
        const targetId = (this.isEditMode && this.gitRepository.projectId)
          ? this.gitRepository.projectId
          : (savedRepo.projectId || savedRepo.id);

        if (targetId) {
          // Fetch full data to ensure consistency (Status, Metrics, Scans)
          this.repositoryService.getFullRepository(targetId).subscribe({
            next: (fullRepo) => {
              if (fullRepo) {
                if (this.isEditMode) {
                  this.sharedData.updateRepository(targetId, fullRepo);
                } else {
                  this.sharedData.addRepository(fullRepo);
                }
              }
            },
            error: (err) => console.error('Failed to fetch full repo after save', err)
          });
        }

        // แจ้งผลเพิ่ม/แก้ repo
        this.snack.open(
          this.isEditMode
            ? 'Repository updated successfully!'
            : 'Repository added successfully!',
          '',
          {
            duration: 2500,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['app-snack', 'app-snack-blue']
          }
        );

        // เรียก startScan ทันที API ใหม่
        if (savedRepo?.projectId) {

          this.repositoryService.startScan(savedRepo.projectId, 'main').subscribe({
            next: (newScan) => {

              // Immediate update to Scan History (Real-time "Scanning" status)
              if (newScan) {
                this.sharedData.upsertScan(newScan);
              }

              // อัปเดตสถานะใน SharedData เป็น Scanning
              this.sharedData.updateRepoStatus(savedRepo.projectId!, 'Scanning', 0);

              this.router.navigate(['/repositories'], {
                state: { message: 'Scan started successfully!' }
              });

            },

            error: (err) => {
              const msgErr = this.extractApiError(err);
              this.snack.open(`Scan failed to start: ${msgErr}`, '', {
                duration: 3000,
                horizontalPosition: 'right',
                verticalPosition: 'top',
                panelClass: ['app-snack', 'app-snack-red']
              });
              // Update status to Error if needed
              this.sharedData.updateRepoStatus(savedRepo.projectId!, 'Error', 0);
              this.router.navigate(['/repositories']);
            }
          });
        }

        else {
          // fallback: ไม่มี projectId ก็กลับหน้า list
          this.router.navigate(['/repositories']);
        }
      },
      error: (err) => {
        const msgErr = this.extractApiError(err);
        this.snack.open(`Save repository failed: ${msgErr}`, '', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-red']
        });
      }
    });
  }

  onCancel() {
    this.router.navigate(['/repositories']);
  }

  onDelete() {
    const repo = this.gitRepository;
    // กัน null / undefined แบบชัดเจน
    if (!repo?.projectId) {
      Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ถูกต้อง',
        text: 'ไม่พบรหัสโปรเจกต์ของ Repository',
      });
      return;
    }

    Swal.fire({
      title: 'ยืนยันการลบ Repository',
      text: 'เมื่อลบแล้วจะไม่สามารถกู้คืนข้อมูลได้',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ลบข้อมูล',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true
    }).then((result: any) => {
      if (result.isConfirmed) {

        // loading ตอนกำลังลบ
        Swal.fire({
          title: 'กำลังลบข้อมูล...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        this.repositoryService.deleteRepo(repo.projectId!).subscribe({
          next: () => {
            this.sharedData.removeRepository(repo.projectId!);
            Swal.fire({
              icon: 'success',
              title: 'ลบสำเร็จ',
              text: 'ลบ Repository เรียบร้อยแล้ว',
              timer: 1800,
              showConfirmButton: false
            });
            this.repositoryService.getAllRepo().subscribe(repos => {
              this.sharedData.setRepositories(repos);
              this.router.navigate(['/repositories']);
            });
          },
          error: () => {
            Swal.fire({
              icon: 'error',
              title: 'ลบไม่สำเร็จ',
              text: 'เกิดข้อผิดพลาดระหว่างการลบ Repository',
            });
          }
        });
      }
    });
  }

  clearForm(form?: NgForm) {
    this.gitRepository = {
      projectId: undefined,
      user: '',
      name: '',
      projectType: undefined,
      repositoryUrl: '',
    };

    this.sonarConfig = {
      projectKey: '',
      projectName: '',
      projectVersion: '',
      sources: 'src',
      serverUrl: 'https://code.pccth.com',
      token: '',
      enableAutoScan: true,
      enableQualityGate: true
    };

    this.authMethod = null;

    if (form) {
      form.resetForm({
        name: '',
        repositoryUrl: '',
        projectType: undefined,
        branch: 'main',
        serverUrl: 'https://code.pccth.com',
        projectKey: '',
        enableAutoScan: true,
        enableQualityGate: true
      });
    }
  }
}
