import { create } from 'zustand';

interface PasswordResetState {
  email: string | null;
  resetToken: string | null;

  setEmail: (email: string) => void;
  setResetToken: (token: string) => void;
  clear: () => void;
}

export const usePasswordResetStore = create<PasswordResetState>((set) => ({
  email: null,
  resetToken: null,

  setEmail: (email) => set({ email }),
  setResetToken: (resetToken) => set({ resetToken }),
  clear: () => set({ email: null, resetToken: null }),
}));