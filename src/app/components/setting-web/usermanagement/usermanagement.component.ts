import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/authservice/auth.service';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { UserService } from '../../../services/userservice/user.service';
import { UserInfo } from '../../../interface/user_interface';
import Swal from 'sweetalert2';


interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

@Component({
  selector: 'app-usermanagement',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './usermanagement.component.html',
  styleUrl: './usermanagement.component.css'
})
export class UsermanagementComponent {

  searchText: string = '';

  modalOpen: boolean = false;
  editingUser: boolean = false;
  modalData: UserInfo = this.emptyUser();
  originalData: UserInfo = this.emptyUser();
  UserData: UserInfo[] = [];
  originalEmail!: string;
  isEmail: boolean = false;
  filteredUsers: UserInfo[] = [];
  emptyUser(): UserInfo {
    return { id: "0", username: '', password: '', email: '', role: 'USER', status: '' };
  }

  // filteredUsers(): User[] {
  //   return this.users.filter(user =>
  //     user.name.toLowerCase().includes(this.searchText.toLowerCase()) ||
  //     user.email.toLowerCase().includes(this.searchText.toLowerCase())
  //   );
  // }

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly sharedData: SharedDataService,
    private readonly userDateService: UserService
  ) { }

  ngOnInit() {
    this.sharedData.AllUser$.subscribe(data => {
      this.UserData = data ?? [];
      this.applyFilter();
    });
    if (!this.sharedData.hasUserCache) {
      this.loadUser();
      console.log("No cache - load from server");
    }

  }
  loadUser() {
    this.sharedData.setLoading(true);
    this.userDateService.getUser().subscribe({
      next: (data) => {
        this.sharedData.UserShared = data;
        this.sharedData.setLoading(false);
        console.log('User loaded:', data);
      },
      error: () => this.sharedData.setLoading(false)
    });
  }
  applyFilter() {
    const keyword = this.searchText.trim().toLowerCase();

    if (keyword == null || keyword === '') {
      this.filteredUsers = [...this.UserData];
      return;
    }

    this.filteredUsers = this.UserData.filter(u =>
      (u.username ?? '').toLowerCase().startsWith(keyword)
      // (u.email ?? '').toLowerCase().includes(keyword) ||
      // (u.role ?? '').toLowerCase().includes(keyword)
    );
  }
  onSearchChange(value: string) {
    this.searchText = value;
    this.applyFilter();
  }

  openAddUser() {
    this.modalData = this.emptyUser();
    this.editingUser = false;
    this.modalOpen = true;
  }

  openEditUser(user: UserInfo) {
    this.modalData = { ...user };
    this.originalEmail = user.email;
    console.log("Modal", this.modalData);
    this.originalData = { ...user };
    this.editingUser = true;
    this.modalOpen = true;
  }

  checkEmail() {
    const email = this.modalData.email?.trim().toLowerCase();
    if (email === this.originalEmail?.toLowerCase()) {
      this.isEmail = false;
      return;
    }
    this.isEmail = this.UserData.some(
      u => u.email.toLowerCase() === email && u.id !== this.modalData.id
    );

  }

  closeModal() {
    this.modalOpen = false;
  }
  canSave(): boolean {
    if (!this.modalData.username || !this.modalData.email || !this.modalData.role) {
      return false; // กรอกไม่ครบ
    }

    if (this.editingUser) {
      return !(
        this.modalData.username === this.originalData.username &&
        this.modalData.email === this.originalData.email &&
        this.modalData.role === this.originalData.role
      );
    }

    return true; // สำหรับ Add User ถ้ากรอกครบ
  }

  onSubmitUser() {
    const payload: UserInfo = {
      id: this.modalData.id,
      username: this.modalData.username,
      email: this.modalData.email,
      phone: this.modalData.phone,
      role: this.modalData.role,
      password: this.modalData.password,
      status: 'UNVERIFIED'
    };
    if (this.editingUser === true) {
      payload.status = this.modalData.status;
      this.userDateService.EditUser(payload).subscribe({
        next: (updatedUser) => {
          this.sharedData.updateUser(payload);
          this.closeModal();
          console.log('User updated:', updatedUser);
        },
        error: (err) => console.error(err, payload)
      });
    } else {
      this.userDateService.AddNewUser(payload).subscribe({
        next: (newUser) => {
          this.closeModal();
          this.sharedData.addUser(payload);
          console.log('User added:', newUser);
        },
        error: (err) => console.error(err)
      });
    }
  };

  onDelete(id: string) {
    Swal.fire({
      title: 'Delete?',
      text: 'Are you sure you want to delete?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Confirm',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.userDateService.DeleteUser(id).subscribe({
          next: () => {
            this.sharedData.removeUser(id);
          },
          error: (err) => Swal.fire({
            icon: 'error',
            title: 'Delete Failed',
            text: 'Please try again.'
          })
        });
      }
    });

  }
}
