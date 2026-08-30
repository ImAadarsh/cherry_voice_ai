import type {
  Order,
  Customer,
  MenuItem,
  MenuCategory,
  VoiceAgent,
  CallLog,
  Payment,
  KpiPoint,
} from "@/types";

const now = Date.now();
const minsAgo = (m: number) => new Date(now - m * 60000).toISOString();
const hoursAgo = (h: number) => new Date(now - h * 3600000).toISOString();
const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();

export const restaurant = {
  name: "Cherry Bistro",
  tagline: "Modern comfort food, delivered by voice",
  currency: "USD",
  address: "142 Maple Avenue, Portland, OR",
  phone: "+1 (503) 555-0142",
  taxRate: 0.08,
};

export const menuCategories: MenuCategory[] = [
  { id: "cat-1", name: "Starters", description: "Small plates to begin", emoji: "🥗" },
  { id: "cat-2", name: "Mains", description: "Signature entrées", emoji: "🍝" },
  { id: "cat-3", name: "Burgers", description: "Hand-pressed, char-grilled", emoji: "🍔" },
  { id: "cat-4", name: "Pizza", description: "Wood-fired, thin crust", emoji: "🍕" },
  { id: "cat-5", name: "Desserts", description: "Sweet endings", emoji: "🍰" },
  { id: "cat-6", name: "Drinks", description: "Soft & specialty", emoji: "🥤" },
];

export const menuItems: MenuItem[] = [
  { id: "m-1", categoryId: "cat-1", name: "Truffle Fries", description: "Parmesan, herbs, truffle aioli", price: 9, available: true, popular: true, emoji: "🍟", prepTime: 8 },
  { id: "m-2", categoryId: "cat-1", name: "Caesar Salad", description: "Cos lettuce, anchovy, crouton", price: 11, available: true, emoji: "🥗", prepTime: 6 },
  { id: "m-3", categoryId: "cat-1", name: "Soup of the Day", description: "Ask your agent", price: 8, available: false, emoji: "🍲", prepTime: 5 },
  { id: "m-4", categoryId: "cat-2", name: "Truffle Pasta", description: "Tagliatelle, wild mushroom, cream", price: 22, available: true, popular: true, emoji: "🍝", prepTime: 16 },
  { id: "m-5", categoryId: "cat-2", name: "Grilled Salmon", description: "Asparagus, lemon butter", price: 26, available: true, emoji: "🐟", prepTime: 18 },
  { id: "m-6", categoryId: "cat-3", name: "Cherry Classic Burger", description: "Double patty, cheddar, house sauce", price: 16, available: true, popular: true, emoji: "🍔", prepTime: 14 },
  { id: "m-7", categoryId: "cat-3", name: "Crispy Chicken Burger", description: "Buttermilk chicken, slaw", price: 15, available: true, emoji: "🍔", prepTime: 14 },
  { id: "m-8", categoryId: "cat-4", name: "Margherita", description: "San Marzano, basil, fior di latte", price: 14, available: true, emoji: "🍕", prepTime: 12 },
  { id: "m-9", categoryId: "cat-4", name: "Pepperoni", description: "Spicy pepperoni, mozzarella", price: 17, available: true, popular: true, emoji: "🍕", prepTime: 12 },
  { id: "m-10", categoryId: "cat-5", name: "Cherry Cheesecake", description: "Baked NY style, cherry compote", price: 10, available: true, popular: true, emoji: "🍰", prepTime: 4 },
  { id: "m-11", categoryId: "cat-5", name: "Chocolate Lava", description: "Warm center, vanilla gelato", price: 11, available: true, emoji: "🍫", prepTime: 9 },
  { id: "m-12", categoryId: "cat-6", name: "Fresh Lemonade", description: "House-pressed, mint", price: 5, available: true, emoji: "🍋", prepTime: 3 },
  { id: "m-13", categoryId: "cat-6", name: "Cold Brew", description: "24h steep, single origin", price: 6, available: true, emoji: "☕", prepTime: 3 },
];

