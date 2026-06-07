import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type SupportedLang = 'en' | 'th';

const LANG_KEY = 'app_lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly supported: SupportedLang[] = ['en', 'th'];
  private _current: SupportedLang;

  constructor(private readonly translate: TranslateService) {
    const saved = localStorage.getItem(LANG_KEY) as SupportedLang | null;
    const initial: SupportedLang = this.supported.includes(saved as SupportedLang)
      ? (saved as SupportedLang)
      : 'en';

    this._current = initial;
    this.translate.addLangs(this.supported);
    this.translate.setFallbackLang('en');
    this.translate.use(initial);
  }

  get current(): SupportedLang {
    return this._current;
  }

  use(lang: SupportedLang): void {
    this._current = lang;
    this.translate.use(lang);
    localStorage.setItem(LANG_KEY, lang);
  }

  toggle(): void {
    this.use(this._current === 'en' ? 'th' : 'en');
  }
}
