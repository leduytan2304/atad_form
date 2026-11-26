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
    ws["F2"] = "KẸP BÚT"

    for col, color in (("B", (255, 0, 0)), ("C", (0, 0, 255))):
        image = XLImage(io.BytesIO(_png(color)))
        image.anchor = f"{col}2"
        ws.add_image(image)

    ws["A3"] = "LÔ HÀNG MỚI"
    ws["B3"] = 5
    ws["C3"] = 0
    ws["D3"] = 50
    ws["E3"] = 5
    ws["F3"] = -5

    ws["A4"] = "VP HCM"
    ws["B4"] = 2.5
    ws["C4"] = 3
    ws["D4"] = 0
    ws["E4"] = ""
    ws["F4"] = 3

    ws["A5"] = "ISO"
    ws["C5"] = -4
    ws["F5"] = 0

    ws["A6"] = "TỔNG CÒN LẠI"
    ws["B6"] = 7.5
    ws["C6"] = 3
    ws["D6"] = 0   # DÙ CÁN ĐỨNG: tổng = 0 -> vẫn hiển thị nhưng không chọn được
    ws["E6"] = ""  # USB: tổng trống -> fallback qua các dòng > 0
    ws["F6"] = -2  # KẸP BÚT: tổng âm -> vẫn hiển thị nhưng không chọn được

    # Dòng không có tên văn phòng: bỏ qua
    ws["B7"] = 999

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def _sample_csv() -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["BẢNG THÔNG TIN VẬT PHẨM 2026", "", "", "", "", ""])
    writer.writerow(["", "TÚI KRAFT", "BÚT CHÌ", "DÙ CÁN ĐỨNG", "USB", "KẸP BÚT"])
    writer.writerow(["LÔ HÀNG MỚI", 5, 0, 50, 5, -5])
    writer.writerow(["VP HCM", 2.5, 3, 0, "", 3])
    writer.writerow(["ISO", "", -4, "", "", 0])
    writer.writerow(["TỔNG CÒN LẠI", 7.5, 3, 0, "", -2])
    writer.writerow(["", 999, "", "", "", ""])
    return buffer.getvalue().encode("utf-8")


def _center_rgb(data: bytes):
    image = Image.open(io.BytesIO(data)).convert("RGB")
    return image.getpixel((image.width // 2, image.height // 2))


def test_parse_groups_by_product_one_row_per_product():
    """Mỗi sản phẩm chỉ 1 dòng: số lượng = TỔNG CÒN LẠI, văn phòng trống."""
    data = stock_sheet.parse_workbook(_sample_workbook())

    assert data.sheet_name == "Tháng 5"
    assert [p.product for p in data.products] == [
        "TÚI KRAFT",
        "BÚT CHÌ",
        "DÙ CÁN ĐỨNG",
        "USB",
        "KẸP BÚT",
    ]

    kraft, pencil, out_of_stock, usb, negative = data.products

    # 1 dòng mỗi sản phẩm
    assert len(kraft.locations) == 1
    assert kraft.locations[0] == stock_sheet.StockLocation(office="", quantity=7.5)
    assert kraft.image is not None
    assert _center_rgb(kraft.image) == (255, 0, 0)

    assert len(pencil.locations) == 1
    assert pencil.locations[0] == stock_sheet.StockLocation(office="", quantity=3.0)
    assert pencil.image is not None
    assert _center_rgb(pencil.image) == (0, 0, 255)

    # Tổng trống: fallback qua các dòng > 0 (USB có 5 ở LÔ HÀNG MỚI)
    assert len(usb.locations) == 1
    assert usb.locations[0] == stock_sheet.StockLocation(office="", quantity=5.0)
    assert usb.image is None

    # Tổng bằng 0 và tổng âm vẫn phải được giữ lại để hiển thị.
    assert out_of_stock.locations == [stock_sheet.StockLocation(office="", quantity=0.0)]
    assert negative.locations == [stock_sheet.StockLocation(office="", quantity=-2.0)]


def test_parse_csv_groups_by_product_one_row_per_product():
    data = stock_sheet.parse_csv(_sample_csv(), "Tháng 5")

    assert [p.product for p in data.products] == [
        "TÚI KRAFT",
        "BÚT CHÌ",
        "DÙ CÁN ĐỨNG",
        "USB",
        "KẸP BÚT",
    ]
    assert len(data.products[0].locations) == 1
    assert data.products[0].locations[0] == stock_sheet.StockLocation(office="", quantity=7.5)
    assert len(data.products[3].locations) == 1
    assert data.products[3].locations[0] == stock_sheet.StockLocation(office="", quantity=5.0)
    assert data.products[2].locations[0].quantity == 0
    assert data.products[4].locations[0].quantity == -2


def test_zero_and_negative_totals_are_kept():
    """Sản phẩm tồn kho bằng 0 hoặc âm vẫn hiển thị (không bị loại bỏ)."""
    workbook = stock_sheet.parse_workbook(_sample_workbook())
    csv_data = stock_sheet.parse_csv(_sample_csv(), "Tháng 5")

    for data in (workbook, csv_data):
        by_name = {p.product: p for p in data.products}
        assert by_name["DÙ CÁN ĐỨNG"].locations[0].quantity == 0
        assert by_name["KẸP BÚT"].locations[0].quantity == -2


def test_product_without_total_row_sums_all_values():
    """Tổng trống: cộng toàn bộ giá trị trong cột, kể cả âm, để có tổng chính xác."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws["B2"] = "SẢN PHẨM ÂM"
    ws["A3"] = "VP HCM"
    ws["B3"] = -3
    ws["A4"] = "VP HÀ NỘI"
    ws["B4"] = 1
    buffer = io.BytesIO()
    wb.save(buffer)

    data = stock_sheet.parse_workbook(buffer.getvalue())

    assert [p.product for p in data.products] == ["SẢN PHẨM ÂM"]
    assert data.products[0].locations == [stock_sheet.StockLocation(office="", quantity=-2.0)]


def test_product_columns_stop_at_first_empty_cell():
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
    assert [p.product for p in data.products] == ["SẢN PHẨM A"]


def test_google_sheet_urls_keep_selected_tab_from_query():
    url = "https://docs.google.com/spreadsheets/d/ABC-123_x/edit?gid=1743768872#gid=1743768872"
    assert stock_sheet.google_sheet_export_url(url) == (
        "https://docs.google.com/spreadsheets/d/ABC-123_x/export?format=xlsx&gid=1743768872"
    )
    assert stock_sheet.google_sheet_csv_url(url) == (
        "https://docs.google.com/spreadsheets/d/ABC-123_x/export?format=csv&gid=1743768872"
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


def test_stock_endpoint_groups_by_product(client, monkeypatch):
    sample = stock_sheet.parse_workbook(_sample_workbook())
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
    assert payload["product_count"] == 5
    assert payload["images_ready"] is False
    assert len(payload["rows"]) == 5  # 1 dòng mỗi sản phẩm, kể cả hết hàng / tồn âm

    assert payload["rows"][0] == {
        "product": "TÚI KRAFT",
        "image_url": None,
        "office": "",
        "quantity": 7.5,
    }
    assert payload["rows"][2]["quantity"] == 0
    assert payload["rows"][4]["quantity"] == -2


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
