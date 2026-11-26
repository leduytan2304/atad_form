import mimetypes
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..config import STOCK_SHEET_URL
from ..schemas import StockRead, StockRow
from ..services import stock_sheet

router = APIRouter(prefix="/api/stock", tags=["stock"])


@router.get("", response_model=StockRead)
def get_stock(url: str | None = None) -> StockRead:
    source = (url or STOCK_SHEET_URL).strip()
    try:
        stock_sheet.google_sheet_csv_url(source)
    except stock_sheet.StockSheetError as exc:
        raise HTTPException(400, str(exc)) from exc

    # Kích hoạt làm mới ảnh ở nền trước, rồi tải CSV nhẹ song song.
    images = stock_sheet.get_images(source)
    try:
        data = stock_sheet.load_data(source)
    except stock_sheet.StockSheetError as exc:
        raise HTTPException(502, str(exc)) from exc

    rows: list[StockRow] = []
    for product in data.products:
        image_url = images.images.get(stock_sheet.normalize_product(product.product))
        for location in product.locations:
            rows.append(
                StockRow(
                    product=product.product,
                    image_url=image_url,
                    office=location.office,
                    quantity=location.quantity,
                )
            )

    stock_sheet.prune_cache()

    return StockRead(
        rows=rows,
        sheet_name=images.sheet_name or data.sheet_name,
        source_url=source,
        fetched_at=datetime.now(timezone.utc),
        product_count=len(data.products),
        images_ready=images.ready,
    )


@router.get("/images/{digest}/{filename}")
def get_stock_image(digest: str, filename: str) -> FileResponse:
    path = stock_sheet.image_path(digest, filename)
    if path is None:
        raise HTTPException(404, "Không tìm thấy ảnh vật phẩm")
    extension = filename.rsplit(".", 1)[-1].lower()
    media_type = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "gif": "image/gif",
    }.get(extension) or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
