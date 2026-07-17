export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN';
}

export interface LoginState {
  status: 'idle' | 'error';
  message?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
  };
}
