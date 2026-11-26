"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  DocIcon,
  RefreshIcon,
  SearchIcon,
} from "@/components/Icons";
import StockImage from "@/components/StockImage";
import ToTrinhEditor from "@/components/ToTrinhEditor";
import ToTrinhPreview from "@/components/ToTrinhPreview";
import { api, type StockData, type StockRow, type Unit } from "@/lib/api";
import {
  emptyDraft,
  validateDraft,
  type ToTrinhDraft,
  type ToTrinhItem,
} from "@/lib/toTrinh";

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const quantityFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

type Mode = "select" | "compose" | "preview";

type StockProduct = StockRow & { key: string };

const productKey = (row: StockRow, index: number) => `${row.product}#${index}`;

function formatFetchedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function StockLookup() {
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<Mode>("select");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<ToTrinhDraft>(emptyDraft);
  const [issues, setIssues] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState("");

  const started = useRef(false);
  const retryCount = useRef(0);

  const load = useCallback(async (url = "", silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      const payload = await api.stock.list(url);
      setData(payload);
      setSource(payload.source_url);

      // Chỉ giữ lựa chọn còn tồn tại và còn hàng sau khi dữ liệu được làm mới.
      const selectable = new Set<string>();
      payload.rows.forEach((row, index) => {
        if (row.quantity > 0) selectable.add(productKey(row, index));
      });
      setSelectedKeys((previous) => {
        const next = new Set([...previous].filter((key) => selectable.has(key)));
        return next.size === previous.size ? previous : next;
      });
      setDraft((previous) => {
        const items = previous.items.filter((item) => selectable.has(item.key));
        return items.length === previous.items.length
          ? previous
          : { ...previous, items };
      });
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Không tải được dữ liệu vật phẩm.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadNow = useCallback(
    (url = "") => {
      retryCount.current = 0;
      void load(url);
    },
    [load],
  );

  const loadUnits = useCallback(async () => {
    setUnitsLoading(true);
    try {
      setUnits(await api.units.list());
      setUnitsError("");
    } catch (err) {
      setUnitsError(
        err instanceof Error ? err.message : "Không tải được danh sách đơn vị tính.",
      );
    } finally {
      setUnitsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadNow();
    void loadUnits();
  }, [loadNow, loadUnits]);

  // Ảnh được làm mới ở nền (file Excel nặng); tự thử lại vài lần để ảnh xuất hiện
  // mà không chặn lần tải dữ liệu đầu tiên.
  useEffect(() => {
    if (!data || data.images_ready) {
      if (data?.images_ready) retryCount.current = 0;
      return;
    }
    if (retryCount.current >= 5) return;
    const timer = window.setTimeout(() => {
      retryCount.current += 1;
      void load(data.source_url, true);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [data, load]);

  const products = useMemo<StockProduct[]>(
    () =>
      (data?.rows ?? []).map((row, index) => ({
        ...row,
        key: productKey(row, index),
      })),
    [data],
  );

  const filtered = useMemo(() => {
    const needle = fold(query.trim());
    return products.filter((row) => !needle || fold(row.product).includes(needle));
  }, [products, query]);

  const selectedProducts = useMemo(
    () =>
      products.filter(
        (product) => product.quantity > 0 && selectedKeys.has(product.key),
      ),
    [products, selectedKeys],
  );

  const productCount = useMemo(
    () => new Set(filtered.map((row) => row.product)).size,
    [filtered],
  );

  const applySource = (event: React.FormEvent) => {
    event.preventDefault();
    const url = source.trim();
    if (!url || loading) return;
    setQuery("");
    setSelectedKeys(new Set());
    setDraft((previous) => ({ ...previous, items: [] }));
    setNotice("");
    setIssues([]);
    loadNow(url === data?.source_url ? "" : url);
  };

  const toggleProduct = (product: StockProduct) => {
    if (product.quantity <= 0) return;

    if (selectedKeys.has(product.key)) {
      setSelectedKeys((previous) => {
        const next = new Set(previous);
        next.delete(product.key);
        return next;
      });
      // Bỏ chọn ở danh sách thì sản phẩm phải biến mất khỏi tờ trình.
      setDraft((previous) => ({
        ...previous,
        items: previous.items.filter((item) => item.key !== product.key),
      }));
    } else {
      setSelectedKeys((previous) => new Set(previous).add(product.key));
    }
    setNotice("");
    setIssues([]);
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
    setDraft((previous) => ({ ...previous, items: [] }));
    setNotice("");
    setIssues([]);
  };

  const openComposer = () => {
    const chosen = products.filter(
      (product) => product.quantity > 0 && selectedKeys.has(product.key),
    );
    if (chosen.length === 0) {
      setNotice(
        "Vui lòng chọn ít nhất một sản phẩm còn tồn kho trước khi lập tờ trình.",
      );
      return;
    }
    setDraft((previous) => ({
      ...previous,
      items: chosen.map((product) => {
        const existing = previous.items.find((item) => item.key === product.key);
        return existing
          ? { ...existing, product: product.product, imageUrl: product.image_url }
          : {
              key: product.key,
              product: product.product,
              imageUrl: product.image_url,
              unitId: null,
              quantity: "",
            };
      }),
    }));
    setIssues([]);
    setNotice("");
    setMode("compose");
  };

  const updateDraft = (patch: Partial<Pick<ToTrinhDraft, "group" | "time" | "place">>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
  };

  const updateItem = (key: string, patch: Partial<ToTrinhItem>) => {
    setDraft((previous) => ({
      ...previous,
      items: previous.items.map((item) =>
        item.key === key ? { ...item, ...patch } : item,
      ),
    }));
  };

  const openPreview = () => {
    const stockByKey = new Map(products.map((product) => [product.key, product.quantity]));
    const found = validateDraft(draft, units, stockByKey);
    if (found.length > 0) {
      setIssues(found);
      return;
    }
    setIssues([]);
    setMode("preview");
  };

  const createUnit = async (name: string) => {
    const unit = await api.units.create(name);
    setUnits((previous) => [...previous, unit]);
    setUnitsError("");
  };

  const updateUnit = async (id: number, name: string) => {
    const unit = await api.units.update(id, name);
    setUnits((previous) => previous.map((item) => (item.id === id ? unit : item)));
  };

  const deleteUnit = async (id: number) => {
    await api.units.remove(id);
    setUnits((previous) => previous.filter((unit) => unit.id !== id));
    setDraft((previous) => ({
      ...previous,
      items: previous.items.map((item) =>
        item.unitId === id ? { ...item, unitId: null } : item,
      ),
    }));
  };

  const firstLoad = loading && !data;

  return (
    <div className="page stock-page">
      {mode === "select" ? (
        <header className="page-head">
          <div>
            <div className="kicker">Chức năng 2 · Tra cứu vật phẩm</div>
            <h1>Tồn kho vật phẩm</h1>
            <p>
              Đọc trực tiếp bảng tính Google Sheet mỗi lần mở trang. Hiển thị toàn bộ
              vật phẩm; chỉ vật phẩm còn tồn kho dương mới có thể chọn để lập tờ
              trình.
            </p>
          </div>
          <div className="head-actions">
            <button
              type="button"
              className="btn"
              onClick={() =>
                loadNow(data ? (source === data.source_url ? "" : source) : "")
              }
              disabled={loading}
            >
              <RefreshIcon size={16} />
              {loading ? "Đang đọc Google Sheet…" : "Tải lại dữ liệu"}
            </button>
            <button type="button" className="btn btn-primary" onClick={openComposer}>
              <DocIcon size={16} />
              Làm Tờ Trình
            </button>
          </div>
        </header>
      ) : (
        <header className="page-head">
          <div>
            <div className="kicker">Chức năng 2 · Lập tờ trình</div>
            <h1>{mode === "preview" ? "Xem trước tờ trình" : "Lập tờ trình"}</h1>
            <p>
              {mode === "preview"
                ? "Kiểm tra nội dung trước khi tải tờ trình xuống dưới dạng hình ảnh."
                : "Nhập thông tin chung, chọn đơn vị tính và số lượng cho từng món quà."}
            </p>
          </div>
          {mode === "compose" ? (
            <div className="head-actions">
              <button type="button" className="btn" onClick={() => setMode("select")}>
                <ArrowLeftIcon size={15} />
                Quay lại danh sách
              </button>
            </div>
          ) : null}
        </header>
      )}

      {mode === "select" ? (
        <>
          <section className="stock-source" aria-label="Nguồn dữ liệu">
            <form onSubmit={applySource}>
              <label className="field-label" htmlFor="stock-source-url">
                Link Google Sheet
              </label>
              <div className="stock-source-row">
                <input
                  id="stock-source-url"
                  className="input"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  spellCheck={false}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="btn"
                  disabled={
                    loading || !source.trim() || source.trim() === data?.source_url
                  }
                >
                  Áp dụng link
                </button>
              </div>
            </form>
            <p className="stock-meta">
              {data ? (
                <>
                  Tab <strong>{data.sheet_name}</strong> · Cập nhật{" "}
                  <strong>{formatFetchedAt(data.fetched_at)}</strong>
                  {!data.images_ready ? " · Đang tải ảnh…" : ""} · Chỉ đọc, không
                  chỉnh sửa file nguồn.
                </>
              ) : (
                "Dữ liệu được tải mới mỗi lần bấm tải lại, không lưu bản sao lâu dài."
              )}
            </p>
          </section>

          {error ? (
            <div className="stock-alert" role="alert">
              <div>
                <strong>Không tải được dữ liệu</strong>
                <p>{error}</p>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => loadNow(data?.source_url ?? "")}
                disabled={loading}
              >
                Thử lại
              </button>
            </div>
          ) : null}

          <section
            className="section stock-section"
            aria-busy={loading}
            hidden={Boolean(error) && !data}
          >
            <div className="section-head">
              <div className="section-title">
                <span className="section-no">02</span>
                <div>
                  <h2>Vật phẩm &amp; tồn kho</h2>
                  <small>
                    {productCount} sản phẩm · {filtered.length} dòng · Đã chọn{" "}
                    {selectedProducts.length}
                  </small>
                </div>
              </div>
              <div className="stock-filters">
                <div className="stock-search">
                  <SearchIcon size={15} />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm sản phẩm…"
                    aria-label="Tìm sản phẩm"
                  />
                </div>
              </div>
            </div>

            <div className="stock-selection">
              <span>
                <strong>{selectedProducts.length}</strong> sản phẩm được chọn để lập
                tờ trình.
                {selectedProducts.length === 0
                  ? " Chọn sản phẩm còn tồn kho ở cột bên trái."
                  : ""}
              </span>
              {selectedProducts.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={clearSelection}
                >
                  Bỏ chọn tất cả
                </button>
              ) : null}
            </div>

            {notice ? (
              <p className="totrinh-notice" role="alert">
                {notice}
              </p>
            ) : null}

            <div className="stock-table-wrap">
              <table className="stock-table">
                <caption className="sr-only">
                  Danh sách vật phẩm và tồn kho
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="stock-pick-head">
                      <span className="sr-only">Chọn</span>
                    </th>
                    <th scope="col">Tên sản phẩm</th>
                    <th scope="col">Hình ảnh</th>
                    <th scope="col">Tên văn phòng</th>
                    <th scope="col" className="stock-qty-head">
                      Số lượng
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {firstLoad
                    ? Array.from({ length: 6 }).map((_, index) => (
                        <tr key={`skeleton-${index}`} className="stock-skeleton">
                          <td>
                            <span />
                          </td>
                          <td>
                            <span />
                          </td>
                          <td>
                            <span />
                          </td>
                          <td>
                            <span />
                          </td>
                          <td>
                            <span />
                          </td>
                        </tr>
                      ))
                    : filtered.map((row) => {
                        const selectable = row.quantity > 0;
                        const selected = selectedKeys.has(row.key);
                        const className = [
                          !selectable ? "is-unavailable" : "",
                          selected ? "is-selected" : "",
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <tr
                            key={row.key}
                            className={className || undefined}
                            onClick={() => toggleProduct(row)}
                          >
                            <td className="stock-pick">
                              <input
                                type="checkbox"
                                checked={selected}
                                disabled={!selectable}
                                onChange={() => toggleProduct(row)}
                                onClick={(event) => event.stopPropagation()}
                                aria-label={`Chọn ${row.product}`}
                              />
                            </td>
                            <td>
                              <span className="stock-product">{row.product}</span>
                              {!selectable ? (
                                <span
                                  className={`stock-badge${
                                    row.quantity < 0 ? " is-negative" : ""
                                  }`}
                                >
                                  {row.quantity < 0 ? "Tồn âm" : "Hết hàng"}
                                </span>
                              ) : null}
                            </td>
                            <td>
                              <StockImage
                                path={row.image_url}
                                alt={`Hình ảnh ${row.product}`}
                              />
                            </td>
                            <td>
                              <span className="stock-office">{row.office || "—"}</span>
                            </td>
                            <td
                              className={`stock-qty${
                                row.quantity <= 0 ? " is-empty" : ""
                              }${row.quantity < 0 ? " is-negative" : ""}`}
                            >
                              {quantityFormat.format(row.quantity)}
                            </td>
                          </tr>
                        );
                      })}
                  {!firstLoad && filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="stock-empty">
                          <strong>
                            {query
                              ? "Không có vật phẩm phù hợp bộ lọc"
                              : "Chưa có dữ liệu vật phẩm"}
                          </strong>
                          <span>
                            {query
                              ? "Thử xóa từ khóa."
                              : "Dữ liệu sẽ xuất hiện khi Google Sheet có tên sản phẩm ở hàng 2."}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <p className="stock-footnote">
              Hiển thị tất cả sản phẩm, kể cả sản phẩm hết hàng hoặc tồn kho âm.
              Sản phẩm có tổng tồn kho bằng 0 hoặc nhỏ hơn 0 được làm tối nền và
              không thể chọn. Số lượng lấy từ cột <strong>TỔNG CÒN LẠI</strong> của
              Google Sheet.
            </p>
          </section>
        </>
      ) : null}

      {mode === "compose" ? (
        <ToTrinhEditor
          draft={draft}
          units={units}
          unitsLoading={unitsLoading}
          unitsError={unitsError}
          issues={issues}
          onChange={updateDraft}
          onItemChange={updateItem}
          onPreview={openPreview}
          onBack={() => setMode("select")}
          onCreateUnit={createUnit}
          onUpdateUnit={updateUnit}
          onDeleteUnit={deleteUnit}
        />
      ) : null}

      {mode === "preview" ? (
        <ToTrinhPreview
          draft={draft}
          units={units}
          onBack={() => setMode("compose")}
        />
      ) : null}
    </div>
  );
}
