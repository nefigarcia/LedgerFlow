import {
  LayoutDashboard,
  Wallet,
  Users2,
  FolderKanban,
  Clock,
  FileText,
  CreditCard,
  Receipt,
  Calculator,
  HandCoins,
  TrendingUp,
  BarChart3,
  FolderOpen,
  Sparkles,
  Settings,
} from "lucide-react";
import type { Permission } from "@/lib/permissions/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requires?: Permission;
}

export interface NavGroup {
  id: string;
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "core",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { label: "Cash", href: "/cash", icon: Wallet },
    ],
  },
  {
    id: "business",
    label: "Business",
    items: [
      { label: "Clients", href: "/clients", icon: Users2, requires: "clients:read" },
      { label: "Projects", href: "/projects", icon: FolderKanban, requires: "projects:read" },
      { label: "Time", href: "/time", icon: Clock, requires: "time:read" },
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      { label: "Invoices", href: "/invoices", icon: FileText, requires: "invoices:read" },
      { label: "Payments", href: "/payments", icon: CreditCard, requires: "payments:read" },
      { label: "Expenses", href: "/expenses", icon: Receipt, requires: "expenses:read" },
    ],
  },
  {
    id: "planning",
    label: "Planning",
    items: [
      { label: "Taxes", href: "/taxes", icon: Calculator, requires: "taxes:read" },
      { label: "Distributions", href: "/distributions", icon: HandCoins, requires: "distributions:read" },
      { label: "Forecast", href: "/forecast", icon: TrendingUp, requires: "reports:read" },
      { label: "Reports", href: "/reports", icon: BarChart3, requires: "reports:read" },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      { label: "Documents", href: "/documents", icon: FolderOpen },
      { label: "Assistant", href: "/assistant", icon: Sparkles, requires: "ai:use" },
    ],
  },
];

export const BOTTOM_NAV: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: Settings,
  requires: "settings:read",
};
