import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailrepositoryComponent } from './detailrepository.component';

describe('DetailrepositoryComponent', () => {
  let component: DetailrepositoryComponent;
  let fixture: ComponentFixture<DetailrepositoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetailrepositoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetailrepositoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
