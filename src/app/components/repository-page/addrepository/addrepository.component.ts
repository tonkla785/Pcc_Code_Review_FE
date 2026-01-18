import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Repository, RepositoryService } from '../../../services/reposervice/repository.service';
import { AuthService } from '../../../services/authservice/auth.service';
import { ScanService } from '../../../services/scanservice/scan.service';
import { SseService } from '../../../services/scanservice/sse.service';        // <-- added

@Component({
  selector: 'app-addrepository',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatSnackBarModule],
  templateUrl: './addrepository.component.html',
  styleUrls: ['./addrepository.component.css']
})
export class AddrepositoryComponent implements OnInit {

  constructor(
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
    serverUrl: 'http://localhost:9000',
    token: '',
    enableAutoScan: true,
    enableQualityGate: true
  };

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('projectId');

    if (projectId) {
      this.isEditMode = true;
      this.loadRepository(projectId);
    }

    if (!this.authService.isLoggedIn) {
      this.router.navigate(['/login']);
      return;
    }

    // TODO: Get userId from token when available
    this.gitRepository.user = '';
    this.updateProjectKey();
  }

  loadRepository(projectId: string) {
    this.repositoryService.getByIdRepo(projectId).subscribe({
      next: (repo) => {
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
          projectId: repo.projectId || '',
          user: repo.user || '',
          name: repo.name || '',
          repositoryUrl: repo.repositoryUrl || '',
          projectType: normalizedType,
          sonarProjectKey: repo.sonarProjectKey || ''
        };
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
      ...this.gitRepository,
      ...this.credentials
    };

    const saveOrUpdate$ = this.isEditMode
      ? this.repositoryService.updateRepo(this.gitRepository.projectId!, payload)
      : this.repositoryService.addRepo(payload);

    saveOrUpdate$.subscribe({
      next: (savedRepo) => {
        const msg = this.isEditMode
          ? 'Repository updated successfully!'
          : 'Repository added successfully!';
        this.router.navigate(['/repositories']);
        this.snack.open(msg, '', {
          duration: 2500,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-blue']
        });

        // 1) เตรียม key ให้ตรงกับ backend
        const sseKey =
          savedRepo.sonarProjectKey ||
          savedRepo.projectId ||
          this.sonarConfig.projectKey ||
          savedRepo.name;

        // 2) ถ้ามี key -> ค่อยฟัง SSE
        if (sseKey) {
          const sub = this.sse.connect(sseKey).subscribe({
            next: (data) => {
              this.snack.open('Sonar scan finished!', '', {
                duration: 3000,
                horizontalPosition: 'right',
                verticalPosition: 'top',
                panelClass: ['app-snack', 'app-snack-green']
              })
              setTimeout(() => {
                window.location.reload();
                this.router.navigate(['/repositories']);
                sub.unsubscribe();
              }, 3500);
              ;
              // 👉 ตอนนี้ค่อย navigate ได้ เพราะ event มาแล้ว
              this.router.navigate(['/repositories']);
              sub.unsubscribe();
            },
            error: (err) => {
              console.error('SSE error:', err);
              // ถ้า SSE พัง ค่อยกลับหน้า list
              this.router.navigate(['/repositories']);
            }
          });
        } else {
          // ถ้าไม่มี key เลย ก็กลับก่อน
          this.router.navigate(['/repositories']);
        }

        // 3) ค่อยสั่ง start scan ทีหลัง
        if (savedRepo.projectId) {
          setTimeout(() => {
            this.scanService.startScan(savedRepo.projectId!, {
              username: this.credentials.username || '',
              password: this.credentials.password || ''
            }).subscribe({
              next: () => {
                this.snack.open('Scan started successfully!', '', {
                  duration: 2500,
                  horizontalPosition: 'right',
                  verticalPosition: 'top',
                  panelClass: ['app-snack', 'app-snack-green']
                });
              },
              error: (err) => {
                const msgErr = this.extractApiError(err);
                console.error('Scan failed:', err);
                this.snack.open(`Scan failed to start: ${msgErr}`, '', {
                  duration: 3000,
                  horizontalPosition: 'right',
                  verticalPosition: 'top',
                  panelClass: ['app-snack', 'app-snack-red']
                });
              }
            });
          }, 1000);
        }
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
        this.router.navigate(['/repositories']);
      });
    }
  }

  clearForm(form?: NgForm) {
    this.gitRepository = {
      projectId: '',
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
