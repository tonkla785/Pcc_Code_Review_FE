# PCCTH Automate Code Review - Frontend

> Angular 18 Frontend Application for Automate Code Review System

---

## Quick Start

```bash
# 1. Clone repository
git clone <repository-url>
cd Pcc_Code_Review_FE

# 2. Install dependencies
npm install

# 3. Configure API URL
# แก้ไข src/app/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080'  // Backend API URL
};

# 4. Run development server
ng serve

# 5. Open browser
http://localhost:4200
```

---

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Angular | 18.x | Frontend Framework |
| TypeScript | 5.x | Language |
| RxJS | 7.x | State Management & Async |
| Bootstrap Icons | 1.x | Icons |
| ng-apexcharts | - | Charts & Graphs |
| jsPDF | - | PDF Export |

---

## Project Structure

```
src/app/
├── components/              # UI Components
│   ├── analytics-page/      # Analysis, Security Dashboard, Technical Debt
│   ├── dashboard/           # Main Dashboard
│   ├── issue-page/          # Issues, Assignment, Issue Detail
│   ├── repository-page/     # Repositories, Add/Edit/Detail
│   ├── report-page/         # Reports, Generate Report
│   ├── scan-page/           # Scan History, Scan Result
│   ├── setting-web/         # SonarQube Config, Notifications
│   ├── user-page/           # Login, Register, Reset Password
│   └── navbar/              # Navigation Bar
│
├── services/                
│   ├── shared-data/         # RxJS State Management (สำคัญ!)
│   ├── authservice/         # Authentication
│   ├── reposervice/         # Repository CRUD
│   ├── scanservice/         # Scan Management
│   ├── issueservice/        # Issue Management
│   └── ...
│
├── interface/               # TypeScript Interfaces
│   └── user_interface.ts    # UserInfo, LoginRequest, etc.
│
└── environments/            # Environment Config
```

---

## API Documentation

> **ดู API Endpoints ทั้งหมดได้ที่ Swagger:**
> 
> `http://localhost:8080/swagger-ui.html`

### Base URL
```
Development: http://localhost:8080
Production:  https://api.production.com (TBD)
```

### Authentication Header
ทุก request (ยกเว้น login/register) ต้องส่ง:
```
Authorization: Bearer <accessToken>
```

---

## State Management (SharedDataService)

### หลักการทำงาน

โปรเจคใช้ **RxJS BehaviorSubject** สำหรับ share ข้อมูลระหว่าง components

```
┌───────────────────────────────────────────────────────────────┐
│                    SharedDataService                          │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  BehaviorSubject (เก็บข้อมูล + แจ้งเตือน subscribers)    │  │
│  │  - currentUser$      : ข้อมูล user ปัจจุบัน              │  │
│  │  - repositories$     : รายการ repositories               │  │
│  │  - selectedRepository$ : repository ที่เลือก             │  │
│  │  - recentScans$      : scans ล่าสุด                      │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │ subscribe          │ subscribe          │ subscribe
    ┌────┴────┐          ┌────┴────┐          ┌────┴────┐
    │ Comp A  │          │ Comp B  │          │ Comp C  │
    └─────────┘          └─────────┘          └─────────┘
```

### Pattern การใช้งาน

**กฎหลัก:**
1. **ถ้ายังไม่มีข้อมูล** → Fetch API แล้ว set ลง SharedDataService
2. **ถ้ามีข้อมูลแล้ว** → ใช้จาก SharedDataService เลย (ไม่ต้อง fetch ซ้ำ)
3. **เมื่อข้อมูลเปลี่ยน** (add/update/delete) → Update SharedDataService ด้วย

---

### ตัวอย่างที่ 1: โหลดข้อมูล Repositories

```typescript
import { Component, OnInit } from '@angular/core';
import { SharedDataService } from '../services/shared-data/shared-data.service';
import { RepositoryService } from '../services/reposervice/repository.service';

@Component({ ... })
export class RepositoriesComponent implements OnInit {
  
  repositories: Repository[] = [];

  constructor(
    private sharedData: SharedDataService,
    private repoService: RepositoryService
  ) {}

  ngOnInit() {
    // 1. Subscribe รับข้อมูลจาก SharedDataService
    this.sharedData.repositories$.subscribe(repos => {
      this.repositories = repos;
    });

    // 2. เช็คว่ามีข้อมูลแล้วหรือยัง
    if (!this.sharedData.hasRepositoriesCache) {
      // 3. ถ้ายังไม่มี → Fetch API
      this.loadRepositories();
    }
  }

  loadRepositories() {
    this.sharedData.setLoading(true);
    
    this.repoService.getAllRepo().subscribe({
      next: (repos) => {
        // 4. เก็บข้อมูลลง SharedDataService
        this.sharedData.setRepositories(repos);
        this.sharedData.setLoading(false);
      },
      error: (err) => {
        console.error('Failed to load repositories:', err);
        this.sharedData.setLoading(false);
      }
    });
  }
}
```