export const customers: Customer[] = [
  { id: "c-1", name: "Amelia Hart", phone: "+1 (503) 555-2841", email: "amelia@example.com", avatarColor: "#DC2626", totalOrders: 34, totalSpent: 1284.5, lastOrderAt: minsAgo(12), tags: ["VIP", "Regular"], favorite: "Truffle Pasta", preferences: "No cilantro. Prefers oat milk.", createdAt: daysAgo(320) },
  { id: "c-2", name: "Marcus Chen", phone: "+1 (503) 555-9012", email: "marcus@example.com", avatarColor: "#2563EB", totalOrders: 18, totalSpent: 642.0, lastOrderAt: hoursAgo(3), tags: ["Regular"], favorite: "Pepperoni", preferences: "Extra spicy.", createdAt: daysAgo(210) },
  { id: "c-3", name: "Sofia Ramirez", phone: "+1 (503) 555-3388", email: "sofia@example.com", avatarColor: "#16A34A", totalOrders: 9, totalSpent: 298.75, lastOrderAt: hoursAgo(20), tags: ["New"], favorite: "Grilled Salmon", createdAt: daysAgo(45) },
  { id: "c-4", name: "James O'Neil", phone: "+1 (503) 555-7761", avatarColor: "#D97706", totalOrders: 52, totalSpent: 2140.25, lastOrderAt: daysAgo(1), tags: ["VIP"], favorite: "Cherry Classic Burger", preferences: "Gluten-free bun.", createdAt: daysAgo(540) },
  { id: "c-5", name: "Priya Nair", phone: "+1 (503) 555-1123", email: "priya@example.com", avatarColor: "#9333EA", totalOrders: 7, totalSpent: 210.0, lastOrderAt: daysAgo(2), tags: ["New"], favorite: "Margherita", createdAt: daysAgo(30) },
  { id: "c-6", name: "David Kim", phone: "+1 (503) 555-6654", avatarColor: "#0891B2", totalOrders: 23, totalSpent: 812.4, lastOrderAt: daysAgo(4), tags: ["Regular"], favorite: "Cold Brew", createdAt: daysAgo(150) },
];

