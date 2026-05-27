import { useAuth } from "@/hooks/use-auth";
import { useGetAnalyticsSummary, useListUsers, useListNotifications, useGetLeaderboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, GraduationCap, Activity, ClipboardList, Bell, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { Link } from "wouter";

function StatCard({ title, value, icon: Icon, sub }: { title: string; value: number | string; icon: React.ElementType; sub?: string }) {
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, "-")}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading } = useGetAnalyticsSummary();
  const { data: pendingUsers } = useListUsers({ status: "pending", schoolId: user?.schoolId ?? undefined });
  const { data: notifications } = useListNotifications();
  const { data: leaderboard } = useGetLeaderboard();

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;
  const pendingCount = pendingUsers?.length ?? 0;

  const role = user?.role;
  const isSuperadmin = role === "superadmin";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="dashboard-title">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isSuperadmin && <StatCard title="Schools" value={summary?.totalSchools ?? 0} icon={GraduationCap} />}
          <StatCard title="Players" value={summary?.totalPlayers ?? 0} icon={Users} />
          <StatCard title="Coaches" value={summary?.totalCoaches ?? 0} icon={Users} />
          <StatCard title="Sessions" value={summary?.totalPerformances ?? 0} icon={Activity} sub="performance records" />
          <StatCard title="Attendance" value={summary?.totalAttendance ?? 0} icon={ClipboardList} />
          {pendingCount > 0 && <StatCard title="Pending Approval" value={pendingCount} icon={Users} sub="awaiting review" />}
          {unreadCount > 0 && <StatCard title="Unread Notifications" value={unreadCount} icon={Bell} />}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {summary?.sportCounts && summary.sportCounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Players by Sport</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={summary.sportCounts.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="sport" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {summary?.attendanceTrend && summary.attendanceTrend.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attendance (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
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

      {leaderboard && leaderboard.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-accent" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaderboard.slice(0, 3).map((entry, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium text-sm">{entry.sport} — {entry.schoolName}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.players.slice(0, 3).map((p, pi) => `${pi + 1}. ${p.name}`).join(" · ")}
                    </p>
                  </div>
                  <Badge variant="outline">{entry.players.length} players</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pendingCount > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4 pb-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{pendingCount} pending registration{pendingCount > 1 ? "s" : ""}</p>
              <p className="text-sm text-muted-foreground">Review and approve or reject users</p>
            </div>
            <Link href="/users?status=pending">
              <span className="text-sm font-medium text-primary underline cursor-pointer">Review</span>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
