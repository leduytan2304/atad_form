from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES
from ..database import get_db
from ..models import UploadedImage
from ..schemas import UploadRead
from ..services import image_cleanup, image_processing, storage

router = APIRouter(prefix="/api/uploads", tags=["uploads"])
files_router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("", response_model=UploadRead, status_code=201)
async def upload_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Chỉ chấp nhận ảnh PNG, JPG, WEBP hoặc GIF")

    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(400, "Ảnh vượt quá 10MB")
    if not data:
        raise HTTPException(400, "File ảnh rỗng")

    try:
        normalized, suffix, stored_type, _size = image_processing.normalize_image(data)
    except Exception as exc:
        raise HTTPException(400, "File không phải ảnh hợp lệ hoặc ảnh bị lỗi") from exc

    try:
        storage_key, bucket, _backend = storage.save_image(normalized, suffix, stored_type)
    except Exception as exc:
        raise HTTPException(502, "Không lưu được ảnh lên Supabase S3") from exc

    image = UploadedImage(
        storage_key=storage_key,
        bucket=bucket,
        original_name=file.filename or "image",
        mime_type=stored_type,
        size_bytes=len(normalized),
    )
    db.add(image)
    db.commit()
    db.refresh(image)
    return UploadRead(
        id=image.id,
        url=storage.public_url(image.storage_key),
        original_name=image.original_name,
    )


@router.get("/id/{image_id}", response_model=UploadRead)
def get_upload_by_id(image_id: int, db: Session = Depends(get_db)):
    image = db.get(UploadedImage, image_id)
    if not image:
        raise HTTPException(404, "Không tìm thấy ảnh")
    return UploadRead(
        id=image.id,
        url=storage.public_url(image.storage_key),
        original_name=image.original_name,
    )


@router.delete("/{image_id}")
def delete_upload(image_id: int, db: Session = Depends(get_db)):
    image = db.get(UploadedImage, image_id)
    if not image:
        raise HTTPException(404, "Không tìm thấy ảnh")
    if image_id in image_cleanup.referenced_image_ids(db):
        return {"deleted": False, "reason": "referenced"}
    try:
        storage.delete_image(image.storage_key)
    except Exception as exc:
        raise HTTPException(502, "Không xóa được ảnh trên Supabase S3") from exc
    db.delete(image)
    db.commit()
    return {"deleted": True, "reason": "deleted"}


@files_router.get("/{storage_key:path}")
def serve_image(storage_key: str, db: Session = Depends(get_db)):
    image = db.scalar(select(UploadedImage).where(UploadedImage.storage_key == storage_key))
    if not image:
        raise HTTPException(404, "Không tìm thấy ảnh")
    data = storage.read_image(image.storage_key)
    if data is None:
        raise HTTPException(404, "Không tìm thấy file ảnh trên kho lưu trữ")
    return Response(
        content=data,
        media_type=image.mime_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )
