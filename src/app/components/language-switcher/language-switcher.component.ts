import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService, SupportedLang } from '../../services/language/language.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="lang-switcher">
      <button
        *ngFor="let lang of languageService.supported"
        class="lang-btn"
        [class.active]="languageService.current === lang"
        (click)="languageService.use(lang)"
      >
        {{ lang.toUpperCase() }}
      </button>
    </div>
  `,
  styles: [`
    .lang-switcher {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .lang-btn {
      padding: 3px 8px;
      border: 1px solid var(--border-color, #ccc);
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.15s;
    }
    .lang-btn.active {
      opacity: 1;
      background: var(--primary-color, #4a90d9);
      color: #fff;
      border-color: var(--primary-color, #4a90d9);
    }
  `]
})
export class LanguageSwitcherComponent {
  constructor(readonly languageService: LanguageService) {}
}
