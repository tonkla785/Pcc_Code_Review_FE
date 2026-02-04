/**
 * Password Validation Utilities
 * ใช้สำหรับ validate password ทั้งโปรเจค
 */

export interface PasswordRules {
    minLength: boolean;
    upper: boolean;
    lower: boolean;
    number: boolean;
    special: boolean;
}

/**
 * ตรวจสอบกฎของ password
 */
export function getPasswordRules(password: string): PasswordRules {
    const pwd = password || '';
    return {
        minLength: pwd.length >= 8,
        upper: /[A-Z]/.test(pwd),
        lower: /[a-z]/.test(pwd),
        number: /\d/.test(pwd),
        special: /[!@#$%&*]/.test(pwd),
    };
}

/**
 * ตรวจสอบว่า password ผ่านทุกกฎหรือไม่
 */
export function isPasswordValid(password: string): boolean {
    const r = getPasswordRules(password);
    return r.minLength && r.upper && r.lower && r.number && r.special;
}

/**
 * ตรวจสอบว่า password กับ confirmPassword ตรงกันหรือไม่
 */
export function isPasswordMismatch(password: string, confirmPassword: string): boolean {
    return !!password && !!confirmPassword && password !== confirmPassword;
}

/**
 * ข้อความ error สำหรับ password ที่ไม่ถูกต้อง
 */
export function getPasswordError(password: string): string {
    const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%&*]).{8,}$/;
    const pwd = password || '';
    return pwd && !pattern.test(pwd)
        ? 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
        : '';
}
