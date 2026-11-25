"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PreviewModal from "@/components/PreviewModal";
import {
  CopyIcon,
  DocIcon,
  DownloadIcon,
  EditIcon,
  EyeIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/Icons";
import { api, type Submission } from "@/lib/api";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "error" } | null>(null);

  const notify = useCallback((message: string, kind: "ok" | "error" = "ok") => {
    setToast({ message, kind });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.submissions.list());
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không tải được lịch sử", "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(timer);
  }, [toast]);

  async function duplicate(item: Submission) {
    try {
      await api.submissions.duplicate(item.id);
      notify("Đã tạo bản sao tờ trình");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không tạo được bản sao", "error");
    }
  }

  async function remove(item: Submission) {
    if (!confirm(`Xóa tờ trình "${item.title}"? Thao tác này không thể hoàn tác.`)) return;
    try {
      await api.submissions.remove(item.id);
      notify("Đã xóa tờ trình");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không xóa được tờ trình", "error");
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="kicker">Lưu trữ nội bộ</div>
          <h1>Lịch sử tờ trình</h1>
          <p>Xem lại, chỉnh sửa, nhân bản hoặc tải lại file DOCX của các tờ trình đã tạo.</p>
        </div>
        <div className="head-actions">
          <Link href="/" className="btn btn-primary">
            <PlusIcon /> Tạo tờ trình mới
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="empty">Đang tải lịch sử...</div>
      ) : items.length === 0 ? (
        <div className="empty">
          <strong>Chưa có tờ trình nào</strong>
          Tờ trình được lưu khi bạn bấm &quot;Lưu nháp&quot; hoặc &quot;Xem trước&quot;.
        </div>
      ) : (
        <div className="history-list">
          {items.map((item) => (
            <article className="history-item" key={item.id}>
              <div>
                <h3>{item.title || "Tờ trình"}</h3>
                <div className="history-meta">
                  <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
                    <DocIcon size={14} /> {item.full_name || "Chưa có họ tên"}
                  </span>
                  {item.department && <span>{item.department}</span>}
                  {item.document_number && <span>Số: {item.document_number}</span>}
                  <span>Cập nhật: {formatDate(item.updated_at)}</span>
                </div>
              </div>
              <div className="history-actions">
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setPreviewId(item.id);
                    setPreviewTitle(item.title);
                  }}
                >
                  <EyeIcon size={14} /> Xem
                </button>
                <Link className="btn btn-sm" href={`/?edit=${item.id}`}>
                  <EditIcon size={14} /> Sửa
                </Link>
                <button className="btn btn-sm" onClick={() => duplicate(item)}>
                  <CopyIcon size={14} /> Nhân bản
                </button>
                <a
                  className="btn btn-sm"
                  href={api.submissions.docxUrl(item.id, true)}
                  download
                  onClick={() => notify("Đang tải file DOCX...")}
                >
                  <DownloadIcon size={14} /> Tải DOCX
                </a>
                <button className="btn btn-sm btn-danger" onClick={() => remove(item)}>
                  <TrashIcon size={14} /> Xóa
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <PreviewModal
        open={previewId !== null}
        submissionId={previewId}
        title={previewTitle}
        onClose={() => setPreviewId(null)}
        notify={notify}
      />

      {toast && <div className={`toast${toast.kind === "error" ? " error" : ""}`}>{toast.message}</div>}
    </div>
  );
}
