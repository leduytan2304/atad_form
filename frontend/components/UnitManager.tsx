"use client";

import { useState } from "react";
import { EditIcon, PlusIcon, SaveIcon, TrashIcon } from "@/components/Icons";
import type { Unit } from "@/lib/api";

type Props = {
  units: Unit[];
  loading: boolean;
  error: string;
  onCreate: (name: string) => Promise<void>;
  onUpdate: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};

export default function UnitManager({
  units,
  loading,
  error,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const message = (value: unknown, fallback: string) =>
    value instanceof Error ? value.message : fallback;

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setActionError("Nhập tên đơn vị tính trước khi thêm.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await onCreate(name);
      setNewName("");
    } catch (value) {
      setActionError(message(value, "Không thêm được đơn vị tính."));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (unit: Unit) => {
    setEditingId(unit.id);
    setEditName(unit.name);
    setActionError("");
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingId === null) return;
    const name = editName.trim();
    if (!name) {
      setActionError("Tên đơn vị tính không được để trống.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await onUpdate(editingId, name);
      setEditingId(null);
      setEditName("");
    } catch (value) {
      setActionError(message(value, "Không sửa được đơn vị tính."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (unit: Unit) => {
    if (!window.confirm(`Xóa đơn vị tính "${unit.name}"?`)) return;
    setBusy(true);
    setActionError("");
    try {
      await onDelete(unit.id);
      if (editingId === unit.id) setEditingId(null);
    } catch (value) {
      setActionError(message(value, "Không xóa được đơn vị tính."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="unit-manager" aria-label="Quản lý đơn vị tính">
      <div className="unit-manager-head">
        <div>
          <h3>Quản lý đơn vị tính</h3>
          <p>
            Danh sách dùng chung, được lưu lại để tái sử dụng cho những lần lập tờ
            trình sau.
          </p>
        </div>
        <span className="unit-count">{units.length} đơn vị</span>
      </div>

      <form className="unit-add" onSubmit={add}>
        <input
          className="input"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="Tên đơn vị tính mới, ví dụ: Cái"
          maxLength={100}
          disabled={busy || loading}
          aria-label="Tên đơn vị tính mới"
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || loading || !newName.trim()}
        >
          <PlusIcon size={15} />
          Thêm đơn vị tính
        </button>
      </form>

      {error || actionError ? (
        <p className="unit-error" role="alert">
          {actionError || error}
        </p>
      ) : null}

      {loading ? (
        <p className="unit-empty">Đang tải danh sách đơn vị tính…</p>
      ) : units.length === 0 ? (
        <p className="unit-empty">
          Chưa có đơn vị tính nào. Thêm đơn vị tính để chọn trong bảng quà tặng.
        </p>
      ) : (
        <ul className="unit-list">
          {units.map((unit) => (
            <li className="unit-row" key={unit.id}>
              {editingId === unit.id ? (
                <form className="unit-edit" onSubmit={saveEdit}>
                  <input
                    className="input"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    maxLength={100}
                    autoFocus
                    aria-label={`Sửa tên đơn vị tính ${unit.name}`}
                  />
                  <button
                    type="submit"
                    className="icon-btn"
                    disabled={busy}
                    aria-label="Lưu tên đơn vị tính"
                    title="Lưu"
                  >
                    <SaveIcon size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setEditingId(null);
                      setEditName("");
                      setActionError("");
                    }}
                    disabled={busy}
                  >
                    Hủy
                  </button>
                </form>
              ) : (
                <>
                  <span className="unit-name">{unit.name}</span>
                  <span className="unit-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => startEdit(unit)}
                      disabled={busy}
                      aria-label={`Sửa đơn vị tính ${unit.name}`}
                      title="Sửa"
                    >
                      <EditIcon size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => void remove(unit)}
                      disabled={busy}
                      aria-label={`Xóa đơn vị tính ${unit.name}`}
                      title="Xóa"
                    >
                      <TrashIcon size={15} />
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
