export interface SafeUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: 'SUPER_ADMIN' | 'MEMBER';
  canAccessAdmin: boolean;
  capabilities?: readonly ('CLIENTS' | 'RENTALS' | 'FINES')[];
}

export interface LoginState {
  status: 'idle' | 'error';
  message?: string;
  fieldErrors?: {
    login?: string;
    email?: string;
    password?: string;
  };
}
