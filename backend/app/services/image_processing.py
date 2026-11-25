"""Chuẩn hóa ảnh tải lên để DOCX/Word luôn đọc được (PNG/JPEG)."""

from __future__ import annotations

import io
from pathlib import Path

from PIL import Image, ImageOps

MAX_DIMENSION = 2200


def _has_alpha(image: Image.Image) -> bool:
    return image.mode in ("RGBA", "LA") or "transparency" in image.info


def normalize_image(data: bytes) -> tuple[bytes, str, str, tuple[int, int]]:
    """Trả về (bytes, extension, mime_type, (width, height)).

    Ảnh có kênh trong suốt lưu PNG, còn lại lưu JPEG để nhẹ file.
    Ảnh quá lớn được thu nhỏ, giữ tỉ lệ.
    """
    with Image.open(io.BytesIO(data)) as source:
        image = ImageOps.exif_transpose(source)
        alpha = _has_alpha(image)
        if alpha:
            image = image.convert("RGBA")
            fmt, extension, mime = "PNG", ".png", "image/png"
            save_options = {"optimize": True}
        else:
            image = image.convert("RGB")
            fmt, extension, mime = "JPEG", ".jpg", "image/jpeg"
            save_options = {"quality": 90, "optimize": True}

        image.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
        output = io.BytesIO()
        image.save(output, format=fmt, **save_options)
        return output.getvalue(), extension, mime, image.size


def local_path_for(storage_key: str) -> Path:
    from ..config import UPLOAD_DIR

    return UPLOAD_DIR / storage_key
