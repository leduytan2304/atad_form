"use client";

import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent } from "react";
import { api } from "@/lib/api";
import { CloseIcon, ImageIcon } from "./Icons";

type Props = {
  imageId: number | null;
  onChange: (imageId: number | null, url: string | null) => void;
  label?: string;
  compact?: boolean;
  onError?: (message: string) => void;
};

export default function ImagePicker({ imageId, onChange, label = "Tải hình ảnh", compact, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [urlForId, setUrlForId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!imageId) {
      setUrl(null);
      setUrlForId(null);
      return;
    }
    if (urlForId === imageId) return;
    api.uploads
      .get(imageId)
      .then((image) => {
        if (cancelled) return;
        setUrl(api.uploads.url(image.url));
        setUrlForId(imageId);
      })
      .catch(() => {
        if (!cancelled) {
          setUrl(null);
          setUrlForId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [imageId, urlForId]);

  function handlePaste(event: ClipboardEvent<HTMLElement>) {
    const file = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .find((item): item is File => Boolean(item));
    if (!file) return;
    event.preventDefault();
    handleFile(file);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError?.("Chỉ chấp nhận file hình ảnh");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onError?.("Hình ảnh vượt quá 10MB");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await api.uploads.create(file);
      if (imageId && imageId !== uploaded.id) {
        // Thay ảnh: dọn object cũ nếu không còn tờ trình nào dùng.
        await api.uploads.remove(imageId).catch(() => undefined);
      }
      const absolute = api.uploads.url(uploaded.url);
      setUrl(absolute);
      setUrlForId(uploaded.id);
      onChange(uploaded.id, absolute);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Không tải được hình ảnh");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (imageId) {
      try {
        await api.uploads.remove(imageId);
      } catch (error) {
        onError?.(error instanceof Error ? error.message : "Không xóa được hình ảnh");
        return;
      }
    }
    setUrl(null);
    setUrlForId(null);
    onChange(null, null);
  }

  if (url && urlForId === imageId) {
    return (
      <div
        className="request-preview paste-target"
        onPaste={handlePaste}
        tabIndex={0}
        title="Dán ảnh mới bằng Ctrl+V để thay ảnh"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Hình ảnh đính kèm" />
        <span>{compact ? "Đã đính kèm" : "Hình ảnh đính kèm"}</span>
        <label className="file-label" title="Chọn ảnh khác hoặc dán ảnh bằng Ctrl+V">
          Thay
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>
        <button type="button" className="icon-btn danger" onClick={handleRemove} title="Xóa hình ảnh">
          <CloseIcon size={15} />
        </button>
      </div>
    );
  }

  return (
    <label
      className="file-label paste-target"
      tabIndex={0}
      onPaste={handlePaste}
      title="Bấm để chọn ảnh, hoặc dán ảnh bằng Ctrl+V"
    >
      <ImageIcon size={15} />
      {uploading ? "Đang tải..." : label}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={uploading}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
    </label>
  );
}
