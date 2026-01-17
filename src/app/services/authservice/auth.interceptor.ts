// src/app/services/authservice/auth.interceptor.ts
import { HttpInterceptorFn, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    // tap(evt => {
    //   if (evt instanceof HttpResponse) {
    //     const newAuth = evt.headers.get('Authorization');
    //     if (newAuth?.startsWith('Bearer ')) {
    //       auth.setToken(newAuth.substring(7));
    //     }
    //   }
    // }),
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && auth.refreshToken) {
        return auth.refresh().pipe(
          switchMap(newToken => {
            const retry = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
            return next(retry);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
