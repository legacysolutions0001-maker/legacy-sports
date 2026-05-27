import * as React from "react";
import { useRoute, useLocation } from "wouter";
import { useGetUser, useUpdateUser, useUpdateFitness, useUpdateUserStatus, useListPerformances, useListAttendance, getGetUserQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, Activity, ClipboardList, PauseCircle, PlayCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const updateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  sport: z.string().optional(),
  age: z.coerce.number().int().positive().optional(),
  className: z.string().optional(),
  parentPhone: z.string().optional(),
  parentEmail: z.string().email().optional().or(z.literal("")),
});

export default function UserDetail() {
  const [, params] = useRoute("/users/:id");
  const [, setLocation] = useLocation();
  const userId = parseInt(params?.id ?? "0");
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: u, isLoading } = useGetUser(userId, { query: { enabled: !!userId, queryKey: getGetUserQueryKey(userId) } });
  const { data: performances } = useListPerformances({ playerId: userId });
  const { data: attendance } = useListAttendance({ userId });
  const updateMutation = useUpdateUser();
  const fitnessMutation = useUpdateFitness();
  const statusMutation = useUpdateUserStatus();

  const form = useForm<z.infer<typeof updateSchema>>({
    resolver: zodResolver(updateSchema),
    defaultValues: { name: "", email: "", phone: "", address: "", sport: "", className: "", parentPhone: "", parentEmail: "" },
  });

  React.useEffect(() => {
    if (u) {
      form.reset({
        name: u.name ?? "",
        email: u.email ?? "",
        phone: u.phone ?? "",
        address: u.address ?? "",
        sport: u.sport ?? "",
        age: u.age ?? undefined,
        className: u.className ?? "",
        parentPhone: u.parentPhone ?? "",
        parentEmail: u.parentEmail ?? "",
      });
    }
  }, [u, form]);

  const onSave = async (v: z.infer<typeof updateSchema>) => {
    try {
      await updateMutation.mutateAsync({ data: v, id: userId });
      toast({ title: "Profile updated" });
      qc.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const onStatusChange = async (status: "approved" | "suspended") => {
    try {
      await statusMutation.mutateAsync({ data: { status }, id: userId });
      toast({ title: status === "approved" ? "User reactivated" : "User suspended" });
      qc.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const onFitness = async (fitnessStatus: "fit" | "injured" | "recovering" | "resting") => {
    try {
      await fitnessMutation.mutateAsync({ data: { fitnessStatus }, id: userId });
      toast({ title: "Fitness status updated" });
      qc.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const presentCount = attendance?.filter((a) => a.status === "present").length ?? 0;
  const totalCount = attendance?.length ?? 0;
  const attendancePct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const perfChartData = performances?.slice(-10).map((p, i) => ({
    session: `#${i + 1}`,
    total: Object.values(p.customData as Record<string, number>).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0),
  }));

  if (isLoading) return <div className="p-6"><Skeleton className="h-96" /></div>;
  if (!u) return <div className="p-6 text-muted-foreground">User not found.</div>;

  const canEdit = me?.role === "superadmin" || me?.role === "school_admin" || me?.id === userId;
  const canManageStatus =
    (me?.role === "superadmin" || me?.role === "school_admin") ||
    (me?.role === "coach" && u.role === "player");

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/users")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold" data-testid="user-name">{u.name}</h1>
          <p className="text-sm text-muted-foreground">@{u.username} · <span className="capitalize">{u.role?.replace("_", " ")}</span></p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {u.status && (
            <Badge variant={u.status === "approved" ? "default" : "outline"} data-testid="status-badge">{u.status}</Badge>
          )}
          {u.role === "player" && u.fitnessStatus && (
            <Badge variant="outline" data-testid="fitness-badge">{u.fitnessStatus}</Badge>
          )}
          {canManageStatus && u.status === "approved" && (
            <Button size="sm" variant="outline" className="text-yellow-600 border-yellow-300 hover:bg-yellow-50" onClick={() => onStatusChange("suspended")} disabled={statusMutation.isPending} data-testid="button-suspend">
              <PauseCircle className="h-4 w-4 mr-1" />
              Suspend
            </Button>
          )}
          {canManageStatus && u.status === "suspended" && (
            <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50" onClick={() => onStatusChange("approved")} disabled={statusMutation.isPending} data-testid="button-reactivate">
              <PlayCircle className="h-4 w-4 mr-1" />
              Reactivate
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><User className="h-4 w-4 mr-1" />Profile</TabsTrigger>
          {u.role === "player" && <TabsTrigger value="performances"><Activity className="h-4 w-4 mr-1" />Performances</TabsTrigger>}
          <TabsTrigger value="attendance"><ClipboardList className="h-4 w-4 mr-1" />Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          {(me?.role === "coach" || me?.role === "school_admin" || me?.role === "superadmin") && u.role === "player" && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Fitness Status</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {(["fit", "injured", "recovering", "resting"] as const).map((fs) => (
                    <Button key={fs} size="sm" variant={u.fitnessStatus === fs ? "default" : "outline"} onClick={() => onFitness(fs)} data-testid={`button-fitness-${fs}`}>{fs}</Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {canEdit && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Edit Profile</CardTitle></CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSave)} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Name</FormLabel><FormControl><Input data-testid="input-name" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input data-testid="input-email" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Phone</FormLabel><FormControl><Input data-testid="input-phone" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="sport" render={({ field }) => (
                        <FormItem><FormLabel>Sport</FormLabel><FormControl><Input data-testid="input-sport" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      {u.role === "player" && (
                        <>
                          <FormField control={form.control} name="age" render={({ field }) => (
                            <FormItem><FormLabel>Age</FormLabel><FormControl><Input data-testid="input-age" type="number" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="className" render={({ field }) => (
                            <FormItem><FormLabel>Class</FormLabel><FormControl><Input data-testid="input-class" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name="parentPhone" render={({ field }) => (
                            <FormItem><FormLabel>Parent Phone</FormLabel><FormControl><Input data-testid="input-parent-phone" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </>
                      )}
                    </div>
                    <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem><FormLabel>Address</FormLabel><FormControl><Input data-testid="input-address" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save">Save Changes</Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="performances" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Sessions</p><p className="text-2xl font-bold">{performances?.length ?? 0}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Sport</p><p className="text-2xl font-bold">{u.sport || "—"}</p></CardContent></Card>
          </div>
          {perfChartData && perfChartData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Performance Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={perfChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="session" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          <div className="space-y-2">
            {performances?.slice().reverse().slice(0, 10).map((p) => (
              <Card key={p.id} data-testid={`card-performance-${p.id}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{p.sport} — {p.sessionType}</p>
                      <p className="text-xs text-muted-foreground">{new Date(p.recordedAt!).toLocaleDateString()}</p>
                      {p.sessionNotes && <p className="text-xs text-muted-foreground italic mt-1">{p.sessionNotes}</p>}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {Object.entries(p.customData as Record<string, string>).slice(0, 3).map(([k, v]) => (
                        <div key={k}>{k}: {v}</div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Total Sessions</p><p className="text-2xl font-bold">{totalCount}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Present</p><p className="text-2xl font-bold text-green-600">{presentCount}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Attendance %</p><p className="text-2xl font-bold">{attendancePct}%</p></CardContent></Card>
          </div>
          <div className="space-y-2">
            {attendance?.slice().reverse().slice(0, 15).map((a) => (
              <div key={a.id} data-testid={`row-attendance-${a.id}`} className="flex items-center justify-between py-2 px-4 border rounded-md">
                <div>
                  <p className="text-sm font-medium">{a.attDate}</p>
                  <p className="text-xs text-muted-foreground">{a.sessionType}</p>
                </div>
                <Badge variant={a.status === "present" ? "default" : a.status === "absent" ? "destructive" : "outline"}>{a.status}</Badge>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
