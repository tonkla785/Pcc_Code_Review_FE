import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeneratereportComponent } from './generatereport.component';

describe('GeneratereportComponent', () => {
  let component: GeneratereportComponent;
  let fixture: ComponentFixture<GeneratereportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeneratereportComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeneratereportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
