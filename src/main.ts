(window as any).global = window;

import { bootstrapApplication } from '@angular/platform-browser';
import { APP_INITIALIZER } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { AuthInterceptor } from './app/services/authservice/auth.interceptor';
import { AuthService } from './app/services/authservice/auth.service';
import { TokenStorageService } from './app/services/tokenstorageService/token-storage.service';
import { provideAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

function initAuth(auth: AuthService, tokenStorage: TokenStorageService) {
  return () => {
    if (!tokenStorage.getLoginUser()) {
      return Promise.resolve(null);
    }

    return firstValueFrom(
      auth.refresh().pipe(catchError(() => of(null))),
      { defaultValue: null },
    );
  };
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withInterceptors([AuthInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initAuth,
      deps: [AuthService, TokenStorageService],
      multi: true,
    },
  ],
});
