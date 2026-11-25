import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR.parent
STORAGE_DIR = BASE_DIR / "storage"
UPLOAD_DIR = STORAGE_DIR / "uploads"
EXPORT_DIR = STORAGE_DIR / "exports"
ASSET_DIR = BASE_DIR / "assets"

# Nạp biến môi trường từ backend/.env (không ghi đè biến đã có sẵn).
load_dotenv(BACKEND_DIR / ".env", override=False)

for directory in (UPLOAD_DIR, EXPORT_DIR, ASSET_DIR, BASE_DIR / "data"):
    directory.mkdir(parents=True, exist_ok=True)


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip().strip('"')


# ----- Database -----
# Ưu tiên ATAD_DATABASE_URL (test), rồi ghép từ DB_* trong .env (an toàn với mật khẩu có @).
# Chỉ dùng DATABASE_URL nguyên chuỗi khi không có đủ thông tin DB_*.
DATABASE_URL = _env("ATAD_DATABASE_URL")
DB_HOST = _env("DB_HOST")
DB_PORT = int(_env("DB_PORT", "5432") or 5432)
DB_NAME = _env("DB_NAME", "postgres")
DB_USER = _env("DB_USER", "postgres")
DB_PASSWORD = _env("DB_PASSWORD")

if not DATABASE_URL:
    if DB_HOST:
        from sqlalchemy.engine import URL

        DATABASE_URL = URL.create(
            "postgresql+psycopg",
            username=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            query={"sslmode": "require"},
        )
    else:
        DATABASE_URL = _env("DATABASE_URL") or f"sqlite:///{BASE_DIR / 'data' / 'atad.db'}"

# ----- Supabase S3 storage -----
STORAGE_BACKEND = _env("ATAD_STORAGE_BACKEND", "s3" if _env("SUPABASE_S3_ENDPOINT") else "local").lower()
SUPABASE_S3_ENDPOINT = _env("SUPABASE_S3_ENDPOINT")
SUPABASE_S3_REGION = _env("SUPABASE_S3_REGION", "ap-northeast-1")
SUPABASE_S3_ACCESS_KEY = _env("SUPABASE_S3_ACCESS_KEY")
SUPABASE_S3_SECRET_KEY = _env("SUPABASE_S3_SECRET_KEY")
SUPABASE_S3_BUCKET = _env("SUPABASE_S3_BUCKET", "uploads")

ALLOWED_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_IMAGE_BYTES = 10 * 1024 * 1024
