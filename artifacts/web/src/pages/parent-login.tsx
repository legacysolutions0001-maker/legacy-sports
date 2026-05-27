import * as React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Trophy, ArrowLeft, Loader2, Users, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type Step = 1 | 2;

export default function ParentLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = React.useState<Step>(1);
  const [schoolCode, setSchoolCode] = React.useState("");
  const [playerCode, setPlayerCode] = React.useState("");
  const [parentPhone, setParentPhone] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [demoLoading, setDemoLoading] = React.useState(false);
  const [schoolName, setSchoolName] = React.useState("");

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolCode.trim()) {
      toast({ title: "School code is required", variant: "destructive" });
      return;
    }
    // Quick validation: just go to step 2 (actual validation happens on login)
    setSchoolName(schoolCode.trim().toUpperCase());
    setStep(2);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerCode.trim() || !parentPhone.trim()) {
      toast({ title: "Player code and parent phone are required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/parent/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          schoolCode: schoolCode.trim().toUpperCase(),
          playerCode: playerCode.trim().toUpperCase(),
          parentPhone: parentPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Login failed", description: data.error || "Invalid credentials", variant: "destructive" });
        return;
      }
      toast({ title: `Welcome, ${data.parentName}!`, description: `Viewing portal for ${data.playerName}` });
      setLocation("/parent-portal");
    } catch {
      toast({ title: "Network error", description: "Could not connect to server", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      const res = await fetch("/api/parent/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ schoolCode: schoolCode.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Demo unavailable", description: data.error || "No demo data available", variant: "destructive" });
        return;
      }
      toast({ title: "Demo Mode Active", description: `Viewing demo portal for ${data.playerName}` });
      setLocation("/parent-portal");
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-14rem)] flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-green-500/15 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/15 blur-[120px]" />
      </div>

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8 text-white">
          <div className="h-16 w-16 bg-green-600 rounded-xl flex items-center justify-center mb-4 shadow-xl shadow-green-600/20">
            <Users className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Parent Portal</h1>
          <p className="text-zinc-400 mt-2 text-center">Track your child's sports journey</p>
        </div>

        <Card className="shadow-2xl shadow-green-600/5" key={step}>
          {step === 1 ? (
            <>
              <CardHeader>
                <CardTitle className="text-xl text-white">Enter School Code</CardTitle>
                <CardDescription className="text-zinc-400">
                  Start with your child's school code
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLookup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sc" className="text-zinc-300">School Code</Label>
                    <Input
                      id="sc"
                      type="text"
                      placeholder="e.g. EAGLES"
                      className="bg-zinc-800 border-zinc-700 text-white uppercase"
                      value={schoolCode}
                      onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white">
                    Continue
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 border-t border-zinc-800 pt-6">
                <p className="text-sm text-zinc-400 text-center">Want to explore first?</p>
                <Button
                  variant="outline"
                  className="w-full border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                  onClick={handleDemo}
                  disabled={demoLoading}
                >
                  {demoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  View Demo Portal
                </Button>
                <Link href="/" className="text-xs text-zinc-500 hover:text-primary transition-colors text-center">
                  Back to main login →
                </Link>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader>
                <div className="flex items-center mb-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 -ml-2 mr-2 text-zinc-400 hover:text-white"
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium text-green-400">{schoolName}</span>
                </div>
                <CardTitle className="text-xl text-white">Parent Sign In</CardTitle>
                <CardDescription className="text-zinc-400">
                  Enter your child's player code and your phone number
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pc" className="text-zinc-300">Player Code</Label>
                    <Input
                      id="pc"
                      type="text"
                      placeholder="e.g. PLR1234"
                      className="bg-zinc-800 border-zinc-700 text-white uppercase"
                      value={playerCode}
                      onChange={(e) => setPlayerCode(e.target.value.toUpperCase())}
                    />
                    <p className="text-xs text-zinc-500">Find this on your child's sports ID card</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ph" className="text-zinc-300">Your Phone Number</Label>
                    <Input
                      id="ph"
                      type="tel"
                      placeholder="e.g. 9876543210"
                      className="bg-zinc-800 border-zinc-700 text-white"
                      value={parentPhone}
                      onChange={(e) => setParentPhone(e.target.value)}
                    />
                    <p className="text-xs text-zinc-500">The phone number registered by your child's school</p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white mt-2"
                    disabled={submitting}
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Sign In
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 border-t border-zinc-800 pt-4">
                <Button
                  variant="outline"
                  className="w-full border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                  onClick={handleDemo}
                  disabled={demoLoading}
                >
                  {demoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  View Demo Instead
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
