"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type ContentTemplate } from "@/lib/api";
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  EditIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "./Icons";

type Props = {
  notify: (message: string, kind?: "ok" | "error") => void;
  onCopy: (content: string, name: string) => void;
};

const EMPTY = { name: "", category: "Chi phí", content: "" };

export default function TemplateLibrary({ notify, onCopy }: Props) {
  const [items, setItems] = useState<ContentTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (q: string, cat: string) => {
      setLoading(true);
      try {
        const [list, cats] = await Promise.all([
          api.templates.list(q, cat === "Tất cả" ? "" : cat),
          api.templates.categories(),
        ]);
        setItems(list);
        setCategories(cats);
      } catch (error) {
        notify(error instanceof Error ? error.message : "Không tải được dữ liệu mẫu", "error");
      } finally {
        setLoading(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      load(query, category);
    }, 220);
    return () => clearTimeout(timer);
  }, [query, category, load]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setEditorOpen(true);
  }

  function startEdit(item: ContentTemplate) {
    setEditingId(item.id);
    setForm({ name: item.name, category: item.category, content: item.content });
    setEditorOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.content.trim()) {
      notify("Vui lòng nhập tên và nội dung mẫu", "error");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.templates.update(editingId, form);
        notify("Đã cập nhật dữ liệu mẫu");
      } else {
        await api.templates.create(form);
        notify("Đã thêm dữ liệu mẫu");
      }
      setEditorOpen(false);
      await load(query, category);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không lưu được dữ liệu mẫu", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ContentTemplate) {
    if (!confirm(`Xóa dữ liệu mẫu "${item.name}"?`)) return;
    try {
      await api.templates.remove(item.id);
      await load(query, category);
      notify("Đã xóa dữ liệu mẫu");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Không xóa được dữ liệu mẫu", "error");
    }
  }

  return (
    <>
      <div className="library-tools">
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              display: "flex",
            }}
          >
            <SearchIcon size={15} />
          </span>
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc nội dung"
            aria-label="Tìm dữ liệu mẫu"
          />
        </div>
        <select
          className="select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Lọc theo phân loại"
        >
          <option>Tất cả</option>
          {categories.map((cat) => (
            <option key={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="empty">Đang tải dữ liệu mẫu...</div>
      ) : items.length === 0 ? (
        <div className="empty">
          <strong>Không có dữ liệu mẫu phù hợp</strong>
          Thử từ khóa khác hoặc thêm dữ liệu mẫu mới.
        </div>
      ) : (
        <div className="template-list">
          {items.map((item) => (
            <article className="template-item" key={item.id}>
              <div className="template-stripe" />
              <div>
                <div className="template-meta">
                  <h3>{item.name}</h3>
                  <span className="tag">{item.category}</span>
                </div>
                <p>{item.content}</p>
              </div>
              <div className="request-actions">
                <button
                  className="btn btn-sm"
                  onClick={() => onCopy(item.content, item.name)}
                  title="Sao chép vào nội dung đệ trình"
                >
                  <CopyIcon size={14} /> Sao chép
                </button>
                <button className="icon-btn" onClick={() => startEdit(item)} title="Sửa">
                  <EditIcon />
                </button>
                <button className="icon-btn danger" onClick={() => remove(item)} title="Xóa">
                  <TrashIcon />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <button className="btn add-row" onClick={startCreate}>
        <PlusIcon /> Thêm dữ liệu mẫu
      </button>

      {editorOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Dữ liệu mẫu">
          <div className="modal">
            <div className="modal-head">
              <div>
                <h2>{editingId ? "Sửa dữ liệu mẫu" : "Thêm dữ liệu mẫu"}</h2>
                <p>Nội dung mẫu dùng để tái sử dụng khi soạn tờ trình.</p>
              </div>
              <button className="icon-btn" onClick={() => setEditorOpen(false)} aria-label="Đóng">
                <CloseIcon />
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label htmlFor="tpl-name">Tên dữ liệu mẫu *</label>
                <input
                  id="tpl-name"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="tpl-category">Phân loại</label>
                <input
                  id="tpl-category"
                  className="input"
                  list="template-categories"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
                <datalist id="template-categories">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
              <div className="field">
                <label htmlFor="tpl-content">Nội dung *</label>
                <textarea
                  id="tpl-content"
                  className="textarea"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setEditorOpen(false)}>
                Hủy
              </button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                <CheckIcon /> {saving ? "Đang lưu..." : "Lưu dữ liệu mẫu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
