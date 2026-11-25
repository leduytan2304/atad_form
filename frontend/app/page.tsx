"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClipboardEvent } from "react";
import ImagePicker from "@/components/ImagePicker";
import PreviewModal from "@/components/PreviewModal";
import ProfileManager from "@/components/ProfileManager";
import TemplateLibrary from "@/components/TemplateLibrary";
import {
  DocIcon,
  DownloadIcon,
  EyeIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/Icons";
import { api, type ProfileSet, type RequestItem, type SubmissionInput } from "@/lib/api";
import { fromDateInputValue, toDateInputValue } from "@/lib/date";

type Row = { key: string; text: string; image_id: number | null };

let rowSequence = 0;

const rowKey = () => {
  rowSequence += 1;
  return `row-${rowSequence}`;
};

const newRow = (): Row => ({ key: rowKey(), text: "", image_id: null });

export default function HomePage() {
  const [profiles, setProfiles] = useState<ProfileSet[]>([]);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [reference, setReference] = useState("");
  const [content, setContent] = useState("");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [reason, setReason] = useState("");
  const [reasonImageId, setReasonImageId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "error" } | null>(null);

  const notify = useCallback((message: string, kind: "ok" | "error" = "ok") => {
    setToast({ message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(timer);
  }, [toast]);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === profileId) ?? null,
    [profiles, profileId],
  );

  const applyProfile = useCallback((profile: ProfileSet | null) => {
    if (!profile) {
      setProfileId(null);
      return;
    }
    setProfileId(profile.id);
    setNumber(profile.document_number);
    setDate(profile.document_date);
    setReference(profile.reference);
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const list = await api.profiles.list();
      setProfiles(list);
      setProfileId((current) => {
        if (current && list.some((item) => item.id === current)) return current;
        return list.find((item) => item.is_active)?.id ?? list[0]?.id ?? null;
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không tải được dữ liệu cố định", "error");
    }
  }, [notify]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    if (!profileId) return;
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;
    setNumber((value) => value || profile.document_number);
    setDate((value) => value || profile.document_date);
    setReference((value) => value || profile.reference);
  }, [profileId, profiles]);

  // Mở tờ trình cũ khi truy cập /?edit=ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = Number(params.get("edit"));
    if (!editId) return;
    (async () => {
      try {
        const item = await api.submissions.get(editId);
        setSubmissionId(item.id);
        setTitle(item.title);
        setProfileId(item.profile_id);
        setNumber(item.document_number);
        setDate(item.document_date);
        setReference(item.reference);
        setContent(item.content);
        setRows(
          item.requests.length
            ? item.requests.map((request) => ({
                key: rowKey(),
                text: request.text,
                image_id: request.image_id,
              }))
            : [newRow()],
        );
        setReason(item.reason);
        setReasonImageId(item.reason_image_id);
      } catch (error) {
        notify(error instanceof Error ? error.message : "Không mở được tờ trình", "error");
      }
    })();
  }, [notify]);

  async function pasteImage(
    event: ClipboardEvent<HTMLElement>,
    apply: (imageId: number) => void,
    onReplaced?: (oldImageId: number) => void,
  ) {
    const file = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .find((item): item is File => Boolean(item));
    if (!file) return;
    event.preventDefault();
    if (file.size > 10 * 1024 * 1024) {
      notify("Hình ảnh dán vào vượt quá 10MB", "error");
      return;
    }
    try {
      const uploaded = await api.uploads.create(file);
      apply(uploaded.id);
      onReplaced?.(uploaded.id);
      notify("Đã dán hình ảnh");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không dán được hình ảnh", "error");
    }
  }

  function pasteIntoRow(event: ClipboardEvent<HTMLElement>, key: string) {
    const old = rows.find((row) => row.key === key)?.image_id ?? null;
    pasteImage(
      event,
      (imageId) => updateRow(key, { image_id: imageId }),
      () => {
        if (old) api.uploads.remove(old).catch(() => undefined);
      },
    );
  }

  function pasteIntoReason(event: ClipboardEvent<HTMLElement>) {
    const old = reasonImageId;
    pasteImage(
      event,
      (imageId) => setReasonImageId(imageId),
      () => {
        if (old) api.uploads.remove(old).catch(() => undefined);
      },
    );
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRowAfter(key: string) {
    setRows((prev) => {
      const index = prev.findIndex((row) => row.key === key);
      const next = [...prev];
      next.splice(index + 1, 0, newRow());
      return next;
    });
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length === 1 ? [newRow()] : prev.filter((row) => row.key !== key)));
  }

  function resetForm() {
    setSubmissionId(null);
    setTitle("");
    setContent("");
    setRows([newRow()]);
    setReason("");
    setReasonImageId(null);
    setNumber(activeProfile?.document_number ?? "");
    setDate(activeProfile?.document_date ?? "");
    setReference(activeProfile?.reference ?? "");
    window.history.replaceState(null, "", "/");
  }

  function buildPayload(): SubmissionInput {
    const requests: RequestItem[] = rows
      .filter((row) => row.text.trim() || row.image_id)
      .map((row) => ({ text: row.text.trim(), image_id: row.image_id }));
    const derivedTitle =
      title.trim() || content.trim().split("\n")[0].slice(0, 180) || "Tờ trình";
    return {
      title: derivedTitle,
      profile_id: profileId,
      profile_name: activeProfile?.name ?? "",
      full_name: activeProfile?.full_name ?? "",
      position: activeProfile?.position ?? "",
      department: activeProfile?.department ?? "",
      document_number: number,
      document_date: date,
      reference,
      content,
      requests,
      reason,
      reason_image_id: reasonImageId,
    };
  }

  async function persist(): Promise<number | null> {
    if (!content.trim()) {
      notify("Vui lòng nhập nội dung đệ trình trước khi lưu", "error");
      return null;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      const saved = submissionId
        ? await api.submissions.update(submissionId, payload)
        : await api.submissions.create(payload);
      setSubmissionId(saved.id);
      setTitle(saved.title);
      return saved.id;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không lưu được tờ trình", "error");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    const id = await persist();
    if (id) notify("Đã lưu tờ trình vào lịch sử");
  }

  async function handlePreview() {
    const id = await persist();
    if (id) {
      setPreviewOpen(true);
    }
  }

  async function handleExport() {
    const id = await persist();
    if (!id) return;
    const link = document.createElement("a");
    link.href = api.submissions.docxUrl(id, true);
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
    notify("Đã tạo file DOCX, kiểm tra thư mục tải về");
  }

  function applyTemplate(text: string, name: string) {
    setContent((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
    notify(`Đã sao chép nội dung từ "${name}"`);
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="kicker">Biểu mẫu HCM-FM45 · Tờ trình nội bộ</div>
          <h1>Tờ trình</h1>
          <p>
            Điền nội dung, đính kèm hình ảnh và xuất file Word theo đúng biểu mẫu.
            {submissionId ? " Đang chỉnh sửa một tờ trình đã lưu." : ""}
          </p>
        </div>
        <div className="head-actions">
          <Link className="btn btn-ghost" href="/history">
            <DocIcon /> Lịch sử
          </Link>
          <button className="btn" onClick={resetForm} title="Tạo tờ trình mới">
            <PlusIcon /> Tờ trình mới
          </button>
          <button className="btn" onClick={handlePreview} disabled={saving}>
            <EyeIcon /> Xem trước
          </button>
          <button className="btn btn-primary" onClick={handleExport} disabled={saving}>
            <DownloadIcon /> {saving ? "Đang xử lý..." : "Xuất file DOCX"}
          </button>
        </div>
      </header>

      {/* 1. Dữ liệu cố định */}
      <section className="section">
        <div className="section-head">
          <div className="section-title">
            <span className="section-no">1</span>
            <div>
              <h2>Dữ liệu cố định</h2>
              <small>Thông tin người đề xuất được điền tự động vào tờ trình.</small>
            </div>
          </div>
          <div className="section-actions">
            <button className="btn btn-sm" onClick={() => setManagerOpen(true)}>
              <EditIcon size={14} /> Quản lý dữ liệu
            </button>
          </div>
        </div>
        <div className="section-body">
          <div className="profile-bar">
            <div className="field">
              <label htmlFor="profile-select">Bộ dữ liệu đang sử dụng</label>
              <select
                id="profile-select"
                className="select"
                value={profileId ?? ""}
                onChange={(event) => {
                  const id = Number(event.target.value);
                  const profile = profiles.find((item) => item.id === id) ?? null;
                  applyProfile(profile);
                  if (profile) {
                    api.profiles.activate(profile.id).catch(() => undefined);
                  }
                }}
              >
                {profiles.length === 0 && <option value="">Chưa có dữ liệu</option>}
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="profile-summary">
              <span>
                Họ và tên: <strong>{activeProfile?.full_name || "Chưa có"}</strong>
              </span>
              <span>
                Chức vụ: <strong>{activeProfile?.position || "Chưa có"}</strong>
              </span>
              <span>
                Phòng ban: <strong>{activeProfile?.department || "Chưa có"}</strong>
              </span>
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="doc-number">Số tờ trình</label>
              <input
                id="doc-number"
                className="input"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="VD: 12/TTr-MKT"
              />
            </div>
            <div className="field">
              <label htmlFor="doc-date">Ngày</label>
              <input
                id="doc-date"
                className="input"
                type="date"
                value={toDateInputValue(date)}
                onChange={(e) => setDate(fromDateInputValue(e.target.value))}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="doc-ref">V/v (trích yếu nội dung)</label>
            <input
              id="doc-ref"
              className="input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="VD: Đề nghị phê duyệt chi phí tổ chức đoàn tham quan"
            />
          </div>
        </div>
      </section>

      {/* 2. Nhập nội dung */}
      <section className="section">
        <div className="section-head">
          <div className="section-title">
            <span className="section-no">2</span>
            <div>
              <h2>Nhập nội dung tờ trình</h2>
              <small>Nội dung đệ trình, danh sách đề nghị và lý do đề nghị.</small>
            </div>
          </div>
        </div>
        <div className="section-body">
          <div className="field">
            <label htmlFor="content">A. Nội dung đệ trình</label>
            <textarea
              id="content"
              className="textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung đệ trình. Có thể xuống dòng cho nhiều đoạn."
            />
          </div>

          <div className="field" style={{ marginTop: 22 }}>
            <span className="field-label">B. Đề nghị</span>
            <div className="request-list">
              {rows.map((row, index) => (
                <div className="request-row" key={row.key}>
                  <div className="request-index" aria-label={`Dòng ${index + 1}`}>
                    {index + 1}
                  </div>
                  <div className="request-main">
                    <textarea
                      className="textarea"
                      style={{ minHeight: 44, height: 44, padding: "10px 11px" }}
                      rows={1}
                      value={row.text}
                      onChange={(e) => updateRow(row.key, { text: e.target.value })}
                      onPaste={(event) => pasteIntoRow(event, row.key)}
                      placeholder={`Nội dung đề nghị ${index + 1} — dán ảnh bằng Ctrl+V`}
                      aria-label={`Nội dung đề nghị ${index + 1}`}
                    />
                    {row.image_id && (
                      <ImagePicker
                        imageId={row.image_id}
                        compact
                        onChange={(id) => updateRow(row.key, { image_id: id })}
                        onError={(message) => notify(message, "error")}
                      />
                    )}
                  </div>
                  <div className="request-actions">
                    {!row.image_id && (
                      <ImagePicker
                        imageId={null}
                        compact
                        label="Ảnh · dán được"
                        onChange={(id) => updateRow(row.key, { image_id: id })}
                        onError={(message) => notify(message, "error")}
                      />
                    )}
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => addRowAfter(row.key)}
                      title="Thêm dòng bên dưới"
                      aria-label="Thêm dòng bên dưới"
                    >
                      <PlusIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => removeRow(row.key)}
                      title="Xóa dòng"
                      aria-label="Xóa dòng"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginTop: 22 }}>
            <label htmlFor="reason">C. Lý do đề nghị</label>
            <textarea
              id="reason"
              className="textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onPaste={pasteIntoReason}
              placeholder="Nhập lý do đề nghị. Có thể đính kèm một hình ảnh minh họa (dán bằng Ctrl+V)."
            />
            <div style={{ marginTop: 8 }}>
              <ImagePicker
                imageId={reasonImageId}
                label="Tải hoặc dán ảnh minh họa"
                onChange={(id) => setReasonImageId(id)}
                onError={(message) => notify(message, "error")}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Dữ liệu mẫu */}
      <section className="section">
        <div className="section-head">
          <div className="section-title">
            <span className="section-no">3</span>
            <div>
              <h2>Dữ liệu mẫu</h2>
              <small>Tái sử dụng nội dung đã soạn. Sao chép nhanh vào nội dung đệ trình.</small>
            </div>
          </div>
        </div>
        <div className="section-body">
          <TemplateLibrary notify={notify} onCopy={applyTemplate} />
        </div>
      </section>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button className="btn" onClick={handleSaveDraft} disabled={saving}>
          Lưu nháp
        </button>
        <button className="btn" onClick={handlePreview} disabled={saving}>
          <EyeIcon /> Xem trước
        </button>
        <button className="btn btn-primary" onClick={handleExport} disabled={saving}>
          <DownloadIcon /> Xuất file DOCX
        </button>
      </div>

      <ProfileManager
        open={managerOpen}
        profiles={profiles}
        onClose={() => setManagerOpen(false)}
        onChanged={loadProfiles}
        notify={notify}
      />

      <PreviewModal
        open={previewOpen}
        submissionId={submissionId}
        title={buildPayload().title}
        onClose={() => setPreviewOpen(false)}
        notify={notify}
      />

      {toast && <div className={`toast${toast.kind === "error" ? " error" : ""}`}>{toast.message}</div>}
    </div>
  );
}
