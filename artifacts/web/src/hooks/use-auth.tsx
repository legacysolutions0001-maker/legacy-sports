import * as React from "react";
import { useGetMe, useLogin, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import type { SessionUser, LoginInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

export interface SchoolInfo {
  id: number;
  name: string;
  code: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  isPaused?: boolean | null;
  pauseMessage?: string | null;
  isDemo?: boolean | null;
  demoMessage?: string | null;
}

interface AuthContextType {
  user: SessionUser | null;
  school: SchoolInfo | null;
  isLoading: boolean;
  login: (data: LoginInput) => Promise<unknown>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

const TAB_KEY = "ls_tab_active";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const hasCheckedTab = React.useRef(false);

  const user = data?.user ?? null;
  const school = ((data as { user?: SessionUser | null; school?: SchoolInfo | null }) as { school?: SchoolInfo | null })?.school ?? null;

  const logout = React.useCallback(async () => {
    sessionStorage.removeItem(TAB_KEY);
    await logoutMutation.mutateAsync(undefined);
    queryClient.setQueryData(getGetMeQueryKey(), null);
    setLocation("/");
  }, [logoutMutation, queryClient, setLocation]);

  const logoutAll = React.useCallback(async () => {
    sessionStorage.removeItem(TAB_KEY);
    await fetch("/api/auth/logout-all", { method: "POST", credentials: "include" });
    queryClient.setQueryData(getGetMeQueryKey(), null);
    setLocation("/");
  }, [queryClient, setLocation]);

  const login = React.useCallback(async (data: LoginInput) => {
    const result = await loginMutation.mutateAsync(data);
    sessionStorage.setItem(TAB_KEY, "1");
    return result;
  }, [loginMutation]);

  React.useEffect(() => {
    if (isLoading || hasCheckedTab.current) return;
    if (!user) return;
    hasCheckedTab.current = true;

    if (user.role !== "superadmin") {
      const tabActive = sessionStorage.getItem(TAB_KEY);
      if (!tabActive) {
        logout();
        return;
      }
    }
    sessionStorage.setItem(TAB_KEY, "1");
  }, [isLoading, user, logout]);

  const value = React.useMemo(
    () => ({ user, school, isLoading, login, logout, logoutAll }),
    [user, school, isLoading, login, logout, logoutAll]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
