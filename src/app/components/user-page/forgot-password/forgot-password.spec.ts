// src/app/pages/forgot-password/forgot-password.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ForgotPasswordComponent } from './forgot-password.component';
// import { AuthPasswordResetService } from '../../services/auth-password-reset.service';
import { of } from 'rxjs';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;

  // mock service ที่คอมโพเนนต์เรียกใช้
  const svcMock = {
    request: jasmine.createSpy('request').and.returnValue(of({}))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent], // standalone component
      providers: [
        // { provide: AuthPasswordResetService, useValue: svcMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
