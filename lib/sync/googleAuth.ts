declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken(opts?: { prompt?: string }): void };
        };
      };
    };
  }
}

let gisLoadPromise: Promise<void> | null = null;

/** โหลด Google Identity Services script (สำหรับขอ OAuth token ฝั่ง client ล้วนๆ ไม่ต้องมี backend) */
export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("โหลด Google Identity Services ไม่สำเร็จ"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

/**
 * ขอ access token จาก Google สำหรับ scope ที่ระบุ
 * - silent = true: ขอแบบเงียบๆ ไม่เด้ง popup (ใช้ตอนโหลดหน้าใหม่ ถ้าเคยเชื่อมต่อไว้แล้วและยัง login Google อยู่)
 *   ถ้า session หมดอายุ หรือยังไม่เคยยินยอม scope นี้มาก่อน จะล้มเหลวเงียบๆ โดยไม่โชว์ popup ใดๆ
 * - silent = false (ค่าเริ่มต้น): เด้ง popup ให้ผู้ใช้ login/ยินยอมสิทธิ์เอง
 */
export async function requestAccessToken(clientId: string, scope: string, silent = false): Promise<string> {
  await loadGis();
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services ยังไม่พร้อม"));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      callback: (resp) => {
        if (resp.error || !resp.access_token) reject(new Error(resp.error || "ขอ token ไม่สำเร็จ"));
        else resolve(resp.access_token);
      },
    });
    client.requestAccessToken(silent ? { prompt: "none" } : undefined);
  });
}
