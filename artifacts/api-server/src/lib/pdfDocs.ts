import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { Letter, Certificate, School } from "@workspace/db/schema";
import { logger } from "./logger";
import * as https from "node:https";
import * as dns from "node:dns/promises";
import * as net from "node:net";

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 50;

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

function isUnsafeHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  return false;
}

function isUnsafeIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return true;
  const [a, b] = [parts[0]!, parts[1]!];
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && parts[2] === 2) return true; // TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a === 198 && b === 51 && parts[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && parts[2] === 113) return true; // TEST-NET-3
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved / broadcast
  return false;
}

// Parse IPv6 (incl. dotted-quad suffix and :: expansion) into a 16-byte buffer.
function ipv6ToBytes(ip: string): Uint8Array | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  if (!s) return null;
  // Convert trailing dotted-quad to two hextets
  const lastColon = s.lastIndexOf(":");
  if (lastColon >= 0 && s.slice(lastColon + 1).includes(".")) {
    const v4 = s.slice(lastColon + 1);
    if (!net.isIPv4(v4)) return null;
    const q = v4.split(".").map((n) => parseInt(n, 10));
    const hi = ((q[0]! << 8) | q[1]!).toString(16);
    const lo = ((q[2]! << 8) | q[3]!).toString(16);
    s = s.slice(0, lastColon + 1) + hi + ":" + lo;
  }
  const dbl = s.split("::");
  if (dbl.length > 2) return null;
  const head = dbl[0] ? dbl[0].split(":") : [];
  const tail = dbl.length === 2 && dbl[1] ? dbl[1].split(":") : [];
  let groups: string[];
  if (dbl.length === 1) {
    if (head.length !== 8) return null;
    groups = head;
  } else {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill("0"), ...tail];
  }
  if (groups.length !== 8) return null;
  const out = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const g = groups[i]!;
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    const n = parseInt(g, 16);
    out[i * 2] = (n >> 8) & 0xff;
    out[i * 2 + 1] = n & 0xff;
  }
  return out;
}

