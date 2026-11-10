import type { Metadata, Viewport } from "next";
// Self-hosted (npm), so builds and pages never depend on fonts.googleapis.com.
import "@fontsource-variable/fraunces/wght.css";
import "@fontsource-variable/fraunces/wght-italic.css";
import "@fontsource-variable/dm-sans/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TrueVisible — by The Growth Lab", template: "%s · TrueVisible" },
  description: "AI visibility for your brand — see what AI says about you, and fix it.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#F7F3EC", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="site-footer small muted">
          <a href="/legal/terms">Terms</a> · <a href="/legal/privacy">Privacy</a> · <a href="/legal/refunds">Cancellation &amp; refunds</a> · <a href="/legal/contact">Contact</a>
        </footer>
      </body>
    </html>
  );
}
