import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/authservice/auth.service';
import { TokenStorageService } from '../../services/tokenstorageService/token-storage.service';
import Swal from 'sweetalert2';

interface SubmenuItem {
  label: string;
  icon: string;
  link: string;
}

interface MenuItem {
  label: string;
  icon: string;
  link?: string;
  submenu?: SubmenuItem[];
  key?: string; // ใช้สำหรับ toggle
}


@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {

  navbarOpen = false;
  submenuOpen: { [key: string]: boolean } = {};

  menu: MenuItem[] = [
    { label: 'Dashboard', icon: 'bi-speedometer2', link: '/dashboard' },
    { label: 'Repositories', icon: 'bi-folder-fill', link: '/repositories' },
    {
      label: 'Code Review', icon: 'bi-chat-left-text', key: 'codeReview', submenu: [
        { label: 'Active Scan', icon: 'bi-play-circle', link: '/activescan' },
        { label: 'Scan History', icon: 'bi-clock-history', link: '/scanhistory' },
      ]
    },
    { label: 'Issue', icon: 'bi-exclamation-circle-fill', link: '/issue' },
    { label: 'Analytics', icon: 'bi-graph-up', link: '/analysis' },
    {
      label: 'Report', icon: 'bi-file-earmark-text-fill', key: 'report', submenu: [
        { label: 'Generate Report', icon: 'bi-file-earmark-plus', link: '/generatereport' },
        { label: 'Report History', icon: 'bi-clock-history', link: '/reporthistory' },
      ]
    },
    {
      label: 'Setting', icon: 'bi-gear-fill', key: 'Setting', submenu: [
        { label: 'sonarqubeconfig', icon: 'bi-gear-fill', link: '/sonarqubeconfig' },
        { label: 'Notification Setting', icon: 'bi-file-earmark-plus', link: '/notificationsetting' },
        { label: 'User Management', icon: 'bi-clock-history', link: '/usermanagement' },
      ]
    },
    { label: 'Logout', icon: 'bi-box-arrow-right', link: '/' }
  ];

  constructor(
    private readonly router: Router,
    public readonly authService: AuthService,
    private readonly tokenStorage: TokenStorageService,
    private readonly elementRef: ElementRef
  ) {


    // ตั้ง submenu ให้เปิดตาม URL ตอนโหลดและเปลี่ยน route
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.menu.forEach(item => {
          if (item.submenu && item.key) {
            this.submenuOpen[item.key] = item.submenu.some(sub => event.urlAfterRedirects.startsWith(sub.link));
          }
        });
      }
    });
  }

  ngOnInit(): void {
    // ไม่ต้องเรียก API - ใช้ข้อมูลจาก localStorage ที่เก็บตอน login แทน
  }

  // ตรวจสอบว่าเป็น ADMIN หรือไม่ - ดึงจาก localStorage
  get isAdmin(): boolean {
    const loginUser = this.tokenStorage.getLoginUser();
    return loginUser?.role === 'ADMIN';
  }

  toggleNavbar() {
    this.navbarOpen = !this.navbarOpen;
  }

  closeNavbar() {
    this.navbarOpen = false;
  }

  toggleSubmenu(key: string, event?: Event) {
    // หยุด event propagation เพื่อไม่ให้ HostListener จับได้
    if (event) {
      event.stopPropagation();
    }
    // ปิด submenu อื่นทั้งหมดก่อนเปิดตัวที่คลิก
    Object.keys(this.submenuOpen).forEach(k => {
      if (k !== key) {
        this.submenuOpen[k] = false;
      }
    });
    this.submenuOpen[key] = !this.submenuOpen[key];
  }

  // ฟัง click event นอก dropdown เพื่อปิด submenu
  // NOTE: On Mobile, we have a Backdrop that handles the close.
  // This listener ensures desktop submenus close (or if backdrop fails).
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    // ตรวจสอบว่า click อยู่นอก navbar หรือไม่
    // หมายเหตุ: elementRef คือตัว Component เอง (<app-navbar>)
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeAllSubmenus();
    }
  }

  // ปิด submenu ทั้งหมด
  closeAllSubmenus() {
    Object.keys(this.submenuOpen).forEach(key => {
      this.submenuOpen[key] = false;
    });
  }

  logout(): void {
    Swal.fire({
      title: 'Logout?',
      text: 'Are you sure you want to logout?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Logout',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.authService.logout().subscribe({
          next: () => {
            this.router.navigate(['/']);
          },
          error: () => {
            Swal.fire({
              icon: 'error',
              title: 'Logout Failed',
              text: 'Please try again.'
            });
          }
        });
      }
    });
  }
}
