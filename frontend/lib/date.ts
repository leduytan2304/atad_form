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

export type ScheduleParts = {
  /** Giá trị cho input type="time", dạng HH:mm. */
  clock: string;
  /** Giá trị cho input type="date", dạng YYYY-MM-DD. */
  date: string;
};

/** Tách chuỗi thời gian đã lưu ("08:00, 27/11/2026") thành giờ và ngày cho ô chọn. */
export function scheduleParts(value: string): ScheduleParts {
  const text = (value || "").trim();
  const full = text.match(/^(\d{2}:\d{2}),\s*(\d{1,2}[/-]\d{1,2}[/-]\d{4})$/);
  if (full) return { clock: full[1], date: toDateInputValue(full[2]) };
  if (/^\d{2}:\d{2}$/.test(text)) return { clock: text, date: "" };
  const date = toDateInputValue(text);
  if (date) return { clock: "", date };
  return { clock: "", date: "" };
}

/** Ghép giờ (HH:mm) và ngày (YYYY-MM-DD) thành chuỗi hiển thị trên tờ trình. */
export function formatSchedule(clock: string, date: string): string {
  const time = /^\d{2}:\d{2}$/.test(clock) ? clock : "";
  const day = fromDateInputValue(date);
  if (time && day) return `${time}, ${day}`;
  return time || day;
}

export function isCompleteSchedule(value: string): boolean {
  return /^\d{2}:\d{2}, \d{2}\/\d{2}\/\d{4}$/.test((value || "").trim());
}
