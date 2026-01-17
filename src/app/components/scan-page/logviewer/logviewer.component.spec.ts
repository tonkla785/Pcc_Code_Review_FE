import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogviewerComponent } from './logviewer.component';

describe('LogviewerComponent', () => {
  let component: LogviewerComponent;
  let fixture: ComponentFixture<LogviewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogviewerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LogviewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
