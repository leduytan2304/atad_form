import csv
import io

import openpyxl
import pytest
from openpyxl.drawing.image import Image as XLImage
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.services import stock_sheet


def _png(color) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (40, 40), color).save(buffer, format="PNG")
    return buffer.getvalue()


def _sample_workbook() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Tháng 5"

    ws["A1"] = "BẢNG THÔNG TIN VẬT PHẨM 2026"
    ws["B2"] = "TÚI KRAFT"
    ws["C2"] = "BÚT CHÌ"
    ws["D2"] = "DÙ CÁN ĐỨNG"
    ws["E2"] = "USB"

    for col, color in (("B", (255, 0, 0)), ("C", (0, 0, 255))):
        image = XLImage(io.BytesIO(_png(color)))
        image.anchor = f"{col}2"
        ws.add_image(image)

    ws["A3"] = "LÔ HÀNG MỚI"
    ws["B3"] = 5
    ws["C3"] = 0
    ws["D3"] = 50
    ws["E3"] = 5

    ws["A4"] = "VP HCM"
    ws["B4"] = 2.5
    ws["C4"] = 3
    ws["D4"] = 0

    ws["A5"] = "ISO"
    ws["C5"] = -4

    ws["A6"] = "TỔNG CÒN LẠI"
    ws["B6"] = 7.5
    ws["C6"] = 3
    ws["D6"] = 0

    # Dòng không có tên văn phòng: phải bị bỏ qua dù có số lượng.
    ws["B7"] = 999

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def _sample_csv() -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["BẢNG THÔNG TIN VẬT PHẨM 2026", "", "", "", ""])
    writer.writerow(["", "TÚI KRAFT", "BÚT CHÌ", "DÙ CÁN ĐỨNG", "USB"])
    writer.writerow(["LÔ HÀNG MỚI", 5, 0, 50, 5])
    writer.writerow(["VP HCM", 2.5, 3, 0, ""])
    writer.writerow(["ISO", "", -4, "", ""])
    writer.writerow(["TỔNG CÒN LẠI", 7.5, 3, 0, ""])
    writer.writerow(["", 999, "", "", ""])
    return buffer.getvalue().encode("utf-8")


