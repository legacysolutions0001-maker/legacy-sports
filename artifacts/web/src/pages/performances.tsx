import * as React from "react";
import { useListPerformances, useCreatePerformance, useDeletePerformance, useListSports, useListUsers, getListPerformancesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SportField } from "@workspace/api-client-react";

export default function Performances() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [selectedSport, setSelectedSport] = React.useState<string>("");
  const [customFields, setCustomFields] = React.useState<Record<string, string>>({});

  const queryParams = user?.role === "player" ? { playerId: user.id } : user?.role === "coach" ? { coachId: user.id } : {};
  const { data: performances, isLoading } = useListPerformances(queryParams);
  const { data: sports } = useListSports();
  const { data: players } = useListUsers({ role: "player", status: "approved", schoolId: user?.schoolId ?? undefined });
  const createMutation = useCreatePerformance();
  const deleteMutation = useDeletePerformance();

  const form = useForm<{ playerId: string; sport: string; sessionType: string; sessionNotes: string }>({
    defaultValues: { playerId: user?.role === "player" ? String(user.id) : "", sport: "", sessionType: "Training", sessionNotes: "" },
  });

  const activeSportFields = React.useMemo<SportField[]>(() => {
    if (!selectedSport || !sports) return [];
    return sports.find((s) => s.sportName === selectedSport)?.fieldsJson ?? [];
  }, [selectedSport, sports]);

  const onSubmit = async (v: { playerId: string; sport: string; sessionType: string; sessionNotes: string }) => {
    if (!v.playerId || !v.sport) {
      toast({ title: "Player and sport required", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: {
          playerId: parseInt(v.playerId),
          sport: v.sport,
          sessionType: v.sessionType,
          sessionNotes: v.sessionNotes,
          customData: customFields,
        },
      });
      toast({ title: "Performance recorded" });
      qc.invalidateQueries({ queryKey: getListPerformancesQueryKey(queryParams) });
      setOpen(false);
      form.reset();
      setCustomFields({});
    } catch (e: any) {
      toast({ title: "Failed", description: e.response?.data?.error, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: "Deleted" });
      qc.invalidateQueries({ queryKey: getListPerformancesQueryKey(queryParams) });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const canLog = user?.role === "coach" || user?.role === "school_admin" || user?.role === "superadmin";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performances</h1>
          <p className="text-muted-foreground">Training sessions and performance data</p>
        </div>
        {canLog && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-log-performance"><Plus className="h-4 w-4 mr-2" />Log Session</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Log Performance</DialogTitle></DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                {user?.role !== "player" && (
                  <div>
                    <label className="text-sm font-medium">Player</label>
                    <Select onValueChange={(v) => form.setValue("playerId", v)}>
                      <SelectTrigger data-testid="select-player" className="mt-1"><SelectValue placeholder="Select player..." /></SelectTrigger>
                      <SelectContent>
                        {players?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.sport || "no sport"})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">Sport</label>
                  <Select onValueChange={(v) => { form.setValue("sport", v); setSelectedSport(v); setCustomFields({}); }}>
                    <SelectTrigger data-testid="select-sport" className="mt-1"><SelectValue placeholder="Select sport..." /></SelectTrigger>
                    <SelectContent>
                      {sports?.map((s) => <SelectItem key={s.id} value={s.sportName}>{s.sportName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Session Type</label>
                  <Select defaultValue="Training" onValueChange={(v) => form.setValue("sessionType", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Training">Training</SelectItem>
                      <SelectItem value="Match">Match</SelectItem>
                      <SelectItem value="Practice">Practice</SelectItem>
                      <SelectItem value="Assessment">Assessment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Input {...form.register("sessionNotes")} placeholder="Session notes..." className="mt-1" />
                </div>

                {activeSportFields.length > 0 && (
                  <div className="border rounded-md p-3 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Sport Statistics</p>
                    {activeSportFields.filter((f) => !f.auto).map((field) => (
                      <div key={field.key}>
                        <label className="text-xs font-medium">{field.label}</label>
                        <Input
                          data-testid={`input-stat-${field.key}`}
                          type={field.type === "text" ? "text" : "number"}
                          placeholder={field.placeholder ?? ""}
                          className="mt-1 h-8 text-sm"
                          value={customFields[field.key] ?? ""}
                          onChange={(e) => setCustomFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-performance">
                  Save Performance
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : performances?.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No performance records yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {performances?.slice().reverse().map((p) => (
            <Card key={p.id} data-testid={`card-performance-${p.id}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{p.sport}</span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{p.sessionType}</span>
                      <span className="text-xs text-muted-foreground">{new Date(p.recordedAt!).toLocaleDateString()}</span>
                    </div>
                    {p.sessionNotes && <p className="text-sm text-muted-foreground italic">{p.sessionNotes}</p>}
                    <div className="flex flex-wrap gap-3 mt-2">
                      {Object.entries(p.customData as Record<string, string>).map(([k, v]) => (
                        <span key={k} className="text-xs">
                          <span className="text-muted-foreground">{k}:</span> <span className="font-medium">{v}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  {canLog && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" data-testid={`button-delete-perf-${p.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Record</AlertDialogTitle>
                          <AlertDialogDescription>Remove this performance record?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(p.id)} className="bg-destructive">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
