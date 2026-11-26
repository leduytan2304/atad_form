"use client";

import { ArrowLeftIcon, EyeIcon } from "@/components/Icons";
import StockImage from "@/components/StockImage";
import UnitManager from "@/components/UnitManager";
import type { Unit } from "@/lib/api";
import type { ToTrinhDraft, ToTrinhItem } from "@/lib/toTrinh";

type Props = {
  draft: ToTrinhDraft;
  units: Unit[];
  unitsLoading: boolean;
  unitsError: string;
  issues: string[];
  onChange: (patch: Partial<Pick<ToTrinhDraft, "group" | "time" | "place">>) => void;
  onItemChange: (key: string, patch: Partial<ToTrinhItem>) => void;
  onPreview: () => void;
  onBack: () => void;
  onCreateUnit: (name: string) => Promise<void>;
  onUpdateUnit: (id: number, name: string) => Promise<void>;
  onDeleteUnit: (id: number) => Promise<void>;
};

export default function ToTrinhEditor({
  draft,
  units,
  unitsLoading,
  unitsError,
  issues,
  onChange,
  onItemChange,
  onPreview,
  onBack,
  onCreateUnit,
  onUpdateUnit,
  onDeleteUnit,
}: Props) {
  return (
    <div className="totrinh-editor">
      <section className="section">
        <div className="section-head">
          <div className="section-title">
            <span className="section-no">01</span>
            <div>
              <h2>Thông tin chung</h2>
              <small>Thông tin đoàn, thời gian và địa điểm sẽ hiển thị trong tờ trình.</small>
            </div>
          </div>
        </div>
        <div className="section-body">
          <div className="totrinh-info-grid">
            <label className="field" htmlFor="totrinh-group">
              <span>Thông tin đoàn</span>
              <input
                id="totrinh-group"
                className="input"
                value={draft.group}
                onChange={(event) => onChange({ group: event.target.value })}
                placeholder="Ví dụ: Đoàn sinh viên Đại học Bách Khoa"
                maxLength={300}
              />
            </label>
            <label className="field" htmlFor="totrinh-time">
              <span>Thời gian</span>
              <input
                id="totrinh-time"
                className="input"
                value={draft.time}
                onChange={(event) => onChange({ time: event.target.value })}
                placeholder="Ví dụ: 08:00 – 17:00, 27/11/2026"
                maxLength={200}
              />
            </label>
            <label className="field" htmlFor="totrinh-place">
              <span>Địa điểm</span>
              <input
                id="totrinh-place"
                className="input"
                value={draft.place}
                onChange={(event) => onChange({ place: event.target.value })}
                placeholder="Ví dụ: Nhà máy ATAD, Khu công nghiệp Long An"
                maxLength={300}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div className="section-title">
            <span className="section-no">02</span>
            <div>
              <h2>Danh sách quà tặng</h2>
              <small>{draft.items.length} sản phẩm đã chọn để lập tờ trình.</small>
            </div>
          </div>
        </div>

        {issues.length > 0 ? (
          <div className="totrinh-issues" role="alert">
            <strong>Vui lòng kiểm tra lại:</strong>
            <ul>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="totrinh-table-wrap">
          <table className="totrinh-table">
            <caption className="sr-only">
              Danh sách quà tặng cần lập trong tờ trình
            </caption>
            <thead>
              <tr>
                <th scope="col" className="totrinh-col-no">
                  No
                </th>
                <th scope="col">Quà Tặng</th>
                <th scope="col" className="totrinh-col-image">
                  Hình Quà
                </th>
                <th scope="col" className="totrinh-col-unit">
                  Đơn vị tính
                </th>
                <th scope="col" className="totrinh-col-qty">
                  Số Lượng
                </th>
              </tr>
            </thead>
            <tbody>
              {draft.items.map((item, index) => (
                <tr key={item.key}>
                  <td className="totrinh-no">{index + 1}</td>
                  <td>
                    <span className="totrinh-product">{item.product}</span>
                  </td>
                  <td>
                    <StockImage path={item.imageUrl} alt={`Hình ảnh ${item.product}`} />
                  </td>
                  <td>
                    <select
                      className="select unit-select"
                      value={item.unitId ?? ""}
                      onChange={(event) =>
                        onItemChange(item.key, {
                          unitId: event.target.value ? Number(event.target.value) : null,
                        })
                      }
                      aria-label={`Đơn vị tính cho ${item.product}`}
                    >
                      <option value="">Chọn đơn vị</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="input totrinh-qty-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={item.quantity}
                      onChange={(event) =>
                        onItemChange(item.key, {
                          quantity: event.target.value.replace(/[^\d]/g, ""),
                        })
                      }
                      placeholder="Nhập số lượng"
                      aria-label={`Số lượng cho ${item.product}`}
                    />
                  </td>
                </tr>
              ))}
              {draft.items.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="stock-empty">
                      <strong>Chưa có sản phẩm nào được chọn</strong>
                      <span>Quay lại danh sách để chọn sản phẩm còn tồn kho.</span>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="stock-footnote">
          Số lượng và đơn vị tính dùng để lập tờ trình. Thao tác này không trừ tồn kho
          và không thực hiện xuất kho.
        </p>
      </section>

      <UnitManager
        units={units}
        loading={unitsLoading}
        error={unitsError}
        onCreate={onCreateUnit}
        onUpdate={onUpdateUnit}
        onDelete={onDeleteUnit}
      />

      <div className="totrinh-actions">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          <ArrowLeftIcon size={15} />
          Quay lại chọn sản phẩm
        </button>
        <button type="button" className="btn btn-primary" onClick={onPreview}>
          <EyeIcon size={16} />
          Xem trước tờ trình
        </button>
      </div>
    </div>
  );
}
