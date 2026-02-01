import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RepositoryService } from '../../../services/reposervice/repository.service';
import { RepositoryAll } from '../../../interface/repository_interface';
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

  authMethod: 'usernamePassword' | 'accessToken' | null = null;
  isEditMode: boolean = false;

  gitRepository: Partial<RepositoryAll> = {
    id: undefined,
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

    this.updateProjectKey();
  }

  loadRepository(projectId: string) {
    this.repositoryService.getRepositoryWithScans(projectId).subscribe({

      next: (repo: RepositoryAll) => {
        // console.log('RAW REPO FROM API:', repo);

        if (!repo) {
          console.error('Repository not found');
          return;
        }

        const rawType = (repo.projectType || '').toLowerCase().trim();
        let normalizedType: 'ANGULAR' | 'SPRING_BOOT' | undefined;

        if (rawType.includes('angular')) {
          normalizedType = 'ANGULAR';
        } else if (rawType.includes('spring')) {
          normalizedType = 'SPRING_BOOT';
        } else {
          normalizedType = undefined;
        }

        this.gitRepository = {
          id: repo.id,
          name: repo.name || '',
          repositoryUrl: repo.repositoryUrl || '',
          projectType: normalizedType,
          sonarProjectKey: repo.sonarProjectKey || ''
        };
        console.log('RAW REPO FROM API:', this.gitRepository);
        this.updateProjectKey();
      },
      error: (err: any) => console.error('Failed to load repository', err)
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
      type: this.gitRepository.projectType === 'ANGULAR'
        ? 'ANGULAR'
        : 'SPRING_BOOT',
    };

    const saveOrUpdate$ = this.isEditMode
      ? this.repositoryService.updateRepo(this.gitRepository.id!, payload)
      : this.repositoryService.addRepo(payload);

    saveOrUpdate$.subscribe({
      next: (savedRepo) => {
        console.log('[ADD REPO RESPONSE]', savedRepo);
        console.log('[ADD REPO RESPONSE]', savedRepo.id);

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
        if (savedRepo?.id) {

          this.repositoryService.startScan(savedRepo.id, 'main').subscribe({
            next: () => {

              // แค่รีเฟรช list แล้วกลับหน้า repo
              this.repositoryService.getAllRepositories().subscribe(repos => {

                this.sharedData.setRepositories(repos);
                this.sharedData.setLoading(true);

                this.router.navigate(['/repositories'], {
                  state: { message: 'Scan started successfully!' }
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
          this.repositoryService.getAllRepositories().subscribe(repos => {
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
      this.repositoryService.deleteRepo(this.gitRepository.id!).subscribe(() => {
        this.snack.open('Deleted successfully!', '', {
          duration: 2500,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['app-snack', 'app-snack-red'],
        });
        this.repositoryService.getAllRepositories().subscribe(repos => {
          this.sharedData.setRepositories(repos);
          this.router.navigate(['/repositories']);
        });
      });
    }
  }

  clearForm(form?: NgForm) {
    this.gitRepository = {
      id: undefined,
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
