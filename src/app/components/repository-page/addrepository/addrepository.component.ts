import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  Repository,
  RepositoryService,
} from '../../../services/reposervice/repository.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { ScanService } from '../../../services/scanservice/scan.service';
import { SseService } from '../../../services/scanservice/sse.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { UserSettingService } from '../../../services/usersettingservice/user-setting.service';
import { UserSettingsDataService } from '../../../services/shared-data/user-settings-data.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-addrepository',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatSnackBarModule],
  templateUrl: './addrepository.component.html',
  styleUrls: ['./addrepository.component.css'],
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
    private readonly userSettingsData: UserSettingsDataService,
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

  // ✅ แผน B: token ใช้ตอน startScan (optional)
  gitToken: string = '';

  authMethod: 'usernamePassword' | 'accessToken' | null = null;
  isEditMode: boolean = false;

  gitRepository: Repository = {
    projectId: undefined,
    user: '',
    name: '',
    projectType: undefined,
    repositoryUrl: '',
    costPerDay: 1000 //default value
  };

  // ❌ ไม่ใช้แล้ว (BE ไม่ได้เอา username/password ไป clone)
  // credentials = {
  //   username: '',
  //   password: '',
  // };

  sonarConfig = {
    projectKey: '',
    projectName: '',
    projectVersion: '',
    sources: 'src',
    serverUrl: 'https://code.pccth.com',
    token: '',
    enableAutoScan: true,
    enableQualityGate: true,
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
      // console.log('Edit mode for projectId:', projectId);
    }

    this.gitRepository.user = '';
    this.updateProjectKey();

    // Fetch SonarQube Config to ensure we have the token for validation
    this.userSettingService.getSonarQubeConfig().subscribe();

    // Fix: Load repositories if cache is empty (for Duplicate Name Validation on refresh)
    if (!this.sharedData.hasRepositoriesCache) {
      this.repositoryService.getAllRepo().subscribe({
        next: (repos) => {
          console.log('Repositories loaded for validation:', repos.length);
          this.sharedData.setRepositories(repos);
        },
        error: (err) => console.error('Failed to load repositories for validation', err)
      });
    }
  }

  loadRepository(projectId: string) {
    this.repositoryService.getByIdRepo(projectId).subscribe({
      next: (repo) => {
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
          sonarProjectKey: repo.sonarProjectKey || '',
          costPerDay: repo.costPerDay
        };

        // Edit Mode: Use existing Project Key from DB
        this.sonarConfig.projectKey = this.gitRepository.sonarProjectKey || '';
      },
      error: (err) => console.error('Failed to load repository', err),
    });
  }

  updateProjectKey() {
    if (this.isEditMode) return;
    this.sonarConfig.projectKey = this.gitRepository.name || '';
  }

  onNameChange(newName: string) {
    this.gitRepository.name = newName;
    this.updateProjectKey();
  }

  onSubmit(form: NgForm) {
    if (this.gitRepository.costPerDay !== undefined && this.gitRepository.costPerDay < 1000) {
      this.snack.open('Cost Per Day must be at least 1000', '', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-red'],
      });
      return;
    }

    if (!form.valid) {
      this.snack.open('Please fill in all required fields', '', {
        duration: 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['app-snack', 'app-snack-red'],
      });
      return;
    }

    // Validate Duplicate Name
    const currentRepos = this.sharedData.repositoriesValue;
    const isDuplicate = currentRepos.some(
      (r) =>
        r.name.trim().toLowerCase() ===
        this.gitRepository.name.trim().toLowerCase() &&
        r.projectId !== this.gitRepository.projectId,
    );

    if (isDuplicate) {
      Swal.fire({
        icon: 'warning',
        title: 'Duplicate Project Name',
        text: 'This project name already exists in the system. Please use a different name.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    // Validate SonarQube Token
    const sonarConfig = this.userSettingsData.sonarQubeConfig;
    if (!sonarConfig?.authToken || sonarConfig.authToken.trim() === '') {
      Swal.fire({
        icon: 'error',
        title: 'Missing SonarQube Token',
        text: 'Please configure your SonarQube Token in User Settings before adding a repository.',
        showCancelButton: true,
        confirmButtonText: 'Go to Settings',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        reverseButtons: true,
      }).then((result: any) => {
        if (result.isConfirmed) {
          this.router.navigate(['/sonarqubeconfig']);
        }
      });
      return;
    }

    this.updateProjectKey();

    // ✅ payload add/update repo: ไม่ต้องส่ง username/password แล้ว
    const payload = {
      name: this.gitRepository.name,
      url: this.gitRepository.repositoryUrl,
      type: this.gitRepository.projectTypeLabel === 'ANGULAR'
        ? 'ANGULAR'
        : 'SPRING_BOOT',
      costPerDay: this.gitRepository.costPerDay || 1000
    };

    const saveOrUpdate$ = this.isEditMode
      ? this.repositoryService.updateRepo(this.gitRepository.projectId!, payload)
      : this.repositoryService.addRepo(payload);

    saveOrUpdate$.subscribe({
      next: (savedRepo) => {
        // Determine the ID to fetch (prioritize existing ID for edits)
        const targetId =
          this.isEditMode && this.gitRepository.projectId
            ? this.gitRepository.projectId
            : savedRepo.projectId || savedRepo.id;

        if (targetId) {
          // 1. Fetch full data FIRST to ensure consistency
          this.repositoryService.getFullRepository(targetId).subscribe({
            next: (fullRepo) => {
              if (fullRepo) {
                // 2. Update Shared Data (This sets the base state, e.g., Status = Active/Created)
                if (this.isEditMode) {
                  this.sharedData.updateRepository(targetId, fullRepo);
                } else {
                  this.sharedData.addRepository(fullRepo);
                }
              }

              this.snack.open(
                this.isEditMode
                  ? 'Repository updated successfully!'
                  : 'Repository added successfully!',
                '',
                {
                  duration: 2500,
                  horizontalPosition: 'right',
                  verticalPosition: 'top',
                  panelClass: ['app-snack', 'app-snack-blue'],
                }
              );

              // 3. Start Scan (Only after repo is firmly in SharedData)
              if (savedRepo?.projectId) {
                const tokenToUse = this.gitToken?.trim() || null;

                // Optimistic Update: Set status to Scanning immediately
                this.sharedData.updateRepoStatus(
                  savedRepo.projectId,
                  'Scanning',
                  0
                );

                this.repositoryService
                  .startScan(savedRepo.projectId, 'main', tokenToUse as any)
                  .subscribe({
                    next: (newScan) => {
                      // ล้าง token หลังส่ง
                      this.gitToken = '';

                      if (newScan) {
                        this.sharedData.upsertScan(newScan);
                      }

                      // Update status again to confirm
                      this.sharedData.updateRepoStatus(
                        savedRepo.projectId!,
                        'Scanning',
                        0
                      );

                      this.router.navigate(['/repositories'], {
                        state: { message: 'Scan started successfully!' },
                      });
                    },
                    error: (err) => {
                      this.gitToken = '';
                      const msgErr = this.extractApiError(err);
                      this.snack.open(`Scan failed to start: ${msgErr}`, '', {
                        duration: 3000,
                        horizontalPosition: 'right',
                        verticalPosition: 'top',
                        panelClass: ['app-snack', 'app-snack-red'],
                      });

                      this.sharedData.updateRepoStatus(
                        savedRepo.projectId!,
                        'Error',
                        0
                      );
                      this.router.navigate(['/repositories']);
                    },
                  });
              } else {
                this.router.navigate(['/repositories']);
              }
            },
            error: (err) => {
              console.error('Failed to fetch full repo after save', err);
              // Even if fetch fails, try to redirect
              this.router.navigate(['/repositories']);
            },
          });
        }
      },
      error: (err) => {
        const msgErr = this.extractApiError(err);
        this.snack.open(`Save repository failed: ${msgErr}`, '', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-red'],
        });
      },
    });
  }

  onCancel() {
    this.router.navigate(['/repositories']);
  }

  onDelete() {
    const repo = this.gitRepository;
    if (!repo?.projectId) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Data',
        text: 'Repository ID not found',
      });
      return;
    }

    Swal.fire({
      title: 'Delete Repository?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
    }).then((result: any) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: 'Deleting...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        this.repositoryService.deleteRepo(repo.projectId!).subscribe({
          next: () => {
            this.sharedData.removeRepository(repo.projectId!);
            Swal.fire({
              icon: 'success',
              title: 'Deleted Successfully',
              text: 'Repository has been deleted.',
              timer: 1800,
              showConfirmButton: false,
            });
            this.repositoryService.getAllRepo().subscribe((repos) => {
              this.sharedData.setRepositories(repos);
              this.router.navigate(['/repositories']);
            });
          },
          error: () => {
            Swal.fire({
              icon: 'error',
              title: 'Delete Failed',
              text: 'An error occurred while deleting the repository.',
            });
          },
        });
      }
    });
  }

  clearForm(form?: NgForm) {
    if (this.isEditMode) {
      // Edit Mode: Clear only editable fields (Name & Git Token)
      this.gitRepository.name = '';
      this.gitToken = '';
      this.gitRepository.costPerDay = 1000;

      if (form) {
        // Reset form controls only for editable fields to clear validation states
        form.controls['name']?.reset('');
        form.controls['gitToken']?.reset('');
      }
    } else {
      // Add Mode: Clear everything
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
        enableQualityGate: true,
      };

      this.authMethod = null;
      this.gitToken = '';

      if (form) {
        form.resetForm({
          name: '',
          repositoryUrl: '',
          projectType: undefined,
          branch: 'main',
          serverUrl: 'https://code.pccth.com',
          projectKey: '',
          enableAutoScan: true,
          enableQualityGate: true,
          gitToken: null,
        });
      }
    }
  }

}

