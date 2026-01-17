// src/app/pages/reset-password/reset-password.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResetPasswordComponent } from './reset-password.component';
import { Router } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { AuthPasswordResetService } from '../../services/auth-password-reset.service';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;

  // mock service ที่คอมโพเนนต์เรียกใช้
  const svcMock = {
    confirm: jasmine.createSpy('confirm').and.returnValue(of({})),
    request: jasmine.createSpy('request').and.returnValue(of({}))
  };

  // mock Router & ActivatedRoute
  const routerMock = {
    navigate: jasmine.createSpy('navigate'),
    navigateByUrl: jasmine.createSpy('navigateByUrl')
  };

  const activatedRouteMock = {
    // ให้มี token ใน query string ตอนเริ่ม
    queryParamMap: of(convertToParamMap({ token: 'test-token' }))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent], // standalone component
      providers: [
        { provide: AuthPasswordResetService, useValue: svcMock },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
