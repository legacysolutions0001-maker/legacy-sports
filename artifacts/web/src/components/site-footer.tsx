import { Phone, MapPin, Building2 } from "lucide-react";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      data-testid="site-footer"
      className="border-t bg-muted/50 text-muted-foreground text-xs"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-6 grid gap-6 md:grid-cols-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Building2 className="h-4 w-4" />
            <span>Legacy Solutions Pvt. Ltd.</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5" />
            <a href="tel:+917452888421" className="hover:underline">
              +91 74528 88421
            </a>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 mt-0.5" />
            <span>Bazpur, Uttarakhand, India</span>
          </div>
        </div>

        <div className="md:col-span-2 space-y-2">
          <p className="font-semibold text-foreground">License &amp; Intellectual Property</p>
          <p>
            The software, source code, design, branding, dashboards, workflows, and all
            related intellectual property remain the exclusive property of the developer.
            The client / school is granted only a limited usage license for internal
            institutional use.
          </p>
          <p>
            The client may <span className="font-medium">not</span> copy, resell, redistribute,
            reverse engineer, modify for resale, sublicense, or transfer the software to any
            third party without written permission from the developer. Unauthorized duplication
            or commercial redistribution of the platform is strictly prohibited.
          </p>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-1">
          <p>
            © {year} Legacy Solutions Pvt. Ltd. All rights reserved. Built and maintained by
            Legacy Solutions Pvt. Ltd.
          </p>
          <p className="text-[11px] opacity-80">
            Powered by Legacy Sports — Elite Athletic Management Platform
          </p>
        </div>
      </div>
    </footer>
  );
}
