import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, refreshSession, setToken } from "./api";
import { applyTheme, DEFAULT_PREFS, type Prefs } from "./theme";

export interface Me {
  id: string;
  name: string;
  email: string;
  role: "owner" | "user";
  hasAccess: boolean;
  subscription: { status: string; currentPeriodEnd: string | null };
  preferences: Prefs;
}
interface Ctx {
  user: Me | null | undefined; // undefined = carregando
  login(email: string, password: string): Promise<void>;
  register(i: { name: string; email: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  reload(): Promise<void>;
}
const AuthCtx = createContext<Ctx>(null!);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null | undefined>(undefined);

  const reload = useCallback(async () => {
    setUser(await api<Me>("/auth/me"));
  }, []);
  useEffect(() => {
    (async () => {
      try {
        if (await refreshSession()) await reload();
        else setUser(null);
      } catch {
        setUser(null);
      }
    })();
  }, [reload]);
  useEffect(() => {
    applyTheme(user?.preferences ?? DEFAULT_PREFS);
  }, [user]);

  const start = async (path: string, body: unknown) => {
    const r = await api<{ accessToken: string }>(path, {
      method: "POST",
      body,
    });
    setToken(r.accessToken);
    await reload();
  };
  const value: Ctx = {
    user,
    reload,
    login: (email, password) => start("/auth/login", { email, password }),
    register: (i) => start("/auth/register", { ...i, acceptTerms: true }),
    logout: async () => {
      await api("/auth/logout", { method: "POST" }).catch(() => {});
      setToken(null);
      setUser(null);
    },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
