import { useState, useRef, type ReactNode } from "react";
import { AuthContext, type AuthTokens, type User } from "./AuthContextValue";

const API = "/api";

function readStoredAuth(): {
  user: User | null;
  tokens: AuthTokens | null;
} {
  const stored = localStorage.getItem("auth");
  if (!stored) return { user: null, tokens: null };

  try {
    const parsed = JSON.parse(stored) as {
      user?: User;
      accessToken?: string;
      refreshToken?: string;
    };
    if (!parsed.user || !parsed.accessToken || !parsed.refreshToken) {
      localStorage.removeItem("auth");
      return { user: null, tokens: null };
    }
    return {
      user: parsed.user,
      tokens: {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
      },
    };
  } catch {
    localStorage.removeItem("auth");
    return { user: null, tokens: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialAuth] = useState(readStoredAuth);
  const [user, setUser] = useState<User | null>(initialAuth.user);
  const [tokens, setTokens] = useState<AuthTokens | null>(initialAuth.tokens);
  const loading = false;

  function persist(u: User, at: string, rt: string) {
    setUser(u);
    setTokens({ accessToken: at, refreshToken: rt });
    localStorage.setItem(
      "auth",
      JSON.stringify({ user: u, accessToken: at, refreshToken: rt }),
    );
  }
  async function login(email: string, password: string) {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Login failed");
    }
    const data = await res.json();
    persist(data.user, data.accessToken, data.refreshToken);
  }
  async function signup(
    email: string,
    name: string,
    password: string,
    role: "BUYER" | "SELLER",
  ) {
    const res = await fetch(`${API}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password, role }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Signup failed");
    }
    const data = await res.json();
    persist(data.user, data.accessToken, data.refreshToken);
  }

  function logout() {
    if (tokens?.accessToken) {
      fetch(`${API}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }).catch(() => {});
    }
    setUser(null);
    setTokens(null);
    localStorage.removeItem("auth");
  }

  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  function refreshAccessToken(): Promise<string | null> {
    if (refreshInFlight.current) return refreshInFlight.current;
    refreshInFlight.current = (async () => {
      if (!tokens?.refreshToken) return null;
      try {
        const res = await fetch(`${API}/auth/refresh`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tokens.refreshToken}` },
        });
        if (!res.ok) throw new Error("Refresh failed");
        const data = await res.json();
        setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
        const stored = localStorage.getItem("auth");
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.accessToken = data.accessToken;
          parsed.refreshToken = data.refreshToken;
          localStorage.setItem("auth", JSON.stringify(parsed));
        }
        return data.accessToken;
      } catch {
        logout();
        return null;
      }
    })().finally(() => {
      refreshInFlight.current = null;
    });
    return refreshInFlight.current;
  }

  async function authFetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    if (!tokens?.accessToken) throw new Error("Not authenticated");

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${tokens.accessToken}`);

    let res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        res = await fetch(url, { ...options, headers });
      }
    }

    return res;
  }
  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, logout, authFetch }}
    >
      {children}
    </AuthContext.Provider>
  );
}
