"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, RefreshIcon, SearchIcon } from "@/components/Icons";
import { api, type StockData, type StockRow } from "@/lib/api";

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const quantityFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

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

function StockThumb({ row }: { row: StockRow }) {
  const [failed, setFailed] = useState(false);
  const src = api.stock.imageUrl(row.image_url);

  if (!src || failed) {
    return (
      <span className="stock-noimg">
        <ImageIcon size={16} />
        <span>Chưa có ảnh</span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="stock-thumb"
      src={src}
      alt={`Hình ảnh ${row.product}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function StockLookup() {
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [office, setOffice] = useState("");
  const [source, setSource] = useState("");
  const started = useRef(false);
  const retryCount = useRef(0);

  const load = useCallback(async (url = "", silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      const payload = await api.stock.list(url);
      setData(payload);
      setSource(payload.source_url);
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

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadNow();
  }, [loadNow]);

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

  const offices = useMemo(() => {
    const seen: string[] = [];
    for (const row of data?.rows ?? []) {
      if (!seen.includes(row.office)) seen.push(row.office);
    }
    return seen;
  }, [data]);

  const filtered = useMemo(() => {
    const needle = fold(query.trim());
    return (data?.rows ?? []).filter(
      (row) =>
        (!needle || fold(row.product).includes(needle)) &&
        (!office || row.office === office),
    );
  }, [data, query, office]);

  const productCount = useMemo(
    () => new Set(filtered.map((row) => row.product)).size,
    [filtered],
  );

  const applySource = (event: React.FormEvent) => {
    event.preventDefault();
    const url = source.trim();
    if (!url || loading) return;
    setOffice("");
    setQuery("");
    loadNow(url === data?.source_url ? "" : url);
  };

  const firstLoad = loading && !data;

  return (
    <div className="page stock-page">
      <header className="page-head">
        <div>
          <div className="kicker">Chức năng 2 · Tra cứu vật phẩm</div>
          <h1>Tồn kho vật phẩm</h1>
          <p>
            Đọc trực tiếp bảng tính Google Sheet mỗi lần mở trang. Chỉ hiển thị vật phẩm
            còn tồn kho dương, tách riêng theo từng văn phòng.
          </p>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => loadNow(data ? (source === data.source_url ? "" : source) : "")}
            disabled={loading}
          >
            <RefreshIcon size={16} />
            {loading ? "Đang đọc Google Sheet…" : "Tải lại dữ liệu"}
          </button>
        </div>
      </header>

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
              disabled={loading || !source.trim() || source.trim() === data?.source_url}
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
              {!data.images_ready ? " · Đang tải ảnh…" : ""} · Chỉ đọc, không chỉnh sửa
              file nguồn.
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
              <h2>Vật phẩm còn tồn kho</h2>
              <small>
                {productCount} sản phẩm · {filtered.length} dòng · {offices.length} văn
                phòng
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
            <select
              className="select"
              value={office}
              onChange={(event) => setOffice(event.target.value)}
              aria-label="Lọc theo văn phòng"
            >
              <option value="">Tất cả văn phòng</option>
              {offices.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="stock-table-wrap">
          <table className="stock-table">
            <caption className="sr-only">
              Danh sách vật phẩm còn tồn kho theo văn phòng
            </caption>
            <thead>
              <tr>
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
                    </tr>
                  ))
                : filtered.map((row, index) => {
                    const isGroupStart =
                      index === 0 || filtered[index - 1].product !== row.product;
                    return (
                      <tr
                        key={`${row.product}-${row.office}-${index}`}
                        className={isGroupStart && index > 0 ? "is-group-start" : undefined}
                      >
                        <td>
                          <span className="stock-product">{row.product}</span>
                        </td>
                        <td>
                          <StockThumb row={row} />
                        </td>
                        <td>
                          <span className="stock-office">{row.office}</span>
                        </td>
                        <td className="stock-qty">{quantityFormat.format(row.quantity)}</td>
                      </tr>
                    );
                  })}
              {!firstLoad && filtered.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="stock-empty">
                      <strong>
                        {query || office
                          ? "Không có vật phẩm phù hợp bộ lọc"
                          : "Chưa có vật phẩm nào còn tồn kho"}
                      </strong>
                      <span>
                        {query || office
                          ? "Thử xóa từ khóa hoặc chọn lại văn phòng."
                          : "Dữ liệu sẽ xuất hiện khi Google Sheet có số lượng lớn hơn 0."}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="stock-footnote">
          Chỉ hiển thị sản phẩm có <strong>TỔNG CÒN LẠI</strong> lớn hơn 0 và từng dòng
          có số lượng lớn hơn 0. Số lượng không được cộng gộp giữa các văn phòng.
        </p>
      </section>
    </div>
  );
}
