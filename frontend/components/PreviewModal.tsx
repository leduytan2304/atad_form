"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { paginateDocx } from "@/lib/docxPagination";
import { ArrowLeftIcon, CloseIcon, DownloadIcon, EyeIcon } from "./Icons";

type Props = {
  open: boolean;
  submissionId: number | null;
  title: string;
  onClose: () => void;
  notify: (message: string, kind?: "ok" | "error") => void;
};

export default function PreviewModal({ open, submissionId, title, onClose, notify }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || !submissionId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    if (containerRef.current) containerRef.current.innerHTML = "";

    (async () => {
      try {
        const blob = await api.submissions.docxBlob(submissionId);
        if (cancelled || !containerRef.current) return;
        const { renderAsync } = await import("docx-preview");
        await renderAsync(blob, containerRef.current, undefined, {
          className: "docx",
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          renderHeaders: true,
          renderFooters: true,
          useBase64URL: true,
          ignoreLastRenderedPageBreak: false,
        });
        // Chờ font tải xong rồi tự phân trang giống Word (docx-preview không làm việc này).
        await document.fonts?.ready;
        if (cancelled || !containerRef.current) return;
        paginateDocx(containerRef.current);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Không xem trước được tài liệu";
          setError(message);
          notify(message, "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, submissionId, notify, attempt]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Xem trước tờ trình">
      <div className="modal modal-wide">
        <div className="modal-head">
          <div>
            <h2>Xem trước tờ trình</h2>
            <p>{title || "Tờ trình"} · File DOCX theo biểu mẫu HCM-FM45</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng">
            <CloseIcon />
          </button>
        </div>

        <div className="preview-toolbar">
          <EyeIcon size={15} />
          <span>Bản xem trước bám theo bố cục file Word. Tải về để mở và chỉnh sửa bằng Word.</span>
        </div>

        <div className="modal-body no-pad">
          <div className="docx-scroll">
            {loading && (
              <div className="preview-loading">
                <div className="spinner" />
                Đang dựng bản xem trước...
              </div>
            )}
            {error && !loading && (
              <div className="empty" style={{ margin: 20 }}>
                <strong>Không hiển thị được bản xem trước</strong>
                <p style={{ margin: "4px 0 12px" }}>{error}</p>
                <button className="btn btn-sm" onClick={() => setAttempt((value) => value + 1)}>
                  Thử lại
                </button>
              </div>
            )}
            <div ref={containerRef} />
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            <ArrowLeftIcon /> Quay lại chỉnh sửa
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Đóng
          </button>
          {submissionId && (
            <a
              className="btn btn-primary"
              href={api.submissions.docxUrl(submissionId, true)}
              download
              onClick={() => notify("Đang tải file DOCX...")}
            >
              <DownloadIcon /> Tải file DOCX
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
