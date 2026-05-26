import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "LandScrape Admin",
  description: "Admin console for LandScrape",
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
      <body>{children}</body>
    </html>
  );
}
