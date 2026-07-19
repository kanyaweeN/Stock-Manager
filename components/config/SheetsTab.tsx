import type { useGoogleSheetsSync } from "@/lib/useGoogleSheetsSync";

type SheetsSync = ReturnType<typeof useGoogleSheetsSync>;

export default function SheetsTab(sync: SheetsSync) {
  const { clientId, sheetId, token, message, busy, origin, saveSettings, connect, push, pull, forget } = sync;

  return (
    <div className="field tab-panel">
      <p className="sub sub-tight text-xs">
        ต้องสร้าง OAuth Client ID จาก{" "}
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
          Google Cloud Console
        </a>{" "}
        เอง (ประเภท &quot;Web application&quot; และเพิ่ม {origin || "URL ของแอปนี้"} ใน
        Authorized JavaScript origins) แล้วสร้าง Google Sheet เปล่าไว้ 1 ชีต คัดลอก Spreadsheet ID จาก URL
        (ส่วนที่อยู่ระหว่าง /d/ กับ /edit) มาใส่ด้านล่าง
      </p>
      <div className="field">
        <input
          type="text"
          placeholder="Google OAuth Client ID"
          value={clientId}
          onChange={(e) => saveSettings(e.target.value, sheetId)}
        />
      </div>
      <div className="field">
        <input
          type="text"
          placeholder="Spreadsheet ID"
          value={sheetId}
          onChange={(e) => saveSettings(clientId, e.target.value)}
        />
      </div>
      <div className="toolbar">
        <button className="btn-primary" onClick={connect} disabled={busy}>
          🔑 {token ? "เชื่อมต่อใหม่" : "เชื่อมต่อ Google"}
        </button>
        {token && (
          <>
            <button className="btn-ghost" onClick={push} disabled={busy}>⬆️ ส่งขึ้น Sheet</button>
            <button className="btn-ghost" onClick={pull} disabled={busy}>⬇️ ดึงจาก Sheet</button>
            <button className="btn-ghost" onClick={forget}>🚫 เลิกจำการเชื่อมต่อ</button>
          </>
        )}
      </div>
      {message && <p className="sub text-xs">{message}</p>}
    </div>
  );
}
