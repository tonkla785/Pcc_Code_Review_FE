import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { TokenStorageService } from '../tokenstorageService/token-storage.service';
import { Router } from '@angular/router';
import { catchError, switchMap, filter, take, finalize } from 'rxjs/operators';
import { throwError, EMPTY, BehaviorSubject, Observable } from 'rxjs';

// Flag เพื่อป้องกันการเรียก refresh ซ้ำ
let isRefreshing = false;

// Subject เพื่อ notify requests ที่รอว่า refresh เสร็จแล้ว
// null = กำลัง refresh, string = token ใหม่
let refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {

  const auth = inject(AuthService);
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  // ไม่ใส่ token ให้ request ไปยัง auth endpoints
  const isAuthUrl = req.url.includes('/user/login') ||
    req.url.includes('/user/register') ||
    req.url.includes('/user/refresh');

  const token = auth.token;
  const authReq = (token && !isAuthUrl)
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // ถ้าเป็น refresh request ที่ล้มเหลว → เรียก logout แล้ว redirect
      if (req.url.includes('/user/refresh')) {
        console.warn('Refresh token expired or invalid, calling logout and redirecting to home');
        isRefreshing = false;
        refreshTokenSubject.next(null);

        // เรียก logout เพื่อ clear ข้อมูลที่ backend (ไม่สนใจว่าสำเร็จหรือไม่)
        auth.logout().pipe(
          catchError(() => EMPTY),
          finalize(() => {
            tokenStorage.clear();
            router.navigate(['/']);
          })
        ).subscribe();

        return EMPTY;
      }

      // ถ้าเป็น 401/403 และยังมี token อยู่ → ลอง refresh
      if ((err.status === 401 || err.status === 403) && auth.isLoggedIn) {

        if (isRefreshing) {
          // ถ้ากำลัง refresh อยู่ → รอ token ใหม่แล้ว retry
          return refreshTokenSubject.pipe(
            filter(token => token !== null),
            take(1),
            switchMap(newToken => {
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` }
              });
              return next(retryReq);
            })
          );
        }

        // เริ่ม refresh
        isRefreshing = true;
        refreshTokenSubject.next(null); // reset

        return auth.refresh().pipe(
          switchMap(() => {
            isRefreshing = false;
            const newToken = auth.token!;
            refreshTokenSubject.next(newToken); // notify pending requests

            const retry = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` }
            });
            return next(retry);
          }),
          catchError((refreshErr) => {
            // Refresh ล้มเหลว → เรียก logout แล้ว redirect
            isRefreshing = false;
            refreshTokenSubject.next(null);
            console.warn('Token refresh failed, calling logout and redirecting to home');

            // เรียก logout เพื่อ clear ข้อมูลที่ backend (ไม่สนใจว่าสำเร็จหรือไม่)
            auth.logout().pipe(
              catchError(() => EMPTY),
              finalize(() => {
                tokenStorage.clear();
                router.navigate(['/']);
              })
            ).subscribe();

            return EMPTY;
          })
        );
      }

      return throwError(() => err);
    })
  );
};
