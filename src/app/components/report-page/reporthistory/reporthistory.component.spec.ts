import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReporthistoryComponent } from './reporthistory.component';

describe('ReporthistoryComponent', () => {
  let component: ReporthistoryComponent;
  let fixture: ComponentFixture<ReporthistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReporthistoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReporthistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
