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
  login: ReturnType<typeof useLogin>["mutateAsync"];
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useGetMe({ query: { retry: false, queryKey: getGetMeQueryKey() } });
  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const user = data?.user ?? null;
  const school = ((data as { user?: SessionUser | null; school?: SchoolInfo | null }) as { school?: SchoolInfo | null })?.school ?? null;

  const logout = React.useCallback(async () => {
    await logoutMutation.mutateAsync(undefined);
    queryClient.setQueryData(getGetMeQueryKey(), null);
    setLocation("/");
  }, [logoutMutation, queryClient, setLocation]);

  const value = React.useMemo(
    () => ({
      user,
      school,
      isLoading,
      login: loginMutation.mutateAsync,
      logout,
    }),
    [user, school, isLoading, loginMutation.mutateAsync, logout]
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
