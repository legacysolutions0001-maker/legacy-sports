import * as React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLookupSchool, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, ArrowLeft, Loader2, PauseCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { user, login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const lookupMutation = useLookupSchool();

  const [step, setStep] = React.useState<1 | 2>(1);
  const [school, setSchool] = React.useState<{ code: string; name?: string; logoUrl?: string; isDemo?: boolean; demoMessage?: string } | null>(null);
  const [code, setCode] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [suspended, setSuspended] = React.useState<{ name: string; message: string } | null>(null);
  const SUSPENDED_FALLBACK_MSG = "This school account is currently suspended. Please contact your school administrator or the Legacy Sports director for assistance.";

  React.useEffect(() => {
    if (user) setLocation(user.role === "parent" ? "/parent-portal" : "/dashboard");
  }, [user, setLocation]);

  const onLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) { toast({ title: "School code is required", variant: "destructive" }); return; }
    if (c === "SUPERADMIN" || c === "SUPER") {
      setSchool({ code: "SUPERADMIN", name: "Super Admin (SUPER)" });
      setStep(2);
      return;
    }
    try {
      const result = await lookupMutation.mutateAsync({ data: { code: c } });
      if (result.isPaused) {
        setSuspended({
          name: result.name ?? "This school",
          message:
            result.pauseMessage || SUSPENDED_FALLBACK_MSG,
        });
        return;
      }
      setSchool({ code: result.code, name: result.name, logoUrl: result.logoUrl, isDemo: result.isDemo ?? false, demoMessage: result.demoMessage ?? "" });
      setStep(2);
    } catch (error: any) {
      toast({
        title: "School not found",
        description: error.response?.data?.error || "Invalid school code",
        variant: "destructive",
      });
    }
  };

  const onLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school) return;
    if (!username.trim() || !password) {
      toast({ title: "Username and password are required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const result = await login({
        data: {
          schoolCode: school.code,
          username: username.trim(),
          password,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Login successful" });
      const role = (result as any)?.user?.role;
      setLocation(role === "parent" ? "/parent-portal" : "/dashboard");
    } catch (error: any) {
      const status = error?.response?.status;
      const msg = error?.response?.data?.error;
      if (status === 403 && /paused|suspended/i.test(msg ?? "")) {
        setSuspended({
          name: school?.name ?? "This school",
          message:
            msg || SUSPENDED_FALLBACK_MSG,
        });
      } else {
        toast({
          title: "Login failed",
          description: msg || "Invalid credentials",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const goSuperadmin = () => {
    setCode("SUPER");
    setSchool({ code: "SUPERADMIN", name: "Super Admin (SUPER)" });
    setStep(2);
  };

  const backToStep1 = () => {
    setStep(1);
    setUsername("");
    setPassword("");
  };

  return (
    <div className="min-h-[calc(100dvh-14rem)] flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/20 blur-[120px]" />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8 text-white">
          <div className="h-16 w-16 bg-primary rounded-xl flex items-center justify-center mb-4 shadow-xl shadow-primary/20">
            <Trophy className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Legacy Sports</h1>
          <p className="text-zinc-400 mt-2 text-center">Elite athletic management platform</p>
        </div>

        <Card className="glass-strong shadow-2xl shadow-primary/5 step-fade-in" key={step}>
          {step === 1 ? (
            <>
              <CardHeader>
                <CardTitle className="text-xl text-white">Welcome back</CardTitle>
                <CardDescription className="text-zinc-400">
                  Enter your school code to continue
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onLookupSubmit} className="space-y-4" autoComplete="off">
                  <div className="space-y-2">
                    <Label htmlFor="school-code" className="text-zinc-300">School Code</Label>
                    <Input
                      id="school-code"
                      name="schoolCode"
                      type="text"
                      placeholder="e.g. EAGLES"
                      className="bg-zinc-800 border-zinc-700 text-white uppercase"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      data-testid="input-school-code"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={lookupMutation.isPending}>
                    {lookupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 border-t border-zinc-800 pt-6">
                <p className="text-sm text-zinc-400 text-center">
                  New to Legacy Sports? <Link href="/register" className="text-primary hover:text-primary/80 font-medium">Register here</Link>
                </p>
                <button
                  type="button"
                  onClick={goSuperadmin}
                  className="text-xs text-zinc-500 hover:text-primary transition-colors"
                >
                  System administrator? Click here →
                </button>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2 mr-2 text-zinc-400 hover:text-white" onClick={backToStep1}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  {school?.logoUrl && <img src={school.logoUrl} alt="Logo" className="h-6 w-6 object-contain rounded mr-2" />}
                  <span className="text-sm font-medium text-primary">{school?.name}</span>
                  {school?.isDemo && (
                    <span className="ml-2 text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-semibold">DEMO</span>
                  )}
                </div>
                <CardTitle className="text-xl text-white">Sign in</CardTitle>
                <CardDescription className="text-zinc-400">
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onLoginSubmit} className="space-y-4" autoComplete="off">
                  <div className="space-y-2">
                    <Label htmlFor="login-username" className="text-zinc-300">Username</Label>
                    <Input
                      id="login-username"
                      name="username"
                      type="text"
                      placeholder="Enter username"
                      className="bg-zinc-800 border-zinc-700 text-white"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      data-testid="input-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-zinc-300">Password</Label>
                    <PasswordInput
                      id="login-password"
                      name="password"
                      placeholder="••••••••"
                      className="bg-zinc-800 border-zinc-700 text-white"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="input-password"
                    />
                  </div>
                  <Button type="submit" className="w-full mt-2" disabled={submitting} data-testid="button-signin">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <Dialog open={!!suspended} onOpenChange={(o) => !o && setSuspended(null)}>
        <DialogContent data-testid="dialog-school-suspended">
          <DialogHeader>
            <div className="mx-auto h-14 w-14 rounded-full bg-destructive/15 flex items-center justify-center mb-3">
              <PauseCircle className="h-7 w-7 text-destructive" />
            </div>
            <DialogTitle className="text-center">{suspended?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-foreground text-center px-2 whitespace-pre-line">{suspended?.message}</p>
          <DialogFooter>
            <Button className="w-full" onClick={() => setSuspended(null)} data-testid="button-close-suspended">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
