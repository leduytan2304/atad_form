from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ContentTemplate
from ..schemas import TemplateCreate, TemplateRead, TemplateUpdate

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=list[TemplateRead])
def list_templates(
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    stmt = select(ContentTemplate)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(ContentTemplate.name.ilike(like), ContentTemplate.content.ilike(like)))
    if category and category != "Tất cả":
        stmt = stmt.where(ContentTemplate.category == category)
    return db.scalars(stmt.order_by(ContentTemplate.updated_at.desc())).all()


@router.get("/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db)):
    values = db.scalars(select(ContentTemplate.category).distinct().order_by(ContentTemplate.category)).all()
    return list(values)


@router.post("", response_model=TemplateRead, status_code=201)
def create_template(payload: TemplateCreate, db: Session = Depends(get_db)):
    item = ContentTemplate(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{template_id}", response_model=TemplateRead)
def update_template(template_id: int, payload: TemplateUpdate, db: Session = Depends(get_db)):
    item = db.get(ContentTemplate, template_id)
    if not item:
        raise HTTPException(404, "Không tìm thấy dữ liệu mẫu")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    item = db.get(ContentTemplate, template_id)
    if not item:
        raise HTTPException(404, "Không tìm thấy dữ liệu mẫu")
    db.delete(item)
    db.commit()
