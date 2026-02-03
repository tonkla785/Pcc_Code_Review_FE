import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { WebSocketService } from './services/websocket/websocket.service';
import { SharedDataService } from './services/shared-data/shared-data.service';
import { RepositoryService } from './services/reposervice/repository.service';
import { ScanService } from './services/scanservice/scan.service';
import { IssueService } from './services/issueservice/issue.service'; // Import IssueService
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, MatSnackBarModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'codereviewFE';
  darkMode = false;
  private wsSub?: Subscription;

  constructor(
    private ws: WebSocketService,
    private sharedData: SharedDataService,
    private repoService: RepositoryService,
    private scanService: ScanService,
    private issueService: IssueService, // Inject IssueService
    private snack: MatSnackBar
  ) { }

  // toggleTheme() {
  //   this.darkMode = !this.darkMode;

  //   if (this.darkMode) {
  //     document.body.classList.add('dark-mode');
  //   } else {
  //     document.body.classList.remove('dark-mode');
  //   }
  // }

  ngOnInit() {

    // Check localStorage on load / ตรวจสอบค่าจาก localStorage เมื่อโหลดหน้าเว็บ
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      this.darkMode = true;
      document.body.classList.add('dark-mode');
    }

    // Global WebSocket Listener
    this.wsSub = this.ws.subscribeScanStatus().subscribe(event => {
      console.log('[AppComponent] WS Event:', event);

      const mappedStatus = this.mapStatus(event.status);

      // อัปเดตสถานะ Repo ใน SharedData ทันที (UI List)
      this.sharedData.updateRepoStatus(
        event.projectId,
        mappedStatus,
        event.status === 'SCANNING' ? 0 : event.status === 'SUCCESS' ? 100 : 0
      );

      // กรณีที่ 1: เริ่มต้น Scan (SCANNING)
      if (event.status === 'SCANNING') {
        // 1. เก็บลง LocalStorage เพื่อจำสถานะ
        localStorage.setItem(`repo-status-${event.projectId}`, mappedStatus);

        // 2. ดึงข้อมูลรอบแรก (เพื่ออัปเดต UI และ History ว่ากำลังหมุน)
        this.fetchScanData(event.projectId, event.status);
      }

      // กรณีที่ 2: Scan เสร็จสิ้น (SUCCESS หรือ FAILED)
      else if (event.status === 'SUCCESS' || event.status === 'FAILED') {
        // 1. ลบ LocalStorage
        localStorage.removeItem(`repo-status-${event.projectId}`);

        // 2. แจ้งเตือน User
        this.snack.open(
          event.status === 'SUCCESS' ? 'Scan Successful' : 'Scan Failed',
          '',
          {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['app-snack', event.status === 'SUCCESS' ? 'app-snack-green' : 'app-snack-red']
          }
        );

        // 3. ดึงข้อมูลรอบสอง (เพื่อเอาผลลัพธ์สุดท้ายมาโชว์)
        this.fetchScanData(event.projectId, event.status);

        // 4. ดึง Issues ใหม่มาทับ (ถ้า Success หรือ Failed)
        if (event.status === 'SUCCESS' || event.status === 'FAILED') {
          this.fetchAndOverwriteIssues();
        }
      }
    });
  }

  // แยกฟังก์ชันดึงข้อมูลออกมา เพื่อให้เรียกใช้ได้ 2 รอบ ตอนเริ่ม และ ตอนจบ
  private fetchScanData(projectId: string, wsStatus: string) {
    // หน่วงเวลา 1 วิ เผื่อ DB Backend commit ช้า
    setTimeout(() => {
      this.repoService.getFullRepository(projectId).subscribe({
        next: (fullRepo) => {
          if (!fullRepo) {
            console.warn('[AppComponent] Full Repo is null for project:', projectId);
            return;
          }
          console.log('[AppComponent] Full Repo fetched:', fullRepo);

          // Update Repository List 
          const merged = this.sharedData.repositoriesValue.map(repo => {
            if (repo.projectId === projectId) {
              return {
                ...repo,
                ...fullRepo,
                status: this.mapStatus(wsStatus) // บังคับใช้ Status จาก WebSocket ล่าสุด
              };
            }
            return repo;
          });
          this.sharedData.setRepositories(merged);

          // Update Scan History (Directly from latest scan in list - No extra API call)
          if (fullRepo.scans && fullRepo.scans.length > 0) {
            const latestScan = fullRepo.scans.reduce((prev, current) =>
              (new Date(current.startedAt).getTime() > new Date(prev.startedAt).getTime()) ? current : prev
            );

            // แก้ไข Race condition: ถ้า DB ยังไม่อัปเดตสถานะ -> เราแก้ค่าให้ตรงกับ WS
            if (latestScan.status === 'PENDING' && (wsStatus === 'SUCCESS' || wsStatus === 'FAILED')) {
              latestScan.status = wsStatus as 'PENDING' | 'SUCCESS' | 'FAILED';
            }

            // ส่งเข้า SharedData (เพื่ออัปเดตหน้า History)
            this.sharedData.upsertScan(latestScan);
            console.log('[AppComponent] Upserted latest scan from list:', latestScan);
          } else {
            console.warn('[AppComponent] No scans found in fullRepo list for project:', projectId);
          }
        },
        error: err => console.error('Failed to refresh full repo', err)
      });
    }, 1000);
  }

  // ดึง Issue ทั้งหมด แล้วเอาไปทับใน SharedData เลย (ตาม Requirement ใหม่)
  private fetchAndOverwriteIssues() {
    // หน่วงเวลา 1.5 วิ (ให้ช้ากว่า repo นิดนึง เพื่อความชัวร์ของ Database)
    setTimeout(() => {
      this.issueService.getAllIssues().subscribe({
        next: (allIssues) => {
          console.log('[AppComponent] Fetched all issues, overwriting SharedData...');
          this.sharedData.IssuesShared = allIssues; // ทับข้อมูลเดิมเลย
        },
        error: (err) => console.error('[AppComponent] Failed to fetch issues', err)
      });
    }, 1000);
  }

  ngOnDestroy() {
    if (this.wsSub) {
      this.wsSub.unsubscribe();
    }
  }

  private mapStatus(wsStatus: string): 'Active' | 'Scanning' | 'Error' {
    switch (wsStatus) {
      case 'SCANNING': return 'Scanning';
      case 'SUCCESS': return 'Active';
      case 'FAILED': return 'Error';
      default: return 'Active';
    }
  }
  // ngOnInit() {
  //   // Check localStorage on load / ตรวจสอบค่าจาก localStorage เมื่อโหลดหน้าเว็บ
  //   const savedTheme = localStorage.getItem('theme');
  //   if (savedTheme === 'dark') {
  //     this.darkMode = true;
  //     document.body.classList.add('dark-mode');
  //   }
  // }

  toggleTheme() {
    this.darkMode = !this.darkMode;

    if (this.darkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark'); // Save to localStorage / บันทึกลง localStorage
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light'); // Save to localStorage / บันทึกลง localStorage
    }
  }

}
