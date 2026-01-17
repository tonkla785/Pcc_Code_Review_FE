import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IssuemodalComponent } from './issuemodal.component';

describe('IssuemodalComponent', () => {
  let component: IssuemodalComponent;
  let fixture: ComponentFixture<IssuemodalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IssuemodalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IssuemodalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
