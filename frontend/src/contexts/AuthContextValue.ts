import { createContext } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "BUYER" | "SELLER";
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    name: string,
    password: string,
    role: "BUYER" | "SELLER",
  ) => Promise<void>;
  logout: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const AuthContext = createContext<AuthContextType | null>(null);
