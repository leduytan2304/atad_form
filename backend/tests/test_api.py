import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200


def test_seed_data_available(client):
    profiles = client.get("/api/profiles").json()
    assert len(profiles) >= 1
    assert any(p["is_active"] for p in profiles)
    templates = client.get("/api/templates").json()
    assert len(templates) >= 1


def test_profile_crud(client):
    created = client.post("/api/profiles", json={
        "name": "Bộ test",
        "full_name": "Nguyễn Văn A",
        "position": "Nhân viên",
        "department": "Kỹ thuật",
    })
    assert created.status_code == 201
    pid = created.json()["id"]

    updated = client.put(f"/api/profiles/{pid}", json={"full_name": "Nguyễn Văn B"})
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Nguyễn Văn B"

    activated = client.post(f"/api/profiles/{pid}/activate")
    assert activated.status_code == 200
    assert activated.json()["is_active"] is True

    assert client.delete(f"/api/profiles/{pid}").status_code == 204


def test_template_search_and_crud(client):
    created = client.post("/api/templates", json={
        "name": "Mẫu tìm kiếm đặc biệt",
        "category": "Test",
        "content": "Nội dung abc",
    })
    assert created.status_code == 201
    tid = created.json()["id"]

    found = client.get("/api/templates", params={"q": "đặc biệt"}).json()
    assert any(item["id"] == tid for item in found)

    assert client.delete(f"/api/templates/{tid}").status_code == 204


def test_units_available_and_crud(client):
    seeded = client.get("/api/units")
    assert seeded.status_code == 200
    assert len(seeded.json()) >= 1

    created = client.post("/api/units", json={"name": "  Kg  "})
    assert created.status_code == 201, created.text
    unit = created.json()
    assert unit["name"] == "Kg"
    uid = unit["id"]

    # Đơn vị tính mới được lưu lại và dùng được ở lần mở sau.
    listed = client.get("/api/units").json()
    assert any(item["id"] == uid and item["name"] == "Kg" for item in listed)

    # Kiểm tra trùng lặp không phân biệt hoa thường / khoảng trắng.
    duplicate = client.post("/api/units", json={"name": "kg"})
    assert duplicate.status_code == 409

    renamed = client.put(f"/api/units/{uid}", json={"name": "Ki-lô-gam"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Ki-lô-gam"

    existing_name = next(item["name"] for item in listed if item["id"] != uid)
    assert client.put(
        f"/api/units/{uid}", json={"name": existing_name.upper()}
    ).status_code == 409

    blank = client.post("/api/units", json={"name": "   "})
    assert blank.status_code == 422

    assert client.delete(f"/api/units/{uid}").status_code == 204
    assert all(item["id"] != uid for item in client.get("/api/units").json())
    assert client.put(f"/api/units/{uid}", json={"name": "Không tồn tại"}).status_code == 404


def test_upload_and_export_docx(client):
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (400, 220), (11, 42, 74)).save(buffer, format="PNG")
    png = buffer.getvalue()
    upload = client.post("/api/uploads", files={"file": ("a.png", png, "image/png")})
    assert upload.status_code == 201, upload.text
    image_id = upload.json()["id"]

    payload = {
        "title": "Tờ trình kiểm thử",
        "full_name": "Nguyễn Ngọc Thảo Vy",
        "position": "Chuyên viên Marketing",
        "department": "Marketing",
        "document_number": "01/TTr-MKT",
        "document_date": "03/10/2026",
        "reference": "Kiểm thử xuất file",
        "content": "Nội dung đệ trình dài\nnhiều dòng để kiểm tra tự động xuống trang.",
        "requests": [
            {"text": "Xe di chuyển 14.000.000 VND", "image_id": image_id},
            {"text": "Nước uống 750.000 VND", "image_id": None},
        ],
        "reason": "Lý do đề nghị kiểm thử",
        "reason_image_id": image_id,
    }
    created = client.post("/api/submissions", json=payload)
    assert created.status_code == 201, created.text
    sid = created.json()["id"]
    assert len(created.json()["requests"]) == 2

    exported = client.get(f"/api/submissions/{sid}/docx")
    assert exported.status_code == 200
    assert exported.content[:2] == b"PK"

    duplicated = client.post(f"/api/submissions/{sid}/duplicate")
    assert duplicated.status_code == 201

    assert client.delete(f"/api/submissions/{sid}").status_code == 204
    assert client.delete(f"/api/submissions/{duplicated.json()['id']}").status_code == 204


def _sample_png():
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (120, 80), (11, 42, 74)).save(buffer, format="PNG")
    return buffer.getvalue()


