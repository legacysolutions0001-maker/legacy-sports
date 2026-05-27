import * as React from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLookupSchool, useRegister, useListSports } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const step1Schema = z.object({ schoolCode: z.string().min(1, "School code required") });

const step2Schema = z.object({
  role: z.enum(["player", "coach"]),
  username: z.string().min(3, "Min 3 chars"),
  password: z.string().min(6, "Min 6 chars"),
  name: z.string().min(2, "Name required"),
  sport: z.string().min(1, "Sport is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  age: z.coerce.number().int().positive().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),
  className: z.string().optional(),
  section: z.string().optional(),
  rollNumber: z.string().optional(),
  admissionNumber: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  parentWhatsapp: z.string().optional(),
  parentEmail: z.string().email().optional().or(z.literal("")),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [schoolCode, setSchoolCode] = React.useState("");
  const [schoolName, setSchoolName] = React.useState("");
  const lookupMutation = useLookupSchool();
  const registerMutation = useRegister();
  const { data: sports } = useListSports();

  const form1 = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    defaultValues: { schoolCode: "" },
  });

  const form2 = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    defaultValues: { role: "player", username: "", password: "", name: "", sport: "", email: "", phone: "", whatsappNumber: "", dateOfBirth: "", gender: "", address: "", className: "", section: "", rollNumber: "", admissionNumber: "", parentName: "", parentPhone: "", parentWhatsapp: "", parentEmail: "" },
  });

  const onStep1 = async (v: z.infer<typeof step1Schema>) => {
    try {
      const result = await lookupMutation.mutateAsync({ data: { code: v.schoolCode } });
      setSchoolCode(result.code);
      setSchoolName(result.name);
      setStep(2);
    } catch {
      toast({ title: "School not found", variant: "destructive" });
    }
  };

  const onStep2 = async (v: z.infer<typeof step2Schema>) => {
    try {
      await registerMutation.mutateAsync({
        data: {
          schoolCode,
          role: v.role,
          username: v.username,
          password: v.password,
          name: v.name,
          sport: v.sport,
          email: v.email ?? "",
          phone: v.phone ?? "",
          whatsappNumber: v.whatsappNumber ?? "",
          age: v.age ? Number(v.age) : undefined,
          dateOfBirth: v.dateOfBirth || undefined,
          gender: v.gender ?? "",
          address: v.address ?? "",
          className: v.className ?? "",
          section: v.section ?? "",
          rollNumber: v.rollNumber ?? "",
          admissionNumber: v.admissionNumber ?? "",
          parentName: v.parentName ?? "",
          parentPhone: v.parentPhone ?? "",
          parentWhatsapp: v.parentWhatsapp ?? "",
          parentEmail: v.parentEmail ?? "",
        },
      });
      setStep(3);
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.response?.data?.error ?? "Please try again",
        variant: "destructive",
      });
    }
  };

  const roleValue = form2.watch("role");

  return (
    <div className="min-h-[calc(100dvh-14rem)] flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/20 blur-[120px]" />
      </div>
      <div className="w-full max-w-lg z-10">
        <div className="flex flex-col items-center mb-8 text-white">
          <div className="h-16 w-16 bg-primary rounded-xl flex items-center justify-center mb-4 shadow-xl shadow-primary/20">
            <Trophy className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Legacy Sports</h1>
          <p className="text-zinc-400 mt-2">Create your account</p>
        </div>

        {step === 3 ? (
          <Card className="border-zinc-800 bg-zinc-900/80 backdrop-blur-xl shadow-2xl text-center">
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <h2 className="text-xl font-bold text-white">Registration Submitted</h2>
              <p className="text-zinc-400 text-sm">Your account is pending approval by an administrator. You will be notified once approved.</p>
              <Button onClick={() => setLocation("/")} className="mt-2">Return to Login</Button>
            </CardContent>
          </Card>
        ) : step === 1 ? (
          <Card className="border-zinc-800 bg-zinc-900/80 backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <CardTitle className="text-xl text-white">Enter School Code</CardTitle>
              <CardDescription className="text-zinc-400">Get your school code from your administrator</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form1}>
                <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-4">
                  <FormField control={form1.control} name="schoolCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-300">School Code</FormLabel>
                      <FormControl>
                        <Input data-testid="input-school-code" placeholder="e.g. EAGLES" className="bg-zinc-800 border-zinc-700 text-white uppercase" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={lookupMutation.isPending} data-testid="button-continue">
                    {lookupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
                  </Button>
                  <p className="text-center text-sm text-zinc-400">Already have an account? <Link href="/" className="text-primary">Sign in</Link></p>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-zinc-800 bg-zinc-900/80 backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2 text-zinc-400" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-primary font-medium">{schoolName}</span>
              </div>
              <CardTitle className="text-xl text-white">Create Account</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form2}>
                <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form2.control} name="role" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300">Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger data-testid="select-role" className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="player">Player</SelectItem>
                            <SelectItem value="coach">Coach</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form2.control} name="sport" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300">Sport <span className="text-red-400">*</span></FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger data-testid="select-sport" className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            {sports?.map((s) => <SelectItem key={s.id} value={s.sportName}>{s.sportName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form2.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-300">Full Name</FormLabel>
                      <FormControl><Input data-testid="input-name" placeholder="Full name" className="bg-zinc-800 border-zinc-700 text-white" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form2.control} name="username" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300">Username</FormLabel>
                        <FormControl><Input data-testid="input-username" placeholder="username" className="bg-zinc-800 border-zinc-700 text-white" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form2.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300">Password</FormLabel>
                        <FormControl><PasswordInput data-testid="input-password" placeholder="min 6 chars" className="bg-zinc-800 border-zinc-700 text-white" autoComplete="new-password" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form2.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300">Email (optional)</FormLabel>
                        <FormControl><Input data-testid="input-email" placeholder="email@..." className="bg-zinc-800 border-zinc-700 text-white" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form2.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300">Phone (optional)</FormLabel>
                        <FormControl><Input data-testid="input-phone" placeholder="Phone" className="bg-zinc-800 border-zinc-700 text-white" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form2.control} name="whatsappNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-300">WhatsApp Number (optional)</FormLabel>
                      <FormControl><Input data-testid="input-whatsapp" placeholder="WhatsApp" className="bg-zinc-800 border-zinc-700 text-white" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  {roleValue === "player" && (
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form2.control} name="admissionNumber" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-zinc-300">Admission No.</FormLabel>
                          <FormControl><Input data-testid="input-admission" placeholder="ADM001" className="bg-zinc-800 border-zinc-700 text-white" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form2.control} name="age" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-zinc-300">Age</FormLabel>
                          <FormControl><Input data-testid="input-age" type="number" placeholder="Age" className="bg-zinc-800 border-zinc-700 text-white" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form2.control} name="dateOfBirth" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-zinc-300">Date of Birth</FormLabel>
                          <FormControl><Input data-testid="input-dob" type="date" className="bg-zinc-800 border-zinc-700 text-white" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form2.control} name="gender" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-zinc-300">Gender</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger data-testid="select-gender" className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form2.control} name="section" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-zinc-300">Section</FormLabel>
                          <FormControl><Input data-testid="input-section" placeholder="e.g. A" className="bg-zinc-800 border-zinc-700 text-white" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form2.control} name="parentName" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-zinc-300">Parent Name</FormLabel>
                          <FormControl><Input data-testid="input-parent-name" placeholder="Parent name" className="bg-zinc-800 border-zinc-700 text-white" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form2.control} name="parentPhone" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-zinc-300">Parent Phone</FormLabel>
                          <FormControl><Input data-testid="input-parent-phone" placeholder="Parent phone" className="bg-zinc-800 border-zinc-700 text-white" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form2.control} name="parentWhatsapp" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-zinc-300">Parent WhatsApp</FormLabel>
                          <FormControl><Input data-testid="input-parent-whatsapp" placeholder="Parent WhatsApp" className="bg-zinc-800 border-zinc-700 text-white" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form2.control} name="className" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-zinc-300">Class</FormLabel>
                          <FormControl><Input data-testid="input-class" placeholder="e.g. 10A" className="bg-zinc-800 border-zinc-700 text-white" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  )}
                  <Button type="submit" className="w-full mt-2" disabled={registerMutation.isPending} data-testid="button-register">
                    {registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Registration"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
