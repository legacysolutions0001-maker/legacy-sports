import * as React from "react";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FileText, Printer, Download, Sparkles, Trash2, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SchoolSnapshot = { id: number; name: string; logoUrl: string; address: string; phone: string; email: string; primaryColor: string };

type Letter = {
  id: number;
  schoolId: number | null;
  authorId: number;
  letterType: string;
  prompt: string;
  recipient: string;
  subject: string;
  body: string;
  senderName: string;
  senderDesignation: string;
  createdAt: string;
  school: SchoolSnapshot | null;
};

type School = { id: number; name: string };

const TYPES = [
  { value: "notice", label: "Official Notice" },
  { value: "warning", label: "Formal Warning" },
  { value: "congratulatory", label: "Congratulatory" },
  { value: "recommendation", label: "Recommendation" },
  { value: "custom", label: "Custom" },
];

const ALLOWED_ROLES = ["superadmin", "school_admin", "sub_admin", "coach"];

export default function LettersPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAllowed = !user || ALLOWED_ROLES.includes(user.role);
  React.useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      setLocation("/");
    }
  }, [user, setLocation]);
  const { toast } = useToast();
  const [type, setType] = React.useState("notice");
  const [recipient, setRecipient] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [schoolId, setSchoolId] = React.useState<string>("__platform__");
  const [schools, setSchools] = React.useState<School[]>([]);
  const [history, setHistory] = React.useState<Letter[]>([]);
  const [current, setCurrent] = React.useState<Letter | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const printRef = React.useRef<HTMLDivElement>(null);

  const isSuper = user?.role === "superadmin";

  const loadAll = React.useCallback(async () => {
    setLoadingHistory(true);
    try {
      const reqs: Promise<unknown>[] = [customFetch<Letter[]>("/api/letters")];
      if (isSuper) reqs.push(customFetch<School[]>("/api/schools"));
      const [h, s] = (await Promise.all(reqs)) as [Letter[], School[] | undefined];
      setHistory(h);
      if (s) setSchools(s);
    } catch (err) {
      toast({ title: "Failed to load", description: String(err), variant: "destructive" });
    } finally {
      setLoadingHistory(false);
    }
  }, [isSuper, toast]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  const activeSchool = current?.school ?? null;

  async function generate() {
    if (type === "custom" && !prompt.trim()) {
      toast({ title: "Prompt required", description: "Describe what the letter should say.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const created = await customFetch<Letter>("/api/letters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          recipient,
          prompt,
          schoolId: isSuper && schoolId && schoolId !== "__platform__" ? parseInt(schoolId) : undefined,
        }),
      });
      setCurrent(created);
      setHistory((h) => [created, ...h]);
      toast({ title: "Letter generated" });
    } catch (err) {
      toast({ title: "Generation failed", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf(id: number) {
    try {
      const res = await fetch(`/api/letters/${id}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `letter-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Download failed", description: String(err), variant: "destructive" });
    }
  }

  function printLetter() {
    if (!printRef.current) return;
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return;
    w.document.write(`<html><head><title>Letter</title><style>
      body{font-family:Georgia,serif;padding:48px;max-width:780px;margin:auto;color:#111;line-height:1.55;}
      h1{font-size:20px;margin:0 0 4px 0;color:#1a3a5c;}
      .meta{font-size:11px;color:#666;}
      .logo{height:56px;margin-right:14px;}
      .head{display:flex;align-items:center;border-bottom:2px solid #1a3a5c;padding-bottom:14px;margin-bottom:18px;}
      .subj{font-weight:bold;margin:14px 0;}
      .body{white-space:pre-wrap;font-size:13px;}
    </style></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  async function removeLetter(id: number) {
    if (!confirm("Delete this letter from history?")) return;
    try {
      await customFetch(`/api/letters/${id}`, { method: "DELETE" });
      setHistory((h) => h.filter((l) => l.id !== id));
      if (current?.id === id) setCurrent(null);
    } catch (err) {
      toast({ title: "Delete failed", description: String(err), variant: "destructive" });
    }
  }

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
            <FileText className="h-6 w-6" /> AI Letter Generator
          </h1>
          <p className="text-muted-foreground">
            Draft professional letters with the school letterhead. Print or download as PDF.
          </p>
        </div>
        <Button variant="outline" onClick={loadAll}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh history
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">New letter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Letter type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Recipient</Label>
              <Input
                placeholder="e.g. Mr. Sharma, Parent of John"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
            <div>
              <Label>Instructions {type === "custom" && <span className="text-destructive">*</span>}</Label>
              <Textarea
                rows={6}
                placeholder="Describe what the letter should say — context, key points, any specifics."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
            {isSuper && (
              <div>
                <Label>School (issuing on behalf of)</Label>
                <Select value={schoolId} onValueChange={setSchoolId}>
                  <SelectTrigger><SelectValue placeholder="Use my account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__platform__">— platform letterhead —</SelectItem>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={generate} disabled={loading} className="w-full">
              <Sparkles className="h-4 w-4 mr-2" />
              {loading ? "Drafting..." : "Generate with AI"}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle className="text-base">Preview</CardTitle>
            {current && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={printLetter}>
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
                Generate a letter or pick one from history to preview it here.
              </p>
            ) : (
              <div ref={printRef} className="bg-white text-black p-6 rounded border">
                <div className="head">
                  {activeSchool?.logoUrl && (
                    <img src={activeSchool.logoUrl} alt="" className="logo" style={{ height: 56, marginRight: 14 }} />
                  )}
                  <div>
                    <h1 style={{ fontSize: 20, margin: 0, color: "#1a3a5c" }}>
                      {activeSchool?.name ?? "Legacy Sports"}
                    </h1>
                    <div className="meta" style={{ fontSize: 11, color: "#666" }}>
                      {activeSchool?.address}
                      {activeSchool?.phone && ` · ${activeSchool.phone}`}
                      {activeSchool?.email && ` · ${activeSchool.email}`}
                    </div>
                  </div>
                </div>
                <div className="meta" style={{ fontSize: 11, color: "#666", margin: "12px 0" }}>
                  {new Date(current.createdAt).toLocaleDateString()}
                </div>
                {current.subject && (
                  <div className="subj">Subject: {current.subject}</div>
                )}
                <div className="body whitespace-pre-wrap text-sm">{current.body}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No letters drafted yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((l) => (
                <div
                  key={l.id}
                  className="flex items-start gap-3 p-3 border rounded hover-elevate cursor-pointer"
                  onClick={() => setCurrent(l)}
                  data-testid={`letter-row-${l.id}`}
                >
                  <FileText className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="capitalize">{l.letterType}</Badge>
                      <span className="font-medium truncate">{l.subject || "(no subject)"}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(l.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-1">
                      To: {l.recipient || "—"} · by {l.senderName}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); downloadPdf(l.id); }}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); removeLetter(l.id); }}>
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
