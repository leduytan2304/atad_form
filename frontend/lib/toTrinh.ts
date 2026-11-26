import type { Unit } from "@/lib/api";

export type ToTrinhItem = {
  /** Khoá ổn định của sản phẩm trong danh sách tồn kho. */
  key: string;
  product: string;
  imageUrl: string | null;
  unitId: number | null;
  quantity: string;
};

export type ToTrinhDraft = {
  group: string;
  time: string;
  place: string;
  items: ToTrinhItem[];
};

export function emptyDraft(): ToTrinhDraft {
  return { group: "", time: "", place: "", items: [] };
}

export function isPositiveInteger(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

export function unitName(units: Unit[], unitId: number | null): string {
  return units.find((unit) => unit.id === unitId)?.name ?? "";
}

export function validateDraft(draft: ToTrinhDraft, units: Unit[]): string[] {
  const issues: string[] = [];

  if (!draft.group.trim()) issues.push("Vui lòng nhập thông tin đoàn.");
  if (!draft.time.trim()) issues.push("Vui lòng nhập thời gian.");
  if (!draft.place.trim()) issues.push("Vui lòng nhập địa điểm.");

  if (draft.items.length === 0) {
    issues.push("Chưa có sản phẩm nào trong tờ trình. Hãy quay lại chọn sản phẩm.");
    return issues;
  }

  draft.items.forEach((item, index) => {
    const label = `Dòng ${index + 1} – ${item.product}`;

    if (item.unitId === null) {
      issues.push(`${label}: vui lòng chọn đơn vị tính.`);
    } else if (!units.some((unit) => unit.id === item.unitId)) {
      issues.push(`${label}: đơn vị tính không còn tồn tại, vui lòng chọn lại.`);
    }

    if (!isPositiveInteger(item.quantity)) {
      issues.push(`${label}: số lượng phải là số nguyên dương.`);
    }
  });

  return issues;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function exportFileBase(draft: ToTrinhDraft, now = new Date()): string {
  const day = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  return `to-trinh-${slugify(draft.group) || "qua-tang"}-${day}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
