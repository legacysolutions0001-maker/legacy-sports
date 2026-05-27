import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalIcon, Plus, Trash2, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, usePagination } from "@/components/pagination";

type Session = {
  id: number;
  schoolId: number;
  coachId: number;
  title: string;
  sport?: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
};

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ title: "", sport: "", location: "", description: "", startsAt: "", endsAt: "" });
  const [creating, setCreating] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [timeFilter, setTimeFilter] = React.useState("all");

  const canEdit = user && ["superadmin", "school_admin", "sub_admin", "coach"].includes(user.role);

  const load = React.useCallback(() => {
    setLoading(true);
    customFetch<Session[]>("/api/sessions")
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.title || !form.startsAt || !form.endsAt) {
      toast({ title: "Title, start and end are required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await customFetch("/api/sessions", { method: "POST", body: JSON.stringify(form) });
      toast({ title: "Session created" });
      setOpen(false);
      setForm({ title: "", sport: "", location: "", description: "", startsAt: "", endsAt: "" });
      load();
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await customFetch(`/api/sessions/${id}`, { method: "DELETE" });
      toast({ title: "Session deleted" });
      load();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const filteredSessions = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();
    return sessions.filter((s) => {
      const start = new Date(s.startsAt).getTime();
      if (timeFilter === "upcoming" && start < now) return false;
      if (timeFilter === "past" && start >= now) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        (s.sport ?? "").toLowerCase().includes(q) ||
        (s.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [sessions, searchQuery, timeFilter]);

  const grouped = React.useMemo(() => {
    const m = new Map<string, Session[]>();
    for (const s of filteredSessions) {
      const day = new Date(s.startsAt).toLocaleDateString();
      m.set(day, [...(m.get(day) ?? []), s]);
    }
    return Array.from(m.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
  }, [filteredSessions]);

  const { page, setPage, pageCount, total, pageItems } = usePagination(grouped, 7);
  React.useEffect(() => { setPage(1); }, [searchQuery, timeFilter, setPage]);

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalIcon className="h-6 w-6" /> Training Calendar</h1>
          <p className="text-muted-foreground">Upcoming training sessions</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-session"><Plus className="h-4 w-4 mr-2" />New Session</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Schedule training session</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-session-title" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Sport</Label><Input value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} /></div>
                  <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Starts *</Label><Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} data-testid="input-starts-at" /></div>
                  <div><Label>Ends *</Label><Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} data-testid="input-ends-at" /></div>
                </div>
                <div><Label>Notes</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={create} disabled={creating} data-testid="button-create-session">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-search-sessions" className="pl-9" placeholder="Search sessions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger data-testid="select-session-time" className="w-36"><SelectValue placeholder="Time" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Past</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : !filteredSessions.length ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">{sessions.length ? "No sessions match your filters." : "No sessions scheduled yet."}</CardContent></Card>
      ) : (
        <>
        {pageItems.map(([day, items]) => (
          <Card key={day}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{day}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {items.map((s) => (
                <div key={s.id} className="flex items-start justify-between p-3 rounded-md border" data-testid={`session-${s.id}`}>
                  <div>
                    <div className="font-semibold flex items-center gap-2">{s.title} {s.sport && <Badge variant="secondary">{s.sport}</Badge>}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(s.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(s.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {s.location && ` · ${s.location}`}
                    </div>
                    {s.description && <div className="text-sm mt-1">{s.description}</div>}
                  </div>
                  {canEdit && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-delete-session-${s.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete session?</AlertDialogTitle>
                          <AlertDialogDescription>Delete "{s.title}"? This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(s.id)} className="bg-destructive">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
        <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
        </>
      )}
    </div>
  );
}
