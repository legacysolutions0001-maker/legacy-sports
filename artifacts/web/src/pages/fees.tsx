import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { customFetch, useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Plus, Trash2, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Pagination, usePagination } from "@/components/pagination";

type Fee = {
  id: number;
  schoolId: number;
  playerId: number;
  amount: number;
  currency: string;
  description?: string;
  dueDate?: string;
  status: "pending" | "paid" | "overdue" | "waived";
  paidAt?: string;
};

export default function Fees() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: usersResp } = useListUsers();
  const players = (usersResp ?? []).filter((u) => u.role === "player");
  const [fees, setFees] = React.useState<Fee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({ playerId: "", amount: "", currency: "INR", description: "", dueDate: "" });
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const isAdmin = user && ["superadmin", "school_admin", "sub_admin"].includes(user.role);

  const load = React.useCallback(() => {
    setLoading(true);
    customFetch<Fee[]>("/api/fees").then(setFees).catch(() => setFees([])).finally(() => setLoading(false));
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const playerName = React.useCallback(
    (id: number) => players.find((p) => p.id === id)?.name ?? `Player #${id}`,
    [players],
  );

  const create = async () => {
    if (!form.playerId || !form.amount) {
      toast({ title: "Player and amount required", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await customFetch("/api/fees", {
        method: "POST",
        body: JSON.stringify({
          playerId: Number(form.playerId),
          amount: Number(form.amount),
          currency: form.currency,
          description: form.description,
          dueDate: form.dueDate || undefined,
        }),
      });
      toast({ title: "Fee added" });
      setOpen(false);
      setForm({ playerId: "", amount: "", currency: "INR", description: "", dueDate: "" });
      load();
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (id: number, status: Fee["status"]) => {
    await customFetch(`/api/fees/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    load();
  };

  const remove = async (id: number) => {
    try {
      await customFetch(`/api/fees/${id}`, { method: "DELETE" });
      toast({ title: "Fee deleted" });
      load();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const filtered = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fees.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (!q) return true;
      return playerName(f.playerId).toLowerCase().includes(q) || (f.description ?? "").toLowerCase().includes(q);
    });
  }, [fees, searchQuery, statusFilter, playerName]);

  const { page, setPage, pageCount, total, pageItems } = usePagination(filtered, 15);
  React.useEffect(() => { setPage(1); }, [searchQuery, statusFilter, setPage]);

  const totalDue = fees.filter((f) => f.status === "pending" || f.status === "overdue").reduce((s, f) => s + Number(f.amount), 0);
  const totalPaid = fees.filter((f) => f.status === "paid").reduce((s, f) => s + Number(f.amount), 0);

  const statusVariant = (s: Fee["status"]) =>
    s === "paid" ? "default" : s === "overdue" ? "destructive" : s === "waived" ? "secondary" : "outline";

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="h-6 w-6" /> Player Fees</h1>
          <p className="text-muted-foreground">Manage player fees and payments</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button data-testid="button-add-fee"><Plus className="h-4 w-4 mr-2" />Add Fee</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add fee</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Player *</Label>
                  <Select value={form.playerId} onValueChange={(v) => setForm({ ...form, playerId: v })}>
                    <SelectTrigger data-testid="select-fee-player"><SelectValue placeholder="Pick a player" /></SelectTrigger>
                    <SelectContent>
                      {players.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Amount *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="input-fee-amount" /></div>
                  <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
                </div>
                <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. May 2026 training fee" /></div>
                <div><Label>Due date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={create} disabled={creating} data-testid="button-create-fee">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Fee"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Due</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold" data-testid="text-total-due">{totalDue.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Paid</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-500" data-testid="text-total-paid">{totalPaid.toLocaleString()}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All Fees</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input data-testid="input-search-fees" className="pl-9" placeholder="Search by player or description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-fee-filter-status" className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="waived">Waived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : !filtered.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">{fees.length ? "No fees match your filters." : "No fees on record."}</p>
          ) : (
            <>
              <div className="space-y-2">
                {pageItems.map((f) => (
                  <div key={f.id} className="flex items-center gap-4 p-3 rounded-md border" data-testid={`fee-${f.id}`}>
                    <div className="flex-1">
                      <div className="font-medium">{playerName(f.playerId)}</div>
                      <div className="text-sm text-muted-foreground">{f.description || "—"} {f.dueDate && `· due ${new Date(f.dueDate).toLocaleDateString()}`}</div>
                    </div>
                    <div className="font-semibold">{f.currency} {Number(f.amount).toLocaleString()}</div>
                    <Badge variant={statusVariant(f.status)} className="capitalize">{f.status}</Badge>
                    {isAdmin && (
                      <>
                        <Select value={f.status} onValueChange={(v) => setStatus(f.id, v as Fee["status"])}>
                          <SelectTrigger className="w-32" data-testid={`select-status-${f.id}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="waived">Waived</SelectItem>
                          </SelectContent>
                        </Select>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-delete-fee-${f.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete fee?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Delete the {f.currency} {Number(f.amount).toLocaleString()} fee for {playerName(f.playerId)}? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(f.id)} className="bg-destructive">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
