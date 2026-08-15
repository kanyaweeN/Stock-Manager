import type { useGoogleDriveSync } from "@/lib/useGoogleDriveSync";

type DriveSync = ReturnType<typeof useGoogleDriveSync>;

export default function DriveTab(sync: DriveSync) {
  const { clientId, token, remoteTime, message, busy, checking, origin, saveClientId, connect, push, pull, forget } = sync;

  return (
    <div className="field tab-panel">
      <div className={`sync-status ${checking ? "sync-status--checking" : token ? "sync-status--on" : "sync-status--off"}`}>
        {checking ? "🟡 กำลังตรวจสอบการเชื่อมต่อ..." : token ? "🟢 เชื่อมต่ออยู่" : "⚪ ยังไม่เชื่อมต่อ"}
      </div>
      <p className="sub sub-tight text-xs">
        สำรองข้อมูล<strong>ทั้งหมด</strong>ขึ้น Google Drive เป็นไฟล์ JSON ไฟล์เดียว (สินค้า หมวดหมู่ สูตรต้นทุน
        ส่วนผสมที่แพ้ ครบทุกอย่าง) เก็บในโฟลเดอร์ซ่อนของแอป — มองไม่เห็นใน Drive ปกติ และแอปนี้แตะไฟล์อื่นในไดรฟ์ไม่ได้
      </p>
      <p className="sub sub-tight text-xs">
        ต้องสร้าง OAuth Client ID จาก{" "}
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
          Google Cloud Console
        </a>{" "}
        เอง (ประเภท &quot;Web application&quot; และเพิ่ม {origin || "URL ของแอปนี้"} ใน Authorized JavaScript origins)
        แล้วเปิดใช้ Google Drive API ในโปรเจกต์นั้นด้วย
      </p>
      <div className="field">
        <input
          type="text"
          placeholder="Google OAuth Client ID"
          value={clientId}
          onChange={(e) => saveClientId(e.target.value)}
        />
      </div>
      <div className="toolbar">
        <button className="btn-primary" onClick={connect} disabled={busy || checking}>
          🔑 {token ? "เชื่อมต่อใหม่" : "เชื่อมต่อ Google"}
        </button>
        {token && (
          <>
            <button className="btn-ghost" onClick={push} disabled={busy}>⬆️ ส่งขึ้น Drive</button>
            <button className="btn-ghost" onClick={pull} disabled={busy}>⬇️ ดึงจาก Drive</button>
            <button className="btn-ghost" onClick={forget}>🚫 เลิกจำการเชื่อมต่อ</button>
          </>
        )}
      </div>
      {remoteTime && (
        <p className="sub text-xs">ไฟล์บน Drive แก้ล่าสุด: {new Date(remoteTime).toLocaleString("th-TH")}</p>
      )}
      {message && <p className="sub text-xs">{message}</p>}
    </div>
  );
}
