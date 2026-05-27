import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Settings, Loader2 } from "lucide-react";

type Settings = {
  schoolId: number;
  customMessage?: string | null;
  calendarEnabled: boolean;
  messagingEnabled: boolean;
  photosEnabled: boolean;
  feesEnabled: boolean;
  performanceEnabled: boolean;
  analyticsEnabled: boolean;
  leaderboardEnabled: boolean;
  notificationsEnabled: boolean;
  attendanceEnabled: boolean;
  registrationEnabled: boolean;
  aiEnabled: boolean;
  websiteEnabled: boolean;
};

type FlagKey = Exclude<keyof Settings, "schoolId" | "customMessage">;

const MODULES: { key: FlagKey; label: string; desc: string }[] = [
  { key: "registrationEnabled", label: "Player Registration", desc: "Allow players to self-register" },
  { key: "attendanceEnabled", label: "Attendance Tracking", desc: "Mark and view attendance" },
  { key: "performanceEnabled", label: "Performance Logging", desc: "Record player performance" },
  { key: "analyticsEnabled", label: "Analytics Dashboard", desc: "View aggregated stats" },
  { key: "leaderboardEnabled", label: "Leaderboard", desc: "Rank players by performance" },
  { key: "calendarEnabled", label: "Training Calendar", desc: "Schedule training sessions" },
  { key: "messagingEnabled", label: "In-app Messaging", desc: "Coach ↔ player direct messages" },
  { key: "photosEnabled", label: "Profile Photos", desc: "Allow profile photo uploads" },
  { key: "feesEnabled", label: "Student Fee Collection", desc: "Track monthly fees players pay to your school" },
  { key: "notificationsEnabled", label: "Notifications", desc: "Send broadcast notifications" },
  { key: "websiteEnabled", label: "Branded School Website", desc: "Public landing page for your academy (billed monthly on your subscription)" },
  { key: "aiEnabled", label: "AI Assistant & Insights", desc: "AI-generated reports and reminders (billed monthly on your subscription)" },
];

export default function SchoolSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!user?.schoolId) { setLoading(false); return; }
    customFetch<Settings>("/api/school-settings")
      .then((s) => { setSettings(s); setMessage(s.customMessage ?? ""); })
      .finally(() => setLoading(false));
  }, [user?.schoolId]);

  const toggle = (key: FlagKey) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: !settings[key] });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { customMessage: message };
      for (const m of MODULES) payload[m.key] = settings[m.key];
      const updated = await customFetch<Settings>("/api/school-settings", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setSettings(updated);
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  if (!user?.schoolId && user?.role !== "superadmin")
    return <div className="p-6">No school context.</div>;
  if (!settings) return <div className="p-6">No settings available.</div>;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="h-6 w-6" /> School Settings</h1>
        <p className="text-muted-foreground">Enable or disable features for your school. Disabled features will be hidden from all users.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Feature Modules</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {MODULES.map((m) => (
            <div key={m.key} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
              <div>
                <Label htmlFor={m.key} className="font-medium">{m.label}</Label>
                <p className="text-sm text-muted-foreground">{m.desc}</p>
              </div>
              <Switch
                id={m.key}
                checked={Boolean(settings[m.key])}
                onCheckedChange={() => toggle(m.key)}
                data-testid={`switch-${m.key}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Custom Message</CardTitle></CardHeader>
        <CardContent>
          <Label className="text-sm text-muted-foreground mb-2 block">Shown to users (e.g. when school is paused)</Label>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional message…"
            data-testid="input-custom-message"
          />
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} data-testid="button-save-settings">
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save Settings
      </Button>
    </div>
  );
}
