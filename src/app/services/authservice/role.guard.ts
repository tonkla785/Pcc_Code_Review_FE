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

        // ตรวจสอบว่ามี Token หรือไม่
        if (!token) {
            router.navigate(['/login']);
            return false;
        }

        try {
            // ถอดรหัส Token ด้วย jwtDecode เพื่อเอา Role จาก Payload ยืนยัน
            const decodedToken: any = jwtDecode(token);

            // เช็ค key ให้ตรงกับที่ backend ส่ง role ออกมา
            const userRole = decodedToken.role || decodedToken.roles || decodedToken.authority;

            if (userRole && allowedRoles.includes(userRole)) {
                return true;
            } else {
                // ถ้า Role ไม่ตรงตามที่ผ่าน redirect ไป dashboard
                router.navigate(['/dashboard']);
                return false;
            }
        } catch (error) {
            // กรณี Token ผิดรูปแบบ หรือ ถูกผู้ใช้ไปแก้จนพัง
            tokenStorage.clear();
            router.navigate(['/login']);
            return false;
        }
    };
}
