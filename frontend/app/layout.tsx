import type { Metadata } from "next";
import { Be_Vietnam_Pro, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const body = Be_Vietnam_Pro({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ATAD · Quản lý tờ trình",
  description: "Soạn, xem trước và xuất tờ trình nội bộ theo biểu mẫu HCM-FM45.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${body.variable} ${display.variable}`}>
      <body suppressHydrationWarning>
        <div className="app-shell">
          <Sidebar />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
