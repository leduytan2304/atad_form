/**
 * Xuất tờ trình thành ảnh PNG. Nội dung dài được chia thành nhiều trang A4
 * thay vì thu nhỏ chữ; nhiều trang được đóng gói trong một file ZIP.
 */

import { api, type Unit } from "@/lib/api";
import {
  downloadBlob,
  exportFileBase,
  unitName,
  type ToTrinhDraft,
  type ToTrinhItem,
} from "@/lib/toTrinh";
import { createZip } from "@/lib/zip";

const PAGE_W = 1240;
const PAGE_H = 1754;
const MARGIN = 88;
const CONTENT_W = PAGE_W - MARGIN * 2;
const COLUMNS = [64, 372, 200, 196, 228];
const HEADER_H = 46;
const ROW_MIN_H = 84;
const FOOTER_SPACE = 46;
const BODY_LINE_H = 24;

const NAVY = "#0b2a4a";
const INK = "#12212e";
const MUTED = "#5a6b7c";
const LINE = "#c8d5e0";
const HEADER_BG = "#f2f5f8";
const WHITE = "#ffffff";
const BLUE = "#0060a9";

type LoadedImage = { image: HTMLImageElement; revoke: () => void } | null;

type TableRow = {
  item: ToTrinhItem;
  index: number;
  unit: string;
  nameLines: string[];
  unitLines: string[];
  height: number;
};

type Page = {
  rows: TableRow[];
  first: boolean;
};

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không hỗ trợ vẽ canvas.");
  return context;
}

function fontOf(size: number, weight = 400, family = "sans-serif"): string {
  return `${weight} ${size}px ${family}`;
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

function measureInfoHeight(
  context: CanvasRenderingContext2D,
  draft: ToTrinhDraft,
  family: string,
): number {
  context.font = fontOf(20, 600, family);
  const labels = ["Thông tin đoàn:", "Thời gian:", "Địa điểm:"];
  const labelWidth = Math.max(...labels.map((label) => context.measureText(label).width));
  const valueWidth = CONTENT_W - labelWidth - 18;
  const values = [draft.group, draft.time, draft.place];

  context.font = fontOf(20, 400, family);
  return values.reduce((height, value) => {
    const lines = wrapText(context, value, valueWidth);
    return height + lines.length * 28 + 12;
  }, 0);
}

function drawInfo(
  context: CanvasRenderingContext2D,
  draft: ToTrinhDraft,
  family: string,
  startY: number,
): number {
  const labels = ["Thông tin đoàn:", "Thời gian:", "Địa điểm:"];
  const values = [draft.group, draft.time, draft.place];

  context.font = fontOf(20, 600, family);
  const labelWidth = Math.max(...labels.map((label) => context.measureText(label).width));
  const valueX = MARGIN + labelWidth + 18;
  const valueWidth = CONTENT_W - labelWidth - 18;

  let y = startY;
  values.forEach((value, index) => {
    context.font = fontOf(20, 600, family);
    context.fillStyle = NAVY;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillText(labels[index], MARGIN, y);

    context.font = fontOf(20, 400, family);
    context.fillStyle = INK;
    const lines = wrapText(context, value, valueWidth);
    lines.forEach((line, lineIndex) => {
      context.fillText(line, valueX, y + lineIndex * 28);
    });

    y += lines.length * 28 + 12;
  });

  return y;
}

function drawFirstPageHeader(
  context: CanvasRenderingContext2D,
  draft: ToTrinhDraft,
  family: string,
  infoHeight: number,
): void {
  context.textAlign = "center";
  context.textBaseline = "alphabetic";

  context.font = fontOf(44, 700, family);
  context.fillStyle = NAVY;
  context.fillText("TỜ TRÌNH", PAGE_W / 2, MARGIN + 48);

  context.font = fontOf(20, 400, family);
  context.fillStyle = MUTED;
  context.fillText("Danh sách quà tặng", PAGE_W / 2, MARGIN + 82);

  context.strokeStyle = LINE;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(MARGIN, MARGIN + 104);
  context.lineTo(PAGE_W - MARGIN, MARGIN + 104);
  context.stroke();

  drawInfo(context, draft, family, MARGIN + 134);

  const sectionY = MARGIN + 134 + infoHeight + 38;
  context.textAlign = "left";
  context.font = fontOf(24, 700, family);
  context.fillStyle = NAVY;
  context.fillText("Danh sách quà tặng", MARGIN, sectionY);
}

function drawContinuedHeader(
  context: CanvasRenderingContext2D,
  family: string,
): void {
  context.textAlign = "center";
  context.textBaseline = "alphabetic";

  context.font = fontOf(28, 700, family);
  context.fillStyle = NAVY;
  context.fillText("TỜ TRÌNH", PAGE_W / 2, MARGIN + 40);

  context.font = fontOf(16, 400, family);
  context.fillStyle = MUTED;
  context.fillText("Trang tiếp theo", PAGE_W / 2, MARGIN + 68);

  context.strokeStyle = LINE;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(MARGIN, MARGIN + 82);
  context.lineTo(PAGE_W - MARGIN, MARGIN + 82);
  context.stroke();
}

function columnX(index: number): number {
  return MARGIN + COLUMNS.slice(0, index).reduce((total, width) => total + width, 0);
}

function drawHeaderRow(
  context: CanvasRenderingContext2D,
  y: number,
  family: string,
): void {
  const labels = ["No", "Quà Tặng", "Hình Quà", "Đơn vị tính", "Số Lượng"];

  context.fillStyle = HEADER_BG;
  context.fillRect(MARGIN, y, CONTENT_W, HEADER_H);

  context.font = fontOf(17, 700, family);
  context.fillStyle = NAVY;
  context.textBaseline = "middle";
  labels.forEach((label, index) => {
    const x = columnX(index);
    context.textAlign = index === 1 ? "left" : "center";
    context.fillText(
      label,
      index === 1 ? x + 12 : x + COLUMNS[index] / 2,
      y + HEADER_H / 2,
    );
  });

  context.strokeStyle = LINE;
  context.lineWidth = 1;
  context.strokeRect(MARGIN, y, CONTENT_W, HEADER_H);
  for (let index = 1; index < COLUMNS.length; index += 1) {
    const x = columnX(index);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x, y + HEADER_H);
    context.stroke();
  }
}

