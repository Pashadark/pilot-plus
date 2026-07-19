export interface ProfileActionState {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
}

export type ProfileValidationResult =
  | { ok: true; name: string; email: string; currentPassword: string }
  | { ok: false; state: ProfileActionState };

export type PasswordValidationResult =
  | { ok: true; currentPassword: string; newPassword: string }
  | { ok: false; state: ProfileActionState };
