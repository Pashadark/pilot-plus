export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'MEMBER';
}

export interface LoginState {
  status: 'idle' | 'error';
  message?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
  };
}
