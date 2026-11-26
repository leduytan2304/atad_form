"""Đọc dữ liệu vật phẩm & tồn kho trực tiếp từ Google Sheet (chỉ đọc)."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
import re
import threading
import time
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import openpyxl
from openpyxl.utils import get_column_letter
from PIL import Image, ImageOps

from ..config import STOCK_DIR, STOCK_SHEET_URL

GOOGLE_HOSTS = {"docs.google.com"}
GOOGLE_SHEET_RE = re.compile(r"/spreadsheets/d/([A-Za-z0-9_-]+)")
EMU_PER_PIXEL = 9525
NAME_ROW = 2  # hàng chứa tên sản phẩm (1-based)
TOTAL_ROW_MARKERS = ("TỔNG", "TOTAL")
CACHE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
IMAGE_TTL_SECONDS = 60 * 60
IMAGE_RETRY_SECONDS = 60
THUMBNAIL_MAX_PX = 320
WEBP_QUALITY = 82

logger = logging.getLogger(__name__)


class StockSheetError(Exception):
    """Lỗi khi tải hoặc đọc file Google Sheet."""


@dataclass
class StockLocation:
    office: str
    quantity: float


@dataclass
class ProductStock:
    product: str
    column: str
    locations: list[StockLocation] = field(default_factory=list)
    image: bytes | None = None
    image_ext: str = "png"


@dataclass
class StockData:
    products: list[ProductStock]
    sheet_name: str


@dataclass
class StockImages:
    images: dict[str, str] = field(default_factory=dict)
    ready: bool = False
    sheet_name: str = ""


@dataclass
class _ImageManifest:
    generated_at: float
    images: dict[str, str]
    sheet_name: str = ""


_manifest_lock = threading.Lock()
_manifests: dict[str, _ImageManifest] = {}
_refreshing: set[str] = set()
_image_failures: dict[str, float] = {}


def normalize_product(name: str) -> str:
    """Khoá so khớp tên sản phẩm giữa CSV và file Excel (bỏ khoảng trắng thừa)."""
    return " ".join((name or "").split())


def _sheet_parts(url: str) -> tuple[str, str | None]:
    parsed = urlparse((url or "").strip())
    if parsed.netloc.lower() not in GOOGLE_HOSTS:
        raise StockSheetError("Link phải là Google Sheet (docs.google.com).")
    match = GOOGLE_SHEET_RE.search(parsed.path)
    if not match:
        raise StockSheetError("Link Google Sheet không đúng định dạng.")
    gid: str | None = None
    query = parse_qs(parsed.query)
    if query.get("gid"):
        gid = query["gid"][0]
    else:
        fragment = parsed.fragment or ""
        m = re.search(r"(?:^|&)gid=([0-9]+)", fragment)
        if m:
            gid = m.group(1)
    return match.group(1), gid


def google_sheet_export_url(url: str) -> str:
    """Đổi link Google Sheet bất kỳ thành link tải .xlsx (giữ nguyên tab được chọn)."""
    sheet_id, gid = _sheet_parts(url)
    link = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"
    if gid:
        link += f"&gid={gid}"
    return link


def google_sheet_csv_url(url: str) -> str:
    """Link CSV nhẹ (khoảng vài KB) để lấy số lượng tồn kho theo thời gian thực."""
    sheet_id, gid = _sheet_parts(url)
    link = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    if gid:
        link += f"&gid={gid}"
    return link


def _request(url: str, timeout: float) -> urllib.request.Request:
    return urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
            )
        },
    )


def fetch_bytes(url: str, timeout: float = 120) -> bytes:
    """Tải nội dung file .xlsx từ Google Sheet (dùng cho ảnh sản phẩm)."""
    try:
        with urllib.request.urlopen(_request(url, timeout), timeout=timeout) as response:
            data = response.read()
    except Exception as exc:  # noqa: BLE001 - trả lỗi thân thiện cho người dùng
        raise StockSheetError(
            "Không tải được Google Sheet. Kiểm tra link đã chia sẻ công khai và kết nối mạng."
        ) from exc

    if not data or data[:2] != b"PK":
        raise StockSheetError(
            "Google Sheet không trả về file Excel. Hãy kiểm tra quyền chia sẻ của link."
        )
    return data


def fetch_csv(url: str, timeout: float = 45) -> tuple[bytes, str]:
    """Tải dữ liệu CSV (rất nhẹ) và tên tab từ Content-Disposition."""
    try:
        with urllib.request.urlopen(_request(url, timeout), timeout=timeout) as response:
            data = response.read()
            disposition = response.headers.get("Content-Disposition", "")
    except Exception as exc:  # noqa: BLE001
        raise StockSheetError(
            "Không tải được dữ liệu Google Sheet. Kiểm tra link đã chia sẻ công khai và kết nối mạng."
        ) from exc

    if not data or data[:1] == b"<":
        raise StockSheetError(
            "Google Sheet không trả về dữ liệu CSV. Hãy kiểm tra quyền chia sẻ của link."
        )

    name = _filename_from_disposition(disposition) or "Google Sheet"
    return data, name


def _filename_from_disposition(value: str) -> str:
    match = re.search(r"filename\*=UTF-8''([^;]+)", value, re.IGNORECASE)
    if match:
        filename = unquote(match.group(1))
    else:
        match = re.search(r'filename="?([^";]+)', value, re.IGNORECASE)
        filename = match.group(1) if match else ""
    return Path(filename.strip()).stem.strip()


def load_data(url: str | None = None) -> StockData:
    """Lấy dữ liệu mới mỗi lần gọi. Ưu tiên CSV; chỉ dùng Excel khi CSV lỗi."""
    source = url or STOCK_SHEET_URL
    try:
        raw, sheet_name = fetch_csv(google_sheet_csv_url(source))
        return parse_csv(raw, sheet_name)
    except StockSheetError:
        return parse_workbook(fetch_bytes(google_sheet_export_url(source)))


def parse_csv(data: bytes, sheet_name: str = "Google Sheet") -> StockData:
    """Đọc dữ liệu từ file CSV export của Google Sheet (hàng 2 là tên sản phẩm)."""
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise StockSheetError("Dữ liệu CSV không đúng định dạng UTF-8.") from exc

    rows = list(csv.reader(io.StringIO(text)))
    if len(rows) < 3:
        raise StockSheetError("Google Sheet không có đủ dữ liệu để tra cứu.")

    products = _row_columns(rows[1])
    if not products:
        raise StockSheetError("Không tìm thấy tên sản phẩm ở hàng 2 của Google Sheet.")

    total_row = _find_total_row_csv(rows, start=2)

    result: list[ProductStock] = []
    for column_index, name in products:
        total = _cell_number(rows[total_row], column_index) if total_row is not None else None
        if total is None:
            total = _column_sum_csv(rows, column_index, total_row)

        # Giữ lại cả sản phẩm tồn kho bằng 0 hoặc âm để giao diện hiển thị đầy đủ.
        result.append(
            ProductStock(
                product=name,
                column=get_column_letter(column_index + 1),
                locations=[StockLocation(office="", quantity=total)],
            )
        )

    return StockData(products=result, sheet_name=sheet_name)


def _column_sum_csv(
    rows: list[list[str]], column_index: int, total_row: int | None
) -> float:
    """Cộng toàn bộ giá trị trong cột khi ô tổng trống (gồm cả số âm)."""
    total = 0.0
    for row_index in range(2, len(rows)):
        if row_index == total_row:
            continue
        row = rows[row_index]
        office = row[0].strip() if row and row[0] else ""
        if not office:
            continue
        quantity = _cell_number(row, column_index)
        if quantity is not None:
            total += quantity
    return total


def _row_columns(row: list[str]) -> list[tuple[int, str]]:
    products: list[tuple[int, str]] = []
    started = False
    for column_index, value in enumerate(row):
        name = (value or "").strip()
        if not name:
            if started:
                break
            continue
        started = True
        products.append((column_index, name))
    return products


def _find_total_row_csv(rows: list[list[str]], start: int) -> int | None:
    found = None
    for row_index in range(start, len(rows)):
        row = rows[row_index]
        if not row or not row[0]:
            continue
        label = row[0].strip().upper()
        if any(marker in label for marker in TOTAL_ROW_MARKERS):
            found = row_index
    return found


def _cell_number(row: list[str], column_index: int) -> float | None:
    if column_index >= len(row):
        return None
    return _number(row[column_index])


def parse_workbook(data: bytes) -> StockData:
    worksheet, products = _pick_worksheet(data)
    total_row = _find_total_row(worksheet)
    images = _images_by_column(worksheet, products)

    result: list[ProductStock] = []
    for column_index, name in products:
        total = (
            _number(worksheet.cell(total_row, column_index).value)
            if total_row is not None
            else None
        )
        if total is None:
            # Tổng trống: cộng các ô trong cột (bỏ dòng tổng, bỏ dòng không có văn phòng).
            total = _column_sum(worksheet, column_index, total_row)

        # Giữ lại cả sản phẩm tồn kho bằng 0 hoặc âm để giao diện hiển thị đầy đủ.
        letter = get_column_letter(column_index)
        image, image_ext = images.get(column_index, (None, "png"))
        result.append(
            ProductStock(
                product=name,
                column=letter,
                locations=[StockLocation(office="", quantity=total)],
                image=image,
                image_ext=image_ext,
            )
        )

    return StockData(products=result, sheet_name=worksheet.title)


def _column_sum(sheet, column_index: int, total_row: int | None) -> float:
    """Cộng toàn bộ giá trị trong cột khi ô tổng trống (gồm cả số âm)."""
    total = 0.0
    for row_index in range(NAME_ROW + 1, sheet.max_row + 1):
        if row_index == total_row:
            continue
        office = sheet.cell(row_index, 1).value
        if not isinstance(office, str) or not office.strip():
            continue
        quantity = _number(sheet.cell(row_index, column_index).value)
        if quantity is not None:
            total += quantity
    return total


def _pick_worksheet(data: bytes):
    try:
        workbook = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
    except Exception as exc:  # noqa: BLE001
        raise StockSheetError("File tải về không phải Excel hợp lệ.") from exc

    best_sheet = None
    best_products: list[tuple[int, str]] = []
    for sheet in workbook.worksheets:
        products = _product_columns(sheet)
        if len(products) > len(best_products):
            best_sheet, best_products = sheet, products

    if best_sheet is None or not best_products:
        raise StockSheetError("Không tìm thấy tên sản phẩm ở hàng 2 của Google Sheet.")
    return best_sheet, best_products


def _product_columns(sheet) -> list[tuple[int, str]]:
    """Đọc dải ô có dữ liệu liên tiếp ở hàng 2, bắt đầu từ cột A."""
    products: list[tuple[int, str]] = []
    started = False
    for column_index in range(1, sheet.max_column + 1):
        value = sheet.cell(NAME_ROW, column_index).value
        name = str(value).strip() if value is not None else ""
        if not name:
            if started:
                break
            continue
        started = True
        products.append((column_index, name))
    return products


def _find_total_row(sheet) -> int | None:
    found = None
    for row_index in range(NAME_ROW + 1, sheet.max_row + 1):
        value = sheet.cell(row_index, 1).value
        if not isinstance(value, str):
            continue
        label = value.strip().upper()
        if any(marker in label for marker in TOTAL_ROW_MARKERS):
            found = row_index
    return found


def _images_by_column(sheet, products: list[tuple[int, str]]) -> dict[int, tuple[bytes, str]]:
    """Ghép ảnh vào cột theo tâm ngang của ảnh (ảnh có thể neo lệch cột)."""
    product_columns = {column for column, _name in products}
    widths = _column_widths_px(sheet)
    images: dict[int, tuple[bytes, str]] = {}

    for image in sheet._images:
        anchor = image.anchor
        origin = getattr(anchor, "_from", None)
        if origin is None or origin.row != NAME_ROW - 1:
            continue

        column = _anchor_center_column(sheet, image, origin, widths)
        if column not in product_columns:
            continue
        try:
            payload = image._data()
        except Exception:  # noqa: BLE001 - bỏ ảnh hỏng, không làm hỏng cả trang
            continue
        if not payload:
            continue
        extension = (image.format or "png").lower()
        if extension == "jpeg":
            extension = "jpg"
        # Ảnh neo chồng nhau: ảnh xuất hiện sau nằm trên và được ưu tiên.
        images[column] = (payload, extension)

    return images


def _anchor_center_column(sheet, image, origin, widths: dict[int, int]) -> int | None:
    ext = getattr(image.anchor, "ext", None)
    if ext is not None:
        image_width = ext.cx
    elif getattr(image.anchor, "_to", None) is not None:
        start = _column_start_px(widths, origin.col + 1) + origin.colOff / EMU_PER_PIXEL
        end = (
            _column_start_px(widths, image.anchor._to.col + 1)
            + image.anchor._to.colOff / EMU_PER_PIXEL
        )
        image_width = max(0.0, end - start) * EMU_PER_PIXEL
    else:
        image_width = float(getattr(image, "width", 0) or 0) * EMU_PER_PIXEL

    center = (
        _column_start_px(widths, origin.col + 1)
        + origin.colOff / EMU_PER_PIXEL
        + image_width / EMU_PER_PIXEL / 2
    )

    x = 0
    for column_index in range(1, sheet.max_column + 1):
        width = widths.get(column_index, _characters_to_px(8.43))
        if center < x + width:
            return column_index
        x += width
    return None


def _column_start_px(widths: dict[int, int], column_index: int) -> float:
    return float(sum(widths.get(index, 0) for index in range(1, column_index)))


def _column_widths_px(sheet) -> dict[int, int]:
    """Độ rộng cột thực tế, gồm cả các cột nằm trong dải <col min..max>."""
    default_width = sheet.sheet_format.defaultColWidth or 8.43
    widths = {
        index: _characters_to_px(default_width)
        for index in range(1, sheet.max_column + 1)
    }
    for dimension in sheet.column_dimensions.values():
        if dimension.min is None or dimension.max is None:
            continue
        width = dimension.width if dimension.width is not None else default_width
        for index in range(dimension.min, dimension.max + 1):
            widths[index] = _characters_to_px(width)
    return widths


def _characters_to_px(width: float) -> int:
    return max(1, int(round(width * 7)) + 5)


def _number(value) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(" ", "").replace("\u00a0", "")
    if not text:
        return None
    if "," in text and "." in text:
        text = text.replace(".", "").replace(",", ".")
    else:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def extract_images(data: bytes) -> tuple[dict[str, tuple[str, bytes, str]], str]:
    """Lấy ảnh của mọi cột sản phẩm, khoá theo tên đã chuẩn hoá."""
    worksheet, products = _pick_worksheet(data)
    images = _images_by_column(worksheet, products)

    counts: dict[str, int] = {}
    for _column_index, name in products:
        key = normalize_product(name)
        counts[key] = counts.get(key, 0) + 1

    extracted: dict[str, tuple[str, bytes, str]] = {}
    for column_index, name in products:
        key = normalize_product(name)
        if counts.get(key, 0) != 1 or column_index not in images:
            continue
        payload, extension = images[column_index]
        extracted[key] = (get_column_letter(column_index), payload, extension)

    return extracted, worksheet.title


def get_images(url: str | None = None) -> StockImages:
    """Trả ảnh đã cache; nếu cache cũ/thiếu thì làm mới ở nền để API không bị chậm."""
    source = url or STOCK_SHEET_URL
    key, _gid = _sheet_parts(source)

    manifest = _cached_manifest(key)
    if manifest is None:
        manifest = _read_manifest(key)
        if manifest is not None:
            with _manifest_lock:
                _manifests[key] = manifest

    if manifest is None or time.time() - manifest.generated_at > IMAGE_TTL_SECONDS:
        _start_image_refresh(source, key)

    return StockImages(
        images=dict(manifest.images) if manifest is not None else {},
        ready=manifest is not None,
        sheet_name=manifest.sheet_name if manifest is not None else "",
    )


def prewarm_images(url: str | None = None) -> None:
    """Làm ấm cache ảnh ngay sau khi khởi động (không chặn server)."""
    try:
        get_images(url)
    except StockSheetError:
        logger.warning("Không thể làm ấm cache ảnh vật phẩm lúc khởi động.")


def _cached_manifest(key: str) -> _ImageManifest | None:
    with _manifest_lock:
        return _manifests.get(key)


def _start_image_refresh(source: str, key: str) -> None:
    now = time.time()
    with _manifest_lock:
        if key in _refreshing:
            return
        if now - _image_failures.get(key, 0.0) < IMAGE_RETRY_SECONDS:
            return
        _refreshing.add(key)

    threading.Thread(
        target=_refresh_worker,
        args=(source, key),
        name=f"stock-images-{key[:8]}",
        daemon=True,
    ).start()


def _refresh_worker(source: str, key: str) -> None:
    try:
        refresh_images(source)
    except Exception as exc:  # noqa: BLE001 - không làm hỏng request chính
        logger.warning("Không làm mới được ảnh vật phẩm: %s", exc)
        with _manifest_lock:
            _image_failures[key] = time.time()
    finally:
        with _manifest_lock:
            _refreshing.discard(key)


def refresh_images(url: str | None = None) -> None:
    """Tải Excel một lần, tạo thumbnail WebP và ghi manifest ảnh theo tên sản phẩm."""
    source = url or STOCK_SHEET_URL
    key, _gid = _sheet_parts(source)
    extracted, sheet_name = extract_images(fetch_bytes(google_sheet_export_url(source)))

    images: dict[str, str] = {}
    for name, (column, payload, extension) in extracted.items():
        try:
            images[name] = save_image(column, payload, extension)
        except Exception as exc:  # noqa: BLE001 - một ảnh lỗi không chặn các ảnh khác
            logger.warning("Bỏ qua ảnh %s: %s", column, exc)

    manifest = _ImageManifest(
        generated_at=time.time(),
        images=images,
        sheet_name=sheet_name,
    )
    _write_manifest(key, manifest)
    with _manifest_lock:
        _manifests[key] = manifest
        _image_failures.pop(key, None)


def _write_manifest(key: str, manifest: _ImageManifest) -> None:
    path = STOCK_DIR / f"images-{key}.json"
    payload = json.dumps(
        {
            "generated_at": manifest.generated_at,
            "sheet_name": manifest.sheet_name,
            "images": manifest.images,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    tmp = path.with_suffix(".json.tmp")
    tmp.write_bytes(payload)
    tmp.replace(path)


def _read_manifest(key: str) -> _ImageManifest | None:
    path = STOCK_DIR / f"images-{key}.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(payload, dict) or not isinstance(payload.get("images"), dict):
        return None
    try:
        generated_at = float(payload.get("generated_at") or 0)
    except (TypeError, ValueError):
        generated_at = 0.0
    return _ImageManifest(
        generated_at=generated_at,
        images={str(name): str(url) for name, url in payload["images"].items()},
        sheet_name=str(payload.get("sheet_name") or ""),
    )


def save_image(column: str, payload: bytes, extension: str = "png") -> str:
    """Tạo thumbnail WebP nhẹ (giữ tỉ lệ) và trả URL tương đối cho frontend."""
    optimized, output_extension = _optimize_image(payload)
    if optimized is None:
        optimized, output_extension = payload, extension

    digest = hashlib.sha1(optimized).hexdigest()[:16]
    folder = STOCK_DIR / digest
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"{column}.{output_extension}"
    path = folder / filename

    if not path.exists():
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_bytes(optimized)
        tmp.replace(path)
    try:
        folder.touch()
    except OSError:
        pass
    return f"/api/stock/images/{digest}/{filename}"


def _optimize_image(payload: bytes) -> tuple[bytes | None, str]:
    try:
        with Image.open(io.BytesIO(payload)) as image:
            image = ImageOps.exif_transpose(image)
            image.thumbnail((THUMBNAIL_MAX_PX, THUMBNAIL_MAX_PX), Image.Resampling.LANCZOS)
            has_alpha = image.mode in ("RGBA", "LA") or (
                image.mode == "P" and "transparency" in image.info
            )
            output = io.BytesIO()
            if has_alpha:
                image.convert("RGBA").save(
                    output, format="WEBP", quality=WEBP_QUALITY, method=6
                )
            else:
                image.convert("RGB").save(
                    output, format="WEBP", quality=WEBP_QUALITY, method=6
                )
            return output.getvalue(), "webp"
    except Exception:  # noqa: BLE001 - ảnh lạ: giữ nguyên định dạng gốc
        return None, ""


def prune_cache() -> None:
    """Dọn cache ảnh cũ, giữ các lần tải gần đây để không phá request đang chạy."""
    if not STOCK_DIR.exists():
        return
    cutoff = time.time() - CACHE_MAX_AGE_SECONDS
    for folder in STOCK_DIR.iterdir():
        if not folder.is_dir():
            continue
        try:
            if folder.stat().st_mtime < cutoff:
                for child in folder.iterdir():
                    child.unlink(missing_ok=True)
                folder.rmdir()
        except OSError:
            continue


def image_path(digest: str, filename: str) -> Path | None:
    if not re.fullmatch(r"[0-9a-f]{8,40}", digest):
        return None
    if not re.fullmatch(r"[A-Z]{1,3}\.(?:png|jpg|jpeg|gif|webp)", filename):
        return None
    path = STOCK_DIR / digest / filename
    try:
        path.resolve().relative_to(STOCK_DIR.resolve())
    except ValueError:
        return None
    return path if path.is_file() else None
