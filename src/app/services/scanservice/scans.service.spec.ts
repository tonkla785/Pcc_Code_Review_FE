import { TestBed } from '@angular/core/testing';
import { ScanService } from './scans.service';

describe('ScanService', () => {
  let service: ScanService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScanService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