function drawRow(
  context: CanvasRenderingContext2D,
  row: TableRow,
  y: number,
  family: string,
  images: Map<string, LoadedImage>,
): void {
  const rowHeight = row.height;

  context.fillStyle = WHITE;
  context.fillRect(MARGIN, y, CONTENT_W, rowHeight);

  context.strokeStyle = LINE;
  context.lineWidth = 1;
  context.strokeRect(MARGIN, y, CONTENT_W, rowHeight);
  for (let index = 1; index < COLUMNS.length; index += 1) {
    const x = columnX(index);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x, y + rowHeight);
    context.stroke();
  }

  context.textBaseline = "middle";

  // No
  context.font = fontOf(18, 600, family);
  context.fillStyle = INK;
  context.textAlign = "center";
  context.fillText(String(row.index + 1), columnX(0) + COLUMNS[0] / 2, y + rowHeight / 2);

  // Quà tặng
  context.textAlign = "left";
  context.font = fontOf(18, 600, family);
  context.fillStyle = NAVY;
  const nameStart = y + rowHeight / 2 - ((row.nameLines.length - 1) * BODY_LINE_H) / 2;
  row.nameLines.forEach((line, index) => {
    context.fillText(line, columnX(1) + 12, nameStart + index * BODY_LINE_H);
  });

  // Hình quà
  const imageCellX = columnX(2);
  const boxW = 120;
  const boxH = 66;
  const boxX = imageCellX + (COLUMNS[2] - boxW) / 2;
  const boxY = y + (rowHeight - boxH) / 2;
  context.fillStyle = WHITE;
  context.strokeStyle = LINE;
  context.fillRect(boxX, boxY, boxW, boxH);
  context.strokeRect(boxX, boxY, boxW, boxH);

  const loaded = row.item.imageUrl ? images.get(row.item.imageUrl) : null;
  if (loaded) {
    const scale = Math.min(
      (boxW - 8) / loaded.image.width,
      (boxH - 8) / loaded.image.height,
    );
    const drawW = loaded.image.width * scale;
    const drawH = loaded.image.height * scale;
    context.drawImage(
      loaded.image,
      boxX + (boxW - drawW) / 2,
      boxY + (boxH - drawH) / 2,
      drawW,
      drawH,
    );
  } else {
    context.font = fontOf(13, 400, family);
    context.fillStyle = MUTED;
    context.textAlign = "center";
    context.fillText("Chưa có ảnh", boxX + boxW / 2, boxY + boxH / 2);
  }

  // Đơn vị tính
  context.font = fontOf(18, 400, family);
  context.fillStyle = INK;
  context.textAlign = "center";
  const unitStart = y + rowHeight / 2 - ((row.unitLines.length - 1) * BODY_LINE_H) / 2;
  row.unitLines.forEach((line, index) => {
    context.fillText(line, columnX(3) + COLUMNS[3] / 2, unitStart + index * BODY_LINE_H);
  });

  // Số lượng
  context.font = fontOf(20, 700, family);
  context.fillStyle = BLUE;
  context.fillText(row.item.quantity, columnX(4) + COLUMNS[4] / 2, y + rowHeight / 2);
}

