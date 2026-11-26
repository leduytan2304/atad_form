from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .config import STOCK_PREWARM
from .database import Base, SessionLocal, engine
from .models import ContentTemplate, ProfileSet, Unit
from .routers import profiles, stock, submissions, templates, units, uploads
from .services import stock_sheet, storage

DEFAULT_UNITS = ["Cái", "Chiếc", "Bộ", "Hộp", "Thùng", "Túi"]

DEFAULT_TEMPLATES = [
    {
        "name": "Đề nghị tạm ứng chi phí",
        "category": "Chi phí",
        "content": (
            "Đề nghị Ban Tổng Giám đốc phê duyệt tạm ứng chi phí dự kiến để triển khai công việc, "
            "bao gồm chi phí di chuyển, ăn uống và in ấn theo bảng dự toán đính kèm. "
            "Kinh phí sẽ được quyết toán sau khi hoàn thành."
        ),
    },
    {
        "name": "Đề nghị tổ chức đoàn tham quan nhà máy",
        "category": "Sự kiện",
        "content": (
            "Đề nghị Ban Tổng Giám đốc phê duyệt chủ trương tổ chức đoàn sinh viên tham quan, "
            "học tập thực tế tại nhà máy ATAD. Chương trình nhằm tăng cường nhận diện thương hiệu "
            "và tạo cơ hội tiếp cận nguồn nhân lực chất lượng."
        ),
    },
    {
        "name": "Lý do tăng nhận diện thương hiệu",
        "category": "Truyền thông",
        "content": (
            "Tăng nhận diện thương hiệu ATAD trong cộng đồng sinh viên và các trường đại học, "
            "đồng thời quảng bá hình ảnh doanh nghiệp, văn hóa làm việc và cơ hội nghề nghiệp "
            "đến nguồn nhân lực trẻ tiềm năng."
        ),
    },
]


def seed() -> None:
    with SessionLocal() as db:
        if db.scalar(select(ProfileSet).limit(1)) is None:
            db.add(
                ProfileSet(
                    name="Dữ liệu mặc định - Marketing",
                    full_name="Nguyễn Ngọc Thảo Vy",
                    position="Chuyên viên Marketing",
                    department="Marketing",
                    document_number="……-……/TTr-……/ATAD",
                    document_date="",
                    reference="Đề nghị phê duyệt chi phí tổ chức đoàn tham quan",
                    is_active=True,
                )
            )
        if db.scalar(select(ContentTemplate).limit(1)) is None:
            for item in DEFAULT_TEMPLATES:
                db.add(ContentTemplate(**item))
        # Chỉ tạo danh sách đơn vị tính mặc định một lần; sau đó người dùng tự quản lý.
        if db.scalar(select(Unit).limit(1)) is None:
            for name in DEFAULT_UNITS:
                db.add(Unit(name=name))
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    storage.ensure_bucket()
    seed()
    if STOCK_PREWARM:
        stock_sheet.prewarm_images()
    yield


app = FastAPI(title="ATAD - Quản lý tờ trình", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://atad-form.vercel.app",
    ],
    # Localhost / mạng LAN + các deployment Vercel của dự án
    # (atad-form.vercel.app và preview atad-form-<hash>-...vercel.app).
    allow_origin_regex=(
        r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?"
        r"|https://atad-form(?:-[a-z0-9-]+)?\.vercel\.app"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(profiles.router)
app.include_router(templates.router)
app.include_router(submissions.router)
app.include_router(uploads.router)
app.include_router(uploads.files_router)
app.include_router(stock.router)
app.include_router(units.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/health", include_in_schema=False)
def health_alias():
    return {"status": "ok"}
