import {
  Building2,
  Scissors,
  Stethoscope,
  Home,
  ShoppingBag,
  Briefcase,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type BusinessType = {
  id: string;
  label: string;
  icon: LucideIcon;
  agentPrompt: string;
  catalogLabel: string;
  catalogFields: string[];
  dashboardLabels: string[];
  accent: string;
};

export const businessTypes: BusinessType[] = [
  {
    id: "restaurant",
    label: "Restaurant & Food",
    icon: Building2,
    agentPrompt:
      "Welcome to Cherry Bistro! I can help you place an order, check today's specials, or answer questions about delivery times.",
    catalogLabel: "Menu items",
    catalogFields: ["Dish name", "Category", "Price", "Modifiers", "Availability"],
    dashboardLabels: ["Orders", "Menu", "Kitchen queue", "Delivery ETA"],
    accent: "from-cherry-500 to-cherry-700",
  },
  {
    id: "salon",
    label: "Salon & Spa",
    icon: Scissors,
    agentPrompt:
      "Hi! I'm your salon assistant. I can book haircuts, color treatments, or spa packages — what would you like today?",
    catalogLabel: "Services",
    catalogFields: ["Service name", "Duration", "Stylist tier", "Price", "Add-ons"],
    dashboardLabels: ["Bookings", "Services", "Staff schedule", "Client notes"],
    accent: "from-pink-500 to-rose-600",
  },
  {
    id: "healthcare",
    label: "Healthcare / Clinic",
    icon: Stethoscope,
    agentPrompt:
      "Thank you for calling. I can help schedule appointments, route urgent concerns, or share clinic hours and insurance info.",
    catalogLabel: "Procedures",
    catalogFields: ["Procedure", "Department", "Duration", "Insurance codes", "Prep notes"],
    dashboardLabels: ["Appointments", "Patients", "Waitlist", "Follow-ups"],
    accent: "from-teal-500 to-cyan-600",
  },
  {
    id: "realestate",
    label: "Real Estate",
    icon: Home,
    agentPrompt:
      "Welcome! I can schedule property viewings, share listing details, or connect you with an agent for your neighborhood.",
    catalogLabel: "Listings",
    catalogFields: ["Property", "Beds/Baths", "Price", "Neighborhood", "Tour slots"],
    dashboardLabels: ["Leads", "Listings", "Showings", "Pipeline"],
    accent: "from-blue-500 to-indigo-600",
  },
  {
    id: "ecommerce",
    label: "E-commerce",
    icon: ShoppingBag,
    agentPrompt:
      "Hi there! I can check order status, recommend products, process returns, or help you find what's in stock.",
    catalogLabel: "Products",
    catalogFields: ["SKU", "Variants", "Inventory", "Price tiers", "Shipping"],
    dashboardLabels: ["Orders", "Catalog", "Returns", "Abandoned carts"],
    accent: "from-violet-500 to-purple-600",
  },
  {
    id: "professional",
    label: "Professional Services",
    icon: Briefcase,
    agentPrompt:
      "Good day. I can book consultations, explain service packages, or collect intake details before your first meeting.",
    catalogLabel: "Offerings",
    catalogFields: ["Package", "Scope", "Timeline", "Rate", "Deliverables"],
    dashboardLabels: ["Clients", "Projects", "Invoices", "Time tracking"],
    accent: "from-amber-500 to-orange-600",
  },
  {
    id: "custom",
    label: "Custom Business",
    icon: Sparkles,
    agentPrompt:
      "Configure any workflow — your agent greets callers with your brand voice and routes to the tools you already use.",
    catalogLabel: "Catalog",
    catalogFields: ["Custom fields", "Tags", "Pricing rules", "Workflows", "Integrations"],
    dashboardLabels: ["Dashboard", "Catalog", "Automations", "Analytics"],
    accent: "from-cherry-500 to-teal-600",
  },
];