function isUnsafeIpv6Bytes(b: Uint8Array): boolean {
  // :: unspecified or ::1 loopback
  let zeros = 0;
  for (let i = 0; i < 15; i++) if (b[i] === 0) zeros++;
  if (zeros === 15 && (b[15] === 0 || b[15] === 1)) return true;
  // IPv4-mapped ::ffff:0:0/96
  let mapped = true;
  for (let i = 0; i < 10; i++) if (b[i] !== 0) { mapped = false; break; }
  if (mapped && b[10] === 0xff && b[11] === 0xff) {
    return isUnsafeIpv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  }
  // IPv4-compatible ::/96 (deprecated) — treat embedded IPv4 strictly
  let compat = true;
  for (let i = 0; i < 12; i++) if (b[i] !== 0) { compat = false; break; }
  if (compat) {
    return isUnsafeIpv4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`);
  }
  // Link-local fe80::/10
  if (b[0] === 0xfe && (b[1]! & 0xc0) === 0x80) return true;
  // ULA fc00::/7
  if ((b[0]! & 0xfe) === 0xfc) return true;
  // Multicast ff00::/8
  if (b[0] === 0xff) return true;
  // Discard prefix 100::/64
  if (b[0] === 0x01 && b[1] === 0x00) {
    let z = true;
    for (let i = 2; i < 8; i++) if (b[i] !== 0) { z = false; break; }
    if (z) return true;
  }
  return false;
}

function isUnsafeIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isUnsafeIpv4(ip);
  if (net.isIPv6(ip)) {
    const bytes = ipv6ToBytes(ip);
    if (!bytes) return true;
    return isUnsafeIpv6Bytes(bytes);
  }
  return true;
}

async function resolvePinnedIp(hostname: string): Promise<{ address: string; family: 4 | 6 } | null> {
  // If hostname is already an IP literal, validate directly.
  if (net.isIP(hostname)) {
    if (isUnsafeIp(hostname)) return null;
    return { address: hostname, family: net.isIPv6(hostname) ? 6 : 4 };
  }
  let addrs: { address: string; family: number }[];
  try {
    addrs = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    return null;
  }
  if (!addrs.length) return null;
  // Every resolved address must be public — if any are unsafe, reject (defense-in-depth).
  for (const a of addrs) if (isUnsafeIp(a.address)) return null;
  const first = addrs[0]!;
  return { address: first.address, family: first.family === 6 ? 6 : 4 };
}

function httpsGetPinned(
  parsed: URL,
  pinned: { address: string; family: 4 | 6 },
  timeoutMs: number,
): Promise<{ buf: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "GET",
        protocol: "https:",
        host: parsed.hostname, // SNI + Host header
        servername: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 443,
        path: parsed.pathname + parsed.search,
        headers: { Accept: "image/*", Host: parsed.host },
        // Pin connection to pre-validated IP to prevent DNS rebinding TOCTOU.
        lookup: (_h, _opts, cb) => cb(null, pinned.address, pinned.family),
        timeout: timeoutMs,
      },
      (res) => {
        // Disallow redirects — caller validated only the original URL.
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
          res.resume();
          reject(new Error("redirect blocked"));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error("status " + res.statusCode));
          return;
        }
        const ct = String(res.headers["content-type"] ?? "");
        if (!/^image\//i.test(ct)) {
          res.resume();
          reject(new Error("bad content-type"));
          return;
        }
        const len = res.headers["content-length"];
        if (len && parseInt(String(len), 10) > MAX_LOGO_BYTES) {
          res.resume();
          reject(new Error("too large (declared)"));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (c: Buffer) => {
          total += c.length;
          if (total > MAX_LOGO_BYTES) {
            res.destroy(new Error("too large"));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => resolve({ buf: Buffer.concat(chunks), contentType: ct }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

async function fetchLogo(doc: PDFDocument, url: string): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    let bytes: Uint8Array;
    if (url.startsWith("data:image/")) {
      const idx = url.indexOf(",");
      if (idx < 0) return null;
      const meta = url.slice(0, idx);
      if (!/;base64$/i.test(meta)) return null;
      const b64 = url.slice(idx + 1);
      const buf = Buffer.from(b64, "base64");
      if (buf.length > MAX_LOGO_BYTES) return null;
      bytes = Uint8Array.from(buf);
    } else if (/^https:\/\//i.test(url)) {
      // SSRF guard: https only, validated hostname, DNS-resolved + pinned IP, no redirects
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return null;
      }
      if (parsed.protocol !== "https:") return null;
      if (parsed.username || parsed.password) return null;
      if (parsed.port && parsed.port !== "443") return null;
      if (isUnsafeHostname(parsed.hostname)) return null;
      const pinned = await resolvePinnedIp(parsed.hostname);
      if (!pinned) return null;
      const { buf } = await httpsGetPinned(parsed, pinned, 6_000);
      if (buf.length > MAX_LOGO_BYTES) return null;
      bytes = Uint8Array.from(buf);
    } else {
      return null;
    }
    const isPng =
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    return isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err.message : err },
      "Logo embed failed",
    );
    return null;
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const trial = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(trial, size) > maxW) {
        if (line) out.push(line);
        line = w;
      } else {
        line = trial;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function drawHeader(
  page: PDFPage,
  school: { name: string; address?: string | null; phone?: string | null; email?: string | null; primaryColor?: string | null },
  logo: PDFImage | null,
  bold: PDFFont,
  reg: PDFFont,
): number {
  const accent = parseColor(school.primaryColor) ?? rgb(0.1, 0.227, 0.361);
  let textX = MARGIN;
  if (logo) {
    const maxH = 56;
    const scale = maxH / logo.height;
    const w = logo.width * scale;
    page.drawImage(logo, {
      x: MARGIN,
      y: A4.h - MARGIN - maxH,
      width: w,
      height: maxH,
    });
    textX = MARGIN + w + 14;
  }
  page.drawText(school.name || "", {
    x: textX,
    y: A4.h - MARGIN - 18,
    size: 18,
    font: bold,
    color: accent,
  });
  const sub: string[] = [];
  if (school.address) sub.push(school.address);
  const contact = [school.phone, school.email].filter(Boolean).join(" · ");
  if (contact) sub.push(contact);
  let yy = A4.h - MARGIN - 34;
  for (const s of sub) {
    page.drawText(s, { x: textX, y: yy, size: 9, font: reg, color: rgb(0.3, 0.3, 0.3) });
    yy -= 12;
  }
  const lineY = A4.h - MARGIN - 70;
  page.drawLine({
    start: { x: MARGIN, y: lineY },
    end: { x: A4.w - MARGIN, y: lineY },
    thickness: 1.5,
    color: accent,
  });
  return lineY - 30;
}

function parseColor(hex: string | null | undefined) {
  if (!hex) return null;
  const m = /^#?([a-f0-9]{6})$/i.exec(hex);
  if (!m || !m[1]) return null;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255);
}

export async function renderInvoicePdf(
  invoice: {
    id: number;
    invoiceNumber: string;
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    lineItems: Array<{ label: string; qty: number; unit: number; total: number }>;
    subtotal: number;
    total: number;
    currency: string;
    status: string;
    paidAt?: Date | string | null;
    paidMethod?: string | null;
    notes?: string | null;
  },
  school: { name: string; address?: string | null; phone?: string | null; email?: string | null; primaryColor?: string | null; logoUrl?: string | null } | null,
  payment: {
    upiId?: string | null;
    qrCodeUrl?: string | null;
    account1BankName?: string | null;
    account1AccountNumber?: string | null;
    account1IfscCode?: string | null;
    account1HolderName?: string | null;
    account2BankName?: string | null;
    account2AccountNumber?: string | null;
    account2IfscCode?: string | null;
    account2HolderName?: string | null;
  } | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.w, A4.h]);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const accent = parseColor(school?.primaryColor) ?? rgb(0.1, 0.227, 0.361);
  const schoolHeader = school ?? { name: "Legacy Sports", address: null, phone: null, email: null, primaryColor: null };
  const logo = school ? await fetchLogo(doc, school.logoUrl ?? "") : null;

  let y = drawHeader(page, schoolHeader, logo, bold, reg);

  // ── Invoice meta block ──────────────────────────────────────────────────────
  y -= 10;
  const metaTop = y;

  // Left: Invoice details
  const metaLines = [
    ["Invoice #", invoice.invoiceNumber],
    ["Period", `${invoice.periodStart} – ${invoice.periodEnd}`],
    ["Due Date", invoice.dueDate],
    ["Status", invoice.status.toUpperCase()],
    ...(invoice.paidAt ? [["Paid", new Date(invoice.paidAt).toLocaleDateString()]] : []),
    ...(invoice.paidMethod ? [["Method", invoice.paidMethod]] : []),
  ];

  for (const [lbl, val] of metaLines) {
    page.drawText(lbl + ":", { x: MARGIN, y, size: 9, font: bold, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(String(val), { x: MARGIN + 72, y, size: 9, font: reg, color: rgb(0.1, 0.1, 0.1) });
    y -= 14;
  }

  // Right: Bill to (school info)
  let ry = metaTop;
  page.drawText("Bill To:", { x: A4.w / 2, y: ry, size: 9, font: bold, color: rgb(0.4, 0.4, 0.4) });
  ry -= 14;
  page.drawText(school?.name ?? "—", { x: A4.w / 2, y: ry, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });
  ry -= 13;
  if (school?.address) {
    const addrLines = wrapText(school.address, reg, 9, A4.w / 2 - MARGIN - 10);
    for (const al of addrLines) {
      page.drawText(al, { x: A4.w / 2, y: ry, size: 9, font: reg, color: rgb(0.3, 0.3, 0.3) });
      ry -= 12;
    }
  }
  if (school?.phone) { page.drawText(`Ph: ${school.phone}`, { x: A4.w / 2, y: ry, size: 9, font: reg, color: rgb(0.3, 0.3, 0.3) }); ry -= 12; }
  if (school?.email) { page.drawText(school.email, { x: A4.w / 2, y: ry, size: 9, font: reg, color: rgb(0.3, 0.3, 0.3) }); ry -= 12; }

  y = Math.min(y, ry) - 14;

  // ── Line items table ────────────────────────────────────────────────────────
  const colX = { desc: MARGIN, qty: 340, unit: 400, total: 470 };
  const tableW = A4.w - MARGIN * 2;

  // Header row
  page.drawRectangle({ x: MARGIN, y: y - 2, width: tableW, height: 18, color: accent });
  page.drawText("Description",     { x: colX.desc + 4, y: y + 3, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Qty",             { x: colX.qty,       y: y + 3, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Unit",            { x: colX.unit,      y: y + 3, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Total",           { x: colX.total,     y: y + 3, size: 8, font: bold, color: rgb(1, 1, 1) });
  y -= 20;

  // Rows
  const lineItems = invoice.lineItems ?? [];
  for (let idx = 0; idx < lineItems.length; idx++) {
    const li = lineItems[idx]!;
    const rowBg = idx % 2 === 1 ? rgb(0.97, 0.97, 0.97) : rgb(1, 1, 1);
    page.drawRectangle({ x: MARGIN, y: y - 4, width: tableW, height: 18, color: rowBg });
    const descLines = wrapText(li.label, reg, 8, colX.qty - colX.desc - 8);
    page.drawText(descLines[0] ?? "", { x: colX.desc + 4, y: y + 3, size: 8, font: reg, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(String(li.qty),     { x: colX.qty,       y: y + 3, size: 8, font: reg, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(String(li.unit),    { x: colX.unit,      y: y + 3, size: 8, font: reg, color: rgb(0.1, 0.1, 0.1) });
    const totalStr = `${invoice.currency} ${li.total.toLocaleString("en-IN")}`;
    const totalW = reg.widthOfTextAtSize(totalStr, 8);
    page.drawText(totalStr, { x: A4.w - MARGIN - totalW, y: y + 3, size: 8, font: reg, color: rgb(0.1, 0.1, 0.1) });
    y -= 18;
  }

  // Subtotal / total
  y -= 6;
  page.drawLine({ start: { x: colX.unit - 10, y }, end: { x: A4.w - MARGIN, y }, thickness: 0.5, color: accent });
  y -= 16;
  const totalStr = `${invoice.currency} ${invoice.total.toLocaleString("en-IN")}`;
  const totalW2 = bold.widthOfTextAtSize(totalStr, 11);
  page.drawText("Total Due:", { x: colX.unit - 10, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(totalStr,     { x: A4.w - MARGIN - totalW2, y, size: 11, font: bold, color: accent });
  y -= 30;

  // ── Notes ───────────────────────────────────────────────────────────────────
  if (invoice.notes) {
    page.drawText("Notes: " + invoice.notes, { x: MARGIN, y, size: 8, font: reg, color: rgb(0.4, 0.4, 0.4) });
    y -= 20;
  }

  // ── Payment Details (only what's available) ──────────────────────────────────
  const hasUpi      = !!payment?.upiId;
  const hasQr       = !!payment?.qrCodeUrl;
  const hasAcct1    = !!payment?.account1BankName;
  const hasAcct2    = !!payment?.account2BankName;
  const hasPayment  = hasUpi || hasQr || hasAcct1 || hasAcct2;

  if (hasPayment && invoice.status !== "paid" && invoice.status !== "void") {
    y -= 8;
    // Section heading bar
    page.drawRectangle({ x: MARGIN, y: y - 2, width: tableW, height: 16, color: rgb(0.96, 0.96, 0.98) });
    page.drawText("How to Pay", { x: MARGIN + 4, y: y + 2, size: 9, font: bold, color: accent });
    page.drawLine({ start: { x: MARGIN, y: y - 2 }, end: { x: A4.w - MARGIN, y: y - 2 }, thickness: 0.5, color: accent });
    y -= 22;

    const colLeft = MARGIN;
    const colRight = A4.w / 2 + 10;
    let leftY = y;
    let rightY = y;

    if (hasUpi) {
      page.drawText("UPI ID:", { x: colLeft, y: leftY, size: 8, font: bold, color: rgb(0.3, 0.3, 0.3) });
      leftY -= 12;
      page.drawText(payment!.upiId!, { x: colLeft, y: leftY, size: 10, font: bold, color: accent });
      leftY -= 20;
    }

    if (hasAcct1) {
      page.drawText("Bank Account 1:", { x: colLeft, y: leftY, size: 8, font: bold, color: rgb(0.3, 0.3, 0.3) });
      leftY -= 12;
      const acct1Lines = [
        `Holder: ${payment!.account1HolderName ?? ""}`,
        `Bank:   ${payment!.account1BankName ?? ""}`,
        `A/C No: ${payment!.account1AccountNumber ?? ""}`,
        `IFSC:   ${payment!.account1IfscCode ?? ""}`,
      ].filter((l) => !l.endsWith(": "));
      for (const l of acct1Lines) {
        page.drawText(l, { x: colLeft, y: leftY, size: 8, font: reg, color: rgb(0.15, 0.15, 0.15) });
        leftY -= 12;
      }
      leftY -= 6;
    }

    if (hasAcct2) {
      page.drawText("Bank Account 2:", { x: colLeft, y: leftY, size: 8, font: bold, color: rgb(0.3, 0.3, 0.3) });
      leftY -= 12;
      const acct2Lines = [
        `Holder: ${payment!.account2HolderName ?? ""}`,
        `Bank:   ${payment!.account2BankName ?? ""}`,
        `A/C No: ${payment!.account2AccountNumber ?? ""}`,
        `IFSC:   ${payment!.account2IfscCode ?? ""}`,
      ].filter((l) => !l.endsWith(": "));
      for (const l of acct2Lines) {
        page.drawText(l, { x: colLeft, y: leftY, size: 8, font: reg, color: rgb(0.15, 0.15, 0.15) });
        leftY -= 12;
      }
    }

    // QR code on the right
    if (hasQr) {
      let qrImage: PDFImage | null = null;
      try { qrImage = await fetchLogo(doc, payment!.qrCodeUrl!); } catch { /* skip */ }
      if (qrImage) {
        const qrSize = 90;
        const qrX = A4.w - MARGIN - qrSize;
        page.drawImage(qrImage, { x: qrX, y: rightY - qrSize, width: qrSize, height: qrSize });
        page.drawText("Scan to pay", {
          x: qrX + (qrSize - reg.widthOfTextAtSize("Scan to pay", 7)) / 2,
          y: rightY - qrSize - 12,
          size: 7, font: reg, color: rgb(0.4, 0.4, 0.4),
        });
      }
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  const lastPage = doc.getPages()[doc.getPageCount() - 1]!;
  lastPage.drawLine({
    start: { x: MARGIN, y: 42 }, end: { x: A4.w - MARGIN, y: 42 },
    thickness: 0.5, color: rgb(0.8, 0.8, 0.8),
  });
  lastPage.drawText(
    `Legacy Sports Platform · Invoice ${invoice.invoiceNumber} · Generated ${new Date().toLocaleDateString()}`,
    { x: MARGIN, y: 28, size: 7, font: reg, color: rgb(0.55, 0.55, 0.55) },
  );

  return await doc.save();
}

export async function renderLetterPdf(
  letter: Letter,
  school: School | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4.w, A4.h]);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = school ? await fetchLogo(doc, school.logoUrl ?? "") : null;
  const schoolHeader = school ?? {
    name: "Legacy Sports",
    address: "",
    phone: "",
    email: "",
    primaryColor: "#1a3a5c",
  };
  let y = drawHeader(page, schoolHeader, logo, bold, reg);

  // Date + subject
  const dateStr = new Date(letter.createdAt ?? new Date()).toLocaleDateString();
  page.drawText(dateStr, { x: MARGIN, y, size: 10, font: reg, color: rgb(0.4, 0.4, 0.4) });
  y -= 24;

  if (letter.subject) {
    page.drawText("Subject: " + letter.subject, {
      x: MARGIN,
      y,
      size: 12,
      font: bold,
    });
    y -= 22;
  }

  const maxW = A4.w - MARGIN * 2;
  const size = 11;
  const lineH = 16;
  const lines = wrapText(letter.body, reg, size, maxW);
  let currentPage = page;
  for (const ln of lines) {
    if (y < MARGIN + 40) {
      currentPage = doc.addPage([A4.w, A4.h]);
      y = A4.h - MARGIN;
    }
    currentPage.drawText(ln, { x: MARGIN, y, size, font: reg, color: rgb(0.1, 0.1, 0.1) });
    y -= lineH;
  }

  // Footer
  const lastPage = doc.getPages()[doc.getPageCount() - 1]!;
  lastPage.drawText(
    `Generated via Legacy Sports · Letter #${letter.id}`,
    { x: MARGIN, y: 28, size: 8, font: reg, color: rgb(0.55, 0.55, 0.55) },
  );

  return await doc.save();
}