---

### ตัวอย่างที่ 2: เพิ่ม Repository ใหม่

```typescript
// add-repository.component.ts

onSubmit() {
  this.repoService.addRepo(this.formData).subscribe({
    next: (newRepo) => {
      // หลัง API สำเร็จ → เพิ่มเข้า SharedDataService
      this.sharedData.addRepository(newRepo);
      
      // ไป page อื่นได้เลย (ข้อมูลจะอัปเดตอัตโนมัติ)
      this.router.navigate(['/repositories']);
    },
    error: (err) => console.error(err)
  });
}
```

---

### ตัวอย่างที่ 3: อัปเดต Repository

```typescript
// edit-repository.component.ts

onUpdate() {
  this.repoService.updateRepo(this.projectId, this.formData).subscribe({
    next: (updated) => {
      // หลัง API สำเร็จ → อัปเดตใน SharedDataService
      this.sharedData.updateRepository(this.projectId, updated);
      
      this.router.navigate(['/repositories']);
    },
    error: (err) => console.error(err)
  });
}
```

---

### ตัวอย่างที่ 4: ลบ Repository

```typescript
// repositories.component.ts

onDelete(projectId: string) {
  if (!confirm('ยืนยันการลบ?')) return;
  
  this.repoService.deleteRepo(projectId).subscribe({
    next: () => {
      // หลัง API สำเร็จ → ลบออกจาก SharedDataService
      this.sharedData.removeRepository(projectId);
    },
    error: (err) => console.error(err)
  });
}
```

---

### ตัวอย่างที่ 5: จัดการ User หลัง Login

```typescript
// login.component.ts

onLogin() {
  this.authService.login(this.credentials).subscribe({
    next: (response) => {
      // เก็บ user info ลง SharedDataService
      this.sharedData.setUserFromLoginResponse(response);
      
      this.router.navigate(['/dashboard']);
    },
    error: (err) => {
      this.errorMessage = 'Login failed';
    }
  });
}
```

```typescript
// navbar.component.ts หรือ component อื่น

// ดึง userId แบบ sync
const userId = this.sharedData.userId;

// ดึง user info แบบ subscribe
this.sharedData.currentUser$.subscribe(user => {
  this.username = user?.username;
  this.isAdmin = user?.role === 'ADMIN';
});
```

---

### ตัวอย่างที่ 6: Logout

```typescript
// navbar.component.ts

logout() {
  this.authService.logout();          // ล้าง token
  this.sharedData.clearAll();         // ล้างข้อมูลทั้งหมด
  this.router.navigate(['/login']);
}
```

---

### สรุป Methods ที่ใช้บ่อย

| Method | เมื่อไหร่ใช้ |
|--------|------------|
| `setRepositories(repos)` | หลัง fetch รายการ repositories จาก API |
| `addRepository(repo)` | หลัง create repository สำเร็จ |
| `updateRepository(id, updates)` | หลัง update repository สำเร็จ |
| `removeRepository(id)` | หลัง delete repository สำเร็จ |
| `setUserFromLoginResponse(res)` | หลัง login สำเร็จ |
| `clearAll()` | ตอน logout |

| Property (Sync) | Description |
|-----------------|-------------|
| `userId` | User ID ปัจจุบัน |
| `isAdmin` | true ถ้าเป็น admin |
| `hasRepositoriesCache` | true ถ้ามี repos ใน cache แล้ว |
| `repositoriesValue` | รายการ repos (ไม่ต้อง subscribe) |

---

## Development Guide

### Adding New Component
```bash
ng generate component components/my-feature/my-component
```

### Adding New Service
```bash
ng generate service services/myservice/my-service
```

### Build Production
```bash
ng build --configuration production
```

---

## Known Issues & TODOs

| Issue | Status | Note |
|-------|--------|------|
| userId ใช้ค่าเปล่าบางที่ | ต้องแก้ | ใช้ `sharedData.userId` แทน |
| Role-based menu | ต้องเพิ่ม | เช็ค `sharedData.isAdmin` |

---

## Environment Config

```typescript
// Development: src/app/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080'
};

// Production: src/app/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: 'https://api.production.com'
};
```