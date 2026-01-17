import { TestBed } from '@angular/core/testing';

import { AssignhistoryService } from './assignhistory.service';

describe('AssignhistoryService', () => {
  let service: AssignhistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AssignhistoryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
