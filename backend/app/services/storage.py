"""Lưu trữ ảnh: Supabase S3 (mặc định) hoặc ổ đĩa khi chạy local/test."""

from __future__ import annotations

import uuid
from pathlib import Path

from ..config import (
    STORAGE_BACKEND,
    SUPABASE_S3_ACCESS_KEY,
    SUPABASE_S3_BUCKET,
    SUPABASE_S3_ENDPOINT,
    SUPABASE_S3_REGION,
    SUPABASE_S3_SECRET_KEY,
    UPLOAD_DIR,
)

try:
    import boto3
    from botocore.config import Config as BotoConfig
except ImportError:  # pragma: no cover - chỉ thiếu khi chưa cài requirements
    boto3 = None
    BotoConfig = None

_client = None


def _s3_enabled() -> bool:
    return (
        STORAGE_BACKEND == "s3"
        and boto3 is not None
        and bool(SUPABASE_S3_ENDPOINT)
        and bool(SUPABASE_S3_ACCESS_KEY)
        and bool(SUPABASE_S3_SECRET_KEY)
    )


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=SUPABASE_S3_ENDPOINT,
            region_name=SUPABASE_S3_REGION,
            aws_access_key_id=SUPABASE_S3_ACCESS_KEY,
            aws_secret_access_key=SUPABASE_S3_SECRET_KEY,
            config=BotoConfig(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
    return _client


def ensure_bucket() -> None:
    """Tạo bucket trên Supabase S3 nếu chưa tồn tại (bỏ qua nếu không có quyền)."""
    if not _s3_enabled():
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        return
    client = _get_client()
    try:
        client.head_bucket(Bucket=SUPABASE_S3_BUCKET)
    except Exception:
        try:
            client.create_bucket(Bucket=SUPABASE_S3_BUCKET)
        except Exception:
            # Bucket có thể đã tồn tại nhưng không có quyền HeadBucket.
            pass


def save_image(data: bytes, extension: str, content_type: str) -> tuple[str, str, str]:
    """Lưu ảnh, trả về (storage_key, bucket, backend)."""
    key = f"images/{uuid.uuid4().hex}{extension}"

    if _s3_enabled():
        _get_client().put_object(
            Bucket=SUPABASE_S3_BUCKET,
            Key=key,
            Body=data,
            ContentType=content_type,
            CacheControl="public, max-age=31536000",
        )
        return key, SUPABASE_S3_BUCKET, "s3"

    path = UPLOAD_DIR / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key, "", "local"


def read_image(storage_key: str) -> bytes | None:
    if _s3_enabled():
        try:
            response = _get_client().get_object(Bucket=SUPABASE_S3_BUCKET, Key=storage_key)
            return response["Body"].read()
        except Exception:
            return _resolve_local(storage_key)

    path = UPLOAD_DIR / storage_key
    return path.read_bytes() if path.exists() else None


def delete_image(storage_key: str) -> None:
    if _s3_enabled():
        # S3 DeleteObject là idempotent; lỗi thật sẽ được caller xử lý.
        _get_client().delete_object(Bucket=SUPABASE_S3_BUCKET, Key=storage_key)
    path = UPLOAD_DIR / storage_key
    if path.exists():
        path.unlink()


def public_url(storage_key: str) -> str:
    """URL nội bộ đi qua backend, giữ bucket ở chế độ private."""
    return f"/uploads/{storage_key}"


def _resolve_local(storage_key: str) -> bytes | None:
    path = UPLOAD_DIR / Path(storage_key).name
    if path.exists():
        return path.read_bytes()
    path = UPLOAD_DIR / storage_key
    return path.read_bytes() if path.exists() else None


def backend_name() -> str:
    return "supabase-s3" if _s3_enabled() else "local"
