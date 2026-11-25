<<<<<<< HEAD
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
=======
# atad_form



## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

* [Create](https://docs.gitlab.com/user/project/repository/web_editor/#create-a-file) or [upload](https://docs.gitlab.com/user/project/repository/web_editor/#upload-a-file) files
* [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://gitlab.com/ldtan1/atad_form.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

* [Set up project integrations](https://gitlab.com/ldtan1/atad_form/-/settings/integrations)

## Collaborate with your team

* [Invite team members and collaborators](https://docs.gitlab.com/user/project/members/)
* [Create a new merge request](https://docs.gitlab.com/user/project/merge_requests/creating_merge_requests/)
* [Automatically close issues from merge requests](https://docs.gitlab.com/user/project/issues/managing_issues/#closing-issues-automatically)
* [Enable merge request approvals](https://docs.gitlab.com/user/project/merge_requests/approvals/)
* [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

* [Get started with GitLab CI/CD](https://docs.gitlab.com/ci/quick_start/)
* [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/user/application_security/sast/)
* [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/topics/autodevops/requirements/)
* [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/user/clusters/agent/)
* [Set up protected environments](https://docs.gitlab.com/ci/environments/protected_environments/)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
>>>>>>> e2dee02f55130489466c7fb1b5006bf4509960cf
