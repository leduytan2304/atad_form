import json
import re
import unicodedata
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Submission, UploadedImage
from ..schemas import SubmissionCreate, SubmissionRead, SubmissionUpdate
from ..services import image_cleanup, storage
from ..services.docx_export import build_docx

router = APIRouter(prefix="/api/submissions", tags=["submissions"])


def _to_read(item: Submission) -> SubmissionRead:
    try:
        requests = json.loads(item.requests_json or "[]")
    except json.JSONDecodeError:
        requests = []
    return SubmissionRead(
        id=item.id,
        title=item.title,
        profile_id=item.profile_id,
        profile_name=item.profile_name,
        full_name=item.full_name,
        position=item.position,
        department=item.department,
        document_number=item.document_number,
        document_date=item.document_date,
        reference=item.reference,
        content=item.content,
        requests=requests,
        reason=item.reason,
        reason_image_id=item.reason_image_id,
        docx_path=item.docx_path,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _apply(item: Submission, payload: SubmissionCreate | SubmissionUpdate) -> None:
    data = payload.model_dump()
    requests = data.pop("requests", [])
    for key, value in data.items():
        setattr(item, key, value)
    item.requests_json = json.dumps(requests, ensure_ascii=False)
    if not item.title:
        item.title = (item.content or "Tờ trình").strip().split("\n")[0][:180] or "Tờ trình"


@router.get("", response_model=list[SubmissionRead])
def list_submissions(db: Session = Depends(get_db)):
    items = db.scalars(select(Submission).order_by(Submission.updated_at.desc())).all()
    return [_to_read(item) for item in items]


@router.get("/{submission_id}", response_model=SubmissionRead)
def get_submission(submission_id: int, db: Session = Depends(get_db)):
    item = db.get(Submission, submission_id)
    if not item:
        raise HTTPException(404, "Không tìm thấy tờ trình")
    return _to_read(item)


@router.post("", response_model=SubmissionRead, status_code=201)
def create_submission(payload: SubmissionCreate, db: Session = Depends(get_db)):
    item = Submission()
    _apply(item, payload)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_read(item)


@router.put("/{submission_id}", response_model=SubmissionRead)
def update_submission(submission_id: int, payload: SubmissionUpdate, db: Session = Depends(get_db)):
    item = db.get(Submission, submission_id)
    if not item:
        raise HTTPException(404, "Không tìm thấy tờ trình")
    old_image_ids = image_cleanup.image_ids_of(item)
    _apply(item, payload)
    item.docx_path = None
    db.commit()
    db.refresh(item)
    image_cleanup.delete_many_if_unreferenced(db, old_image_ids - image_cleanup.image_ids_of(item))
    return _to_read(item)


@router.post("/{submission_id}/duplicate", response_model=SubmissionRead, status_code=201)
def duplicate_submission(submission_id: int, db: Session = Depends(get_db)):
    source = db.get(Submission, submission_id)
    if not source:
        raise HTTPException(404, "Không tìm thấy tờ trình")
    copy = Submission(
        title=f"Bản sao - {source.title}"[:300],
        profile_id=source.profile_id,
        profile_name=source.profile_name,
        full_name=source.full_name,
        position=source.position,
        department=source.department,
        document_number=source.document_number,
        document_date=source.document_date,
        reference=source.reference,
        content=source.content,
        requests_json=source.requests_json,
        reason=source.reason,
        reason_image_id=source.reason_image_id,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return _to_read(copy)


@router.delete("/{submission_id}", status_code=204)
def delete_submission(submission_id: int, db: Session = Depends(get_db)):
    item = db.get(Submission, submission_id)
    if not item:
        raise HTTPException(404, "Không tìm thấy tờ trình")
    image_ids = image_cleanup.image_ids_of(item)
    if item.docx_path:
        from pathlib import Path

        Path(item.docx_path).unlink(missing_ok=True)
    db.delete(item)
    db.commit()
    image_cleanup.delete_many_if_unreferenced(db, image_ids)


@router.get("/{submission_id}/docx")
def download_docx(
    submission_id: int,
    download: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    item = db.get(Submission, submission_id)
    if not item:
        raise HTTPException(404, "Không tìm thấy tờ trình")

    images = {img.id: img for img in db.scalars(select(UploadedImage)).all()}
    cache: dict[int, bytes | None] = {}

    def load_image(image_id: int) -> bytes | None:
        if image_id not in cache:
            image = images.get(image_id)
            cache[image_id] = storage.read_image(image.storage_key) if image else None
        return cache[image_id]

    requests = json.loads(item.requests_json or "[]")
    path = build_docx(item, requests, load_image)
    item.docx_path = str(path)
    db.commit()

    slug = _slug(item.title) or "to-trinh"
    filename = f"{slug}.docx"
    disposition = "attachment" if download else "inline"
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": (
                f"{disposition}; filename=\"{slug}.docx\"; filename*=UTF-8''{quote(filename)}"
            )
        },
    )


def _slug(value: str) -> str:
    text = unicodedata.normalize("NFD", value or "")
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.replace("đ", "d").replace("Đ", "D")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text[:80]
