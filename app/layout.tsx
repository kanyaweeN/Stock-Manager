import type { Metadata } from "next";
import "./globals.css";
import { StockDBProvider } from "@/lib/StockDBProvider";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "จัดการสต็อกสินค้า",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#14161a" },
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
