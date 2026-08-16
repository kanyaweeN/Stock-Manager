"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStockDB } from "@/lib/StockDBProvider";
import packageJson from "@/package.json";

/** เมนูหลัก — ใช้ทั้งแถบข้าง (จอกว้าง) และแถบล่าง (มือถือ) */
const NAV = [
  { href: "/", icon: "🏠", label: "สินค้า", short: "สินค้า" },
  { href: "/plan", icon: "🛒", label: "วางแผนซื้อ", short: "แผนซื้อ" },
  { href: "/summary", icon: "📊", label: "สรุปยอด", short: "สรุปยอด" },
  { href: "/cost", icon: "🧮", label: "คำนวณต้นทุน", short: "ต้นทุน" },
  { href: "/analyze", icon: "🧪", label: "วิเคราะห์ส่วนผสม", short: "ส่วนผสม" },
  { href: "/config", icon: "⚙️", label: "ตั้งค่า", short: "ตั้งค่า" },
] as const;

/**
 * โครงหลักของแอป — แถบนำทางที่อยู่ทุกหน้า จึงไม่ต้องมีปุ่ม "กลับหน้าหลัก" ในแต่ละหน้าอีก
 * จอกว้าง = แถบข้างซ้าย, มือถือ = แถบล่างแบบแท็บ (ดู .shell ใน globals.css)
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { db, status } = useStockDB();

  const counts: Record<string, number> = {
    "/": db.items.length,
    "/cost": db.recipes?.length ?? 0,
    // นับเฉพาะของที่ยังไม่ได้ซื้อ — ตัวเลขนี้คือ "ค้างอยู่กี่อย่าง" ไม่ใช่จำนวนแผน
    "/plan": (db.plans ?? []).reduce((s, p) => s + p.lines.filter((l) => !l.bought).length, 0),
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="shell">
      <aside className="shell__side">
        <Link href="/" className="shell__brand">
          <span className="shell__brand-mark">📦</span>
          <span>สต็อกสินค้า</span>
        </Link>

        <nav className="shell__nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`shell__nav-item ${isActive(n.href) ? "is-active" : ""}`}>
              <span className="shell__nav-icon">{n.icon}</span>
              <span className="shell__nav-label">{n.label}</span>
              {counts[n.href] ? <span className="shell__nav-count">{counts[n.href]}</span> : null}
            </Link>
          ))}
        </nav>

        <div className="shell__side-foot">
          <span className={`shell__sync shell__sync--${status.type}`} title={status.msg}>
            <i /> <span className="shell__sync-msg">{status.msg}</span>
          </span>
          <span className="shell__version">เวอร์ชัน {packageJson.version}</span>
        </div>
      </aside>

      <main className="shell__main">{children}</main>

      <nav className="shell__tabbar">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`shell__tab ${isActive(n.href) ? "is-active" : ""}`}>
            <span className="shell__tab-icon">{n.icon}</span>
            {n.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
