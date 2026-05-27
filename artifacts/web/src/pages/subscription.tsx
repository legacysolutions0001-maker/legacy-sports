import * as React from "react";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Wallet, FileText, QrCode, Download, Loader2 } from "lucide-react";

type Subscription = {
  id: number; schoolId: number; planName: string; status: string;
  autoBill: boolean; nextInvoiceDate?: string; lastInvoicedAt?: string;
};

type Invoice = {
  id: number; schoolId: number; invoiceNumber: string;
  periodStart: string; periodEnd: string; dueDate: string;
  subtotal: number; total: number; currency: string;
  status: "pending" | "paid" | "overdue" | "void";
  paidAt?: string;
  lineItems?: Array<{ label: string; qty: number; unit: number; total: number }>;
};

type Preview = { items: Invoice["lineItems"]; subtotal: number; total: number; currency: string; playerCount: number };

type PaymentDetails = {
  upiId?: string;
  qrCodeUrl?: string;
  account1BankName?: string;
  account1AccountNumber?: string;
  account1IfscCode?: string;
  account1HolderName?: string;
  account2BankName?: string;
  account2AccountNumber?: string;
  account2IfscCode?: string;
  account2HolderName?: string;
};

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [sub, setSub] = React.useState<Subscription | null>(null);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [payment, setPayment] = React.useState<PaymentDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pdfLoading, setPdfLoading] = React.useState<number | null>(null);

  const downloadPdf = async (invoiceId: number, invoiceNumber: string) => {
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
      alert("Could not download PDF. Please try again.");
    } finally {
      setPdfLoading(null);
    }
  };

  React.useEffect(() => {
    if (!user?.schoolId) { setLoading(false); return; }
    Promise.all([
      customFetch<Subscription[]>("/api/subscriptions").catch(() => []),
      customFetch<Invoice[]>("/api/invoices").catch(() => []),
      customFetch<Preview>(`/api/subscriptions/${user.schoolId}/preview`).catch(() => null),
      customFetch<PaymentDetails>("/api/payment-methods").catch(() => null),
    ]).then(([subs, invs, prev, pay]) => {
      setSub(subs[0] ?? null); setInvoices(invs); setPreview(prev); setPayment(pay);
    }).finally(() => setLoading(false));
  }, [user?.schoolId]);

  if (loading) return <div className="p-6 space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  const statusBadge = (s: string) =>
    s === "paid" ? "default" : s === "overdue" ? "destructive" : s === "void" ? "secondary" : "outline";

  const hasPaymentDetails = payment && (
    payment.upiId || payment.qrCodeUrl || payment.account1BankName || payment.account2BankName
  );

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> Subscription & Billing</h1>
        <p className="text-muted-foreground">Your Legacy Sports platform subscription, invoices and upcoming bill.</p>
      </div>

      {sub && (
        <Card>
          <CardHeader><CardTitle className="text-base">Subscription</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><div className="text-muted-foreground text-xs">Plan</div><div className="font-medium">{sub.planName}</div></div>
            <div><div className="text-muted-foreground text-xs">Status</div><Badge variant={sub.status === "suspended" ? "destructive" : "default"} className="capitalize">{sub.status}</Badge></div>
            <div><div className="text-muted-foreground text-xs">Auto-bill</div><div className="font-medium">{sub.autoBill ? "On" : "Off"}</div></div>
            <div><div className="text-muted-foreground text-xs">Next invoice</div><div className="font-medium">{sub.nextInvoiceDate ?? "—"}</div></div>
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader><CardTitle className="text-base">Upcoming bill preview</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {preview.items?.map((li, i) => (
              <div key={i} className="flex justify-between text-sm border-b py-1 last:border-0">
                <span>{li.label}</span>
                <span className="font-mono">{preview.currency} {li.total.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-2">
              <span>Total</span>
              <span>{preview.currency} {preview.total.toLocaleString()}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">Based on {preview.playerCount} active player(s) + your enabled modules.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Invoice history</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No invoices yet.</p>
          ) : invoices.map((i) => (
            <div key={i.id} className="border rounded p-3 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium">{i.invoiceNumber}</div>
                  <div className="text-xs text-muted-foreground">Period {i.periodStart} → {i.periodEnd} · Due {i.dueDate}</div>
                </div>
                <div className="font-semibold">{i.currency} {i.total.toLocaleString()}</div>
                <Badge variant={statusBadge(i.status) as "default" | "destructive" | "secondary" | "outline"} className="capitalize">{i.status}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downloadPdf(i.id, i.invoiceNumber)}
                  disabled={pdfLoading === i.id}
                >
                  {pdfLoading === i.id
                    ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    : <Download className="h-3 w-3 mr-1" />}
                  PDF
                </Button>
              </div>

              {i.lineItems && i.lineItems.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">Line items</summary>
                  <div className="mt-2 space-y-1">
                    {i.lineItems.map((li, idx) => (
                      <div key={idx} className="flex justify-between border-b py-1 last:border-0">
                        <span>{li.label}</span>
                        <span className="font-mono">{i.currency} {li.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Payment details on each invoice */}
              {i.status !== "paid" && i.status !== "void" && hasPaymentDetails && (
                <div className="border rounded p-3 space-y-3 bg-muted/30">
                  <div className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                    <QrCode className="h-3.5 w-3.5" /> How to Pay
                  </div>
                  <div className="flex gap-6 flex-wrap">
                    <div className="flex-1 space-y-3 min-w-[180px]">
                      {payment?.upiId && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">UPI ID</div>
                          <div className="font-mono text-sm font-semibold">{payment.upiId}</div>
                        </div>
                      )}
                      {payment?.account1BankName && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5 font-medium">Bank Account 1</div>
                          <div className="text-xs space-y-0.5">
                            <div><span className="text-muted-foreground">Bank:</span> {payment.account1BankName}</div>
                            <div><span className="text-muted-foreground">A/C No:</span> {payment.account1AccountNumber}</div>
                            <div><span className="text-muted-foreground">IFSC:</span> {payment.account1IfscCode}</div>
                            <div><span className="text-muted-foreground">Name:</span> {payment.account1HolderName}</div>
                          </div>
                        </div>
                      )}
                      {payment?.account2BankName && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5 font-medium">Bank Account 2</div>
                          <div className="text-xs space-y-0.5">
                            <div><span className="text-muted-foreground">Bank:</span> {payment.account2BankName}</div>
                            <div><span className="text-muted-foreground">A/C No:</span> {payment.account2AccountNumber}</div>
                            <div><span className="text-muted-foreground">IFSC:</span> {payment.account2IfscCode}</div>
                            <div><span className="text-muted-foreground">Name:</span> {payment.account2HolderName}</div>
                          </div>
                        </div>
                      )}
                    </div>
                    {payment?.qrCodeUrl && (
                      <div className="flex flex-col items-center gap-1">
                        <img src={payment.qrCodeUrl} alt="Payment QR" className="w-24 h-24 object-contain border rounded-md p-1 bg-white" />
                        <span className="text-xs text-muted-foreground">Scan to pay</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
