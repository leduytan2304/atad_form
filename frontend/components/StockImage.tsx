"use client";

import { useState } from "react";
import { ImageIcon } from "@/components/Icons";
import { api } from "@/lib/api";

export default function StockImage({
  path,
  alt,
}: {
  path: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = api.stock.imageUrl(path);

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
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
