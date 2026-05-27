import { useGetAnalyticsSummary, useGetLeaderboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, TrendingUp, Users, GraduationCap, Activity, ClipboardList } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--destructive))", "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

export default function Analytics() {
  const { data: summary, isLoading } = useGetAnalyticsSummary();
  const { data: leaderboard, isLoading: lbLoading } = useGetLeaderboard();

  if (isLoading) return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <div className="grid md:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
    </div>
  );

  const stats = [
    { label: "Schools", value: summary?.totalSchools ?? 0, icon: GraduationCap },
    { label: "Players", value: summary?.totalPlayers ?? 0, icon: Users },
    { label: "Coaches", value: summary?.totalCoaches ?? 0, icon: Users },
    { label: "Sessions", value: summary?.totalPerformances ?? 0, icon: Activity },
    { label: "Attendance", value: summary?.totalAttendance ?? 0, icon: ClipboardList },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Platform-wide performance metrics</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} data-testid={`stat-${label.toLowerCase()}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
                <Icon className="h-6 w-6 text-primary/60" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {summary?.sportCounts && summary.sportCounts.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Players by Sport</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={summary.sportCounts.sort((a, b) => b.count - a.count).slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="sport" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {summary?.schoolCounts && summary.schoolCounts.length > 1 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Players by School</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={summary.schoolCounts} dataKey="count" nameKey="schoolName" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {summary.schoolCounts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {summary?.attendanceTrend && summary.attendanceTrend.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />Attendance Trend (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={summary.attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {!lbLoading && leaderboard && leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-accent" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leaderboard.map((entry, ei) => (
                <div key={ei} data-testid={`leaderboard-entry-${ei}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">{entry.sport}</span>
                    <Badge variant="outline" className="text-xs">{entry.schoolName}</Badge>
                  </div>
                  <div className="space-y-1">
                    {entry.players.slice(0, 3).map((p, pi) => (
                      <div key={p.id} data-testid={`leaderboard-player-${p.id}`} className="flex items-center gap-3 text-sm py-1 px-3 rounded-md bg-muted/40">
                        <span className={`font-bold w-5 ${pi === 0 ? "text-yellow-500" : pi === 1 ? "text-gray-400" : "text-amber-700"}`}>#{pi + 1}</span>
                        <span className="flex-1">{p.name}</span>
                        <span className="text-muted-foreground text-xs">{p.sessions} sessions</span>
                        <span className="font-medium">{p.total.toFixed(1)} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
