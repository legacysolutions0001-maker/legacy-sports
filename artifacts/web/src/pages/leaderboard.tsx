import * as React from "react";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Loader2 } from "lucide-react";

type Row = {
  schoolName: string;
  sport: string;
  icon: string;
  players: { id: number; name: string; total: number; sessions: number }[];
};

export default function Leaderboard() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    customFetch<Row[]>("/api/analytics/leaderboard")
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const rank = (i: number) =>
    i === 0 ? <Trophy className="h-5 w-5 text-yellow-500" /> :
    i === 1 ? <Medal className="h-5 w-5 text-gray-400" /> :
    i === 2 ? <Award className="h-5 w-5 text-amber-700" /> :
    <span className="w-5 text-center text-muted-foreground">{i + 1}</span>;

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Trophy className="h-6 w-6" /> Leaderboard</h1>
        <p className="text-muted-foreground">Top performers by sport across all schools</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">No performance data yet.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((r, idx) => (
            <Card key={idx} data-testid={`leaderboard-card-${idx}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{r.sport || "—"}</span>
                  <Badge variant="outline">{r.schoolName}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {r.players.length === 0 && <p className="text-sm text-muted-foreground">No players ranked yet</p>}
                {r.players.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                    <div className="w-6 flex justify-center">{rank(i)}</div>
                    <div className="flex-1">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.sessions} sessions</div>
                    </div>
                    <div className="font-bold tabular-nums">{p.total.toLocaleString()}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
