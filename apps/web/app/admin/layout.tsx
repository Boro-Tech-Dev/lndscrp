import "./admin-globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "LandScrape Admin",
  description: "Admin console for LandScrape"
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-console">{children}</div>;
}
