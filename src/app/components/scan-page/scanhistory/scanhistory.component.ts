import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../services/authservice/auth.service';
import { ScanResponseDTO } from '../../../interface/scan_interface';
import { SharedDataService } from '../../../services/shared-data/shared-data.service';
import { ScanService } from '../../../services/scanservice/scans.service';
@Component({
  selector: 'app-scanhistory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scanhistory.component.html',
  styleUrls: ['./scanhistory.component.css']
})
export class ScanhistoryComponent implements OnInit {
  ScanHistory: ScanResponseDTO[] = [];
  
  constructor(
     private sharedData: SharedDataService,
     private scanService: ScanService,
  ) {}

  ngOnInit(): void {
    this.sharedData.scansHistory$.subscribe((data) => { 
      this.ScanHistory = data ?? [];
    });
    if(!this.sharedData.hasScansHistoryCache){
      this.loadScanHistory();
    }
  }

  loadScanHistory(){
      this.sharedData.setLoading(true);
      
      this.scanService.getScansHistory().subscribe({
        next: (data: ScanResponseDTO[]) => {
          this.ScanHistory = data;
          this.sharedData.setLoading(false);
        },
        error: (error) => {
          console.error('Error fetching scan history:', error);
          this.sharedData.setLoading(false);
        }
      });
  }

}
