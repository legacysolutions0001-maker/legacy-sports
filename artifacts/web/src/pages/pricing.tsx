import * as React from "react";
import {
  useGetPricing,
  useUpdatePricing,
  useListSubscriptions,
  useListInvoices,
  useListSchools,
  usePreviewInvoice,
  useGenerateInvoice,
  useUpdateInvoice,
  useMarkInvoicePaid,
  useMarkInvoiceUnpaid,
  useVoidInvoice,
  useSendInvoiceReminders,
  useListReminders,
  useRunBillingCycle,
  getGetPricingQueryKey,
  getListInvoicesQueryKey,
  getListSubscriptionsQueryKey,
  getListSchoolsQueryKey,
  getListRemindersQueryKey,
  getPreviewInvoiceQueryKey,
} from "@workspace/api-client-react";
import type {
  PricingConfig,
  PricingConfigInput,
  Invoice,
  School,
  Subscription,
  ReminderLog,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, Save, RefreshCw, FileText, Send, Eye, CheckCircle2, XCircle, Loader2, Bell, Upload, QrCode, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const PRICE_FIELDS: Array<{ key: keyof PricingConfigInput; label: string; section?: string }> = [
  { key: "baseFee",           label: "Base subscription / month",   section: "Base fees" },
  { key: "perPlayerFee",      label: "Per active player / month" },
  { key: "perSportFee",       label: "Per enabled sport / month" },
  { key: "modWebsite",        label: "Branded school website",       section: "Module fees" },
  { key: "modAi",             label: "AI assistant & insights" },
  { key: "modAttendance",     label: "Attendance module" },
  { key: "modPerformance",    label: "Performance tracking" },
  { key: "modAnalytics",      label: "Analytics dashboard" },
  { key: "modLeaderboard",    label: "Leaderboard" },
  { key: "modCalendar",       label: "Training calendar" },
  { key: "modMessaging",      label: "In-app messaging" },
  { key: "modPhotos",         label: "Profile photos" },
  { key: "modNotifications",  label: "Notifications" },
  { key: "modFees",           label: "Student fee collection" },
  { key: "modRegistration",   label: "Open registration" },
];

function statusBadge(s: string): "default" | "destructive" | "secondary" | "outline" {
  if (s === "paid")    return "default";
  if (s === "overdue") return "destructive";
  if (s === "void")    return "secondary";
  return "outline";
}

export default function PricingPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: pricing, isLoading: pricingLoading } = useGetPricing();
  const { data: schools = [] }     = useListSchools();
  const { data: subs = [] }        = useListSubscriptions();
  const { data: invoices = [] }    = useListInvoices();

  const [draft, setDraft] = React.useState<PricingConfigInput | null>(null);
  React.useEffect(() => {
    if (pricing && !draft) setDraft({ ...pricing });
  }, [pricing, draft]);

  const invalidateAll = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: getGetPricingQueryKey() });
    qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
    qc.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });
    qc.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
  }, [qc]);

  const updatePricing = useUpdatePricing({
    mutation: {
      onSuccess: () => { toast({ title: "Pricing saved" }); invalidateAll(); },
      onError: ()  => { toast({ title: "Save failed", variant: "destructive" }); },
    },
  });

  const runCycleMut = useRunBillingCycle({
    mutation: {
      onSuccess: (r) => {
        toast({ title: "Billing cycle complete", description: `Created ${r.invoices} invoice(s), suspended ${r.suspended} school(s)` });
        invalidateAll();
      },
      onError: () => { toast({ title: "Cycle failed", variant: "destructive" }); },
    },
  });

  const [previewSchool, setPreviewSchool] = React.useState<School | null>(null);
  const { data: preview, isLoading: previewLoading } = usePreviewInvoice(
    previewSchool?.id ?? 0,
    { query: { enabled: !!previewSchool, queryKey: getPreviewInvoiceQueryKey(previewSchool?.id ?? 0) } }
  );

  const generateInvoiceMut = useGenerateInvoice({
    mutation: {
      onSuccess: () => { toast({ title: "Invoice generated" }); setPreviewSchool(null); invalidateAll(); },
      onError:   () => { toast({ title: "Generate failed", variant: "destructive" }); },
    },
  });

  const [invoiceDetail, setInvoiceDetail] = React.useState<Invoice | null>(null);
  const { data: reminders = [] } = useListReminders(
    { invoiceId: invoiceDetail?.id },
    { query: { enabled: !!invoiceDetail, queryKey: getListRemindersQueryKey({ invoiceId: invoiceDetail?.id }) } }
  );

  const markPaid = useMarkInvoicePaid({
    mutation: {
      onSuccess: () => { toast({ title: "Invoice marked paid" }); setInvoiceDetail(null); invalidateAll(); },
      onError:   () => { toast({ title: "Failed", variant: "destructive" }); },
    },
  });
  const markUnpaid = useMarkInvoiceUnpaid({
    mutation: {
      onSuccess: () => { toast({ title: "Invoice marked unpaid" }); setInvoiceDetail(null); invalidateAll(); },
      onError:   () => { toast({ title: "Failed", variant: "destructive" }); },
    },
  });
  const voidInv = useVoidInvoice({
    mutation: {
      onSuccess: () => { toast({ title: "Invoice voided" }); setInvoiceDetail(null); invalidateAll(); },
      onError:   () => { toast({ title: "Failed", variant: "destructive" }); },
    },
  });
  const sendReminders = useSendInvoiceReminders({
    mutation: {
      onSuccess: () => {
        toast({ title: "AI reminders sent on all channels" });
        if (invoiceDetail) qc.invalidateQueries({ queryKey: getListRemindersQueryKey({ invoiceId: invoiceDetail.id }) });
      },
      onError: () => { toast({ title: "Send failed", variant: "destructive" }); },
    },
  });

  const [pdfLoading, setPdfLoading] = React.useState<number | null>(null);
  const downloadInvoicePdf = async (invoiceId: number, invoiceNumber: string) => {
    setPdfLoading(invoiceId);
    try {
      const resp = await fetch(`/api/invoices/${invoiceId}/pdf`, { credentials: "include" });
      if (!resp.ok) throw new Error("Download failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "PDF download failed", variant: "destructive" });
    } finally {
      setPdfLoading(null);
    }
  };

  const [editOpen, setEditOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState<{ total: number; dueDate: string; notes: string }>({ total: 0, dueDate: "", notes: "" });
  const openEdit = () => {
    if (!invoiceDetail) return;
    setEditForm({ total: invoiceDetail.total, dueDate: invoiceDetail.dueDate, notes: "" });
    setEditOpen(true);
  };
  const updateInvoiceMut = useUpdateInvoice({
    mutation: {
      onSuccess: (updated) => {
        toast({ title: "Invoice updated" });
        setInvoiceDetail(updated as Invoice);
        setEditOpen(false);
        invalidateAll();
      },
      onError: () => { toast({ title: "Update failed", variant: "destructive" }); },
    },
  });

  const schoolName   = (id: number) => (schools as School[]).find((s) => s.id === id)?.name ?? `School #${id}`;
  const schoolById   = (id: number) => (schools as School[]).find((s) => s.id === id);
  const subForSchool = (id: number) => (subs as Subscription[]).find((s) => s.schoolId === id);
  const latestInvForSchool = (id: number) => (invoices as Invoice[]).filter((i) => i.schoolId === id)[0];

  const currency     = pricing?.currency ?? "INR";
  const totalPending = (invoices as Invoice[]).filter((i) => i.status === "pending").reduce((s, i) => s + i.total, 0);
  const totalOverdue = (invoices as Invoice[]).filter((i) => i.status === "overdue").reduce((s, i) => s + i.total, 0);
  const totalPaid    = (invoices as Invoice[]).filter((i) => i.status === "paid").reduce((s, i) => s + i.total, 0);

  if (pricingLoading || !draft) {
    return <div className="p-6 space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> Pricing & Billing</h1>
          <p className="text-muted-foreground">Configure platform pricing, review invoices, send AI reminders.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={invalidateAll}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          <Button onClick={() => runCycleMut.mutate()} disabled={runCycleMut.isPending}>
            {runCycleMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Run billing cycle
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{currency} {totalPending.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{currency} {totalOverdue.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Collected</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-500">{currency} {totalPaid.toLocaleString()}</div></CardContent></Card>
      </div>

      {/* Pricing configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing configuration</CardTitle>
          <p className="text-xs text-muted-foreground">
            Rates are in <strong>{draft.currency}</strong> per month. Changes apply to new invoices only.
            {pricing?.updatedAt && ` Last updated ${new Date(pricing.updatedAt).toLocaleString()}.`}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Group fields by section */}
          {(() => {
            const sections: Array<{ title: string; fields: typeof PRICE_FIELDS }> = [];
            let current: (typeof sections)[0] | null = null;
            for (const f of PRICE_FIELDS) {
              if (f.section || !current) {
                current = { title: f.section ?? "", fields: [] };
                sections.push(current);
              }
              current.fields.push(f);
            }
            return sections.map((sec) => (
              <div key={sec.title} className="space-y-3">
                {sec.title && <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">{sec.title}</h3>}
                <div className="grid md:grid-cols-3 gap-3">
                  {sec.fields.map(({ key, label }) => (
                    <div key={key}>
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type="number"
                        value={(draft[key] as number) ?? 0}
                        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}

          {/* Settings */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Settings</h3>
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Currency</Label>
                <Input value={draft.currency ?? ""} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Grace period (days)</Label>
                <Input type="number" value={draft.gracePeriodDays ?? 0} onChange={(e) => setDraft({ ...draft, gracePeriodDays: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Reminder days before due</Label>
                <Input type="number" value={draft.reminderDaysBefore ?? 0} onChange={(e) => setDraft({ ...draft, reminderDaysBefore: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Auto-suspend after (days)</Label>
                <Input type="number" value={draft.autoSuspendAfterDays ?? 0} onChange={(e) => setDraft({ ...draft, autoSuspendAfterDays: Number(e.target.value) })} />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => updatePricing.mutate({ data: draft })}
              disabled={updatePricing.isPending}
            >
              {updatePricing.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save pricing
            </Button>
            <Button variant="outline" onClick={() => setDraft({ ...pricing as PricingConfig })}>
              Reset changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><QrCode className="h-4 w-4" /> Payment Details</CardTitle>
          <p className="text-xs text-muted-foreground">Add your payment information so schools can make payments easily. These details appear on invoices.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Code upload */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">QR Code</h3>
            <div className="flex items-start gap-6">
              <div className="flex-1 space-y-2">
                <Label className="text-xs">Upload QR Code Image</Label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm hover:bg-accent hover:text-accent-foreground transition-colors">
                    <Upload className="h-4 w-4" />
                    Choose file
                  </div>
                  <span className="text-xs text-muted-foreground">PNG, JPG, or JPEG</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const result = ev.target?.result as string;
                        if (draft) setDraft({ ...draft, qrCodeUrl: result });
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                <p className="text-xs text-muted-foreground">The QR code will be displayed on invoices for easy payments.</p>
              </div>
              {draft?.qrCodeUrl && (
                <div className="flex flex-col items-center gap-2">
                  <img src={draft.qrCodeUrl} alt="Payment QR Code" className="w-32 h-32 object-contain border rounded-md p-1" />
                  <button
                    className="text-xs text-destructive hover:underline"
                    onClick={() => setDraft({ ...draft, qrCodeUrl: "" })}
                  >
                    Remove
                  </button>
                </div>
              )}
              {!draft?.qrCodeUrl && (
                <div className="w-32 h-32 border-2 border-dashed rounded-md flex items-center justify-center text-muted-foreground">
                  <QrCode className="h-10 w-10 opacity-30" />
                </div>
              )}
            </div>
          </div>

          {/* UPI ID */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">UPI</h3>
            <div className="max-w-sm">
              <Label className="text-xs">UPI ID</Label>
              <Input
                placeholder="yourname@bank"
                value={draft?.upiId ?? ""}
                onChange={(e) => draft && setDraft({ ...draft, upiId: e.target.value })}
              />
            </div>
          </div>

          {/* Bank Account 1 */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Bank Account 1</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Holder Name</Label>
                <Input
                  placeholder="Account holder name"
                  value={draft?.account1HolderName ?? ""}
                  onChange={(e) => draft && setDraft({ ...draft, account1HolderName: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Bank Name</Label>
                <Input
                  placeholder="e.g. State Bank of India"
                  value={draft?.account1BankName ?? ""}
                  onChange={(e) => draft && setDraft({ ...draft, account1BankName: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Account Number</Label>
                <Input
                  placeholder="Account number"
                  value={draft?.account1AccountNumber ?? ""}
                  onChange={(e) => draft && setDraft({ ...draft, account1AccountNumber: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">IFSC Code</Label>
                <Input
                  placeholder="e.g. SBIN0001234"
                  value={draft?.account1IfscCode ?? ""}
                  onChange={(e) => draft && setDraft({ ...draft, account1IfscCode: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Bank Account 2 */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">Bank Account 2</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Holder Name</Label>
                <Input
                  placeholder="Account holder name"
                  value={draft?.account2HolderName ?? ""}
                  onChange={(e) => draft && setDraft({ ...draft, account2HolderName: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Bank Name</Label>
                <Input
                  placeholder="e.g. HDFC Bank"
                  value={draft?.account2BankName ?? ""}
                  onChange={(e) => draft && setDraft({ ...draft, account2BankName: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Account Number</Label>
                <Input
                  placeholder="Account number"
                  value={draft?.account2AccountNumber ?? ""}
                  onChange={(e) => draft && setDraft({ ...draft, account2AccountNumber: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">IFSC Code</Label>
                <Input
                  placeholder="e.g. HDFC0001234"
                  value={draft?.account2IfscCode ?? ""}
                  onChange={(e) => draft && setDraft({ ...draft, account2IfscCode: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => updatePricing.mutate({ data: draft! })}
              disabled={updatePricing.isPending}
            >
              {updatePricing.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save payment details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions by school */}
      <Card>
        <CardHeader><CardTitle className="text-base">Subscriptions by school</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(schools as School[]).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No schools yet.</p>
          ) : (schools as School[]).map((s) => {
            const sub = subForSchool(s.id);
            const inv = latestInvForSchool(s.id);
            return (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded border flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium flex items-center gap-2">
                    {s.name}
                    <Badge variant="outline" className="text-xs">{s.code}</Badge>
                    {s.isPaused && <Badge variant="destructive" className="text-xs">Suspended</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sub ? `Status: ${sub.status} · Next bill: ${sub.nextInvoiceDate ?? "—"}` : "No subscription"}
                    {inv && ` · Latest: ${inv.invoiceNumber} (${inv.status})`}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPreviewSchool(s)}>
                  <Eye className="h-3 w-3 mr-1" />Preview
                </Button>
                <Button size="sm" onClick={() => generateInvoiceMut.mutate({ schoolId: s.id })} disabled={generateInvoiceMut.isPending}>
                  <FileText className="h-3 w-3 mr-1" />Generate invoice
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* All invoices */}
      <Card>
        <CardHeader><CardTitle className="text-base">All invoices</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(invoices as Invoice[]).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No invoices yet. Click "Run billing cycle" or "Generate invoice" to create one.</p>
          ) : (invoices as Invoice[]).map((i) => (
            <div
              key={i.id}
              className="flex items-center gap-3 p-3 rounded border flex-wrap cursor-pointer hover:bg-accent/30"
              onClick={() => setInvoiceDetail(i)}
            >
              <div className="flex-1 min-w-[180px]">
                <div className="font-medium">{i.invoiceNumber}</div>
                <div className="text-xs text-muted-foreground">
                  {schoolName(i.schoolId)} · period {i.periodStart} → {i.periodEnd} · due {i.dueDate}
                </div>
              </div>
              <div className="font-semibold">{i.currency} {i.total.toLocaleString()}</div>
              <Badge variant={statusBadge(i.status)} className="capitalize">{i.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Preview dialog */}
      <Dialog open={!!previewSchool} onOpenChange={(o) => !o && setPreviewSchool(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Next bill preview · {previewSchool?.name}</DialogTitle>
            <DialogDescription>Computed from the school's currently enabled modules and active player count.</DialogDescription>
          </DialogHeader>
          {previewLoading || !preview ? <Skeleton className="h-32" /> : (
            <div className="space-y-2">
              {preview.items?.map((li, idx) => (
                <div key={idx} className="flex justify-between text-sm border-b pb-1">
                  <span>{li.label}</span>
                  <span className="font-mono">{preview.currency} {li.total.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold pt-2">
                <span>Total</span>
                <span>{preview.currency} {preview.total.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground">{preview.playerCount} active player(s) at the per-player rate.</p>
            </div>
          )}
          <DialogFooter>
            {previewSchool && (
              <Button
                onClick={() => generateInvoiceMut.mutate({ schoolId: previewSchool.id })}
                disabled={generateInvoiceMut.isPending}
              >
                Generate this invoice
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice detail dialog */}
      <Dialog open={!!invoiceDetail} onOpenChange={(o) => !o && setInvoiceDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{invoiceDetail?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              {invoiceDetail && schoolById(invoiceDetail.schoolId)?.name} · period {invoiceDetail?.periodStart} → {invoiceDetail?.periodEnd}
            </DialogDescription>
          </DialogHeader>
          {invoiceDetail && (
            <div className="space-y-4">
              <div className="space-y-1 border rounded p-3">
                {(invoiceDetail.lineItems ?? []).map((li, idx) => (
                  <div key={idx} className="flex justify-between text-sm border-b last:border-0 py-1">
                    <span>{li.label}</span>
                    <span className="font-mono">{invoiceDetail.currency} {li.total.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2">
                  <span>Total</span>
                  <span>{invoiceDetail.currency} {invoiceDetail.total.toLocaleString()}</span>
                </div>
                <div className="text-xs text-muted-foreground pt-1">
                  Status: <Badge variant={statusBadge(invoiceDetail.status)} className="capitalize">{invoiceDetail.status}</Badge>
                  {" · "}Due {invoiceDetail.dueDate}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => downloadInvoicePdf(invoiceDetail.id, invoiceDetail.invoiceNumber)}
                  disabled={pdfLoading === invoiceDetail.id}
                >
                  {pdfLoading === invoiceDetail.id
                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    : <Download className="h-4 w-4 mr-2" />}
                  Download PDF
                </Button>
                {invoiceDetail.status !== "paid" && invoiceDetail.status !== "void" && (
                  <Button onClick={() => markPaid.mutate({ id: invoiceDetail.id })} disabled={markPaid.isPending}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />Mark paid
                  </Button>
                )}
                {invoiceDetail.status === "paid" && (
                  <Button variant="outline" onClick={() => markUnpaid.mutate({ id: invoiceDetail.id })} disabled={markUnpaid.isPending}>
                    <XCircle className="h-4 w-4 mr-2" />Mark unpaid
                  </Button>
                )}
                {invoiceDetail.status !== "paid" && invoiceDetail.status !== "void" && (
                  <Button variant="outline" onClick={() => voidInv.mutate({ id: invoiceDetail.id })} disabled={voidInv.isPending}>
                    <XCircle className="h-4 w-4 mr-2" />Void
                  </Button>
                )}
                {invoiceDetail.status !== "void" && (
                  <Button variant="outline" onClick={openEdit}>Override total / due date</Button>
                )}
                {invoiceDetail.status !== "paid" && invoiceDetail.status !== "void" && (
                  <Button
                    variant="secondary"
                    onClick={() => sendReminders.mutate({ id: invoiceDetail.id, data: { channels: ["email", "sms", "whatsapp", "inbox"] } })}
                    disabled={sendReminders.isPending}
                  >
                    {sendReminders.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Send AI reminders
                  </Button>
                )}
              </div>

              {/* Override dialog */}
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Override invoice</DialogTitle>
                    <DialogDescription>Replace the auto-computed total or push out the due date for this school.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Total ({invoiceDetail.currency})</Label>
                      <Input type="number" value={editForm.total} onChange={(e) => setEditForm({ ...editForm, total: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="text-xs">Due date</Label>
                      <Input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Notes (visible internally)</Label>
                      <Input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Why is this overridden?" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button
                      onClick={() => updateInvoiceMut.mutate({ id: invoiceDetail.id, data: { total: editForm.total, subtotal: editForm.total, dueDate: editForm.dueDate, notes: editForm.notes } })}
                      disabled={updateInvoiceMut.isPending}
                    >
                      {updateInvoiceMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Save override
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Payment details on invoice */}
              {(pricing?.upiId || pricing?.qrCodeUrl || pricing?.account1BankName || pricing?.account2BankName) && (
                <div className="border rounded p-4 space-y-3 bg-muted/30">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><QrCode className="h-4 w-4" /> Payment Details</h4>
                  <div className="flex gap-6 flex-wrap">
                    <div className="flex-1 space-y-3 min-w-[200px]">
                      {pricing?.upiId && (
                        <div>
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">UPI</div>
                          <div className="font-mono text-sm font-semibold">{pricing.upiId}</div>
                        </div>
                      )}
                      {pricing?.account1BankName && (
                        <div>
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Account 1</div>
                          <div className="text-sm space-y-0.5">
                            <div><span className="text-muted-foreground">Bank:</span> {pricing.account1BankName}</div>
                            <div><span className="text-muted-foreground">A/C:</span> {pricing.account1AccountNumber}</div>
                            <div><span className="text-muted-foreground">IFSC:</span> {pricing.account1IfscCode}</div>
                            <div><span className="text-muted-foreground">Name:</span> {pricing.account1HolderName}</div>
                          </div>
                        </div>
                      )}
                      {pricing?.account2BankName && (
                        <div>
                          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Account 2</div>
                          <div className="text-sm space-y-0.5">
                            <div><span className="text-muted-foreground">Bank:</span> {pricing.account2BankName}</div>
                            <div><span className="text-muted-foreground">A/C:</span> {pricing.account2AccountNumber}</div>
                            <div><span className="text-muted-foreground">IFSC:</span> {pricing.account2IfscCode}</div>
                            <div><span className="text-muted-foreground">Name:</span> {pricing.account2HolderName}</div>
                          </div>
                        </div>
                      )}
                    </div>
                    {pricing?.qrCodeUrl && (
                      <div className="flex flex-col items-center gap-1">
                        <img src={pricing.qrCodeUrl} alt="Payment QR" className="w-28 h-28 object-contain border rounded-md p-1 bg-white" />
                        <span className="text-xs text-muted-foreground">Scan to pay</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Reminder history */}
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2"><Bell className="h-4 w-4" /> Reminder history</h4>
                {(reminders as ReminderLog[]).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No reminders sent yet for this invoice.</p>
                ) : (
                  <div className="space-y-2">
                    {(reminders as ReminderLog[]).map((r) => (
                      <div key={r.id} className="border rounded p-2 text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">{r.channel}</Badge>
                          <Badge variant={r.status === "sent" ? "default" : "destructive"} className="capitalize">{r.status}</Badge>
                          <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                          <span className="text-muted-foreground">via {r.provider}</span>
                        </div>
                        {r.recipient && <div className="text-muted-foreground">To: {r.recipient}</div>}
                        {r.subject && <div className="font-medium">{r.subject}</div>}
                        <div className="whitespace-pre-wrap text-muted-foreground">{r.body}</div>
                        {r.error && <div className="text-destructive">Error: {r.error}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