export const orders: Order[] = [
  {
    id: "o-1", reference: "CB-1042", customerId: "c-1", customerName: "Amelia Hart", customerPhone: "+1 (503) 555-2841",
    status: "preparing", paymentStatus: "paid", channel: "voice",
    items: [
      { id: "i-1", name: "Truffle Pasta", qty: 1, price: 22 },
      { id: "i-2", name: "Fresh Lemonade", qty: 2, price: 5 },
    ],
    subtotal: 32, tax: 2.56, total: 34.56, createdAt: minsAgo(8), eta: "18 min",
    agentId: "a-1", callId: "call-9001", recordingUrl: "#", notes: "Birthday — add candle if possible.",
  },
  {
    id: "o-2", reference: "CB-1041", customerId: "c-2", customerName: "Marcus Chen", customerPhone: "+1 (503) 555-9012",
    status: "pending", paymentStatus: "pending", channel: "voice",
    items: [
      { id: "i-3", name: "Pepperoni", qty: 1, price: 17, notes: "Extra spicy" },
      { id: "i-4", name: "Truffle Fries", qty: 1, price: 9 },
    ],
    subtotal: 26, tax: 2.08, total: 28.08, createdAt: minsAgo(21), agentId: "a-1", callId: "call-9000", recordingUrl: "#",
  },
  {
    id: "o-3", reference: "CB-1040", customerId: "c-3", customerName: "Sofia Ramirez", customerPhone: "+1 (503) 555-3388",
    status: "paid", paymentStatus: "paid", channel: "web",
    items: [{ id: "i-5", name: "Grilled Salmon", qty: 1, price: 26 }],
    subtotal: 26, tax: 2.08, total: 28.08, createdAt: minsAgo(44),
  },
  {
    id: "o-4", reference: "CB-1039", customerId: "c-4", customerName: "James O'Neil", customerPhone: "+1 (503) 555-7761",
    status: "completed", paymentStatus: "paid", channel: "voice",
    items: [
      { id: "i-6", name: "Cherry Classic Burger", qty: 2, price: 16 },
      { id: "i-7", name: "Cherry Cheesecake", qty: 1, price: 10 },
    ],
    subtotal: 42, tax: 3.36, total: 45.36, createdAt: hoursAgo(2), agentId: "a-2", callId: "call-8990", recordingUrl: "#",
  },
  {
    id: "o-5", reference: "CB-1038", customerId: "c-5", customerName: "Priya Nair", customerPhone: "+1 (503) 555-1123",
    status: "cancelled", paymentStatus: "refunded", channel: "voice",
    items: [{ id: "i-8", name: "Margherita", qty: 1, price: 14 }],
    subtotal: 14, tax: 1.12, total: 15.12, createdAt: hoursAgo(5), agentId: "a-1", callId: "call-8977", recordingUrl: "#",
    notes: "Customer changed plans.",
  },
  {
    id: "o-6", reference: "CB-1037", customerId: "c-6", customerName: "David Kim", customerPhone: "+1 (503) 555-6654",
    status: "completed", paymentStatus: "paid", channel: "walk-in",
    items: [
      { id: "i-9", name: "Cold Brew", qty: 1, price: 6 },
      { id: "i-10", name: "Chocolate Lava", qty: 1, price: 11 },
    ],
    subtotal: 17, tax: 1.36, total: 18.36, createdAt: hoursAgo(6),
  },
  {
    id: "o-7", reference: "CB-1036", customerId: "c-2", customerName: "Marcus Chen", customerPhone: "+1 (503) 555-9012",
    status: "pending", paymentStatus: "unpaid", channel: "voice",
    items: [{ id: "i-11", name: "Crispy Chicken Burger", qty: 3, price: 15 }],
    subtotal: 45, tax: 3.6, total: 48.6, createdAt: minsAgo(2), agentId: "a-2", callId: "call-9002", recordingUrl: "#",
  },
];

export const voiceAgents: VoiceAgent[] = [
  { id: "a-1", omnidimAgentId: "omni-a-1", name: "Ruby", role: "Order Taker", status: "online", phoneNumber: "+1 (503) 555-0142", language: "English (US)", voice: "Warm Female", callsToday: 47, avgDuration: 132, successRate: 0.94, model: "cherry-voice-2" },
  { id: "a-2", omnidimAgentId: "omni-a-2", name: "Milo", role: "Reservations", status: "online", phoneNumber: "+1 (503) 555-0143", language: "English (US)", voice: "Friendly Male", callsToday: 22, avgDuration: 96, successRate: 0.89, model: "cherry-voice-2" },
  { id: "a-3", omnidimAgentId: "omni-a-3", name: "Sol", role: "After-hours Support", status: "idle", phoneNumber: "+1 (503) 555-0144", language: "Spanish (MX)", voice: "Calm Neutral", callsToday: 6, avgDuration: 148, successRate: 0.82, model: "cherry-voice-2" },
  { id: "a-4", omnidimAgentId: "omni-a-4", name: "Nova", role: "Feedback & Surveys", status: "offline", phoneNumber: "+1 (503) 555-0145", language: "English (US)", voice: "Bright Female", callsToday: 0, avgDuration: 0, successRate: 0, model: "cherry-voice-1" },
];

