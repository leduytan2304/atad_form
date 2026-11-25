from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ProfileSet
from ..schemas import ProfileSetCreate, ProfileSetRead, ProfileSetUpdate

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("", response_model=list[ProfileSetRead])
def list_profiles(db: Session = Depends(get_db)):
    return db.scalars(select(ProfileSet).order_by(ProfileSet.id)).all()


@router.get("/active", response_model=ProfileSetRead | None)
def active_profile(db: Session = Depends(get_db)):
    return db.scalar(select(ProfileSet).where(ProfileSet.is_active.is_(True)))


@router.post("", response_model=ProfileSetRead, status_code=201)
def create_profile(payload: ProfileSetCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    make_active = data.pop("is_active", False)
    if db.scalar(select(ProfileSet).limit(1)) is None:
        make_active = True
    if make_active:
        _deactivate_all(db)
    profile = ProfileSet(**data, is_active=make_active)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/{profile_id}", response_model=ProfileSetRead)
def update_profile(profile_id: int, payload: ProfileSetUpdate, db: Session = Depends(get_db)):
    profile = db.get(ProfileSet, profile_id)
    if not profile:
        raise HTTPException(404, "Không tìm thấy bộ dữ liệu")
    data = payload.model_dump(exclude_unset=True)
    if data.pop("is_active", None):
        _deactivate_all(db)
        profile.is_active = True
    for key, value in data.items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.post("/{profile_id}/activate", response_model=ProfileSetRead)
def activate_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = db.get(ProfileSet, profile_id)
    if not profile:
        raise HTTPException(404, "Không tìm thấy bộ dữ liệu")
    _deactivate_all(db)
    profile.is_active = True
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=204)
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    profile = db.get(ProfileSet, profile_id)
    if not profile:
        raise HTTPException(404, "Không tìm thấy bộ dữ liệu")
    was_active = profile.is_active
    db.delete(profile)
    db.flush()
    if was_active:
        remaining = db.scalar(select(ProfileSet).order_by(ProfileSet.id))
        if remaining:
            remaining.is_active = True
    db.commit()


def _deactivate_all(db: Session) -> None:
    for item in db.scalars(select(ProfileSet).where(ProfileSet.is_active.is_(True))):
        item.is_active = False
