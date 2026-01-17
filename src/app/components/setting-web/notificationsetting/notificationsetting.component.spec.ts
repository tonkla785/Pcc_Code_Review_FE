import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationsettingComponent } from './notificationsetting.component';

describe('NotificationsettingComponent', () => {
  let component: NotificationsettingComponent;
  let fixture: ComponentFixture<NotificationsettingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsettingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationsettingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