export const callLogs: CallLog[] = [
  { id: "call-9002", agentId: "a-2", agentName: "Milo", customerName: "Marcus Chen", customerPhone: "+1 (503) 555-9012", outcome: "order_placed", duration: 142, startedAt: minsAgo(2), orderId: "o-7", recordingUrl: "#", sentiment: "positive" },
  { id: "call-9001", agentId: "a-1", agentName: "Ruby", customerName: "Amelia Hart", customerPhone: "+1 (503) 555-2841", outcome: "order_placed", duration: 168, startedAt: minsAgo(8), orderId: "o-1", recordingUrl: "#", sentiment: "positive" },
  { id: "call-9000", agentId: "a-1", agentName: "Ruby", customerName: "Marcus Chen", customerPhone: "+1 (503) 555-9012", outcome: "order_placed", duration: 121, startedAt: minsAgo(21), orderId: "o-2", recordingUrl: "#", sentiment: "neutral" },
  { id: "call-8995", agentId: "a-3", agentName: "Sol", customerName: "Unknown", customerPhone: "+1 (503) 555-4410", outcome: "inquiry", duration: 64, startedAt: minsAgo(35), recordingUrl: "#", sentiment: "neutral" },
  { id: "call-8990", agentId: "a-2", agentName: "Milo", customerName: "James O'Neil", customerPhone: "+1 (503) 555-7761", outcome: "reservation", duration: 88, startedAt: hoursAgo(2), recordingUrl: "#", sentiment: "positive" },
  { id: "call-8985", agentId: "a-1", agentName: "Ruby", customerName: "Unknown", customerPhone: "+1 (503) 555-2210", outcome: "missed", duration: 0, startedAt: hoursAgo(3), sentiment: "negative" },
  { id: "call-8977", agentId: "a-1", agentName: "Ruby", customerName: "Priya Nair", customerPhone: "+1 (503) 555-1123", outcome: "order_placed", duration: 102, startedAt: hoursAgo(5), orderId: "o-5", recordingUrl: "#", sentiment: "neutral" },
];

export const payments: Payment[] = [
  { id: "p-1", orderId: "o-1", orderRef: "CB-1042", customerName: "Amelia Hart", amount: 34.56, method: "card", gateway: "stripe", status: "paid", createdAt: minsAgo(7) },
  { id: "p-2", orderId: "o-2", orderRef: "CB-1041", customerName: "Marcus Chen", amount: 28.08, method: "link", gateway: "stripe", status: "pending", createdAt: minsAgo(20), linkStatus: "opened" },
  { id: "p-3", orderId: "o-3", orderRef: "CB-1040", customerName: "Sofia Ramirez", amount: 28.08, method: "upi", gateway: "razorpay", status: "paid", createdAt: minsAgo(43) },
  { id: "p-4", orderId: "o-4", orderRef: "CB-1039", customerName: "James O'Neil", amount: 45.36, method: "card", gateway: "stripe", status: "paid", createdAt: hoursAgo(2) },
  { id: "p-5", orderId: "o-5", orderRef: "CB-1038", customerName: "Priya Nair", amount: 15.12, method: "card", gateway: "stripe", status: "refunded", createdAt: hoursAgo(5) },
  { id: "p-6", orderId: "o-6", orderRef: "CB-1037", customerName: "David Kim", amount: 18.36, method: "cash", gateway: "cash", status: "paid", createdAt: hoursAgo(6) },
  { id: "p-7", orderId: "o-7", orderRef: "CB-1036", customerName: "Marcus Chen", amount: 48.6, method: "link", gateway: "razorpay", status: "pending", createdAt: minsAgo(1), linkStatus: "sent" },
];

export const revenueSeries: KpiPoint[] = [
  { label: "Mon", revenue: 1240, orders: 42 },
  { label: "Tue", revenue: 1580, orders: 51 },
  { label: "Wed", revenue: 1320, orders: 45 },
  { label: "Thu", revenue: 1890, orders: 63 },
  { label: "Fri", revenue: 2640, orders: 88 },
  { label: "Sat", revenue: 3120, orders: 104 },
  { label: "Sun", revenue: 2280, orders: 76 },
];

export const kpis = {
  ordersToday: 128,
  ordersDelta: 12.4,
  revenueToday: 3184.5,
  revenueDelta: 8.1,
  activeCalls: 3,
  callsDelta: 0,
  pendingPayments: 2,
  pendingAmount: 76.68,
};
