"""Điền dữ liệu vào file DOCX mẫu HCM-FM45, giữ nguyên toàn bộ định dạng gốc.

File mẫu là chuẩn: chỉ thay nội dung của các trường người dùng nhập,
không thêm tiêu đề, chữ ký, footer hay bất kỳ nội dung nào khác.
"""

from __future__ import annotations

import copy
import io
import re
from pathlib import Path
from typing import Callable

from docx import Document
from docx.oxml.ns import qn
from docx.shared import Cm
from docx.text.paragraph import Paragraph

from ..config import EXPORT_DIR
from . import image_processing

TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "templates" / "HCM-FM45-TO-TRINH.docx"

MAX_IMG_WIDTH_CM = 15.2
MAX_IMG_HEIGHT_CM = 12.0
NUMBER_PLACEHOLDER = "…..-……/TTr-……/ATAD"
REF_PLACEHOLDER = "…………………………………………………"
CITY = "TP.HCM"

ImageLoader = Callable[[int], bytes | None]


# ---------- Tiện ích giữ nguyên định dạng ----------
def _find(doc: Document, prefix: str) -> Paragraph:
    for paragraph in doc.paragraphs:
        if paragraph.text.strip().startswith(prefix):
            return paragraph
    raise ValueError(f"Không tìm thấy mục '{prefix}' trong file mẫu")


def _index_of(paragraphs: list[Paragraph], target: Paragraph) -> int:
    for index, paragraph in enumerate(paragraphs):
        if paragraph._p is target._p:
            return index
    raise ValueError("Không tìm thấy đoạn văn trong file mẫu")


def _find_contains(doc: Document, needle: str) -> Paragraph:
    for paragraph in doc.paragraphs:
        if needle in paragraph.text:
            return paragraph
    raise ValueError(f"Không tìm thấy nội dung '{needle}' trong file mẫu")


def _first_rpr(paragraph: Paragraph):
    for run in paragraph._p.findall(qn("w:r")):
        rpr = run.find(qn("w:rPr"))
        if rpr is not None:
            return copy.deepcopy(rpr)
    return None


def _clear_content(paragraph: Paragraph) -> None:
    """Xóa text/hình ảnh nhưng giữ nguyên pPr (căn lề, tab, giãn dòng...)."""
    for child in list(paragraph._p):
        if child.tag != qn("w:pPr"):
            paragraph._p.remove(child)


def _set_text(paragraph: Paragraph, text: str, rpr=None) -> None:
    rpr = rpr if rpr is not None else _first_rpr(paragraph)
    _clear_content(paragraph)
    run = paragraph.add_run()
    if rpr is not None:
        run._r.insert(0, copy.deepcopy(rpr))
    if text:
        run.text = text


def _set_multiline(paragraph: Paragraph, text: str) -> None:
    lines = (text or "").replace("\r\n", "\n").split("\n")
    _set_text(paragraph, lines[0])
    anchor = paragraph._p
    for line in lines[1:]:
        new_element = copy.deepcopy(paragraph._p)
        anchor.addnext(new_element)
        anchor = new_element
        _set_text(Paragraph(new_element, paragraph._parent), line)


def _copy_paragraph(template: Paragraph) -> Paragraph:
    element = copy.deepcopy(template._p)
    return Paragraph(element, template._parent)


def _width_for_size(width: int, height: int) -> Cm:
    width_cm = width / 96 * 2.54
    height_cm = height / 96 * 2.54
    scale = 1.0
    if width_cm > MAX_IMG_WIDTH_CM:
        scale = min(scale, MAX_IMG_WIDTH_CM / width_cm)
    if height_cm * scale > MAX_IMG_HEIGHT_CM:
        scale = min(scale, MAX_IMG_HEIGHT_CM / height_cm)
    return Cm(max(width_cm * scale, 1.0))


def _add_image(paragraph_template: Paragraph, data: bytes, anchor=None) -> bool:
    """Thêm ảnh vào paragraph mới/có sẵn, giữ pPr của mẫu.

    Ảnh luôn được chuyển sang PNG/JPEG trước khi nhúng để Word đọc được
    (kể cả ảnh WebP cũ đã lưu trước đây).
    """
    try:
        normalized, _ext, _mime, (width_px, height_px) = image_processing.normalize_image(data)
        width = _width_for_size(width_px, height_px)
    except Exception:
        return False

    if anchor is None:
        paragraph = _copy_paragraph(paragraph_template)
        paragraph_template._p.addprevious(paragraph._p)
    else:
        paragraph = paragraph_template
        _clear_content(paragraph)

    run = paragraph.add_run()
    try:
        run.add_picture(io.BytesIO(normalized), width=width)
    except Exception:
        if anchor is None:
            paragraph._p.getparent().remove(paragraph._p)
        return False
    return True


