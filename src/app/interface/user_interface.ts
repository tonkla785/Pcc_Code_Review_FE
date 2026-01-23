/**
 * User information from login response
 */
export interface UserInfo {
  id: string;
  username: string;
  password: string;
  email: string;
  phone?: string;
  role: 'USER' | 'ADMIN';
}
export interface LoginUser {
  id: string;
  username: string;
  email: string;
  phone?: string;
  role: string;
}

/**
 * Login Response from API
 */ 
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  id: string;
  username: string;
  email: string;
  phone: string;
  role: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  phone: string;
  password: string;
}
