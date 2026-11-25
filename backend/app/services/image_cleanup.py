"""Xóa ảnh trên kho lưu trữ khi không còn tờ trình nào tham chiếu."""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Submission, UploadedImage
from . import storage


def referenced_image_ids(db: Session) -> set[int]:
    ids: set[int] = set()
    for submission in db.scalars(select(Submission)).all():
        try:
            requests = json.loads(submission.requests_json or "[]")
        except json.JSONDecodeError:
            requests = []
        for item in requests:
            image_id = item.get("image_id")
            if image_id:
                ids.add(int(image_id))
        if submission.reason_image_id:
            ids.add(int(submission.reason_image_id))
    return ids


def delete_if_unreferenced(db: Session, image_id: int) -> bool:
    """Xóa object trên S3 + metadata nếu ảnh không còn được sử dụng."""
    image = db.get(UploadedImage, image_id)
    if not image:
        return False
    if image_id in referenced_image_ids(db):
        return False

    storage.delete_image(image.storage_key)
    db.delete(image)
    db.commit()
    return True


def delete_many_if_unreferenced(db: Session, image_ids: set[int]) -> list[int]:
    deleted: list[int] = []
    if not image_ids:
        return deleted
    references = referenced_image_ids(db)
    for image_id in image_ids:
        if image_id in references:
            continue
        image = db.get(UploadedImage, image_id)
        if not image:
            continue
        try:
            storage.delete_image(image.storage_key)
        except Exception:
            continue
        db.delete(image)
        deleted.append(image_id)
    if deleted:
        db.commit()
    return deleted


def image_ids_of(submission: Submission) -> set[int]:
    ids: set[int] = set()
    try:
        requests = json.loads(submission.requests_json or "[]")
    except json.JSONDecodeError:
        requests = []
    for item in requests:
        image_id = item.get("image_id")
        if image_id:
            ids.add(int(image_id))
    if submission.reason_image_id:
        ids.add(int(submission.reason_image_id))
    return ids