export async function renderCertificatePdf(
  cert: Certificate,
  school: School | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  // Landscape A4
  const W = A4.h;
  const H = A4.w;
  const page = doc.addPage([W, H]);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const accent = parseColor(school?.primaryColor) ?? rgb(0.1, 0.227, 0.361);
  const gold = rgb(0.72, 0.55, 0.16);

  // Decorative border
  const inset = 22;
  page.drawRectangle({
    x: inset,
    y: inset,
    width: W - inset * 2,
    height: H - inset * 2,
    borderColor: accent,
    borderWidth: 3,
  });
  page.drawRectangle({
    x: inset + 8,
    y: inset + 8,
    width: W - (inset + 8) * 2,
    height: H - (inset + 8) * 2,
    borderColor: gold,
    borderWidth: 1,
  });

  // Logo (centered, top)
  const logo = school ? await fetchLogo(doc, school.logoUrl ?? "") : null;
  if (logo) {
    const maxH = 70;
    const scale = maxH / logo.height;
    const w = logo.width * scale;
    page.drawImage(logo, {
      x: (W - w) / 2,
      y: H - inset - 18 - maxH,
      width: w,
      height: maxH,
    });
  }

  const schoolName = school?.name ?? "Legacy Sports";
  const nameW = bold.widthOfTextAtSize(schoolName, 14);
  page.drawText(schoolName, {
    x: (W - nameW) / 2,
    y: H - inset - 110,
    size: 14,
    font: bold,
    color: accent,
  });

  // Title
  const title = "Certificate of " + (cert.template === "achievement" ? "Achievement" : cert.template === "sport-specific" ? "Excellence" : "Participation");
  const titleSize = 34;
  const titleW = bold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (W - titleW) / 2,
    y: H - inset - 160,
    size: titleSize,
    font: bold,
    color: accent,
  });

  const prelude = "This is to certify that";
  const pW = italic.widthOfTextAtSize(prelude, 13);
  page.drawText(prelude, {
    x: (W - pW) / 2,
    y: H - inset - 200,
    size: 13,
    font: italic,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Player name
  const playerSize = 30;
  const playerW = bold.widthOfTextAtSize(cert.playerName, playerSize);
  page.drawText(cert.playerName, {
    x: (W - playerW) / 2,
    y: H - inset - 240,
    size: playerSize,
    font: bold,
    color: gold,
  });
  // Underline
  page.drawLine({
    start: { x: (W - playerW) / 2 - 20, y: H - inset - 248 },
    end: { x: (W - playerW) / 2 + playerW + 20, y: H - inset - 248 },
    thickness: 1,
    color: gold,
  });

  // Citation (wrapped, centered)
  const citationLines = wrapText(cert.citation, reg, 12, W - 160);
  let cy = H - inset - 280;
  for (const ln of citationLines) {
    const w = reg.widthOfTextAtSize(ln, 12);
    page.drawText(ln, {
      x: (W - w) / 2,
      y: cy,
      size: 12,
      font: reg,
      color: rgb(0.15, 0.15, 0.15),
    });
    cy -= 18;
  }

  // Signature lines
  const sigY = inset + 70;
  const sigW = 180;
  // Left signature
  page.drawLine({
    start: { x: 100, y: sigY },
    end: { x: 100 + sigW, y: sigY },
    thickness: 0.8,
    color: rgb(0.3, 0.3, 0.3),
  });
  const sigName = cert.signatoryName || "Authorised Signatory";
  const sigDes = cert.signatoryDesignation || (school?.name ?? "Legacy Sports");
  page.drawText(sigName, { x: 100, y: sigY - 14, size: 11, font: bold });
  page.drawText(sigDes, { x: 100, y: sigY - 28, size: 9, font: reg, color: rgb(0.4, 0.4, 0.4) });

  // Right (date)
  page.drawLine({
    start: { x: W - 100 - sigW, y: sigY },
    end: { x: W - 100, y: sigY },
    thickness: 0.8,
    color: rgb(0.3, 0.3, 0.3),
  });
  const dateStr = new Date(cert.createdAt ?? new Date()).toLocaleDateString();
  page.drawText("Date: " + dateStr, { x: W - 100 - sigW, y: sigY - 14, size: 11, font: bold });
  page.drawText(`Certificate #${cert.id}`, {
    x: W - 100 - sigW,
    y: sigY - 28,
    size: 9,
    font: reg,
    color: rgb(0.4, 0.4, 0.4),
  });

  return await doc.save();
}
