import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TechnicaldebtComponent } from './technicaldebt.component';

describe('TechnicaldebtComponent', () => {
  let component: TechnicaldebtComponent;
  let fixture: ComponentFixture<TechnicaldebtComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TechnicaldebtComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TechnicaldebtComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
