import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AuthInterceptor } from './services/authservice/auth.interceptor';

export const appConfig = {
  providers: [
    provideHttpClient(withInterceptors([AuthInterceptor])),
  ],
};
