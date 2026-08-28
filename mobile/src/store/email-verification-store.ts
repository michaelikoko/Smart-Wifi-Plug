import { create } from 'zustand';

interface EmailVerificationState {
  email: string | null;
  setEmail: (email: string) => void;
  clear: () => void;
}

export const useEmailVerificationStore = create<EmailVerificationState>((set) => ({
  email: null,
  setEmail: (email) => set({ email }),
  clear: () => set({ email: null }),
}));