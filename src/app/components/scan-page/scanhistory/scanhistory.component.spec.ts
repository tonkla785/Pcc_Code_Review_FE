import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScanhistoryComponent } from './scanhistory.component';

describe('ScanhistoryComponent', () => {
  let component: ScanhistoryComponent;
  let fixture: ComponentFixture<ScanhistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScanhistoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScanhistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
