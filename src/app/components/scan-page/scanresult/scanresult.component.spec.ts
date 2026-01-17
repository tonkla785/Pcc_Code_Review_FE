import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScanresultComponent } from './scanresult.component';

describe('ScanresultComponent', () => {
  let component: ScanresultComponent;
  let fixture: ComponentFixture<ScanresultComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScanresultComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ScanresultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
