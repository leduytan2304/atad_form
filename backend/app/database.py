from sqlalchemy import create_engine
from sqlalchemy.engine import make_url, URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL

url = DATABASE_URL if isinstance(DATABASE_URL, URL) else make_url(DATABASE_URL)
is_sqlite = url.get_backend_name() == "sqlite"

engine = create_engine(
    url,
    connect_args={"check_same_thread": False} if is_sqlite else {},
    pool_pre_ping=not is_sqlite,
    pool_recycle=300 if not is_sqlite else -1,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
