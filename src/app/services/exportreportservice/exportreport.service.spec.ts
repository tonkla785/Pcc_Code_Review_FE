import { TestBed } from '@angular/core/testing';

import { ExportreportService } from './exportreport.service';

describe('ExportreportService', () => {
  let service: ExportreportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExportreportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
