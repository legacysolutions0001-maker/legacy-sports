import * as React from "react";
import { useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Baby, Loader2, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface AttRecord { id: number; attDate: string; status: string; note?: string | null; }
interface AttSummary { total: number; present: number; absent: number; late: number; rate: number; }
interface PerfRecord { id: number; recordedAt: string; metricName: string; value: string | number; unit?: string | null; notes?: string | null; }
interface FeeRecord { id: number; description?: string | null; amount: number; dueDate?: string | null; status: string; }
interface FeeSummary { totalDue: number; totalPaid: number; }
interface SessionRecord { id: number; title: string; sport: string; venue?: string | null; startsAt: string; }

type TabKey = "overview" | "attendance" | "performances" | "fees" | "schedule";

export default function ParentPortal() {
  const { user, school } = useAuth();
  const search = useSearch();
  const tab = (new URLSearchParams(search).get("tab") as TabKey) ?? "overview";
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [child, setChild] = React.useState<Record<string, unknown> | null>(null);
  const [loadingChild, setLoadingChild] = React.useState(true);
  const [attendance, setAttendance] = React.useState<{ records: AttRecord[]; summary: AttSummary } | null>(null);
  const [performances, setPerformances] = React.useState<PerfRecord[]>([]);
  const [fees, setFees] = React.useState<{ records: FeeRecord[]; summary: FeeSummary } | null>(null);
  const [sessions, setSessions] = React.useState<SessionRecord[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const go = async () => {
      try {
        const [cr, ar, pr, fr, sr] = await Promise.all([
          fetch(`${BASE}/api/parent/child`),
          fetch(`${BASE}/api/parent/attendance`),
          fetch(`${BASE}/api/parent/performances`),
          fetch(`${BASE}/api/parent/fees`),
          fetch(`${BASE}/api/parent/sessions`),
        ]);
        if (cr.status === 401) { setError("Session expired. Please log in again."); return; }
        if (cr.ok) { const d = await cr.json() as Record<string, unknown> | null; setChild(d); }
        if (ar.ok) setAttendance(await ar.json() as { records: AttRecord[]; summary: AttSummary });
        if (pr.ok) setPerformances(await pr.json() as PerfRecord[]);
        if (fr.ok) setFees(await fr.json() as { records: FeeRecord[]; summary: FeeSummary });
        if (sr.ok) setSessions(await sr.json() as SessionRecord[]);
      } catch {
        setError("Failed to load data. Please refresh.");
      } finally {
        setLoadingChild(false);
      }
    };
    go();
  }, [BASE]);

  if (!user) return null;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Baby className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Parent Portal</h1>
          <p className="text-muted-foreground text-sm">
            Welcome, {user.name}{school?.name ? ` — ${school.name}` : ""}
          </p>
        </div>
      </div>

      {loadingChild && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your child&apos;s data…
        </div>
      )}

      {!loadingChild && error && (
        <div className="flex items-center gap-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {!loadingChild && !error && !child && (
        <div className="flex items-center gap-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-medium">No player linked to your account</p>
            <p className="text-sm">Please contact the school administrator to link your child&apos;s profile.</p>
          </div>
        </div>
      )}

      {!loadingChild && !error && child && (
        <>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold flex-shrink-0">
                  {String(child.name ?? "?").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold truncate">{String(child.name ?? "")}</h2>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {!!child.sport && <Badge variant="secondary">{String(child.sport)}</Badge>}
                    {!!child.className && (
                      <Badge variant="outline">
                        Class {String(child.className)}{child.section ? `-${String(child.section)}` : ""}
                      </Badge>
                    )}
                    {!!child.playerCode && (
                      <Badge variant="outline" className="font-mono text-xs">{String(child.playerCode)}</Badge>
                    )}
                    <Badge variant={child.fitnessStatus === "fit" ? "default" : "secondary"} className="capitalize">
                      {String(child.fitnessStatus ?? "fit")}
                    </Badge>
                  </div>
                </div>
                {attendance?.summary && (
                  <div className="text-right hidden sm:block flex-shrink-0">
                    <p className="text-2xl font-bold text-primary">{attendance.summary.rate}%</p>
                    <p className="text-xs text-muted-foreground">Attendance</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue={tab}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="performances">Performances</TabsTrigger>
              <TabsTrigger value="fees">Fees</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Attendance Rate", value: `${attendance?.summary?.rate ?? 0}%`, sub: `${attendance?.summary?.present ?? 0}/${attendance?.summary?.total ?? 0} sessions` },
                  { label: "Performance Records", value: String(performances.length), sub: "total recorded" },
                  { label: "Fees Outstanding", value: `₹${(fees?.summary?.totalDue ?? 0).toLocaleString()}`, sub: "to be paid" },
                  { label: "Upcoming Sessions", value: String(sessions.length), sub: "scheduled" },
                ].map((item) => (
                  <Card key={item.label}>
                    <CardContent className="py-4 text-center">
                      <p className="text-2xl font-bold text-primary">{item.value}</p>
                      <p className="text-xs font-medium mt-1">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.sub}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Child Details</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {([
                      ["Name", child.name],
                      ["Sport", child.sport],
                      ["Class", child.className ? `${child.className}${child.section ? "-" + String(child.section) : ""}` : "—"],
                      ["Roll No.", child.rollNumber || "—"],
                      ["Admission No.", child.admissionNumber || "—"],
                      ["Player Code", child.playerCode || "—"],
                      ["Gender", child.gender || "—"],
                      ["Age", child.age ? `${String(child.age)} years` : "—"],
                      ["Phone", child.phone || "—"],
                      ["Email", child.email || "—"],
                    ] as [string, unknown][]).map(([label, value]) => (
                      <div key={label}>
                        <span className="text-muted-foreground text-xs block">{label}</span>
                        <span className="font-medium capitalize">{String(value ?? "—")}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance" className="mt-4 space-y-4">
              {!attendance ? (
                <div className="text-muted-foreground text-sm flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "Total", value: attendance.summary.total, color: "text-foreground" },
                      { label: "Present", value: attendance.summary.present, color: "text-green-600" },
                      { label: "Absent", value: attendance.summary.absent, color: "text-red-600" },
                      { label: "Late", value: attendance.summary.late, color: "text-yellow-600" },
                    ].map((item) => (
                      <Card key={item.label}>
                        <CardContent className="py-3 text-center">
                          <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left p-3 font-medium">Date</th>
                              <th className="text-left p-3 font-medium">Status</th>
                              <th className="text-left p-3 font-medium">Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attendance.records.length === 0 ? (
                              <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">No records found</td></tr>
                            ) : attendance.records.map((r) => (
                              <tr key={r.id} className="border-b last:border-0">
                                <td className="p-3">{new Date(r.attDate).toLocaleDateString()}</td>
                                <td className="p-3">
                                  {r.status === "present" ? (
                                    <span className="flex items-center gap-1 text-green-600 text-xs font-medium"><CheckCircle className="h-3.5 w-3.5" /> Present</span>
                                  ) : r.status === "absent" ? (
                                    <span className="flex items-center gap-1 text-red-600 text-xs font-medium"><XCircle className="h-3.5 w-3.5" /> Absent</span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-yellow-600 text-xs font-medium"><Clock className="h-3.5 w-3.5" /> Late</span>
                                  )}
                                </td>
                                <td className="p-3 text-muted-foreground text-xs">{r.note || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="performances" className="mt-4">
              {performances.length === 0 ? (
                <div className="text-muted-foreground text-sm py-8 text-center">No performance records yet.</div>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-3 font-medium">Date</th>
                            <th className="text-left p-3 font-medium">Metric</th>
                            <th className="text-left p-3 font-medium">Value</th>
                            <th className="text-left p-3 font-medium">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {performances.map((p) => (
                            <tr key={p.id} className="border-b last:border-0">
                              <td className="p-3">{new Date(p.recordedAt).toLocaleDateString()}</td>
                              <td className="p-3 font-medium">{p.metricName}</td>
                              <td className="p-3">{String(p.value)}{p.unit ? ` ${p.unit}` : ""}</td>
                              <td className="p-3 text-muted-foreground text-xs">{p.notes || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="fees" className="mt-4 space-y-4">
              {!fees ? (
                <div className="text-muted-foreground text-sm flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Card>
                      <CardContent className="py-4 text-center">
                        <p className="text-2xl font-bold text-red-600">₹{fees.summary.totalDue.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1">Outstanding</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4 text-center">
                        <p className="text-2xl font-bold text-green-600">₹{fees.summary.totalPaid.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1">Paid</p>
                      </CardContent>
                    </Card>
                  </div>
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left p-3 font-medium">Description</th>
                              <th className="text-left p-3 font-medium">Amount</th>
                              <th className="text-left p-3 font-medium">Due Date</th>
                              <th className="text-left p-3 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fees.records.length === 0 ? (
                              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No fee records</td></tr>
                            ) : fees.records.map((f) => (
                              <tr key={f.id} className="border-b last:border-0">
                                <td className="p-3">{f.description || "Fee"}</td>
                                <td className="p-3 font-medium">₹{f.amount.toLocaleString()}</td>
                                <td className="p-3">{f.dueDate ? new Date(f.dueDate).toLocaleDateString() : "—"}</td>
                                <td className="p-3">
                                  <Badge
                                    variant={f.status === "paid" ? "default" : f.status === "overdue" ? "destructive" : "secondary"}
                                    className="capitalize"
                                  >
                                    {f.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="schedule" className="mt-4">
              {sessions.length === 0 ? (
                <div className="text-muted-foreground text-sm py-8 text-center">No upcoming sessions scheduled.</div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((s) => (
                    <Card key={s.id}>
                      <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.title}</p>
                          <p className="text-xs text-muted-foreground capitalize">{s.sport}{s.venue ? ` — ${s.venue}` : ""}</p>
                        </div>
                        <div className="text-right text-sm flex-shrink-0">
                          <p className="font-medium">{new Date(s.startsAt).toLocaleDateString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(s.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
