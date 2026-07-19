import type { DbStatus } from "@/lib/usePersistedDB";

interface Props {
  status: DbStatus;
  linkedFileName: string | null;
  onToggleLink: () => void;
}

export default function StorageTab({ status, linkedFileName, onToggleLink }: Props) {
  return (
    <div className="field tab-panel">
      <p className="sub sub-tight">{status.msg}</p>
      <div className="toolbar">
        <button className="btn-primary" onClick={onToggleLink}>
          {linkedFileName ? `💾 ผูกกับไฟล์: ${linkedFileName} (คลิกเพื่อเลิกผูก)` : "📁 ผูกกับไฟล์บนเครื่อง"}
        </button>
      </div>
      <p className="sub text-xs">
        ปกติข้อมูลจะถูกบันทึกเป็นไฟล์ในเบราว์เซอร์อัตโนมัติอยู่แล้ว (ไม่ต้องกดบันทึก) —
        ถ้ากด &quot;ผูกกับไฟล์บนเครื่อง&quot; ระบบจะเขียนข้อมูลไปยังไฟล์ .json ที่เลือกไว้บนเครื่องจริงๆ ด้วยทุกครั้งที่มีการเปลี่ยนแปลง
        (รองรับเฉพาะ Chrome/Edge)
      </p>
    </div>
  );
}