function drawFooter(
  context: CanvasRenderingContext2D,
  page: number,
  total: number,
  family: string,
): void {
  context.font = fontOf(15, 400, family);
  context.fillStyle = MUTED;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.fillText(`Trang ${page}/${total}`, PAGE_W / 2, PAGE_H - MARGIN + 8);
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không tải được ảnh"));
    image.src = url;
  });
}

async function loadImage(url: string): Promise<LoadedImage> {
  let objectUrl: string | null = null;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);
    const image = await loadHtmlImage(objectUrl);
    return { image, revoke: () => URL.revokeObjectURL(objectUrl as string) };
  } catch {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    return null;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Không tạo được file ảnh."));
    }, "image/png");
  });
}

export async function downloadToTrinhImage(
  draft: ToTrinhDraft,
  units: Unit[],
): Promise<{ pages: number; filename: string }> {
  if (typeof document !== "undefined" && document.fonts) {
    await document.fonts.ready.catch(() => undefined);
  }

  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const measureCanvas = createCanvas(PAGE_W, PAGE_H);
  const measureContext = getContext(measureCanvas);

  const infoHeight = measureInfoHeight(measureContext, draft, family);

  measureContext.font = fontOf(18, 400, family);
  const rows: TableRow[] = draft.items.map((item, index) => {
    const nameLines = wrapText(measureContext, item.product, COLUMNS[1] - 24);
    const unit = unitName(units, item.unitId) || "—";
    const unitLines = wrapText(measureContext, unit, COLUMNS[3] - 24);
    const lineCount = Math.max(nameLines.length, unitLines.length);
    return {
      item,
      index,
      unit,
      nameLines,
      unitLines,
      height: Math.max(ROW_MIN_H, lineCount * BODY_LINE_H + 28),
    };
  });

  const imageUrls = Array.from(
    new Set(
      rows
        .map((row) => api.stock.imageUrl(row.item.imageUrl))
        .filter((url): url is string => Boolean(url)),
    ),
  );
  const loadedImages = await Promise.all(imageUrls.map((url) => loadImage(url)));
  const images = new Map<string, LoadedImage>();
  imageUrls.forEach((url, index) => images.set(url, loadedImages[index]));

  const firstTableTop = MARGIN + 134 + infoHeight + 38 + 26;
  const nextTableTop = MARGIN + 92;
  const bottom = PAGE_H - MARGIN - FOOTER_SPACE;
  const firstCapacity = bottom - firstTableTop - HEADER_H;
  const nextCapacity = bottom - nextTableTop - HEADER_H;

  const pages: Page[] = [];
  let current: TableRow[] = [];
  let used = 0;
  let capacity = firstCapacity;

  for (const row of rows) {
    if (current.length > 0 && used + row.height > capacity) {
      pages.push({ rows: current, first: pages.length === 0 });
      current = [];
      used = 0;
      capacity = nextCapacity;
    }
    current.push(row);
    used += row.height;
  }
  if (current.length > 0 || pages.length === 0) {
    pages.push({ rows: current, first: pages.length === 0 });
  }

  const canvases: HTMLCanvasElement[] = [];
  try {
    pages.forEach((page, pageIndex) => {
      const canvas = createCanvas(PAGE_W, PAGE_H);
      const context = getContext(canvas);
      context.fillStyle = WHITE;
      context.fillRect(0, 0, PAGE_W, PAGE_H);

      let tableTop = nextTableTop;
      if (page.first) {
        drawFirstPageHeader(context, draft, family, infoHeight);
        tableTop = firstTableTop;
      } else {
        drawContinuedHeader(context, family);
      }

      drawHeaderRow(context, tableTop, family);
      let y = tableTop + HEADER_H;
      page.rows.forEach((row) => {
        drawRow(context, row, y, family, images);
        y += row.height;
      });

      drawFooter(context, pageIndex + 1, pages.length, family);
      canvases.push(canvas);
    });

    const blobs = await Promise.all(canvases.map((canvas) => canvasToBlob(canvas)));
    const base = exportFileBase(draft);

    if (blobs.length === 1) {
      const filename = `${base}.png`;
      downloadBlob(blobs[0], filename);
      return { pages: 1, filename };
    }

    const archive = await createZip(
      blobs.map((blob, index) => ({
        name: `${base}-trang-${index + 1}.png`,
        blob,
      })),
    );
    const filename = `${base}.zip`;
    downloadBlob(archive, filename);
    return { pages: blobs.length, filename };
  } finally {
    loadedImages.forEach((loaded) => loaded?.revoke());
  }
}