def _center_rgb(data: bytes):
    image = Image.open(io.BytesIO(data)).convert("RGB")
    return image.getpixel((image.width // 2, image.height // 2))


def test_parse_maps_images_filters_stock_and_uses_total_as_gate():
    data = stock_sheet.parse_workbook(_sample_workbook())

    assert data.sheet_name == "Tháng 5"
    assert [product.product for product in data.products] == ["TÚI KRAFT", "BÚT CHÌ", "USB"]

    kraft, pencil, usb = data.products

    assert [(loc.office, loc.quantity) for loc in kraft.locations] == [
        ("LÔ HÀNG MỚI", 5.0),
        ("VP HCM", 2.5),
    ]
    assert kraft.image is not None
    assert _center_rgb(kraft.image) == (255, 0, 0)

    assert [(loc.office, loc.quantity) for loc in pencil.locations] == [("VP HCM", 3.0)]
    assert pencil.image is not None
    assert _center_rgb(pencil.image) == (0, 0, 255)

    # Không có ô tổng: hiển thị theo các vị trí còn hàng.
    assert [(loc.office, loc.quantity) for loc in usb.locations] == [("LÔ HÀNG MỚI", 5.0)]
    assert usb.image is None


def test_parse_csv_filters_stock_and_uses_total_as_gate():
    data = stock_sheet.parse_csv(_sample_csv(), "Tháng 5")

    assert data.sheet_name == "Tháng 5"
    assert [product.product for product in data.products] == ["TÚI KRAFT", "BÚT CHÌ", "USB"]

    kraft, pencil, usb = data.products

    assert [(loc.office, loc.quantity) for loc in kraft.locations] == [
        ("LÔ HÀNG MỚI", 5.0),
        ("VP HCM", 2.5),
    ]
    assert [(loc.office, loc.quantity) for loc in pencil.locations] == [("VP HCM", 3.0)]
    # Không có ô tổng: hiển thị theo các vị trí còn hàng.
    assert [(loc.office, loc.quantity) for loc in usb.locations] == [("LÔ HÀNG MỚI", 5.0)]


def test_parse_stops_reading_products_at_first_empty_cell():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws["B2"] = "SẢN PHẨM A"
    ws["C2"] = None
    ws["D2"] = "KHÔNG PHẢI SẢN PHẨM"
    ws["A3"] = "VP HCM"
    ws["B3"] = 1
    ws["A4"] = "TỔNG CÒN LẠI"
    ws["B4"] = 1
    ws["D4"] = 1
    buffer = io.BytesIO()
    wb.save(buffer)

    data = stock_sheet.parse_workbook(buffer.getvalue())

    assert [product.product for product in data.products] == ["SẢN PHẨM A"]


def test_google_sheet_export_url_builds_xlsx_link():
    assert (
        stock_sheet.google_sheet_export_url(
            "https://docs.google.com/spreadsheets/d/ABC-123_x/edit?usp=sharing"
        )
        == "https://docs.google.com/spreadsheets/d/ABC-123_x/export?format=xlsx"
    )


def test_google_sheet_csv_url_builds_csv_link():
    assert (
        stock_sheet.google_sheet_csv_url(
            "https://docs.google.com/spreadsheets/d/ABC-123_x/edit?usp=sharing"
        )
        == "https://docs.google.com/spreadsheets/d/ABC-123_x/export?format=csv"
    )


def test_google_sheet_urls_keep_selected_tab_from_query():
    url = (
        "https://docs.google.com/spreadsheets/d/ABC-123_x/edit?gid=1743768872#gid=1743768872"
    )
    assert stock_sheet.google_sheet_export_url(url) == (
        "https://docs.google.com/spreadsheets/d/ABC-123_x/export?format=xlsx&gid=1743768872"
    )
    assert stock_sheet.google_sheet_csv_url(url) == (
        "https://docs.google.com/spreadsheets/d/ABC-123_x/export?format=csv&gid=1743768872"
    )


def test_google_sheet_urls_keep_selected_tab_from_fragment_only():
    url = "https://docs.google.com/spreadsheets/d/ABC-123_x/edit#gid=1743768872"
    assert stock_sheet.google_sheet_export_url(url) == (
        "https://docs.google.com/spreadsheets/d/ABC-123_x/export?format=xlsx&gid=1743768872"
    )


def test_google_sheet_export_url_rejects_other_hosts():
    with pytest.raises(stock_sheet.StockSheetError):
        stock_sheet.google_sheet_export_url("https://example.com/spreadsheets/d/ABC/edit")


def test_save_image_creates_webp_thumbnail(tmp_path, monkeypatch):
    monkeypatch.setattr(stock_sheet, "STOCK_DIR", tmp_path)
    buffer = io.BytesIO()
    Image.new("RGB", (1200, 800), (255, 0, 0)).save(buffer, format="PNG")

    url = stock_sheet.save_image("B", buffer.getvalue(), "png")

    assert url.endswith("/B.webp")
    digest, filename = url.rsplit("/", 2)[-2:]
    path = stock_sheet.image_path(digest, filename)
    assert path is not None
    with Image.open(path) as image:
        assert image.format == "WEBP"
        assert max(image.size) <= 320
        assert round(image.width / image.height, 2) == 1.5


def test_refresh_images_builds_manifest_keyed_by_product_name(tmp_path, monkeypatch):
    monkeypatch.setattr(stock_sheet, "STOCK_DIR", tmp_path)
    monkeypatch.setattr(stock_sheet, "_manifests", {})
    monkeypatch.setattr(stock_sheet, "_image_failures", {})
    monkeypatch.setattr(stock_sheet, "fetch_bytes", lambda _url: _sample_workbook())
    source = "https://docs.google.com/spreadsheets/d/TEST_SHEET/edit"

    stock_sheet.refresh_images(source)
    cache = stock_sheet.get_images(source)

    assert cache.ready is True
    assert cache.sheet_name == "Tháng 5"
    assert set(cache.images) == {"TÚI KRAFT", "BÚT CHÌ"}
    assert all(url.endswith(".webp") for url in cache.images.values())


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_stock_endpoint_uses_fast_csv_data_and_flags_images(client, monkeypatch):
    sample = stock_sheet.parse_csv(_sample_csv(), "Tháng 5")
    monkeypatch.setattr(stock_sheet, "load_data", lambda _url: sample)
    monkeypatch.setattr(
        stock_sheet,
        "get_images",
        lambda _url: stock_sheet.StockImages(images={}, ready=False),
    )

    response = client.get("/api/stock")
    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["sheet_name"] == "Tháng 5"
    assert payload["product_count"] == 3
    assert payload["images_ready"] is False
    assert len(payload["rows"]) == 4
    assert payload["rows"][0] == {
        "product": "TÚI KRAFT",
        "image_url": None,
        "office": "LÔ HÀNG MỚI",
        "quantity": 5.0,
    }


def test_stock_endpoint_rejects_non_google_url(client):
    response = client.get("/api/stock", params={"url": "https://example.com/x.xlsx"})
    assert response.status_code == 400


def test_image_endpoint_serves_webp(client, tmp_path, monkeypatch):
    monkeypatch.setattr(stock_sheet, "STOCK_DIR", tmp_path)
    url = stock_sheet.save_image("B", _png((255, 0, 0)), "png")

    response = client.get(url)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    assert response.content[:4] == b"RIFF"
