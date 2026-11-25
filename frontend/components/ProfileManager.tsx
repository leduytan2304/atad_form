"use client";

import { useEffect, useState } from "react";
import { api, type ProfileInput, type ProfileSet } from "@/lib/api";
import { fromDateInputValue, toDateInputValue } from "@/lib/date";
import { CheckIcon, CloseIcon, EditIcon, PlusIcon, TrashIcon } from "./Icons";

type Props = {
  open: boolean;
  profiles: ProfileSet[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
  notify: (message: string, kind?: "ok" | "error") => void;
};

const EMPTY: ProfileInput = {
  name: "",
  full_name: "",
  position: "",
  department: "",
  document_number: "",
  document_date: "",
  reference: "",
};

export default function ProfileManager({ open, profiles, onClose, onChanged, notify }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY);
    }
  }, [open]);

  if (!open) return null;

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  }

  function startEdit(profile: ProfileSet) {
    setEditingId(profile.id);
    setForm({
      name: profile.name,
      full_name: profile.full_name,
      position: profile.position,
      department: profile.department,
      document_number: profile.document_number,
      document_date: profile.document_date,
      reference: profile.reference,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      notify("Vui lòng nhập tên bộ dữ liệu", "error");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.profiles.update(editingId, form);
        notify("Đã cập nhật bộ dữ liệu");
      } else {
        await api.profiles.create({ ...form, is_active: profiles.length === 0 });
        notify("Đã thêm bộ dữ liệu mới");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY);
      await onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không lưu được dữ liệu", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: number) {
    try {
      await api.profiles.activate(id);
      await onChanged();
      notify("Đã chọn bộ dữ liệu sử dụng");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không chọn được dữ liệu", "error");
    }
  }

  async function handleDelete(profile: ProfileSet) {
    if (!confirm(`Xóa bộ dữ liệu "${profile.name}"?`)) return;
    try {
      await api.profiles.remove(profile.id);
      if (editingId === profile.id) {
        setShowForm(false);
        setEditingId(null);
      }
      await onChanged();
      notify("Đã xóa bộ dữ liệu");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không xóa được dữ liệu", "error");
    }
  }

  function update(key: keyof ProfileInput, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Quản lý dữ liệu cố định">
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2>Quản lý dữ liệu cố định</h2>
            <p>Thông tin người đề xuất, tự động điền vào tờ trình đang chọn.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body">
          <div className="profile-cards">
            {profiles.length === 0 && (
              <div className="empty">
                <strong>Chưa có bộ dữ liệu</strong>
                Thêm bộ dữ liệu đầu tiên để dùng cho tờ trình.
              </div>
            )}
            {profiles.map((profile) => (
              <div key={profile.id} className={`profile-card${profile.is_active ? " is-active" : ""}`}>
                <button
                  type="button"
                  className="radio-dot"
                  onClick={() => handleActivate(profile.id)}
                  aria-label={`Chọn ${profile.name}`}
                  title="Dùng bộ dữ liệu này"
                />
                <div className="profile-card-main">
                  <h4>
                    {profile.name} {profile.is_active && <span className="tag">Đang dùng</span>}
                  </h4>
                  <p>
                    {profile.full_name || "Chưa có họ tên"}
                    {profile.position ? ` · ${profile.position}` : ""}
                    {profile.department ? ` · ${profile.department}` : ""}
                  </p>
                </div>
                <div className="request-actions">
                  <button className="icon-btn" onClick={() => startEdit(profile)} title="Sửa">
                    <EditIcon />
                  </button>
                  <button className="icon-btn danger" onClick={() => handleDelete(profile)} title="Xóa">
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!showForm && (
            <button className="btn" onClick={startCreate}>
              <PlusIcon /> Thêm bộ dữ liệu
            </button>
          )}

          {showForm && (
            <div>
              <div className="form-divider" />
              <p className="field-label" style={{ marginBottom: 12 }}>
                {editingId ? "Sửa bộ dữ liệu" : "Bộ dữ liệu mới"}
              </p>
              <div className="field">
                <label htmlFor="profile-name">Tên bộ dữ liệu *</label>
                <input
                  id="profile-name"
                  className="input"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="VD: Dữ liệu Marketing"
                />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="profile-fullname">Họ và tên</label>
                  <input
                    id="profile-fullname"
                    className="input"
                    value={form.full_name}
                    onChange={(e) => update("full_name", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="profile-position">Chức vụ</label>
                  <input
                    id="profile-position"
                    className="input"
                    value={form.position}
                    onChange={(e) => update("position", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="profile-department">Phòng ban</label>
                  <input
                    id="profile-department"
                    className="input"
                    value={form.department}
                    onChange={(e) => update("department", e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="profile-number">Số tờ trình</label>
                  <input
                    id="profile-number"
                    className="input"
                    value={form.document_number}
                    onChange={(e) => update("document_number", e.target.value)}
                    placeholder="VD: 12/TTr-MKT"
                  />
                </div>
                <div className="field">
                  <label htmlFor="profile-date">Ngày</label>
                  <input
                    id="profile-date"
                    className="input"
                    type="date"
                    value={toDateInputValue(form.document_date)}
                    onChange={(e) => update("document_date", fromDateInputValue(e.target.value))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="profile-ref">V/v (trích yếu)</label>
                  <input
                    id="profile-ref"
                    className="input"
                    value={form.reference}
                    onChange={(e) => update("reference", e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  <CheckIcon /> {saving ? "Đang lưu..." : "Lưu bộ dữ liệu"}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
