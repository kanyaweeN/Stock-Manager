import type { Metadata } from "next";
import "./globals.css";
import { StockDBProvider } from "@/lib/hooks/StockDBProvider";
import AppShell from "@/components/AppShell";
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from "@/lib/core/themeColors";

export const metadata: Metadata = {
  title: "จัดการสต็อกสินค้า",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR_DARK },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <StockDBProvider>
          <AppShell>{children}</AppShell>
        </StockDBProvider>
      </body>
    </html>
  );
}
