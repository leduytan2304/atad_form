import os
import pathlib

# Dùng SQLite riêng và lưu ảnh local khi chạy test (không đụng Supabase).
TEST_DIR = pathlib.Path(__file__).resolve().parent
TEST_DB = TEST_DIR / "test_atad.db"
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ["ATAD_DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["ATAD_STORAGE_BACKEND"] = "local"
os.environ["ATAD_STOCK_PREWARM"] = "0"
