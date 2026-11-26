from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Unit
from ..schemas import UnitCreate, UnitRead, UnitUpdate

router = APIRouter(prefix="/api/units", tags=["units"])


@router.get("", response_model=list[UnitRead])
def list_units(db: Session = Depends(get_db)):
    return db.scalars(select(Unit).order_by(Unit.id)).all()


@router.post("", response_model=UnitRead, status_code=201)
def create_unit(payload: UnitCreate, db: Session = Depends(get_db)):
    if _duplicate(db, payload.name) is not None:
        raise HTTPException(409, "Đơn vị tính đã tồn tại")
    unit = Unit(name=payload.name)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@router.put("/{unit_id}", response_model=UnitRead)
def update_unit(unit_id: int, payload: UnitUpdate, db: Session = Depends(get_db)):
    unit = db.get(Unit, unit_id)
    if unit is None:
        raise HTTPException(404, "Không tìm thấy đơn vị tính")
    if _duplicate(db, payload.name, exclude_id=unit_id) is not None:
        raise HTTPException(409, "Đơn vị tính đã tồn tại")
    unit.name = payload.name
    db.commit()
    db.refresh(unit)
    return unit


@router.delete("/{unit_id}", status_code=204)
def delete_unit(unit_id: int, db: Session = Depends(get_db)):
    unit = db.get(Unit, unit_id)
    if unit is None:
        raise HTTPException(404, "Không tìm thấy đơn vị tính")
    db.delete(unit)
    db.commit()


def _duplicate(db: Session, name: str, exclude_id: int | None = None) -> Unit | None:
    """So khớp không phân biệt hoa thường và khoảng trắng thừa."""
    target = name.strip().casefold()
    for unit in db.scalars(select(Unit)):
        if unit.id != exclude_id and unit.name.strip().casefold() == target:
            return unit
    return None
