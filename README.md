# ATAD · Quản lý tờ trình

Website nội bộ soạn, xem trước và xuất **tờ trình** theo biểu mẫu `HCM-FM45`, xây dựng bằng **Next.js** và **FastAPI**.

## Chức năng

- **Tờ trình** (`/`)
  - **Dữ liệu cố định**: nhiều bộ dữ liệu người đề xuất, chọn bộ đang dùng, thêm/sửa/xóa, tự động điền Họ tên – Chức vụ – Phòng ban – Số – Ngày – V/v vào file Word.
  - **Nội dung đệ trình**: nhập nhiều dòng.
  - **Đề nghị**: danh sách dòng tự đánh số, thêm dòng bên dưới bằng dấu `+`, xóa dòng và tự đánh số lại, mỗi dòng đính kèm một hình ảnh tùy chọn (xem/thay/xóa).
  - **Lý do đề nghị**: nội dung nhiều dòng + một hình ảnh tùy chọn.
  - Hình ảnh có thể **chọn file** hoặc **dán trực tiếp bằng Ctrl+V** vào ô nhập/khung ảnh.
  - **Dữ liệu mẫu**: thêm/sửa/xóa, phân loại, tìm kiếm, sao chép nhanh vào nội dung.
  - **Xem trước** file DOCX ngay trên trình duyệt, quay lại chỉnh sửa hoặc tải về.
- **Lịch sử tờ trình** (`/history`, mở từ nút "Lịch sử" ở trang Tờ trình): xem lại, sửa, nhân bản, tải lại file DOCX, xóa.
- Sidebar có 3 chức năng theo yêu cầu; Chức năng 2 và 3 đang là trang giữ chỗ.

File DOCX được tạo bằng cách **sao chép nguyên file mẫu** `backend/app/templates/HCM-FM45-TO-TRINH.docx` rồi chỉ điền các trường người dùng nhập (số/ngày/V-v, họ tên/chức vụ/phòng ban, nội dung, danh sách đề nghị + ảnh, lý do + ảnh). Toàn bộ logo, tiêu đề, header/footer, căn lề, font và bố cục gốc được giữ nguyên; không thêm chữ ký hay nội dung ngoài input. Hình ảnh được thu phóng vừa khổ A4 và nội dung dài tự sang trang.

## Cấu trúc

```
backend/
  app/
    main.py              # khởi tạo FastAPI, seed dữ liệu mặc định
    models.py            # ProfileSet, ContentTemplate, Submission, UploadedImage
    routers/             # profiles, templates, submissions, uploads
    services/docx_export.py  # sinh file DOCX từ biểu mẫu
    services/storage.py      # Supabase S3 (fallback ổ đĩa khi test)
    assets/logo.jpeg     # logo ATAD
    templates/HCM-FM45-TO-TRINH.docx  # file mẫu gốc để tham chiếu
    storage/uploads/     # ảnh local khi chạy test / fallback
    storage/exports/     # file DOCX đã xuất
  migrations/supabase_schema.sql  # schema Postgres trên Supabase
  .env                 # cấu hình Supabase (không commit)
  .env.example         # mẫu cấu hình
  tests/test_api.py
frontend/
  app/                   # trang Tờ trình, Lịch sử, Chức năng 2/3
  components/            # Sidebar, quản lý dữ liệu, thư viện mẫu, xem trước DOCX
  lib/api.ts
```

## Chạy dự án

Yêu cầu: Python 3.11+, Node.js 20+.

```bash
# 1. Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 2. Frontend (cửa sổ khác)
cd frontend
npm install
npm run dev
```

Mở http://localhost:3000. API chạy tại http://localhost:8000 (Swagger: `/docs`).

Biến môi trường tuỳ chọn: `NEXT_PUBLIC_API_URL` (mặc định `http://localhost:8000`).

## Lưu trữ: Supabase Postgres + Supabase S3

Backend đọc cấu hình từ `backend/.env` (xem mẫu `backend/.env.example`):

| Biến | Dùng cho |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Kết nối Supabase Postgres (session pooler, SSL) |
| `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION` | Endpoint S3 của Supabase Storage |
| `SUPABASE_S3_ACCESS_KEY`, `SUPABASE_S3_SECRET_KEY` | Khóa S3 |
| `SUPABASE_S3_BUCKET` | Bucket lưu ảnh (mặc định `uploads`) |

- **Text/metadata** lưu trong Supabase Postgres. Các bảng được tạo tự động khi backend khởi động (`Base.metadata.create_all`), hoặc chạy tay `backend/migrations/supabase_schema.sql`.
- **Ảnh** lưu trên Supabase S3 với object key `images/<uuid>.<ext>`. Bảng `uploaded_images` chỉ lưu metadata: `storage_key`, `bucket`, `original_name`, `mime_type`, `size_bytes`.
- Ảnh upload được chuẩn hóa sang PNG/JPEG (kể cả WebP/GIF) để Word/DOCX luôn mở được; ảnh quá lớn tự thu nhỏ.
- Bucket được tự tạo khi khởi động nếu chưa có. Bucket để **private**, ảnh hiển thị/tải qua backend tại `/uploads/images/...` để không lộ khóa S3.
- Khi xuất DOCX, backend tải ảnh từ S3 và nhúng vào file Word.
- Bấm **X** hoặc **Thay** ảnh sẽ xóa object trên S3 nếu ảnh không còn được tờ trình nào dùng. Nếu ảnh đang được lưu trong lịch sử, ảnh được giữ lại và tự xóa khi tờ trình bỏ ảnh hoặc bị xóa.
- Chạy test tự động dùng SQLite + lưu ảnh local (`tests/conftest.py`), không ghi vào Supabase.

## Kiểm thử

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest -q
```

Kiểm tra frontend:

```bash
cd frontend
npm run build
```
