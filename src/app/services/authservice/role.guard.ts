import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenStorageService } from '../tokenstorageService/token-storage.service';
import { jwtDecode } from 'jwt-decode';

/**
 * Role Guard - ตรวจสอบ role ของผู้ใช้จาก JWT token ก่อนเข้าถึง route
 * @param allowedRoles - array ของ roles ที่อนุญาต เช่น ['ADMIN']
 */
export function roleGuard(allowedRoles: string[]): CanActivateFn {
    return () => {
        const tokenStorage = inject(TokenStorageService);
        const router = inject(Router);

        const token = tokenStorage.getAccessToken();
        if (!token) {
            router.navigate(['/login']);
            return false;
        }

        try {
            const decodedToken: any = jwtDecode(token);
            const userRole = decodedToken.role || decodedToken.roles || decodedToken.authority;

            if (userRole && allowedRoles.includes(userRole)) {
                return true;
            } else {
                router.navigate(['/dashboard']);
                return false;
            }
        } catch (error) {
            tokenStorage.clear();
            router.navigate(['/login']);
            return false;
        }
    };
}
