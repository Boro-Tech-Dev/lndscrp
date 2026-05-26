import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "LandScrape",
  description: "LandScrape market intelligence workspace",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" }
    ],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas antialiased">{children}</body>
    </html>
  );
}