# ---------- Điền dữ liệu ----------
def _format_date_parts(value: str) -> tuple[str, str, str]:
    value = (value or "").strip()
    if not value:
        return "……", "……", "……"
    match = re.match(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$", value)
    if match:
        day, month, year = match.groups()
        return day, month, year
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", value)
    if match:
        year, month, day = match.groups()
        return day, month, year
    numbers = re.findall(r"\d+", value)
    if len(numbers) >= 3:
        return numbers[0], numbers[1], numbers[2]
    return value, "……", "……"


def _set_city(paragraph: Paragraph) -> None:
    """Ghi địa danh trước ', Ngày/' giống file mẫu: 'TP.HCM, Ngày/ ...'."""
    marker = ", Ngày/"
    for run in paragraph.runs:
        if marker in run.text:
            run.text = CITY + run.text[run.text.index(marker):]
            return


def _set_date_part(runs, label: str, value: str) -> None:
    """Điền giá trị vào run ngay sau nhãn 'date' / 'month' / 'year'."""
    for index, run in enumerate(runs):
        if run.text.strip() != label:
            continue
        filled = False
        for follow in runs[index + 1:]:
            text = follow.text
            if any(stop in text for stop in ("Ngày/", "Tháng/", "năm/")):
                break
            if not text.strip():
                continue
            if not filled:
                lead = text[: len(text) - len(text.lstrip())]
                trail = text[len(text.rstrip()):]
                follow.text = f"{lead}{value}{trail}"
                filled = True
            else:
                follow.text = ""
        return


def _fill_meta(doc: Document, submission) -> None:
    paragraph = _find(doc, "Số/ No:")
    runs = paragraph.runs
    if len(runs) >= 3:
        runs[2].text = f": {submission.document_number or NUMBER_PLACEHOLDER}"

    _set_city(paragraph)
    day, month, year = _format_date_parts(submission.document_date)
    _set_date_part(runs, "date", day)
    _set_date_part(runs, "month", month)
    _set_date_part(runs, "year", year)

    ref = _find(doc, "(V/v Ref:")
    if len(ref.runs) >= 3:
        ref.runs[2].text = f":  {submission.reference or REF_PLACEHOLDER})"


def _fill_person(doc: Document, submission) -> None:
    name_line = _find(doc, "Họ và tên / Full name:")
    runs = name_line.runs
    if len(runs) >= 8:
        runs[3].text = submission.full_name
        runs[7].text = submission.position

    department = _find(doc, "Thuộc Phòng, ban / Department:")
    department_runs = department.runs
    if len(department_runs) >= 4:
        department_runs[3].text = submission.department


def _fill_content(doc: Document, submission) -> None:
    heading = _find(doc, "Nội dung đệ trình/ Content:")
    paragraphs = doc.paragraphs
    index = _index_of(paragraphs, heading)
    content_paragraph = paragraphs[index + 1]
    _set_multiline(content_paragraph, submission.content or "")


def _fill_requests(doc: Document, submission, requests: list[dict], load_image: ImageLoader) -> None:
    heading = _find(doc, "Đề nghị/Request:")
    reason_heading = _find(doc, "Lý do đề nghị / Reasons:")
    paragraphs = doc.paragraphs
    start = _index_of(paragraphs, heading) + 1
    end = _index_of(paragraphs, reason_heading)

    section = paragraphs[start:end]
    intro = [p for p in section if p.text.strip().startswith("Hạng mục")]
    item_template = next((p for p in section if p.text.strip() and p not in intro), None)

    # Mẫu paragraph dùng cho ảnh trong file gốc (paragraph có drawing ở phần lý do).
    image_template = None
    for paragraph in paragraphs[end:]:
        if paragraph._p.findall(".//" + qn("w:drawing")):
            image_template = paragraph
            break

    # Bỏ các dòng mẫu, chỉ giữ dòng tiêu đề "Hạng mục" có sẵn trong template.
    for paragraph in section:
        if all(paragraph._p is not kept._p for kept in intro):
            paragraph._p.getparent().remove(paragraph._p)

    if item_template is None or image_template is None:
        return

    for index, item in enumerate(requests, start=1):
        text = (item.get("text") or "").strip()
        paragraph = _copy_paragraph(item_template)
        _set_text(paragraph, f"{index}. {text}")
        reason_heading._p.addprevious(paragraph._p)

        image_id = item.get("image_id")
        if image_id:
            data = load_image(int(image_id))
            if data:
                image_paragraph = _copy_paragraph(image_template)
                _clear_content(image_paragraph)
                reason_heading._p.addprevious(image_paragraph._p)
                _add_image(image_paragraph, data, anchor=True)


def _fill_reason(doc: Document, submission, load_image: ImageLoader) -> None:
    heading = _find(doc, "Lý do đề nghị / Reasons:")
    closing = _find_contains(doc, "mong Ban TGĐ")
    paragraphs = doc.paragraphs
    start = _index_of(paragraphs, heading) + 1
    end = _index_of(paragraphs, closing)

    section = paragraphs[start:end]
    text_paragraph = next((p for p in section if p.text.strip() and not p._p.findall(".//" + qn("w:drawing"))), None)
    image_paragraph = next((p for p in section if p._p.findall(".//" + qn("w:drawing"))), None)

    if text_paragraph is not None:
        _set_multiline(text_paragraph, submission.reason or "")

    data = load_image(int(submission.reason_image_id)) if submission.reason_image_id else None
    if image_paragraph is not None:
        if data:
            _add_image(image_paragraph, data, anchor=True)
        else:
            image_paragraph._p.getparent().remove(image_paragraph._p)


def build_docx(submission, requests: list[dict], load_image: ImageLoader) -> Path:
    """Sao chép file mẫu, điền dữ liệu người dùng rồi lưu bản DOCX."""
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Thiếu file mẫu: {TEMPLATE_PATH}")

    doc = Document(str(TEMPLATE_PATH))

    _fill_meta(doc, submission)
    _fill_person(doc, submission)
    _fill_content(doc, submission)
    _fill_requests(doc, submission, requests, load_image)
    _fill_reason(doc, submission, load_image)

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = EXPORT_DIR / f"to-trinh-{submission.id}.docx"
    doc.save(path)
    return path
