import { redirect } from "next/navigation";

export default function LegacyDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
