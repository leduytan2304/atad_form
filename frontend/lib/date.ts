/** Chuyển ngày đang lưu (DD/MM/YYYY hoặc YYYY-MM-DD) sang giá trị cho input type="date". */
export function toDateInputValue(value: string): string {
  const text = (value || "").trim();
  if (!text) return "";
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return "";
}

/** Chuyển giá trị YYYY-MM-DD của input type="date" sang DD/MM/YYYY để lưu và xuất file. */
export function fromDateInputValue(value: string): string {
  const match = (value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
