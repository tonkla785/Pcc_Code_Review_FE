import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SonarqubeconfigComponent } from './sonarqubeconfig.component';

describe('SonarqubeconfigComponent', () => {
  let component: SonarqubeconfigComponent;
  let fixture: ComponentFixture<SonarqubeconfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SonarqubeconfigComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SonarqubeconfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