def _upload(client):
    response = client.post(
        "/api/uploads", files={"file": ("xoa-anh.png", _sample_png(), "image/png")}
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_delete_unreferenced_upload(client):
    image = _upload(client)
    deleted = client.delete(f"/api/uploads/{image['id']}")
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] is True
    assert client.get(f"/api/uploads/id/{image['id']}").status_code == 404
    assert client.get(image["url"]).status_code == 404


def test_image_kept_while_referenced_then_cleaned_on_update(client):
    image = _upload(client)
    payload = {
        "title": "Tờ trình có ảnh",
        "content": "Nội dung",
        "requests": [{"text": "Đề nghị 1", "image_id": image["id"]}],
        "reason": "Lý do",
        "reason_image_id": image["id"],
    }
    created = client.post("/api/submissions", json=payload)
    assert created.status_code == 201
    sid = created.json()["id"]

    kept = client.delete(f"/api/uploads/{image['id']}")
    assert kept.status_code == 200
    assert kept.json()["deleted"] is False
    assert client.get(image["url"]).status_code == 200

    updated = client.put(
        f"/api/submissions/{sid}",
        json={**payload, "requests": [{"text": "Đề nghị 1", "image_id": None}], "reason_image_id": None},
    )
    assert updated.status_code == 200
    assert client.get(f"/api/uploads/id/{image['id']}").status_code == 404

    assert client.delete(f"/api/submissions/{sid}").status_code == 204


def test_webp_upload_exports_docx(client):
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (300, 180), (0, 96, 169)).save(buffer, format="WEBP")
    upload = client.post(
        "/api/uploads", files={"file": ("anh.webp", buffer.getvalue(), "image/webp")}
    )
    assert upload.status_code == 201, upload.text
    image = upload.json()
    assert image["url"].endswith((".png", ".jpg"))

    created = client.post(
        "/api/submissions",
        json={
            "title": "Tờ trình ảnh WebP",
            "content": "Nội dung",
            "requests": [{"text": "Đề nghị", "image_id": image["id"]}],
        },
    )
    assert created.status_code == 201
    sid = created.json()["id"]

    exported = client.get(f"/api/submissions/{sid}/docx")
    assert exported.status_code == 200, exported.text

    assert client.delete(f"/api/submissions/{sid}").status_code == 204


def test_delete_submission_cleans_images(client):
    image = _upload(client)
    created = client.post(
        "/api/submissions",
        json={
            "title": "Tờ trình xóa ảnh",
            "content": "Nội dung",
            "requests": [{"text": "Đề nghị", "image_id": image["id"]}],
        },
    )
    assert created.status_code == 201
    sid = created.json()["id"]
    assert client.delete(f"/api/submissions/{sid}").status_code == 204
    assert client.get(f"/api/uploads/id/{image['id']}").status_code == 404


def test_docx_uses_original_template_without_extra_sections(client):
    import io
    import zipfile

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (240, 140), (0, 96, 169)).save(buffer, format="PNG")
    image = client.post(
        "/api/uploads", files={"file": ("mau.png", buffer.getvalue(), "image/png")}
    ).json()

    created = client.post(
        "/api/submissions",
        json={
            "title": "Kiểm tra template",
            "full_name": "Trần Thị Bình",
            "position": "Trưởng phòng",
            "department": "Hành chính",
            "document_number": "25/TTr-HC",
            "document_date": "24/11/2026",
            "reference": "Đề nghị tổ chức sự kiện",
            "content": "Nội dung thứ nhất.\nNội dung thứ hai.",
            "requests": [
                {"text": "Thuê hội trường", "image_id": image["id"]},
                {"text": "In ấn tài liệu", "image_id": None},
            ],
            "reason": "Lý do thứ nhất.\nLý do thứ hai.",
            "reason_image_id": image["id"],
        },
    )
    assert created.status_code == 201
    sid = created.json()["id"]

    exported = client.get(f"/api/submissions/{sid}/docx")
    assert exported.status_code == 200
    archive = zipfile.ZipFile(io.BytesIO(exported.content))
    document_xml = archive.read("word/document.xml").decode("utf-8")
    header_xml = archive.read("word/header1.xml").decode("utf-8")

    assert "Người đề xuất" not in document_xml
    assert "Phê duyệt / Approval" not in document_xml
    assert "Trần Thị Bình" in document_xml
    assert "25/TTr-HC" in document_xml
    assert "Thuê hội trường" in document_xml
    assert "Lý do thứ hai." in document_xml
    # Header/footer của file mẫu được giữ nguyên.
    assert "HCM-FM45Rev01" in header_xml
    assert "word/footer1.xml" in archive.namelist()

    assert client.delete(f"/api/submissions/{sid}").status_code == 204
