import * as React from "react";
import { useListSchools, useCreateSchool, useUpdateSchool, useDeleteSchool, usePauseSchool, useGetPricing, usePreviewInvoice, getListSchoolsQueryKey, getPreviewInvoiceQueryKey } from "@workspace/api-client-react";
import type { School, PricingConfig, InvoicePreview } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Pause, Play, GraduationCap, Search, Wallet, ListChecks, Loader2, CheckCircle2, XCircle, Download } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Pagination, usePagination } from "@/components/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_SPORTS = [
  "Cricket", "Basketball", "Volleyball", "Football", "Swimming",
  "Athletics", "Boxing", "Badminton", "Tennis", "Kabaddi",
  "Hockey", "Weightlifting", "Gymnastics", "Archery", "Cycling", "Wrestling",
];

type SchoolSettings = {
  schoolId: number;
  enabledSports?: string | null;
  attendanceEnabled: boolean;
  registrationEnabled: boolean;
  performanceEnabled: boolean;
  analyticsEnabled: boolean;
  leaderboardEnabled: boolean;
  notificationsEnabled: boolean;
  calendarEnabled: boolean;
  messagingEnabled: boolean;
  photosEnabled: boolean;
  feesEnabled: boolean;
  aiEnabled: boolean;
  websiteEnabled: boolean;
  customMessage?: string | null;
};

type ModDef = { key: keyof SchoolSettings; label: string; pricingKey: keyof PricingConfig };

const MODULES: ModDef[] = [
  { key: "attendanceEnabled",    label: "Attendance Tracking",        pricingKey: "modAttendance" },
  { key: "registrationEnabled",  label: "Player Registration",        pricingKey: "modRegistration" },
  { key: "performanceEnabled",   label: "Performance Logging",        pricingKey: "modPerformance" },
  { key: "analyticsEnabled",     label: "Analytics Dashboard",        pricingKey: "modAnalytics" },
  { key: "leaderboardEnabled",   label: "Leaderboard",                pricingKey: "modLeaderboard" },
  { key: "calendarEnabled",      label: "Training Calendar",          pricingKey: "modCalendar" },
  { key: "messagingEnabled",     label: "In-app Messaging",           pricingKey: "modMessaging" },
  { key: "photosEnabled",        label: "Profile Photos",             pricingKey: "modPhotos" },
  { key: "feesEnabled",          label: "Student Fee Collection",     pricingKey: "modFees" },
  { key: "notificationsEnabled", label: "Notifications",              pricingKey: "modNotifications" },
  { key: "websiteEnabled",       label: "Branded School Website",     pricingKey: "modWebsite" },
  { key: "aiEnabled",            label: "AI Assistant & Insights",    pricingKey: "modAi" },
];

