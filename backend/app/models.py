from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def now() -> datetime:
    return datetime.now()


class ProfileSet(Base):
    """Một bộ dữ liệu cố định (thông tin người đề xuất)."""

    __tablename__ = "profile_sets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    full_name: Mapped[str] = mapped_column(String(200), default="")
    position: Mapped[str] = mapped_column(String(200), default="")
    department: Mapped[str] = mapped_column(String(200), default="")
    document_number: Mapped[str] = mapped_column(String(100), default="")
    document_date: Mapped[str] = mapped_column(String(100), default="")
    reference: Mapped[str] = mapped_column(String(300), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ContentTemplate(Base):
    """Dữ liệu mẫu để tái sử dụng."""

    __tablename__ = "content_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100), default="Khác")
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class Submission(Base):
    """Một tờ trình đã lưu."""

    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300), default="")
    profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("profile_sets.id", ondelete="SET NULL"), nullable=True
    )
    profile_name: Mapped[str] = mapped_column(String(200), default="")
    full_name: Mapped[str] = mapped_column(String(200), default="")
    position: Mapped[str] = mapped_column(String(200), default="")
    department: Mapped[str] = mapped_column(String(200), default="")
    document_number: Mapped[str] = mapped_column(String(100), default="")
    document_date: Mapped[str] = mapped_column(String(100), default="")
    reference: Mapped[str] = mapped_column(String(300), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    requests_json: Mapped[str] = mapped_column(Text, default="[]")
    reason: Mapped[str] = mapped_column(Text, default="")
    reason_image_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    docx_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)

    profile: Mapped[ProfileSet | None] = relationship()


class UploadedImage(Base):
    """Metadata ảnh lưu trên Supabase S3 (hoặc ổ đĩa khi chạy local)."""

    __tablename__ = "uploaded_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Khóa object trên S3, ví dụ: images/9f2c...png
    storage_key: Mapped[str] = mapped_column(String(500), unique=True)
    bucket: Mapped[str] = mapped_column(String(200), default="")
    original_name: Mapped[str] = mapped_column(String(300))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
