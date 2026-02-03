import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenStorageService } from '../tokenstorageService/token-storage.service';

/**
 * Role Guard - ตรวจสอบ role ของผู้ใช้ก่อนเข้าถึง route
 * @param allowedRoles - array ของ roles ที่อนุญาต เช่น ['ADMIN']
 */
export function roleGuard(allowedRoles: string[]): CanActivateFn {
    return () => {
        const tokenStorage = inject(TokenStorageService);
        const router = inject(Router);

        // ตรวจสอบว่า login อยู่หรือไม่
        if (!tokenStorage.hasToken()) {
            router.navigate(['/login']);
            return false;
        }

        // ดึง role จาก localStorage ที่เก็บตอน login
        const loginUser = tokenStorage.getLoginUser();

        if (loginUser && allowedRoles.includes(loginUser.role)) {
            return true;
        } else {
            // ถ้า role ไม่ตรง redirect ไป dashboard
            router.navigate(['/dashboard']);
            return false;
        }
    };
}