function SchoolNeedsDialog({ school, onClose }: { school: School; onClose: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [settings, setSettings] = React.useState<SchoolSettings | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);

  const [selectedSports, setSelectedSports] = React.useState<Set<string>>(new Set());
  const [modules, setModules] = React.useState<Partial<Record<keyof SchoolSettings, boolean>>>({});

  const { data: pricing } = useGetPricing();
  const { data: preview, isLoading: previewLoading, refetch: refetchPreview } = usePreviewInvoice(
    school.id,
    { query: { enabled: showPreview, queryKey: getPreviewInvoiceQueryKey(school.id) } }
  );

  React.useEffect(() => {
    setLoading(true);
    customFetch<SchoolSettings>(`/api/schools/${school.id}/settings`)
      .then((s) => {
        setSettings(s);
        const sports = (s.enabledSports ?? "")
          .split(",").map((x) => x.trim()).filter(Boolean);
        setSelectedSports(new Set(sports));
        const mods: Partial<Record<keyof SchoolSettings, boolean>> = {};
        for (const m of MODULES) mods[m.key] = Boolean(s[m.key]);
        setModules(mods);
      })
      .catch(() => { toast({ title: "Failed to load school settings", variant: "destructive" }); })
      .finally(() => setLoading(false));
  }, [school.id, toast]);

  const toggleSport = (sport: string) => {
    setSelectedSports((prev) => {
      const next = new Set(prev);
      if (next.has(sport)) next.delete(sport);
      else next.add(sport);
      return next;
    });
  };

  const toggleModule = (key: keyof SchoolSettings) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        enabledSports: Array.from(selectedSports).join(","),
      };
      for (const m of MODULES) payload[m.key] = modules[m.key] ?? false;
      await customFetch(`/api/schools/${school.id}/settings`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast({ title: "School needs saved", description: "Invoice will be recalculated automatically." });
      setShowPreview(true);
      refetchPreview();
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const currency = pricing?.currency ?? "INR";

  const estimatedSportCost = selectedSports.size * (pricing?.perSportFee ?? 0);
  const estimatedModCost = MODULES.reduce((sum, m) => {
    if (modules[m.key]) return sum + (pricing ? Number(pricing[m.pricingKey]) : 0);
    return sum;
  }, 0);
  const estimatedBase = pricing?.baseFee ?? 0;
  const liveEstimate = estimatedBase + estimatedSportCost + estimatedModCost;

  if (loading) {
    return <div className="flex items-center gap-2 py-8"><Loader2 className="h-5 w-5 animate-spin" /> Loading school needs…</div>;
  }

  if (!settings || !pricing) {
    return <p className="text-destructive py-4">Could not load settings.</p>;
  }

  return (
    <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">

      {/* ── SPORTS ── */}
      <div>
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
          Sports Assigned
          <Badge variant="outline">{selectedSports.size} / {ALL_SPORTS.length}</Badge>
          {pricing && <span className="text-muted-foreground font-normal text-xs">{currency} {pricing.perSportFee}/sport</span>}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Tick only the sports this school needs. Only selected sports appear in the school portal.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_SPORTS.map((sport) => {
            const on = selectedSports.has(sport);
            return (
              <button
                key={sport}
                type="button"
                onClick={() => toggleSport(sport)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors text-left ${
                  on
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {on
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  : <XCircle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                }
                {sport}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Sport cost: <span className="font-semibold text-foreground">{currency} {estimatedSportCost.toLocaleString()}</span> ({selectedSports.size} × {currency} {pricing.perSportFee})
        </p>
      </div>

      {/* ── MODULES ── */}
      <div>
        <h3 className="font-semibold text-sm mb-1">Feature Modules</h3>
        <p className="text-xs text-muted-foreground mb-3">Each ticked module adds its fee to the school's monthly invoice.</p>
        <div className="space-y-2">
          {MODULES.map((m) => {
            const on = Boolean(modules[m.key]);
            const cost = Number(pricing[m.pricingKey]);
            return (
              <div
                key={m.key}
                className={`flex items-center justify-between px-3 py-2 rounded border transition-colors ${
                  on ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`mod-${m.key}`}
                    checked={on}
                    onCheckedChange={() => toggleModule(m.key)}
                  />
                  <Label htmlFor={`mod-${m.key}`} className="cursor-pointer text-sm font-medium">{m.label}</Label>
                </div>
                <span className={`text-xs font-mono ${on ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                  {on ? `+ ${currency} ${cost}` : `${currency} ${cost}`}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Module cost: <span className="font-semibold text-foreground">{currency} {estimatedModCost.toLocaleString()}</span>
        </p>
      </div>

      {/* ── LIVE ESTIMATE ── */}
      <div className="rounded border bg-muted/40 px-4 py-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Base subscription</span>
          <span className="font-mono">{currency} {estimatedBase.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Sports ({selectedSports.size})</span>
          <span className="font-mono">{currency} {estimatedSportCost.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Modules ({MODULES.filter((m) => modules[m.key]).length})</span>
          <span className="font-mono">{currency} {estimatedModCost.toLocaleString()}</span>
        </div>
        <div className="flex justify-between border-t pt-1 font-bold">
          <span>Estimated monthly (excl. players)</span>
          <span className="font-mono text-primary">{currency} {liveEstimate.toLocaleString()}</span>
        </div>
        <p className="text-xs text-muted-foreground">Player charges ({currency} {pricing.perPlayerFee}/player) are added at invoice time.</p>
      </div>

      {/* ── SAVED INVOICE PREVIEW ── */}
      {preview && (
        <div className="rounded border px-4 py-3 space-y-1 text-sm">
          <p className="font-semibold mb-2 flex items-center gap-2"><Wallet className="h-4 w-4" /> Actual next-invoice preview (after save)</p>
          {preview.items?.map((li, idx) => (
            <div key={idx} className="flex justify-between border-b last:border-0 py-1 text-xs">
              <span>{li.label}</span>
              <span className="font-mono">{preview.currency} {li.total.toLocaleString()}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold pt-1">
            <span>Total</span>
            <span className="font-mono text-primary">{preview.currency} {preview.total.toLocaleString()}</span>
          </div>
          <p className="text-xs text-muted-foreground">{preview.playerCount} active player(s) included.</p>
        </div>
      )}

      <DialogFooter className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ListChecks className="h-4 w-4 mr-2" />}
          Save School Needs
        </Button>
        {!preview && !saving && (
          <Button variant="secondary" onClick={() => { setShowPreview(true); refetchPreview(); }} disabled={previewLoading}>
            {previewLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wallet className="h-4 w-4 mr-2" />}
            Preview invoice
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}

const schoolSchema = z.object({
  name: z.string().min(1, "Name required"),
  code: z.string().max(20).optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  ownerWhatsapp: z.string().optional(),
  ownerEmail: z.string().email().optional().or(z.literal("")),
  principalName: z.string().optional(),
  primaryColor: z.string().optional(),
  logoUrl: z.string().optional(),
});

function SchoolForm({ school, onClose }: { school?: School; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateSchool();
  const update = useUpdateSchool();

  const form = useForm<z.infer<typeof schoolSchema>>({
    resolver: zodResolver(schoolSchema),
    defaultValues: {
      name: school?.name ?? "",
      code: school?.code ?? "",
      phone: school?.phone ?? "",
      whatsappNumber: school?.whatsappNumber ?? "",
      address: school?.address ?? "",
      email: school?.email ?? "",
      ownerName: school?.ownerName ?? "",
      ownerPhone: school?.ownerPhone ?? "",
      ownerWhatsapp: school?.ownerWhatsapp ?? "",
      ownerEmail: school?.ownerEmail ?? "",
      principalName: school?.principalName ?? "",
      primaryColor: school?.primaryColor ?? "#1a3a5c",
      logoUrl: school?.logoUrl ?? "",
    },
  });

  const onSubmit = async (v: z.infer<typeof schoolSchema>) => {
    try {
      if (school) {
        await update.mutateAsync({ data: v, id: school.id });
        toast({ title: "School updated" });
      } else {
        await create.mutateAsync({ data: v });
        toast({ title: "School created" });
      }
      qc.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast({ title: "Error", description: e?.response?.data?.error ?? "Failed", variant: "destructive" });
    }
  };

  const nameValue = form.watch("name");
  const codeValue = form.watch("code");
  const codeManuallyEditedRef = React.useRef(false);
  React.useEffect(() => {
    if (school) return;
    if (codeManuallyEditedRef.current) return;
    const auto = (nameValue ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 8);
    if (auto !== codeValue) {
      form.setValue("code", auto, { shouldDirty: false, shouldValidate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameValue, school]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>School Name</FormLabel><FormControl><Input data-testid="input-school-name" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="code" render={({ field }) => (
            <FormItem><FormLabel>School Code {!school && <span className="text-muted-foreground text-xs">(auto-filled from name, editable)</span>}</FormLabel><FormControl><Input data-testid="input-school-code" {...field} className="uppercase" placeholder={school ? "" : "Auto-filled from name"} onChange={(e) => { codeManuallyEditedRef.current = true; field.onChange(e.target.value.toUpperCase()); }} disabled={!!school} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="whatsappNumber" render={({ field }) => (
            <FormItem><FormLabel>WhatsApp Number</FormLabel><FormControl><Input data-testid="input-school-whatsapp" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="principalName" render={({ field }) => (
            <FormItem><FormLabel>Principal Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="border-t pt-3 mt-1">
          <p className="text-sm font-medium mb-2">Owner Contact</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="ownerName" render={({ field }) => (
              <FormItem><FormLabel>Owner Name</FormLabel><FormControl><Input data-testid="input-owner-name" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="ownerPhone" render={({ field }) => (
              <FormItem><FormLabel>Owner Phone</FormLabel><FormControl><Input data-testid="input-owner-phone" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="ownerWhatsapp" render={({ field }) => (
              <FormItem><FormLabel>Owner WhatsApp</FormLabel><FormControl><Input data-testid="input-owner-whatsapp" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="ownerEmail" render={({ field }) => (
              <FormItem><FormLabel>Owner Email</FormLabel><FormControl><Input data-testid="input-owner-email" type="email" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
        </div>
        <FormField control={form.control} name="address" render={({ field }) => (
          <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="logoUrl" render={({ field }) => (
          <FormItem>
            <FormLabel>Logo URL <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
            <FormControl><Input data-testid="input-school-logo" placeholder="https://… or paste image link" {...field} /></FormControl>
            {field.value && <img src={field.value} alt="Logo preview" className="h-14 w-14 rounded object-cover mt-2 border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" className="w-full" disabled={create.isPending || update.isPending} data-testid="button-save-school">
          {school ? "Update School" : "Create School"}
        </Button>
      </form>
    </Form>
  );
}

function PauseDialog({ school, onClose }: { school: School; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const pauseMutation = usePauseSchool();
  const [message, setMessage] = React.useState(school.pauseMessage ?? "");

  const handlePause = async (paused: boolean) => {
    try {
      await pauseMutation.mutateAsync({ data: { paused, message }, id: school.id });
      toast({ title: paused ? "School paused" : "School activated" });
      qc.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
      onClose();
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      {!school.isPaused && (
        <div>
          <label className="text-sm font-medium">Pause message (optional)</label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Reason for pausing..." className="mt-1" />
        </div>
      )}
      <div className="flex gap-2">
        {school.isPaused ? (
          <Button onClick={() => handlePause(false)} className="flex-1">
            <Play className="h-4 w-4 mr-2" /> Activate School
          </Button>
        ) : (
          <Button onClick={() => handlePause(true)} variant="destructive" className="flex-1">
            <Pause className="h-4 w-4 mr-2" /> Pause School
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

type SubSummary = { id: number; schoolId: number; status: string; planName: string; nextInvoiceDate?: string };
type InvSummary = { id: number; schoolId: number; total: number; currency: string; status: string; dueDate: string; invoiceNumber: string };

function SubscriptionPanel({ schoolId }: { schoolId: number }) {
  const [data, setData] = React.useState<{ sub?: SubSummary; latest?: InvSummary } | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      customFetch<SubSummary[]>(`/api/subscriptions`).catch(() => [] as SubSummary[]),
      customFetch<InvSummary[]>(`/api/invoices?schoolId=${schoolId}`).catch(() => [] as InvSummary[]),
    ]).then(([subs, invs]) => {
      if (cancelled) return;
      setData({ sub: subs.find((s) => s.schoolId === schoolId), latest: invs[0] });
    });
    return () => { cancelled = true; };
  }, [schoolId]);
  if (!data) return null;
  if (!data.sub && !data.latest) return <p className="text-xs text-muted-foreground">No subscription yet.</p>;
  const inv = data.latest;
  const statusVariant = (s?: string) => s === "paid" ? "default" : s === "overdue" ? "destructive" : s === "suspended" ? "destructive" : "outline";
  return (
    <div className="mt-3 pt-3 border-t text-xs space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <Wallet className="h-3 w-3" />
        <span className="font-medium">{data.sub?.planName ?? "Standard"}</span>
        {data.sub && <Badge variant={statusVariant(data.sub.status)} className="text-[10px] capitalize">{data.sub.status}</Badge>}
        {data.sub?.nextInvoiceDate && <span className="text-muted-foreground">Next bill {data.sub.nextInvoiceDate}</span>}
      </div>
      {inv && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground">Latest:</span>
          <span className="font-mono">{inv.invoiceNumber}</span>
          <span>{inv.currency} {inv.total.toLocaleString()}</span>
          <Badge variant={statusVariant(inv.status)} className="text-[10px] capitalize">{inv.status}</Badge>
          <span className="text-muted-foreground">due {inv.dueDate}</span>
        </div>
      )}
    </div>
  );
}

export default function Schools() {
  const { data: schools, isLoading } = useListSchools();
  const qc = useQueryClient();
  const { toast } = useToast();
  const deleteSchool = useDeleteSchool();
  const [editSchool, setEditSchool] = React.useState<School | null>(null);
  const [pauseSchool, setPauseSchool] = React.useState<School | null>(null);
  const [needsSchool, setNeedsSchool] = React.useState<School | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");

  const filtered = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (schools ?? []).filter((s) => {
      if (statusFilter === "paused" && !s.isPaused) return false;
      if (statusFilter === "active" && s.isPaused) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.ownerName ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [schools, searchQuery, statusFilter]);

  const { page, setPage, pageCount, total, pageItems } = usePagination(filtered, 12);
  React.useEffect(() => { setPage(1); }, [searchQuery, statusFilter, setPage]);

  const handleDelete = async (id: number) => {
    try {
      await deleteSchool.mutateAsync({ id });
      toast({ title: "School deleted" });
      qc.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const [exporting, setExporting] = React.useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export/schools", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schools-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Schools</h1>
          <p className="text-muted-foreground">Manage all registered schools</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} data-testid="button-export-schools">
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Export CSV
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-school"><Plus className="h-4 w-4 mr-2" />Add School</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create School</DialogTitle></DialogHeader>
              <SchoolForm onClose={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-search-schools"
            className="pl-9"
            placeholder="Search by name, code, owner, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="select-school-status" className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Schools</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : !filtered.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{schools?.length ? "No schools match your filters." : "No schools yet. Add your first school."}</p>
        </div>
      ) : (
        <>
        <div className="grid md:grid-cols-2 gap-4">
          {pageItems.map((school) => (
            <Card key={school.id} data-testid={`card-school-${school.id}`} className={school.isPaused ? "opacity-70 border-destructive/40" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-base">{school.name}</h3>
                      <Badge variant="outline" className="text-xs">{school.code}</Badge>
                      {school.isPaused && <Badge variant="destructive" className="text-xs">Paused</Badge>}
                    </div>
                    {school.ownerName && <p className="text-sm text-muted-foreground">Owner: {school.ownerName}</p>}
                    {school.email && <p className="text-sm text-muted-foreground">{school.email}</p>}
                    {school.pauseMessage && <p className="text-xs text-destructive mt-1">{school.pauseMessage}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Created {new Date(school.createdAt!).toLocaleDateString()}</p>
                    <SubscriptionPanel schoolId={school.id} />
                  </div>
                  <div className="flex gap-1">
                    {/* School Needs button */}
                    <Dialog open={needsSchool?.id === school.id} onOpenChange={(o) => !o && setNeedsSchool(null)}>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => setNeedsSchool(school)} title="Configure school needs" data-testid={`button-needs-${school.id}`}>
                          <ListChecks className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <ListChecks className="h-5 w-5" /> School Needs — {school.name}
                          </DialogTitle>
                          <DialogDescription>
                            Select which sports and feature modules this school requires. The monthly invoice is calculated automatically based on these selections.
                          </DialogDescription>
                        </DialogHeader>
                        {needsSchool?.id === school.id && (
                          <SchoolNeedsDialog school={school} onClose={() => setNeedsSchool(null)} />
                        )}
                      </DialogContent>
                    </Dialog>

                    <Dialog open={pauseSchool?.id === school.id} onOpenChange={(o) => !o && setPauseSchool(null)}>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => setPauseSchool(school)} data-testid={`button-pause-${school.id}`}>
                          {school.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>{school.isPaused ? "Activate" : "Pause"} School</DialogTitle></DialogHeader>
                        {pauseSchool && <PauseDialog school={pauseSchool} onClose={() => setPauseSchool(null)} />}
                      </DialogContent>
                    </Dialog>
                    <Dialog open={editSchool?.id === school.id} onOpenChange={(o) => !o && setEditSchool(null)}>
                      <DialogTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => setEditSchool(school)} data-testid={`button-edit-${school.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader><DialogTitle>Edit School</DialogTitle></DialogHeader>
                        {editSchool && <SchoolForm school={editSchool} onClose={() => setEditSchool(null)} />}
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-destructive" data-testid={`button-delete-${school.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete School</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete {school.name} and all its data.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(school.id)} className="bg-destructive">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Pagination page={page} pageCount={pageCount} total={total} onChange={setPage} />
        </>
      )}
    </div>
  );
}
