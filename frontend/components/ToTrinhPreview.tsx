"use client";

import { useState } from "react";
import { ArrowLeftIcon, DownloadIcon } from "@/components/Icons";
import StockImage from "@/components/StockImage";
import type { Unit } from "@/lib/api";
import { downloadToTrinhImage } from "@/lib/toTrinhExport";
import { unitName, type ToTrinhDraft } from "@/lib/toTrinh";

type Props = {
  draft: ToTrinhDraft;
  units: Unit[];
  onBack: () => void;
};

export default function ToTrinhPreview({ draft, units, onBack }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const download = async () => {
    setDownloading(true);
    setError("");
    setMessage("");
    try {
      const result = await downloadToTrinhImage(draft, units);
      setMessage(
        result.pages > 1
          ? `Đã tải ${result.pages} trang trong file ${result.filename}.`
          : `Đã tải file ${result.filename}.`,
      );
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Không tạo được file tờ trình.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="totrinh-preview">
      <div className="totrinh-preview-bar">
        <button type="button" className="btn" onClick={onBack} disabled={downloading}>
          <ArrowLeftIcon size={15} />
          Quay lại chỉnh sửa
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void download()}
          disabled={downloading}
        >
          <DownloadIcon size={16} />
          {downloading ? "Đang tạo file…" : "Tải tờ trình xuống"}
        </button>
      </div>

      {error ? (
        <div className="stock-alert" role="alert">
          <div>
            <strong>Không tạo được file</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="totrinh-success" role="status">
          {message}
        </div>
      ) : null}

      <article className="preview-sheet" aria-label="Bản xem trước tờ trình">
        <header className="preview-sheet-head">
          <h2>TỜ TRÌNH</h2>
          <p>Danh sách quà tặng</p>
        </header>

        <dl className="preview-info">
          <div>
            <dt>Thông tin đoàn:</dt>
            <dd>{draft.group.trim()}</dd>
          </div>
          <div>
            <dt>Thời gian:</dt>
            <dd>{draft.time.trim()}</dd>
          </div>
          <div>
            <dt>Địa điểm:</dt>
            <dd>{draft.place.trim()}</dd>
          </div>
        </dl>

        <h3 className="preview-section-title">Danh sách quà tặng</h3>

        <table className="preview-table">
          <caption className="sr-only">Quà tặng trong tờ trình</caption>
          <thead>
            <tr>
              <th scope="col">No</th>
              <th scope="col">Quà Tặng</th>
              <th scope="col">Hình Quà</th>
              <th scope="col">Đơn vị tính</th>
              <th scope="col">Số Lượng</th>
            </tr>
          </thead>
          <tbody>
            {draft.items.map((item, index) => (
              <tr key={item.key}>
                <td className="preview-no">{index + 1}</td>
                <td className="preview-product">{item.product}</td>
                <td>
                  <StockImage path={item.imageUrl} alt={`Hình ảnh ${item.product}`} />
                </td>
                <td>{unitName(units, item.unitId)}</td>
                <td className="preview-qty">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="preview-footnote">
          Tờ trình chỉ ghi nhận danh sách quà tặng. Không thực hiện xuất kho hoặc trừ
          tồn kho.
        </p>
      </article>
    </div>
  );
}
