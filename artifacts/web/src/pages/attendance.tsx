import * as React from "react";
import { useListAttendance, useMarkAttendance, useListUsers, getListAttendanceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, CheckCircle, XCircle, Clock, Search, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Pagination, usePagination } from "@/components/pagination";

type AttendanceStatus = "present" | "absent" | "late";

export default function Attendance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0]!;

  const [mode, setMode] = React.useState<"history" | "mark">("history");
  const [attDate, setAttDate] = React.useState(today);
  const [sessionType, setSessionType] = React.useState("Training");
  const [markStatus, setMarkStatus] = React.useState<Record<number, AttendanceStatus>>({});
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const { data: players } = useListUsers({ role: "player", status: "approved", schoolId: user?.schoolId ?? undefined });
  const queryParams = { schoolId: user?.schoolId ?? undefined, coachId: user?.role === "coach" ? user.id : undefined };
  const { data: records, isLoading } = useListAttendance(queryParams);
  const markMutation = useMarkAttendance();

  const canMark = user?.role === "coach" || user?.role === "school_admin" || user?.role === "superadmin";
  const canExport = user?.role === "superadmin" || user?.role === "school_admin" || user?.role === "sub_admin" || user?.role === "coach";
  const [exporting, setExporting] = React.useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export/attendance", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    if (!players) return;
    const all: Record<number, AttendanceStatus> = {};
    players.forEach((p) => (all[p.id] = status));
    setMarkStatus(all);
  };

  const handleSubmit = async () => {
    if (!user?.schoolId && user?.role !== "superadmin") {
      toast({ title: "No school context", variant: "destructive" });
      return;
    }
    const records = Object.entries(markStatus).map(([userId, status]) => ({ userId: parseInt(userId), status }));
    if (!records.length) {
      toast({ title: "No records to submit", variant: "destructive" });
      return;
    }
    try {
      await markMutation.mutateAsync({
        data: {
          schoolId: user?.schoolId ?? 0,
          attDate,
          sessionType,
          records,
        },
      });
      toast({ title: "Attendance marked" });
      qc.invalidateQueries({ queryKey: getListAttendanceQueryKey(queryParams) });
      setMarkStatus({});
      setMode("history");
    } catch (e: any) {
      toast({ title: "Failed", description: e.response?.data?.error, variant: "destructive" });
    }
  };

  const statusBadge = (s: string) => {
    if (s === "present") return <Badge className="bg-green-100 text-green-700 border-green-200">{s}</Badge>;
    if (s === "absent") return <Badge variant="destructive">{s}</Badge>;
    return <Badge variant="outline">{s}</Badge>;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground">Track session attendance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canExport && (
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} data-testid="button-export-attendance">
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Export CSV
            </Button>
          )}
          {canMark && (
            <Button variant={mode === "history" ? "outline" : "default"} onClick={() => setMode(mode === "history" ? "mark" : "history")} data-testid="button-toggle-mode">
              {mode === "history" ? "Mark Attendance" : "View History"}
            </Button>
          )}
        </div>
      </div>

      {mode === "mark" && canMark ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mark Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} className="mt-1 w-40" data-testid="input-att-date" />
              </div>
              <div>
                <label className="text-sm font-medium">Session Type</label>
                <Select value={sessionType} onValueChange={setSessionType}>
                  <SelectTrigger data-testid="select-session-type" className="mt-1 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Training">Training</SelectItem>
                    <SelectItem value="Match">Match</SelectItem>
                    <SelectItem value="Practice">Practice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 mb-2">
              <Button size="sm" variant="outline" onClick={() => handleMarkAll("present")} data-testid="button-mark-all-present">All Present</Button>
              <Button size="sm" variant="outline" onClick={() => handleMarkAll("absent")} data-testid="button-mark-all-absent">All Absent</Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {players?.map((p) => (
                <div key={p.id} data-testid={`row-player-att-${p.id}`} className="flex items-center justify-between py-2 px-3 border rounded-md">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sport || "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    {(["present", "absent", "late"] as AttendanceStatus[]).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={markStatus[p.id] === s ? "default" : "outline"}
                        className={`h-7 px-2 text-xs ${s === "present" && markStatus[p.id] === s ? "bg-green-600 hover:bg-green-700" : s === "absent" && markStatus[p.id] === s ? "bg-destructive hover:bg-destructive/90" : ""}`}
                        onClick={() => setMarkStatus((prev) => ({ ...prev, [p.id]: s }))}
                        data-testid={`button-${s}-${p.id}`}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleSubmit} disabled={markMutation.isPending} className="w-full" data-testid="button-submit-attendance">
              Submit Attendance ({Object.keys(markStatus).length} marked)
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : records?.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No attendance records yet.</p>
            </div>
          ) : (
            <AttendanceTable
              records={records ?? []}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              statusBadge={statusBadge}
            />
          )}
        </>
      )}
    </div>
  );
}

function AttendanceTable({
  records, searchQuery, setSearchQuery, statusFilter, setStatusFilter, statusBadge,
}: {
  records: Array<{ id: number; userId: number; userName?: string | null; attDate: string; sessionType?: string | null; status: string }>;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  statusBadge: (s: string) => React.ReactNode;
}) {
  const filtered = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records
      .slice()
      .reverse()
      .filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (!q) return true;
        return (r.userName ?? "").toLowerCase().includes(q) || (r.sessionType ?? "").toLowerCase().includes(q);
      });
  }, [records, searchQuery, statusFilter]);

  const { page, setPage, pageCount, total, pageItems } = usePagination(filtered, 25);
  React.useEffect(() => { setPage(1); }, [searchQuery, statusFilter, setPage]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-attendance"
            className="pl-9"
            placeholder="Search by player or session..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="select-att-status" className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="late">Late</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Player</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Session</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((r) => (
              <tr key={r.id} data-testid={`row-att-${r.id}`} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{r.userName || `User #${r.userId}`}</td>
                <td className="px-4 py-2 text-muted-foreground">{r.attDate}</td>
                <td className="px-4 py-2 hidden md:table-cell text-muted-foreground">{r.sessionType}</td>
                <td className="px-4 py-2">{statusBadge(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t px-4">
          <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}
