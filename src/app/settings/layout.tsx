import { SettingsSubnav } from "@/components/settings/settings-subnav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <SettingsSubnav />
      {children}
    </div>
  );
}
