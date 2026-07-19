import type { Metadata } from "next";
import "./globals.css";
import { StockDBProvider } from "@/lib/StockDBProvider";

export const metadata: Metadata = {
  title: "จัดการสต็อกสินค้า",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <StockDBProvider>{children}</StockDBProvider>
      </body>
    </html>
  );
}
