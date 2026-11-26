-- Schema Supabase Postgres cho website Quản lý tờ trình ATAD.
-- Ứng dụng tự tạo bảng khi khởi động (SQLAlchemy create_all);
-- file này dùng khi muốn tạo bảng thủ công trong SQL Editor của Supabase.

CREATE TABLE IF NOT EXISTS profile_sets (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    full_name       VARCHAR(200) NOT NULL DEFAULT '',
    position        VARCHAR(200) NOT NULL DEFAULT '',
    department      VARCHAR(200) NOT NULL DEFAULT '',
    document_number VARCHAR(100) NOT NULL DEFAULT '',
    document_date   VARCHAR(100) NOT NULL DEFAULT '',
    reference       VARCHAR(300) NOT NULL DEFAULT '',
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_templates (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    category   VARCHAR(100) NOT NULL DEFAULT 'Khác',
    content    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submissions (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(300) NOT NULL DEFAULT '',
    profile_id      INTEGER REFERENCES profile_sets(id) ON DELETE SET NULL,
    profile_name    VARCHAR(200) NOT NULL DEFAULT '',
    full_name       VARCHAR(200) NOT NULL DEFAULT '',
    position        VARCHAR(200) NOT NULL DEFAULT '',
    department      VARCHAR(200) NOT NULL DEFAULT '',
    document_number VARCHAR(100) NOT NULL DEFAULT '',
    document_date   VARCHAR(100) NOT NULL DEFAULT '',
    reference       VARCHAR(300) NOT NULL DEFAULT '',
    content         TEXT NOT NULL DEFAULT '',
    requests_json   TEXT NOT NULL DEFAULT '[]',
    reason          TEXT NOT NULL DEFAULT '',
    reason_image_id INTEGER,
    docx_path       VARCHAR(500),
    created_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Đơn vị tính dùng khi lập tờ trình, quản lý độc lập với sản phẩm.
CREATE TABLE IF NOT EXISTS units (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Bảng metadata ảnh: file nhị phân nằm trên Supabase S3 (bucket uploads),
-- database chỉ lưu khóa object và thông tin hiển thị.
CREATE TABLE IF NOT EXISTS uploaded_images (
    id            SERIAL PRIMARY KEY,
    storage_key   VARCHAR(500) NOT NULL UNIQUE,
    bucket        VARCHAR(200) NOT NULL DEFAULT '',
    original_name VARCHAR(300) NOT NULL,
    mime_type     VARCHAR(100) NOT NULL,
    size_bytes    INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_submissions_updated_at ON submissions (updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_content_templates_category ON content_templates (category);
CREATE INDEX IF NOT EXISTS ix_uploaded_images_storage_key ON uploaded_images (storage_key);
