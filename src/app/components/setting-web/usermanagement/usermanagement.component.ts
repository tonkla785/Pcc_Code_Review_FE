import { Component } from '@angular/core';
import {FormsModule} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/authservice/auth.service';


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

  users: User[] = [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin', active: true },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'Admin', active: false },
    { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'User', active: true },
  ];

  modalOpen: boolean = false;
  editingUser: boolean = false;
  modalData: User = this.emptyUser(); 
  originalData: User = this.emptyUser(); 

  emptyUser(): User {
    return { id: 0, name: '', email: '', role: 'User', active: true };
  }

  filteredUsers(): User[] {
    return this.users.filter(user =>
      user.name.toLowerCase().includes(this.searchText.toLowerCase()) ||
      user.email.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  constructor(
        private readonly router: Router,
        private readonly authService: AuthService,
      ) { }
      
  ngOnInit(): void {
      const userId = this.authService.userId;
      console.log(userId);
      if (!userId) {
        this.router.navigate(['/login']);
        return;
      }
    }

  openAddUser() {
    this.modalData = this.emptyUser();
    this.editingUser = false;
    this.modalOpen = true;
  }

  openEditUser(user: User) {
    this.modalData = { ...user };
    this.originalData = { ...user };
    this.editingUser = true;
    this.modalOpen = true;
  }

  closeModal() {
    this.modalOpen = false;
  }
  canSave(): boolean {
    if (!this.modalData.name || !this.modalData.email || !this.modalData.role) {
      return false; // กรอกไม่ครบ
    }
    
    if (this.editingUser) {
      return !(
        this.modalData.name === this.originalData.name &&
        this.modalData.email === this.originalData.email &&
        this.modalData.role === this.originalData.role &&
        this.modalData.active === this.originalData.active
      );
    }

    return true; // สำหรับ Add User ถ้ากรอกครบ
  }
  saveUser() {
    if (this.editingUser) {
      // Update user
      const index = this.users.findIndex(u => u.id === this.modalData.id);
      if (index > -1) this.users[index] = { ...this.modalData };
      alert('User updated successfully');
    } else {
      // Add new user
      this.modalData.id = this.users.length + 1;
      this.users.push({ ...this.modalData });
      alert('User added successfully');
    }
    this.closeModal();
  }

  deleteUser(user: User) {
    const confirmDelete = confirm(`Are you sure you want to delete ${user.name}?`);
    if (confirmDelete) {
      this.users = this.users.filter(u => u.id !== user.id);
    }
  }

}
