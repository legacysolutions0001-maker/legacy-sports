import * as React from "react";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, RefreshCw, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReminderLog = {
  id: number;
  invoiceId: number;
  schoolId: number;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  provider: string;
  error: string;
  createdAt: string;
};

type Invoice = {
  id: number;
  invoiceNumber: string;
  schoolId: number;
  total: number;
  currency: string;
};

type School = { id: number; name: string; code: string };

export default function RemindersInbox() {
  const [rows, setRows] = React.useState<ReminderLog[]>([]);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [schools, setSchools] = React.useState<School[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");
  const [channel, setChannel] = React.useState("all");
  const [status, setStatus] = React.useState("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [r, inv, s] = await Promise.all([
        customFetch<ReminderLog[]>("/api/reminders"),
        customFetch<Invoice[]>("/api/invoices"),
        customFetch<School[]>("/api/schools"),
      ]);
      setRows(r);
      setInvoices(inv);
      setSchools(s);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  const schoolName = (id: number) =>
    schools.find((x) => x.id === id)?.name ?? `School #${id}`;
  const invoiceNum = (id: number) =>
    invoices.find((x) => x.id === id)?.invoiceNumber ?? `#${id}`;

  const filtered = rows.filter((r) => {
    if (channel !== "all" && r.channel !== channel) return false;
    if (status !== "all" && r.status !== status) return false;
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      schoolName(r.schoolId).toLowerCase().includes(needle) ||
      invoiceNum(r.invoiceId).toLowerCase().includes(needle) ||
      r.recipient.toLowerCase().includes(needle) ||
      r.subject.toLowerCase().includes(needle) ||
      r.body.toLowerCase().includes(needle)
    );
  });

  const counts = {
    sent: rows.filter((r) => r.status === "sent").length,
    failed: rows.filter((r) => r.status === "failed").length,
    total: rows.length,
  };

  return (
    <div className="p-6 max-w-6xl space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" /> Reminder Inbox
          </h1>
          <p className="text-muted-foreground">
            Every billing reminder run — manual or automatic — across all
            schools and channels.
          </p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{counts.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{counts.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.total}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by school, invoice, recipient, subject..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Channel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="inbox">In-app inbox</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No reminder runs match these filters.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const isAuto = r.subject.startsWith("[auto:");
            return (
              <Card key={r.id}>
                <CardContent className="pt-4 pb-4 space-y-1 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="capitalize">{r.channel}</Badge>
                    <Badge variant={r.status === "sent" ? "default" : r.status === "failed" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge>
                    {isAuto && <Badge variant="secondary" className="text-[10px]">auto</Badge>}
                    <span className="font-medium">{schoolName(r.schoolId)}</span>
                    <span className="text-muted-foreground">· invoice {invoiceNum(r.invoiceId)}</span>
                    <span className="text-muted-foreground ml-auto">{new Date(r.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">To: {r.recipient || "—"} · via {r.provider}</div>
                  {r.subject && <div className="font-medium">{r.subject}</div>}
                  <div className="whitespace-pre-wrap text-muted-foreground text-xs">{r.body}</div>
                  {r.error && <div className="text-destructive text-xs">Error: {r.error}</div>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
