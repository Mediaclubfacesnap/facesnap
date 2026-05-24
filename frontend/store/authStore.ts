import { create } from "zustand";

interface UserResponse {
  id: string;
  email: string;
  username: string;
  full_name: string;
  avatar_url?: string | null;
  created_at: string;
}

interface AuthState {
  user: UserResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: UserResponse, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Safe extraction for SSR
  const isClient = typeof window !== "undefined";
  const storedUser = isClient ? localStorage.getItem("facesnap_user") : null;
  const storedToken = isClient ? localStorage.getItem("facesnap_token") : null;

  let initialUser: UserResponse | null = null;
  if (storedUser) {
    try {
      initialUser = JSON.parse(storedUser);
    } catch {
      if (isClient) localStorage.removeItem("facesnap_user");
    }
  }

  return {
    user: initialUser,
    token: storedToken,
    isAuthenticated: !!storedToken,
    login: (user, token) => {
      if (isClient) {
        localStorage.setItem("facesnap_user", JSON.stringify(user));
        localStorage.setItem("facesnap_token", token);
      }
      set({ user, token, isAuthenticated: true });
    },
    logout: () => {
      if (isClient) {
        localStorage.removeItem("facesnap_user");
        localStorage.removeItem("facesnap_token");
      }
      set({ user: null, token: null, isAuthenticated: false });
    }
  };
});
