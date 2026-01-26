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
    private readonly sse: SseService               // <-- added
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

  // private scanningProjectIds = new Set<string>();



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
    }

    // TODO: Get userId from token when available
    this.gitRepository.user = '';
    this.updateProjectKey();
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
        let normalizedType: 'Angular' | 'Spring Boot' | undefined;

        if (rawType.includes('angular')) {
          normalizedType = 'Angular';
        } else if (rawType.includes('spring')) {
          normalizedType = 'Spring Boot';
        } else {
          normalizedType = undefined;
        }

        this.gitRepository = {
          projectId: repo.projectId || repo.id,
          user: repo.user || '',
          name: repo.name || '',
          repositoryUrl: repo.repositoryUrl || '',
          projectType: normalizedType,
          sonarProjectKey: repo.sonarProjectKey || ''
        };
        // console.log('RAW REPO FROM API:', this.gitRepository);
        this.updateProjectKey();
      },
      error: (err) => console.error('Failed to load repository', err)
    });
  }

  updateProjectKey() {
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

    this.updateProjectKey();

    const payload = {
      name: this.gitRepository.name,
      url: this.gitRepository.repositoryUrl,
      type: this.gitRepository.projectType === 'Angular'
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

        // เรียก start scan ทันที API ใหม่
        if (savedRepo?.projectId) {

          this.repositoryService.startScan(savedRepo.projectId, 'main').subscribe({
            next: () => {

              // แค่รีเฟรช list แล้วกลับหน้า repo
              this.repositoryService.getAllRepo().subscribe(repos => {
                this.repositoryService.getAllRepo().subscribe(repos => {

                  repos.forEach(r => {
                    if (r.projectId === savedRepo.projectId) {
                      r.status = 'Scanning';
                      r.scanningProgress = 0;
                    }
                  });

                  this.sharedData.setRepositories(repos);

                  this.router.navigate(['/repositories'], {
                    state: { message: 'Scan started successfully!' }
                  });
                });

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
            }
          });
        }

        else {
          // fallback: ไม่มี projectId ก็กลับหน้า list
          this.repositoryService.getAllRepo().subscribe(repos => {
            this.sharedData.setRepositories(repos);
            this.router.navigate(['/repositories']);
          });
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
    if (confirm('Are you sure to delete this repository?')) {
      this.repositoryService.deleteRepo(this.gitRepository.projectId!).subscribe(() => {
        this.snack.open('Deleted successfully!', '', {
          duration: 2500,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-red'],
        });
        this.repositoryService.getAllRepo().subscribe(repos => {
          this.sharedData.setRepositories(repos);
          this.router.navigate(['/repositories']);
        });
      });
    }
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
