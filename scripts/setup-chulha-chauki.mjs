#!/usr/bin/env node
/**
 * Full setup for Chulha Chauki Da Dhaba — restaurant, menu (Gemini), website context,
 * Omnidim voice agent, integrations, agent flow, and smoke tests.
 *
 * Usage: node scripts/setup-chulha-chauki.mjs
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import OmniDimension from "@omnidim-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CONFIG = {
  restaurantName: "Chulha Chauki Da Dhaba",
  website: "https://www.chulhachaukidadhaba.com/",
  currency: "INR",
  city: "Bangalore",
  country: "India",
  timezone: "Asia/Kolkata",
  cuisine: "North Indian / Punjabi Dhaba",
  emails: ["admin@chulhachaukidadhaba.com"],
  password: "1@Admin123",
  adminName: "Chulha Admin",
  baseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  imageDir:
    process.env.CHULHA_MENU_IMAGE_DIR ||
    "/Users/aadarsh/.cursor/projects/Applications-XAMPP-xamppfiles-htdocs-cherry-voice-ai-dashboard/assets",
  geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash",
  agentName: "Chulha Chauki Voice Agent",
};

const report = {
  gemini: { ok: false, model: CONFIG.geminiModel, error: null, testResponse: null },
  auth: { email: null, registered: false, loginOk: false, restaurantId: null, userId: null },
  menu: { imagesProcessed: 0, categories: 0, items: 0, combos: 0, errors: [] },
  website: { fetched: false, saved: false },
  agent: { id: null, localId: null, integrations: {}, flowId: null },
  tests: {},
  errors: [],
};

const CHERRY_VOICE_TOOLS = [
  {
    name: "create_order",
    method: "POST",
    path: "/api/integrations/omnidim/create-order",
    description: "Place a new order for the caller.",
    body_params: [
      { key: "phone", description: "Customer phone", type: "string", required: true },
      { key: "name", description: "Customer name", type: "string" },
      { key: "order_type", description: "pickup or delivery", type: "string" },
      { key: "items", description: "JSON array of {name, quantity}", type: "string", required: true },
      { key: "notes", description: "Order notes", type: "string" },
    ],
  },
  { name: "get_menu", method: "GET", path: "/api/integrations/omnidim/menu", description: "Read menu." },
  {
    name: "lookup_customer",
    method: "GET",
    path: "/api/integrations/omnidim/customer",
    description: "Look up customer by phone.",
    query_params: [{ key: "phone", description: "Phone", type: "string", required: true }],
  },
  {
    name: "send_payment_link",
    method: "POST",
    path: "/api/integrations/omnidim/send-payment-link",
    description: "Send payment link.",
    body_params: [{ key: "order_id", description: "Order id", type: "number", required: true }],
  },
  {
    name: "create_reservation",
    method: "POST",
    path: "/api/integrations/omnidim/create-reservation",
    description: "Book a table.",
    body_params: [
      { key: "customer_name", description: "Name", type: "string", required: true },
      { key: "customer_phone", description: "Phone", type: "string", required: true },
      { key: "party_size", description: "Guests", type: "number", required: true },
      { key: "reserved_at", description: "ISO datetime", type: "string", required: true },
    ],
  },
  {
    name: "get_restaurant_info",
    method: "GET",
    path: "/api/integrations/omnidim/restaurant",
    description: "Get hours and policies.",
  },
];

const WEBSITE_CONTEXT = {
  hours:
    "Monday to Sunday: Lunch 12:00 PM – 3:30 PM, Dinner 6:30 PM – 10:30 PM (same across all Bangalore branches).",
  branches: [
    { name: "HRBR Layout / Kalyan Nagar", phone: "7349738041", address: "Masand Esquire, near Hennur Main Road, HRBR Layout 3rd Block, Kalyan Nagar, Bengaluru 560043" },
    { name: "Brookefields", phone: "7349738047", address: "Krishvi Prospero 601, AECS Layout Main Rd, Brookefield, Bengaluru 560037" },
    { name: "Mahadevapura", phone: "7349738050", address: "62/2 Chinnappa Reddy Rd, Doddanekundi, KR Puram, Bengaluru 560037 (AC)" },
    { name: "Sarjapur Road", phone: "7349738049", address: "6th Floor SAKET CALLIPOLIS, Halanayakanahalli, Bengaluru 560035" },
    { name: "Indiranagar", phone: "7349738053", address: "2nd Floor, 608 12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru 560008" },
    { name: "Rajajinagar", phone: "7349738051", address: "1st Floor, Dr Rajkumar Rd, Rajajinagar, Bengaluru 560010 (AC)" },
    { name: "Jayanagar", phone: "9008162086", address: "5th Floor Jodh Tower, 27th Cross 5th Main, Jayanagar 4th Block, Bengaluru 560011" },
    { name: "Yelahanka", phone: null, address: "Yelahanka, Bengaluru" },
  ],
  signatureDishes: [
    "Butter Chicken", "Paneer Tikka", "Tawa Veg", "Chicken Punjabi Masala", "Mutton Rogan Josh",
    "Dal Tadka", "Desi Ghee Fulka", "Kulhad Lassi", "Lemon Chicken", "Kalmi Kebab",
    "Chicken Lahsuniya", "Kadai Paneer", "Paneer Butter Masala",
  ],
  faqs: [
    "Family-friendly dhaba-style restaurant with veg and non-veg North Indian food.",
    "No online reservations — walk in welcome at any branch.",
    "Home/office delivery via Zomato and Swiggy.",
    "Mahadevpura and Rajajinagar branches are fully air-conditioned.",
    "Not pet-friendly. No dedicated vegan or gluten-free menu.",
  ],
  comboRecommendations: {
    nonVeg: {
      spicy: [
        "Tandoori Chicken + Chicken Kadai + Butter Roti + Jeera Rice + Dal Tadka + Boondi Raitha + Kulhad Lassi",
        "Chicken Chilli + Chicken Tikka Masala + Butter Garlic Naan + Chicken Curry + Plain Rice + Masala Soda",
      ],
      medium: [
        "Tandoori Kabab + Chicken Methi + Butter Naan + Jeera Rice + Dal Fry + Kulhad Lassi",
        "Kalmi Kabab + Chicken Punjabi Masala + Butter Garlic Naan + Chicken Dum Biryani + Jaljeera + Gulab Jamun",
      ],
      mild: [
        "Chicken Garlic + Chicken Methi + Butter Kulcha + Biryani Rice + Kulhad Lassi",
        "Malai Kabab + Chicken Butter Masala + Butter Garlic Naan + Ghee Rice + Lime Juice + Gulab Jamun",
      ],
    },
    veg: {
      spicy: [
        "Mushroom Pepper Dry + Tawa Veg + Laccha Paratha + Biryani Rice + Kulhad Lassi",
        "Paneer Tikka + Kadai Mushroom + Butter Garlic Naan + Jeera Rice + Jaljeera",
      ],
      medium: [
        "Paneer Chatpata + Aloo Gobi Mutter + Desi Ghee Fulka + Plain Rice + Dal Fry + Kulhad Lassi",
        "Paneer Tikka + Kadai Paneer + Butter Roti + Jeera Rice + Gulab Jamun",
      ],
      mild: [
        "Paneer Butter Masala + Butter Kulcha + Veg Special Pulao + Kulhad Lassi + Gulab Jamun",
        "Malai Paneer Tikka + Diwani Handi + Desi Ghee Fulka + Ghee Rice + Dal Makhani + Fresh Lime Soda",
      ],
    },
  },
};

const MENU_EXTRACTION_PROMPT = `You are extracting menu data from a Chulha Chauki Da Dhaba (North Indian/Punjabi) menu image.
Return JSON only with this exact shape:
{
  "categories": [
    {
      "name": "Category Name",
      "items": [
        {
          "name": "Dish Name",
          "price_inr": 419,
          "half_price_inr": null,
          "full_price_inr": null,
          "description": "optional",
          "spice_level": 0,
          "is_vegetarian": true,
          "is_new": false
        }
      ]
    }
  ],
  "combos": [
    { "name": "Combo title", "spice_level": "spicy|medium|mild", "diet": "veg|non-veg", "items": ["item1", "item2"] }
  ]
}

Rules:
- price_inr is the displayed rupee price as a number (NOT paise). For Half/Full items set half_price_inr and full_price_inr instead.
- spice_level: 0=mild (black chili), 1=mild spicy (green), 2=medium (1 red), 3=spicy (2 red), 4=extra spicy (3 red)
- Extract ALL visible items with accurate prices
- Include category names exactly as shown (Time Pass, Tandoori, Paneer, Dal, Rice, Drinks, etc.)
- For recommendation pages without prices, put items in combos array only`;

// ── Helpers ─────────────────────────────────────────────────────────────────

function log(section, msg) {
  console.log(`[${section}] ${msg}`);
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

async function geminiGenerate(parts, jsonMode = true, retries = 3) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${key}`;
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: jsonMode
            ? { responseMimeType: "application/json", temperature: 0.1 }
            : { temperature: 0.2 },
        }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
      const json = JSON.parse(text);
      const out = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!out) throw new Error("Gemini empty response");
      return out;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        log("gemini", `Retry ${attempt}/${retries}: ${err.message}`);
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }
  throw lastErr;
}

async function testGemini() {
  log("gemini", `Testing API key with model ${CONFIG.geminiModel}...`);
  try {
    const raw = await geminiGenerate([{ text: "Reply with exactly the word: hello" }], false);
    report.gemini.ok = true;
    report.gemini.testResponse = raw.trim().slice(0, 100);
    log("gemini", `OK — response: ${report.gemini.testResponse}`);
  } catch (err) {
    report.gemini.error = err.message;
    report.errors.push(`Gemini: ${err.message}`);
    log("gemini", `FAILED — ${err.message}`);
  }
}

async function getDb() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 20000,
    enableKeepAlive: true,
  });
}

async function withDb(fn) {
  const conn = await getDb();
  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

async function findOrCreateRestaurant(conn) {
  const [rows] = await conn.query(
    "SELECT id FROM restaurants WHERE name = ? LIMIT 1",
    [CONFIG.restaurantName],
  );
  if (rows[0]) return rows[0].id;

  let slug = slugify(CONFIG.restaurantName);
  const [res] = await conn.query(
    `INSERT INTO restaurants (name, slug, email, currency, country, city, timezone, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      CONFIG.restaurantName,
      `${slug}-${Date.now().toString(36)}`,
      CONFIG.emails[0],
      CONFIG.currency,
      "IN",
      CONFIG.city,
      CONFIG.timezone,
    ],
  );
  return res.insertId;
}

async function loginOrRegister(conn) {
  for (const email of CONFIG.emails) {
    const [users] = await conn.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email.toLowerCase()]);
    if (users[0]) {
      const ok = bcrypt.compareSync(CONFIG.password, users[0].password_hash);
      if (ok) {
        report.auth.email = email;
        report.auth.loginOk = true;
        report.auth.userId = users[0].id;
        report.auth.restaurantId = users[0].restaurant_id;
        log("auth", `Logged in existing user ${email} (restaurant ${users[0].restaurant_id})`);
        return { cookie: null, restaurantId: users[0].restaurant_id, userId: users[0].id };
      }
    }
  }

  // Register via API for proper session cookie
  const email = CONFIG.emails[0];
  const res = await fetch(`${CONFIG.baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: CONFIG.adminName,
      email,
      password: CONFIG.password,
      restaurantName: CONFIG.restaurantName,
      phone: "7349738041",
    }),
  });
  const data = await res.json();
  if (!res.ok && res.status !== 409) {
    throw new Error(`Register failed: ${data.error || res.status}`);
  }

  if (res.status === 409) {
    // Email exists but wrong password path — try login API
    const loginRes = await fetch(`${CONFIG.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: CONFIG.password }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(`Login failed: ${loginData.error}`);
    report.auth.email = email;
    report.auth.loginOk = true;
    report.auth.restaurantId = loginData.data.restaurantId;
    report.auth.userId = loginData.data.userId;
    const cookie = loginRes.headers.getSetCookie?.()?.[0]?.split(";")[0] || null;
    log("auth", `Logged in via API: ${email}`);
    return { cookie, restaurantId: loginData.data.restaurantId, userId: loginData.data.userId };
  }

  report.auth.email = email;
  report.auth.registered = true;
  report.auth.loginOk = true;
  report.auth.restaurantId = data.data.restaurantId;
  report.auth.userId = data.data.userId;
  const cookie = res.headers.getSetCookie?.()?.[0]?.split(";")[0] || null;
  log("auth", `Registered new account: ${email} (restaurant ${data.data.restaurantId})`);
  return { cookie, restaurantId: data.data.restaurantId, userId: data.data.userId };
}

async function updateRestaurantProfile(conn, restaurantId) {
  await conn.query(
    `UPDATE restaurants SET name=?, currency=?, country=?, city=?, timezone=?, status='active' WHERE id=?`,
    [CONFIG.restaurantName, CONFIG.currency, "IN", CONFIG.city, CONFIG.timezone, restaurantId],
  );
}

async function saveWebsiteContext(conn, restaurantId) {
  report.website.fetched = true;
  const policies = [
    ...WEBSITE_CONTEXT.faqs,
    `Delivery partners: Zomato, Swiggy.`,
    `Branches: ${WEBSITE_CONTEXT.branches.map((b) => `${b.name}${b.phone ? ` (${b.phone})` : ""}`).join("; ")}`,
  ].join("\n");

  const menuSummary = [
    `Signature dishes: ${WEBSITE_CONTEXT.signatureDishes.join(", ")}.`,
    `Cuisine: ${CONFIG.cuisine}.`,
    `Combo recommendations by spice level stored in agent context.`,
  ].join(" ");

  await conn.query(
    `INSERT INTO restaurant_agent_context (restaurant_id) VALUES (?) ON DUPLICATE KEY UPDATE restaurant_id=restaurant_id`,
    [restaurantId],
  );
  await conn.query(
    `UPDATE restaurant_agent_context SET
      hours=?, policies=?, delivery_zones=?, cuisine_type=?, website_url=?,
      menu_summary=?, raw_context=?, extraction_status='ready', last_extracted_at=NOW()
     WHERE restaurant_id=?`,
    [
      WEBSITE_CONTEXT.hours,
      policies,
      "Bangalore — 7 branches (HRBR Layout, Brookefields, Mahadevapura, Sarjapur Road, Indiranagar, Rajajinagar, Jayanagar, Yelahanka)",
      CONFIG.cuisine,
      CONFIG.website,
      menuSummary,
      JSON.stringify({ website: WEBSITE_CONTEXT, combos: WEBSITE_CONTEXT.comboRecommendations }),
      restaurantId,
    ],
  );

  for (const [cat, entries] of Object.entries({
    restaurant: { hours: WEBSITE_CONTEXT.hours, cuisine_type: CONFIG.cuisine, website: CONFIG.website },
    delivery: { area: "Bangalore", partners: ["Zomato", "Swiggy"] },
    branches: { list: WEBSITE_CONTEXT.branches },
    combos: WEBSITE_CONTEXT.comboRecommendations,
  })) {
    for (const [key, value] of Object.entries(entries)) {
      await conn.query(
        `INSERT INTO settings (restaurant_id, category, \`key\`, value)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE value=VALUES(value)`,
        [restaurantId, cat, key, JSON.stringify(value)],
      );
    }
  }
  report.website.saved = true;
  log("website", "Saved hours, branches, FAQs, and combo recommendations");
}

function listMenuImages() {
  if (!fs.existsSync(CONFIG.imageDir)) {
    throw new Error(`Image directory not found: ${CONFIG.imageDir}`);
  }
  return fs
    .readdirSync(CONFIG.imageDir)
    .filter((f) => f.startsWith("image-") && f.endsWith(".png"))
    .sort()
    .map((f) => path.join(CONFIG.imageDir, f));
}

async function extractMenuFromImage(filePath) {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const raw = await geminiGenerate(
    [
      { inline_data: { mime_type: "image/png", data: base64 } },
      { text: MENU_EXTRACTION_PROMPT },
    ],
    true,
  );
  return JSON.parse(raw);
}

function normalizeItem(item, categoryName) {
  const results = [];
  const base = {
    name: item.name?.trim(),
    category: categoryName,
    description: item.description || null,
    spiceLevel: item.spice_level ?? null,
    isVegetarian: Boolean(item.is_vegetarian),
    isNew: Boolean(item.is_new),
  };
  if (!base.name) return results;

  if (item.half_price_inr != null && item.full_price_inr != null) {
    results.push({ ...base, name: `${base.name} (Half)`, price: Math.round(item.half_price_inr * 100), options: { portion: "half" } });
    results.push({ ...base, name: `${base.name} (Full)`, price: Math.round(item.full_price_inr * 100), options: { portion: "full" } });
  } else if (item.price_inr != null) {
    results.push({ ...base, price: Math.round(item.price_inr * 100) });
  }
  return results;
}

async function extractAllMenus() {
  const images = listMenuImages();
  log("menu", `Processing ${images.length} menu images...`);

  const categoryMap = new Map();
  const itemMap = new Map();
  const combos = [];

  for (const img of images) {
    const fname = path.basename(img);
    try {
      log("menu", `Extracting ${fname}...`);
      const data = await extractMenuFromImage(img);
      report.menu.imagesProcessed++;

      for (const cat of data.categories || []) {
        const catName = cat.name?.trim();
        if (!catName) continue;
        if (!categoryMap.has(catName.toLowerCase())) {
          categoryMap.set(catName.toLowerCase(), { name: catName, items: [] });
        }
        for (const item of cat.items || []) {
          for (const norm of normalizeItem(item, catName)) {
            const key = norm.name.toLowerCase();
            if (!itemMap.has(key)) itemMap.set(key, norm);
          }
        }
      }
      for (const combo of data.combos || []) combos.push(combo);
    } catch (err) {
      const msg = `${fname}: ${err.message}`;
      report.menu.errors.push(msg);
      log("menu", `WARN ${msg}`);
    }
  }

  return { categoryMap, itemMap, combos };
}

async function saveMenuToDb(conn, restaurantId, categoryMap, itemMap, combos) {
  await conn.query("DELETE FROM menu_items WHERE restaurant_id = ?", [restaurantId]);
  await conn.query("DELETE FROM menu_categories WHERE restaurant_id = ?", [restaurantId]);

  const catIdByName = new Map();
  let sortOrder = 0;
  for (const [, cat] of categoryMap) {
    const [res] = await conn.query(
      "INSERT INTO menu_categories (restaurant_id, name, sort_order, is_active) VALUES (?, ?, ?, 1)",
      [restaurantId, cat.name, sortOrder++],
    );
    catIdByName.set(cat.name.toLowerCase(), res.insertId);
  }

  let itemCount = 0;
  for (const [, item] of itemMap) {
    const catId = catIdByName.get(item.category?.toLowerCase()) ?? null;
    const desc = [item.description, item.isNew ? "[NEW]" : null].filter(Boolean).join(" ");
    await conn.query(
      `INSERT INTO menu_items
        (restaurant_id, category_id, name, description, price, currency, is_available, is_vegetarian, spice_level, options, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        restaurantId,
        catId,
        item.name,
        desc || null,
        item.price || 0,
        CONFIG.currency,
        item.isVegetarian ? 1 : 0,
        item.spiceLevel,
        item.options ? JSON.stringify(item.options) : null,
        itemCount,
      ],
    );
    itemCount++;
  }

  report.menu.categories = categoryMap.size;
  report.menu.items = itemCount;
  report.menu.combos = combos.length + Object.keys(WEBSITE_CONTEXT.comboRecommendations.nonVeg).length * 2;
  log("menu", `Imported ${itemCount} items in ${categoryMap.size} categories`);
}

function buildAgentPrompt() {
  const branchList = WEBSITE_CONTEXT.branches
    .map((b) => `- ${b.name}: ${b.address}${b.phone ? ` | Ph: ${b.phone}` : ""}`)
    .join("\n");

  const comboBlock = JSON.stringify(WEBSITE_CONTEXT.comboRecommendations, null, 2);

  return `You are the friendly voice ordering assistant for Chulha Chauki Da Dhaba, a beloved North Indian and Punjabi dhaba in Bangalore.

PERSONALITY: Warm, desi, enthusiastic about food. Speak naturally as if greeting a guest at a highway dhaba. Use short spoken sentences — no bullet lists when talking.

HOURS: ${WEBSITE_CONTEXT.hours}

BRANCHES (7 outlets in Bangalore):
${branchList}

ORDERING FLOW:
1. Greet warmly — "Namaste! Welcome to Chulha Chauki Da Dhaba!"
2. Ask: place an order, or need branch/hours info? (We do NOT take reservations by phone — walk in only.)
3. For orders: ask pickup or delivery (delivery via Zomato/Swiggy; voice orders are pickup by default).
4. Use get_menu to answer what's available. Prices are in INR rupees.
5. Suggest combo meals by spice preference when customer is unsure:
${comboBlock}
6. Confirm each dish, quantity, and read back the total.
7. Use create_order, then offer send_payment_link via SMS.
8. Mention signature dishes: ${WEBSITE_CONTEXT.signatureDishes.slice(0, 6).join(", ")}.

SPICE LEVELS: mild (creamy/butter dishes), mild spicy, medium, spicy, extra spicy — ask preference and suggest matching combos.

POLICIES: No online table reservations. Delivery through Zomato/Swiggy. Mahadevpura & Rajajinagar are AC. Not pet-friendly.

Always use API tools for real actions — never invent prices or order IDs.`;
}

function buildAgentFlowSteps() {
  return [
    { id: "step-1", type: "greeting", title: "Welcome", message: "Namaste! Thanks for calling Chulha Chauki Da Dhaba. Kaise madad kar sakta hoon aaj?" },
    { id: "step-2", type: "question", title: "Intent", message: "Would you like to place a food order, or hear about our branches and hours?", branches: { order: "step-3", info: "step-8" } },
    { id: "step-3", type: "question", title: "Order type", message: "Pickup or delivery? (Delivery is via Zomato/Swiggy; I can take pickup orders now.)", branches: { pickup: "step-4", delivery: "step-4" } },
    { id: "step-4", type: "question", title: "Spice preference", message: "What spice level do you prefer — mild, medium, or spicy? I can suggest a perfect combo!", branches: { mild: "step-5", medium: "step-5", spicy: "step-5" } },
    { id: "step-5", type: "action", title: "Take dishes", message: "Take dish orders. Use get_menu. Suggest combos matching their spice level. Confirm each item and quantity.", action: "take_order" },
    { id: "step-6", type: "action", title: "Confirm & total", message: "Read back full order with prices in INR. Ask if they want Kulhad Lassi or Gulab Jamun.", action: "confirm_order" },
    { id: "step-7", type: "action", title: "Payment link", message: "Use create_order then send_payment_link to their phone.", action: "send_payment_link" },
    { id: "step-8", type: "action", title: "Restaurant info", message: "Use get_restaurant_info for hours, branches, signature dishes.", action: "get_info" },
    { id: "step-9", type: "closing", title: "Thank you", message: "Dhanyavaad! Enjoy your meal at Chulha Chauki!" },
  ];
}

async function getOrCreateIntegrationApiKey(conn, restaurantId) {
  const [rows] = await conn.query(
    "SELECT api_key FROM restaurant_integration_keys WHERE restaurant_id = ? LIMIT 1",
    [restaurantId],
  );
  if (rows[0]?.api_key) return rows[0].api_key;
  const apiKey = `cvai_${crypto.randomBytes(24).toString("hex")}`;
  await conn.query(
    "INSERT INTO restaurant_integration_keys (restaurant_id, api_key) VALUES (?, ?)",
    [restaurantId, apiKey],
  );
  return apiKey;
}

async function provisionIntegrations(conn, restaurantId, agentId) {
  const omnidim = new OmniDimension({ apiKey: process.env.OMNIDIM_API_KEY });
  const apiKey = await getOrCreateIntegrationApiKey(conn, restaurantId);
  const baseUrl = CONFIG.baseUrl.replace(/\/$/, "");
  const integrationIds = {};

  const [existing] = await conn.query(
    "SELECT tool_name, omnidim_integration_id FROM omnidim_agent_integrations WHERE restaurant_id = ? AND omnidim_agent_id = ?",
    [restaurantId, String(agentId)],
  );
  const existingMap = new Map(existing.map((r) => [r.tool_name, r.omnidim_integration_id]));

  for (const tool of CHERRY_VOICE_TOOLS) {
    if (existingMap.has(tool.name)) {
      integrationIds[tool.name] = existingMap.get(tool.name);
      continue;
    }
    const payload = {
      name: tool.name,
      url: `${baseUrl}${tool.path}`,
      method: tool.method,
      description: tool.description,
      headers: [
        { key: "Authorization", value: `Bearer ${apiKey}` },
        { key: "X-Restaurant-Key", value: apiKey },
      ],
      query_params: tool.query_params,
      body_params: tool.body_params,
      request_timeout: 30,
    };
    const created = await omnidim.integrations.createCustomApi(payload);
    const integrationId =
      created?.integration?.id ?? created?.integration_id ?? created?.id ?? null;
    if (!integrationId) throw new Error(`No integration id for ${tool.name}`);
    await omnidim.integrations.addToAgent(agentId, integrationId);
    await conn.query(
      `INSERT INTO omnidim_agent_integrations (restaurant_id, omnidim_agent_id, omnidim_integration_id, tool_name)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE omnidim_integration_id=VALUES(omnidim_integration_id)`,
      [restaurantId, String(agentId), integrationId, tool.name],
    );
    integrationIds[tool.name] = integrationId;
    log("agent", `Provisioned tool ${tool.name} → integration ${integrationId}`);
  }
  return { integrationIds, apiKey };
}

async function createVoiceAgent(conn, restaurantId, cookie) {
  if (!process.env.OMNIDIM_API_KEY) throw new Error("OMNIDIM_API_KEY not configured");

  const [existing] = await conn.query(
    "SELECT omnidim_agent_id, id FROM omnidim_agents WHERE restaurant_id = ? ORDER BY created_at DESC LIMIT 1",
    [restaurantId],
  );

  const prompt = buildAgentPrompt();
  const omnidim = new OmniDimension({ apiKey: process.env.OMNIDIM_API_KEY });
  let agentId;

  if (existing[0]?.omnidim_agent_id) {
    agentId = existing[0].omnidim_agent_id;
    report.agent.localId = existing[0].id;
    log("agent", `Reusing existing agent ${agentId}`);
    await omnidim.agents.update(agentId, {
      name: CONFIG.agentName,
      welcome_message: "Namaste! Welcome to Chulha Chauki Da Dhaba. How can I help you today?",
      context_breakdown: [
        { title: "Instructions", body: prompt, type: "text" },
      ],
    });
  } else {
    const created = await omnidim.agents.create({
      name: CONFIG.agentName,
      welcome_message: "Namaste! Welcome to Chulha Chauki Da Dhaba. How can I help you today?",
      context_breakdown: [{ title: "Instructions", body: prompt, type: "text" }],
    });
    agentId = created?.id;
    if (!agentId) throw new Error("Omnidim did not return agent id");

    const [res] = await conn.query(
      `INSERT INTO omnidim_agents (restaurant_id, omnidim_agent_id, name, direction, config, last_synced_at)
       VALUES (?, ?, ?, 'inbound', ?, NOW())
       ON DUPLICATE KEY UPDATE name=VALUES(name), last_synced_at=NOW()`,
      [restaurantId, String(agentId), CONFIG.agentName, JSON.stringify(created)],
    );
    report.agent.localId = res.insertId;
    log("agent", `Created Omnidim agent ${agentId}`);
  }

  report.agent.id = agentId;

  const { integrationIds } = await provisionIntegrations(conn, restaurantId, agentId);
  report.agent.integrations = integrationIds;

  // Save generated prompt
  await conn.query(
    "UPDATE restaurant_agent_context SET generated_prompt = ? WHERE restaurant_id = ?",
    [prompt, restaurantId],
  );

  // Create agent flow
  const steps = buildAgentFlowSteps();
  const flowPrompt = steps.map((s, i) => `## Step ${i + 1}: ${s.title}\n${s.message}`).join("\n\n");

  const [flows] = await conn.query(
    "SELECT id FROM agent_flows WHERE restaurant_id = ? AND name LIKE '%Chulha%' LIMIT 1",
    [restaurantId],
  );
  let flowId;
  if (flows[0]) {
    flowId = flows[0].id;
    await conn.query(
      "UPDATE agent_flows SET steps=?, generated_prompt=?, applied_agent_id=?, is_active=1 WHERE id=?",
      [JSON.stringify(steps), flowPrompt, String(agentId), flowId],
    );
  } else {
    const [fres] = await conn.query(
      `INSERT INTO agent_flows (restaurant_id, name, template, steps, generated_prompt, is_active, applied_agent_id)
       VALUES (?, ?, 'combined', ?, ?, 1, ?)`,
      [restaurantId, "Chulha Chauki Order Flow", JSON.stringify(steps), flowPrompt, String(agentId)],
    );
    flowId = fres.insertId;
  }
  report.agent.flowId = flowId;
  log("agent", `Agent flow id ${flowId} configured`);

  return agentId;
}

async function runTests(restaurantId, apiKey, agentId, cookie) {
  const headers = { Authorization: `Bearer ${apiKey}`, "X-Restaurant-Key": apiKey };

  // Menu API
  try {
    const res = await fetch(`${CONFIG.baseUrl}/api/integrations/omnidim/menu`, { headers });
    const data = await res.json();
    report.tests.menuApi = {
      ok: res.ok,
      status: res.status,
      categories: data.categories?.length ?? data.data?.categories?.length ?? 0,
      items: data.items?.length ?? data.data?.items?.length ?? 0,
    };
    log("test", `Menu API: ${report.tests.menuApi.items} items`);
  } catch (err) {
    report.tests.menuApi = { ok: false, error: err.message };
  }

  // Create order
  try {
    const res = await fetch(`${CONFIG.baseUrl}/api/integrations/omnidim/create-order`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: "+919876543210",
        name: "Test Guest",
        order_type: "pickup",
        items: JSON.stringify([{ name: "Dal Tadka", quantity: 1 }, { name: "Butter Naan", quantity: 2 }]),
        notes: "Setup script test order",
      }),
    });
    const data = await res.json();
    report.tests.createOrder = { ok: res.ok, status: res.status, orderId: data.order_id ?? data.data?.order_id };
    log("test", `Create order: ${report.tests.createOrder.ok ? "OK" : "FAIL"} order_id=${report.tests.createOrder.orderId}`);
  } catch (err) {
    report.tests.createOrder = { ok: false, error: err.message };
  }

  // Restaurant info
  try {
    const res = await fetch(`${CONFIG.baseUrl}/api/integrations/omnidim/restaurant`, { headers });
    const data = await res.json();
    report.tests.restaurantInfo = { ok: res.ok, hasHours: Boolean(data.hours ?? data.data?.hours) };
  } catch (err) {
    report.tests.restaurantInfo = { ok: false, error: err.message };
  }

  // Dashboard login
  if (cookie) {
    try {
      const res = await fetch(`${CONFIG.baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
      const data = await res.json();
      report.tests.dashboardLogin = { ok: res.ok, email: data.data?.email };
    } catch (err) {
      report.tests.dashboardLogin = { ok: false, error: err.message };
    }
  }

  // Demo call session
  if (cookie && agentId) {
    try {
      const res = await fetch(`${CONFIG.baseUrl}/api/omnidim/demo-calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ agent_id: agentId }),
      });
      const data = await res.json();
      report.tests.demoCall = {
        ok: res.ok,
        hasWsUrl: Boolean(data.data?.session?.ws_url ?? data.session?.ws_url),
        wsUrl: (data.data?.session?.ws_url ?? data.session?.ws_url ?? "").slice(0, 80),
      };
      log("test", `Demo call: ${report.tests.demoCall.ok ? "session created" : "failed"}`);
    } catch (err) {
      report.tests.demoCall = { ok: false, error: err.message };
    }
  }

  report.tests.integrationsCount = Object.keys(report.agent.integrations).length;
}

function printReport() {
  console.log("\n" + "=".repeat(60));
  console.log("CHULHA CHAUKI DA DHABA — SETUP TEST REPORT");
  console.log("=".repeat(60));
  console.log("\n## Gemini API");
  console.log(`  Status: ${report.gemini.ok ? "✅ WORKING" : "❌ FAILED"}`);
  console.log(`  Model: ${report.gemini.model}`);
  if (report.gemini.testResponse) console.log(`  Test response: ${report.gemini.testResponse}`);
  if (report.gemini.error) console.log(`  Error: ${report.gemini.error}`);

  console.log("\n## Authentication");
  console.log(`  Email: ${report.auth.email}`);
  console.log(`  Login: ${report.auth.loginOk ? "✅" : "❌"}`);
  console.log(`  Registered new: ${report.auth.registered ? "yes" : "no"}`);
  console.log(`  Restaurant ID: ${report.auth.restaurantId}`);
  console.log(`  User ID: ${report.auth.userId}`);

  console.log("\n## Menu Import");
  console.log(`  Images processed: ${report.menu.imagesProcessed}/10`);
  console.log(`  Categories: ${report.menu.categories}`);
  console.log(`  Items imported: ${report.menu.items}`);
  console.log(`  Combo sets: ${report.menu.combos}`);
  if (report.menu.errors.length) {
    console.log(`  Extraction warnings: ${report.menu.errors.length}`);
    report.menu.errors.forEach((e) => console.log(`    - ${e}`));
  }

  console.log("\n## Website Context");
  console.log(`  Saved: ${report.website.saved ? "✅" : "❌"}`);

  console.log("\n## Omnidim Agent");
  console.log(`  Agent ID: ${report.agent.id}`);
  console.log(`  Local mapping ID: ${report.agent.localId}`);
  console.log(`  Agent flow ID: ${report.agent.flowId}`);
  console.log(`  Integrations (${Object.keys(report.agent.integrations).length}/6):`);
  for (const [tool, id] of Object.entries(report.agent.integrations)) {
    console.log(`    - ${tool}: ${id}`);
  }

  console.log("\n## API Tests");
  for (const [name, result] of Object.entries(report.tests)) {
    console.log(`  ${name}: ${JSON.stringify(result)}`);
  }

  if (report.errors.length) {
    console.log("\n## Errors");
    report.errors.forEach((e) => console.log(`  - ${e}`));
  }
  console.log("\n" + "=".repeat(60));
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Starting Chulha Chauki Da Dhaba setup...\n");

  await testGemini();
  if (!report.gemini.ok) {
    console.error("Gemini API test failed — cannot extract menus. Aborting.");
    printReport();
    process.exit(1);
  }

  let cookie = null;
  let restaurantId;
  let apiKey;
  let agentId;

  try {
    // Auth (short DB session)
    const auth = await withDb(async (conn) => {
      const result = await loginOrRegister(conn);
      restaurantId = result.restaurantId;
      await updateRestaurantProfile(conn, restaurantId);
      await saveWebsiteContext(conn, restaurantId);
      return result;
    });
    cookie = auth.cookie;
    restaurantId = auth.restaurantId;
    report.auth.restaurantId = restaurantId;

    // Menu extraction (no DB — can take several minutes)
    const { categoryMap, itemMap, combos } = await extractAllMenus();

    // Save menu + agent (fresh DB connections)
    await withDb(async (conn) => {
      await saveMenuToDb(conn, restaurantId, categoryMap, itemMap, combos);
      agentId = await createVoiceAgent(conn, restaurantId, cookie);
      apiKey = await getOrCreateIntegrationApiKey(conn, restaurantId);
    });

    // Tests
    await runTests(restaurantId, apiKey, agentId, cookie);
  } catch (err) {
    report.errors.push(err.message);
    console.error("Setup error:", err);
  }

  printReport();
  process.exit(report.errors.length > 0 || !report.gemini.ok ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
