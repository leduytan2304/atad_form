"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Tờ trình", note: "Soạn và xuất biểu mẫu", code: "01", also: ["/history"] },
  { href: "/feature-2", label: "Chức năng 2", note: "Bổ sung sau", code: "02", also: [] },
  { href: "/feature-3", label: "Chức năng 3", note: "Bổ sung sau", code: "03", also: [] },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">ATAD</div>
        <div className="brand-text">
          <span>Hồ sơ nội bộ</span>
          <strong>Quản lý tờ trình</strong>
        </div>
      </div>

      <nav className="nav" aria-label="Chức năng chính">
        <p className="nav-caption">Biểu mẫu HCM-FM45</p>
        {items.map((item) => {
          const active = pathname === item.href || item.also.includes(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="nav-code">{item.code}</span>
              <span className="nav-label">
                {item.label}
                <small>{item.note}</small>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <p>ATAD · Partnership Success</p>
        <span>Biểu mẫu HCM-FM45 · Rev01</span>
      </div>
    </aside>
  );
}
