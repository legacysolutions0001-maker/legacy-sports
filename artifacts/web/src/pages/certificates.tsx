import * as React from "react";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Award, Printer, Download, Sparkles, Trash2, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SchoolSnapshot = { id: number; name: string; logoUrl: string; address: string; phone: string; email: string; primaryColor: string };

type Cert = {
  id: number;
  schoolId: number | null;
  playerId: number | null;
  playerName: string;
  template: string;
  eventName: string;
  score: string;
  sport: string;
  citation: string;
  signatoryName: string;
  signatoryDesignation: string;
  createdAt: string;
  school: SchoolSnapshot | null;
};

type Player = { id: number; name: string; role: string; sport: string; schoolId: number | null };

const TEMPLATES = [
  { value: "participation", label: "Participation" },
  { value: "achievement", label: "Achievement" },
  { value: "sport-specific", label: "Sport Excellence" },
];

const ALLOWED_ROLES = ["superadmin", "school_admin", "sub_admin", "coach"];

export default function CertificatesPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAllowed = !user || ALLOWED_ROLES.includes(user.role);
  React.useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      setLocation("/");
    }
  }, [user, setLocation]);
  const { toast } = useToast();
  const [template, setTemplate] = React.useState("participation");
  const [playerId, setPlayerId] = React.useState("");
  const [eventName, setEventName] = React.useState("");
  const [score, setScore] = React.useState("");
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [history, setHistory] = React.useState<Cert[]>([]);
  const [current, setCurrent] = React.useState<Cert | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const printRef = React.useRef<HTMLDivElement>(null);

  const isCoach = user?.role === "coach";

  const loadAll = React.useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [h, p] = await Promise.all([
        customFetch<Cert[]>("/api/certificates"),
        customFetch<Player[]>("/api/users?role=player"),
      ]);
      setHistory(h);
      const filtered = isCoach && user?.sport
        ? p.filter((x) => x.sport === user.sport)
        : p;
      setPlayers(filtered);
    } catch (err) {
      toast({ title: "Failed to load", description: String(err), variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  }, [isCoach, user?.sport, toast]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  const activeSchool = current?.school ?? null;

  async function generate() {
    if (!playerId) {
      toast({ title: "Pick a player", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const created = await customFetch<Cert>("/api/certificates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: parseInt(playerId),
          template,
          eventName,
          score,
        }),
      });
      setCurrent(created);
      setHistory((h) => [created, ...h]);
      toast({ title: "Certificate generated" });
    } catch (err) {
      toast({ title: "Generation failed", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf(id: number) {
    try {
      const res = await fetch(`/api/certificates/${id}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Download failed", description: String(err), variant: "destructive" });
    }
  }

  function printCert() {
    if (!printRef.current) return;
    const w = window.open("", "_blank", "width=1100,height=820");
    if (!w) return;
    w.document.write(`<html><head><title>Certificate</title><style>
      @page{size:A4 landscape;margin:0;}
      body{font-family:Georgia,serif;margin:0;color:#111;}
      .cert{position:relative;width:1090px;height:760px;padding:40px;margin:20px auto;border:3px solid #1a3a5c;}
      .cert::after{content:"";position:absolute;inset:8px;border:1px solid #b88c29;pointer-events:none;}
      .logo{max-height:70px;display:block;margin:0 auto 8px;}
      .sname{text-align:center;font-weight:bold;color:#1a3a5c;font-size:16px;}
      .title{text-align:center;font-size:38px;font-weight:bold;color:#1a3a5c;margin:24px 0 12px;}
      .prelude{text-align:center;font-style:italic;color:#555;margin-bottom:18px;}
      .player{text-align:center;font-size:34px;font-weight:bold;color:#b88c29;border-bottom:1px solid #b88c29;display:inline-block;padding:0 28px 6px;}
      .playerwrap{text-align:center;margin-bottom:24px;}
      .citation{text-align:center;font-size:14px;line-height:1.6;padding:0 80px;color:#222;}
      .sigs{display:flex;justify-content:space-between;margin:60px 80px 0;}
      .sig{width:240px;text-align:center;}
      .sigline{border-top:1px solid #333;padding-top:6px;font-weight:bold;}
      .sigdes{font-size:11px;color:#666;}
    </style></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  async function removeCert(id: number) {
    if (!confirm("Delete this certificate from history?")) return;
    try {
      await customFetch(`/api/certificates/${id}`, { method: "DELETE" });
      setHistory((h) => h.filter((c) => c.id !== id));
      if (current?.id === id) setCurrent(null);
    } catch (err) {
      toast({ title: "Delete failed", description: String(err), variant: "destructive" });
    }
  }

  const title =
    !current ? "" :
    current.template === "achievement" ? "Certificate of Achievement"
    : current.template === "sport-specific" ? "Certificate of Excellence"
    : "Certificate of Participation";

  if (!isAllowed) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        You do not have access to this page.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6" /> AI Certificate Generator
          </h1>
          <p className="text-muted-foreground">
            Produce participation, achievement, and sport-specific certificates. Print or download as PDF.
          </p>
        </div>
        <Button variant="outline" onClick={loadAll}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh history
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">New certificate</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Template</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Player</Label>
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger><SelectValue placeholder={players.length ? "Choose a player" : "No players available"} /></SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}{p.sport ? ` · ${p.sport}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCoach && (
                <p className="text-xs text-muted-foreground mt-1">
                  Coaches only see players in their own sport.
                </p>
              )}
            </div>
            <div>
              <Label>Event (optional)</Label>
              <Input
                placeholder="e.g. Inter-school Athletics 2026"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>
            <div>
              <Label>Score / position (optional)</Label>
              <Input
                placeholder="e.g. 1st Place, 9.8/10"
                value={score}
                onChange={(e) => setScore(e.target.value)}
              />
            </div>
            <Button onClick={generate} disabled={loading} className="w-full">
              <Sparkles className="h-4 w-4 mr-2" />
              {loading ? "Drafting..." : "Generate with AI"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle className="text-base">Preview</CardTitle>
            {current && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={printCert}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
                <Button size="sm" onClick={() => downloadPdf(current.id)}>
                  <Download className="h-4 w-4 mr-1" /> PDF
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!current ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                Generate a certificate or pick one from history to preview it here.
              </p>
            ) : (
              <div ref={printRef}>
                <div
                  className="cert bg-white text-black relative mx-auto"
                  style={{
                    width: "100%",
                    maxWidth: 820,
                    aspectRatio: "1.414 / 1",
                    padding: 36,
                    border: "3px solid #1a3a5c",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 8,
                      border: "1px solid #b88c29",
                      pointerEvents: "none",
                    }}
                  />
                  {activeSchool?.logoUrl && (
                    <img src={activeSchool.logoUrl} alt="" className="logo" style={{ maxHeight: 60, display: "block", margin: "0 auto 8px" }} />
                  )}
                  <div className="sname" style={{ textAlign: "center", fontWeight: "bold", color: "#1a3a5c", fontSize: 14 }}>
                    {activeSchool?.name ?? "Legacy Sports"}
                  </div>
                  <div className="title" style={{ textAlign: "center", fontSize: 30, fontWeight: "bold", color: "#1a3a5c", margin: "16px 0 8px" }}>
                    {title}
                  </div>
                  <div className="prelude" style={{ textAlign: "center", fontStyle: "italic", color: "#555", marginBottom: 14 }}>
                    This is to certify that
                  </div>
                  <div className="playerwrap" style={{ textAlign: "center", marginBottom: 18 }}>
                    <span
                      className="player"
                      style={{
                        fontSize: 26,
                        fontWeight: "bold",
                        color: "#b88c29",
                        borderBottom: "1px solid #b88c29",
                        display: "inline-block",
                        padding: "0 22px 4px",
                      }}
                    >
                      {current.playerName}
                    </span>
                  </div>
                  <div className="citation" style={{ textAlign: "center", fontSize: 13, lineHeight: 1.6, padding: "0 50px", color: "#222" }}>
                    {current.citation}
                  </div>
                  <div className="sigs" style={{ display: "flex", justifyContent: "space-between", margin: "44px 50px 0" }}>
                    <div className="sig" style={{ width: 200, textAlign: "center" }}>
                      <div className="sigline" style={{ borderTop: "1px solid #333", paddingTop: 6, fontWeight: "bold", fontSize: 12 }}>
                        {current.signatoryName}
                      </div>
                      <div className="sigdes" style={{ fontSize: 10, color: "#666" }}>
                        {current.signatoryDesignation}
                      </div>
                    </div>
                    <div className="sig" style={{ width: 200, textAlign: "center" }}>
                      <div className="sigline" style={{ borderTop: "1px solid #333", paddingTop: 6, fontWeight: "bold", fontSize: 12 }}>
                        Date: {new Date(current.createdAt).toLocaleDateString()}
                      </div>
                      <div className="sigdes" style={{ fontSize: 10, color: "#666" }}>
                        Certificate #{current.id}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No certificates issued yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-3 p-3 border rounded hover-elevate cursor-pointer"
                  onClick={() => setCurrent(c)}
                  data-testid={`cert-row-${c.id}`}
                >
                  <Award className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="capitalize">{c.template}</Badge>
                      <span className="font-medium truncate">{c.playerName}</span>
                      {c.sport && <span className="text-xs text-muted-foreground">· {c.sport}</span>}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-1">
                      {c.eventName || "—"}{c.score && ` · ${c.score}`} · by {c.signatoryName}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); downloadPdf(c.id); }}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); removeCert(c.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
