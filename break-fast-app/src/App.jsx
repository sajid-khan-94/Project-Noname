import { useState, useEffect } from "react";

const darkTheme = {
  bg: "#0D0B07",
  surface: "#1A1610",
  card: "#221E16",
  cardHover: "#2A261C",
  accent: "#F5A623",
  accentDeep: "#C47E0D",
  accentSoft: "rgba(245,166,35,0.12)",
  text: "#F5F0E8",
  muted: "#9A9080",
  subtle: "#5C5648",
  border: "rgba(245,166,35,0.25)",
  borderSoft: "rgba(255,255,255,0.07)",
  navBg: "rgba(13,11,7,0.92)",
  green: "#4CAF7D",
  red: "#E85D4A",
  toggleBg: "#2A261C",
  toggleBorder: "rgba(245,166,35,0.3)",
};

const lightTheme = {
  bg: "#FDFAF5",
  surface: "#FFFFFF",
  card: "#FFF8EE",
  cardHover: "#FFF3E0",
  accent: "#C47E0D",
  accentDeep: "#9A6009",
  accentSoft: "rgba(196,126,13,0.10)",
  text: "#1A1610",
  muted: "#6B5E4A",
  subtle: "#A89880",
  border: "rgba(196,126,13,0.25)",
  borderSoft: "rgba(0,0,0,0.08)",
  navBg: "rgba(253,250,245,0.92)",
  green: "#2E7D52",
  red: "#C0392B",
  toggleBg: "#FFF3E0",
  toggleBorder: "rgba(196,126,13,0.3)",
};

const CATEGORIES = [
  { id: "all", label: "All", icon: "◈" },
  { id: "burgers", label: "Burgers", icon: "⬡" },
  { id: "pizza", label: "Pizza", icon: "◉" },
  { id: "sushi", label: "Sushi", icon: "◎" },
  { id: "bowls", label: "Bowls", icon: "◍" },
  { id: "desserts", label: "Desserts", icon: "◌" },
];

const RESTAURANTS = [
  {
    id: 1, category: "burgers",
    name: "Smash & Grind", cuisine: "Craft Burgers",
    rating: 4.9, reviews: 2840, time: "18–25", delivery: 0, minOrder: 12,
    tags: ["#1 in City", "Fan Favorite"],
    color: "#E85D4A",
    items: [
      { id: 101, name: "Double Smash Stack", desc: "Two 4oz patties, American cheese, special sauce, pickles", price: 14.90, popular: true, cal: 890 },
      { id: 102, name: "Truffle Mushroom Melt", desc: "Wagyu beef, truffle aioli, crispy shallots, gruyère", price: 17.50, popular: false, cal: 760 },
      { id: 103, name: "Crispy Chicken Sando", desc: "Buttermilk fried thigh, gochujang slaw, pickled daikon", price: 13.90, popular: true, cal: 680 },
      { id: 104, name: "Loaded Fries", desc: "Skin-on fries, cheese sauce, bacon bits, jalapeños", price: 8.50, popular: false, cal: 540 },
      { id: 105, name: "Vanilla Custard Shake", desc: "House-made custard, Madagascar vanilla, whipped cream", price: 7.90, popular: false, cal: 420 },
    ]
  },
  {
    id: 2, category: "pizza",
    name: "Forno Nero", cuisine: "Neapolitan Pizza",
    rating: 4.8, reviews: 1620, time: "22–35", delivery: 2.99, minOrder: 15,
    tags: ["Wood Fired", "Authentic"],
    color: "#F5A623",
    items: [
      { id: 201, name: "Margherita Classica", desc: "San Marzano DOP, fior di latte, fresh basil, EVOO", price: 16.50, popular: true, cal: 720 },
      { id: 202, name: "Nduja Diavola", desc: "Spicy Calabrian nduja, provolone, honey drizzle", price: 19.90, popular: true, cal: 850 },
      { id: 203, name: "Burrata Bianca", desc: "No-tomato base, burrata, truffle, arugula, lemon zest", price: 21.50, popular: false, cal: 680 },
      { id: 204, name: "Tiramisu", desc: "Classic Venetian recipe, Savoiardi, mascarpone cream", price: 8.90, popular: false, cal: 380 },
    ]
  },
  {
    id: 3, category: "sushi",
    name: "Omakase Daily", cuisine: "Modern Japanese",
    rating: 4.95, reviews: 980, time: "30–45", delivery: 3.99, minOrder: 25,
    tags: ["Chef's Pick", "Premium"],
    color: "#6B9CF5",
    items: [
      { id: 301, name: "Toro Otoro Set", desc: "6pc fatty tuna nigiri, yuzu ponzu, shiso", price: 32.00, popular: true, cal: 420 },
      { id: 302, name: "Spicy Dragon Roll", desc: "Tempura shrimp, cucumber, spicy tuna, avocado, sriracha aioli", price: 18.50, popular: true, cal: 580 },
      { id: 303, name: "Edamame Truffle", desc: "Steamed edamame, black truffle salt, sesame oil", price: 9.00, popular: false, cal: 190 },
      { id: 304, name: "Miso Black Cod", desc: "48hr miso-marinated black cod, pickled ginger", price: 28.00, popular: false, cal: 520 },
    ]
  },
  {
    id: 4, category: "bowls",
    name: "The Grain Lab", cuisine: "Grain Bowls & Salads",
    rating: 4.7, reviews: 3100, time: "15–22", delivery: 0, minOrder: 10,
    tags: ["Free Delivery", "Healthy"],
    color: "#4CAF7D",
    items: [
      { id: 401, name: "Green Goddess Bowl", desc: "Farro, roasted broccolini, avocado, pumpkin seeds, tahini-herb dressing", price: 15.50, popular: true, cal: 520 },
      { id: 402, name: "Korean BBQ Bowl", desc: "Short rib, kimchi fried rice, gochujang glaze, sesame cucumber", price: 17.90, popular: true, cal: 720 },
      { id: 403, name: "Açaí Power Bowl", desc: "Organic açaí, granola, fresh berries, honey, coconut flakes", price: 13.50, popular: false, cal: 460 },
      { id: 404, name: "Chicken Caesar Wrap", desc: "Grilled chicken, romaine, house Caesar, parmesan crisp, in a spinach wrap", price: 14.00, popular: false, cal: 580 },
    ]
  },
  {
    id: 5, category: "desserts",
    name: "Pâtisserie Lune", cuisine: "French Pastries",
    rating: 4.85, reviews: 760, time: "20–30", delivery: 2.50, minOrder: 18,
    tags: ["Award Winning", "Artisan"],
    color: "#C47EBF",
    items: [
      { id: 501, name: "Mille-Feuille", desc: "Caramelized puff pastry, diplomat cream, vanilla glaze", price: 9.50, popular: true, cal: 420 },
      { id: 502, name: "Chocolate Fondant Box", desc: "4 dark chocolate fondants, crème anglaise, gold leaf", price: 18.00, popular: true, cal: 880 },
      { id: 503, name: "Tarte au Citron", desc: "French butter pastry, lemon curd, Italian meringue, torched", price: 8.50, popular: false, cal: 380 },
      { id: 504, name: "Croissant Box (6)", desc: "Freshly baked all-butter croissants, house jam selection", price: 14.00, popular: false, cal: 1560 },
    ]
  },
];

const injectStyles = (theme) => {
  const styleId = "fda-styles";
  let style = document.getElementById(styleId);
  if (!style) { style = document.createElement("style"); style.id = styleId; document.head.appendChild(style); }
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;700&family=DM+Sans:wght@300;400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${theme.bg}; color: ${theme.text}; font-family: 'DM Sans', sans-serif; transition: background 0.3s, color 0.3s; }
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: ${theme.surface}; }
    ::-webkit-scrollbar-thumb { background: ${theme.subtle}; border-radius: 2px; }
    .fda-app { min-height: 100vh; background: ${theme.bg}; transition: background 0.3s; }
    .serif { font-family: 'Playfair Display', serif; }

    /* Nav */
    .nav { position: sticky; top: 0; z-index: 100; background: ${theme.navBg}; backdrop-filter: blur(20px); border-bottom: 1px solid ${theme.borderSoft}; transition: background 0.3s, border-color 0.3s; }
    .nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; height: 64px; }
    .nav-logo { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: ${theme.accent}; letter-spacing: -0.5px; }
    .nav-logo span { color: ${theme.text}; }
    .nav-search { display: flex; align-items: center; gap: 8px; background: ${theme.surface}; border: 1px solid ${theme.borderSoft}; border-radius: 10px; padding: 0 14px; width: 260px; height: 38px; transition: border-color 0.2s; }
    .nav-search:focus-within { border-color: ${theme.accent}; }
    .nav-search input { background: none; border: none; outline: none; color: ${theme.text}; font-size: 14px; font-family: 'DM Sans', sans-serif; width: 100%; }
    .nav-search input::placeholder { color: ${theme.subtle}; }
    .nav-actions { display: flex; align-items: center; gap: 12px; }
    .btn-icon { width: 38px; height: 38px; border-radius: 8px; background: ${theme.surface}; border: 1px solid ${theme.borderSoft}; color: ${theme.text}; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .btn-icon:hover { background: ${theme.card}; border-color: ${theme.accent}; }
    .cart-badge { position: relative; }
    .badge { position: absolute; top: -4px; right: -4px; background: ${theme.accent}; color: #fff; font-size: 10px; font-weight: 700; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

    /* Theme Toggle */
    .theme-toggle { display: flex; align-items: center; gap: 8px; background: ${theme.toggleBg}; border: 1px solid ${theme.toggleBorder}; border-radius: 100px; padding: 4px 6px; cursor: pointer; transition: all 0.3s; }
    .toggle-option { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: all 0.25s; }
    .toggle-option.active { background: ${theme.accent}; }

    /* Hero */
    .hero { max-width: 1200px; margin: 0 auto; padding: 48px 24px 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; }
    .hero-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 2px; color: ${theme.accent}; text-transform: uppercase; margin-bottom: 16px; }
    .hero-title { font-family: 'Playfair Display', serif; font-size: 52px; line-height: 1.1; font-weight: 700; margin-bottom: 16px; color: ${theme.text}; }
    .hero-title em { color: ${theme.accent}; font-style: italic; }
    .hero-sub { color: ${theme.muted}; font-size: 16px; line-height: 1.6; max-width: 380px; margin-bottom: 32px; }
    .hero-cta { display: flex; gap: 12px; }
    .btn-primary { background: ${theme.accent}; color: #fff; border: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
    .btn-primary:hover { background: ${theme.accentDeep}; transform: translateY(-1px); }
    .btn-secondary { background: transparent; color: ${theme.text}; border: 1px solid ${theme.borderSoft}; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
    .btn-secondary:hover { border-color: ${theme.accent}; color: ${theme.accent}; }
    .hero-stats { display: flex; gap: 32px; margin-top: 32px; }
    .stat-num { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: ${theme.text}; }
    .stat-label { font-size: 12px; color: ${theme.muted}; margin-top: 2px; }
    .hero-visual { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .hero-card { background: ${theme.card}; border: 1px solid ${theme.borderSoft}; border-radius: 16px; padding: 20px; transition: background 0.3s, border-color 0.3s; }
    .hero-card.featured { grid-column: span 2; background: ${theme.card}; border-color: ${theme.border}; }
    .hero-card-tag { font-size: 10px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: ${theme.accent}; margin-bottom: 8px; }
    .hero-card-name { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; margin-bottom: 4px; color: ${theme.text}; }
    .hero-card-sub { font-size: 12px; color: ${theme.muted}; }
    .hero-card-meta { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12px; color: ${theme.muted}; }
    .rating-dot { color: ${theme.accent}; font-size: 14px; }

    /* Categories */
    .section { max-width: 1200px; margin: 0 auto; padding: 0 24px 40px; }
    .section-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 20px; }
    .section-title { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: ${theme.text}; }
    .section-link { font-size: 13px; color: ${theme.accent}; cursor: pointer; }
    .cats { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
    .cats::-webkit-scrollbar { display: none; }
    .cat-chip { display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 100px; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; transition: all 0.2s; border: 1px solid ${theme.borderSoft}; background: ${theme.surface}; color: ${theme.muted}; }
    .cat-chip.active { background: ${theme.accentSoft}; border-color: ${theme.accent}; color: ${theme.accent}; }
    .cat-chip:hover:not(.active) { border-color: ${theme.subtle}; color: ${theme.text}; }
    .cat-icon { font-size: 14px; }

    /* Restaurant Grid */
    .rest-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .rest-card { background: ${theme.card}; border: 1px solid ${theme.borderSoft}; border-radius: 20px; overflow: hidden; cursor: pointer; transition: all 0.25s; }
    .rest-card:hover { border-color: ${theme.border}; transform: translateY(-3px); background: ${theme.cardHover}; }
    .rest-banner { height: 140px; position: relative; display: flex; align-items: flex-end; padding: 16px; }
    .rest-banner-pattern { position: absolute; inset: 0; opacity: 0.15; }
    .rest-tags { display: flex; gap: 6px; position: relative; z-index: 1; }
    .tag { font-size: 10px; font-weight: 600; letter-spacing: 0.5px; padding: 4px 10px; border-radius: 100px; background: rgba(0,0,0,0.55); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
    .rest-body { padding: 18px; }
    .rest-name { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; margin-bottom: 2px; color: ${theme.text}; }
    .rest-cuisine { font-size: 12px; color: ${theme.muted}; margin-bottom: 14px; }
    .rest-meta { display: flex; gap: 16px; }
    .meta-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: ${theme.muted}; }
    .meta-item strong { color: ${theme.text}; font-weight: 500; }
    .meta-icon { font-size: 12px; }

    /* Restaurant Detail Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
    .modal { background: ${theme.surface}; border-radius: 24px 24px 0 0; width: 100%; max-width: 680px; max-height: 85vh; overflow-y: auto; }
    .modal-hero { height: 180px; position: relative; display: flex; align-items: flex-end; padding: 20px 24px; }
    .modal-hero-pattern { position: absolute; inset: 0; opacity: 0.2; }
    .modal-close { position: absolute; top: 16px; right: 16px; width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.55); border: none; color: #fff; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; z-index: 1; }
    .modal-title-wrap { position: relative; z-index: 1; }
    .modal-rest-name { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,0.4); }
    .modal-rest-cuisine { font-size: 13px; color: rgba(255,255,255,0.8); margin-top: 2px; }
    .modal-body { padding: 24px; }
    .modal-meta-row { display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
    .modal-meta-pill { display: flex; align-items: center; gap: 6px; background: ${theme.card}; border: 1px solid ${theme.borderSoft}; padding: 8px 14px; border-radius: 100px; font-size: 12px; color: ${theme.muted}; }
    .modal-meta-pill strong { color: ${theme.text}; }
    .menu-section-title { font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: ${theme.accent}; margin-bottom: 14px; }
    .menu-item { display: flex; align-items: center; justify-content: space-between; padding: 16px; background: ${theme.card}; border: 1px solid ${theme.borderSoft}; border-radius: 14px; margin-bottom: 10px; transition: border-color 0.2s; }
    .menu-item:hover { border-color: ${theme.border}; }
    .menu-item-info { flex: 1; }
    .menu-item-name { font-size: 15px; font-weight: 500; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; color: ${theme.text}; }
    .popular-badge { font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; background: ${theme.accentSoft}; color: ${theme.accent}; padding: 2px 8px; border-radius: 100px; border: 1px solid ${theme.border}; }
    .menu-item-desc { font-size: 12px; color: ${theme.muted}; line-height: 1.5; margin-bottom: 6px; max-width: 380px; }
    .menu-item-cal { font-size: 11px; color: ${theme.subtle}; }
    .menu-item-right { display: flex; align-items: center; gap: 12px; margin-left: 16px; }
    .menu-item-price { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: ${theme.accent}; white-space: nowrap; }
    .add-btn { width: 32px; height: 32px; border-radius: 50%; background: ${theme.accent}; border: none; color: #fff; font-size: 20px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
    .add-btn:hover { background: ${theme.accentDeep}; transform: scale(1.1); }

    /* Cart Panel */
    .cart-panel { position: fixed; top: 0; right: 0; height: 100vh; width: 380px; background: ${theme.surface}; border-left: 1px solid ${theme.borderSoft}; z-index: 300; display: flex; flex-direction: column; transform: translateX(100%); transition: transform 0.35s cubic-bezier(0.4,0,0.2,1), background 0.3s, border-color 0.3s; }
    .cart-panel.open { transform: translateX(0); }
    .cart-header { padding: 24px; border-bottom: 1px solid ${theme.borderSoft}; display: flex; align-items: center; justify-content: space-between; }
    .cart-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: ${theme.text}; }
    .cart-close { width: 32px; height: 32px; border-radius: 50%; background: ${theme.card}; border: 1px solid ${theme.borderSoft}; color: ${theme.text}; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; }
    .cart-items { flex: 1; overflow-y: auto; padding: 16px 24px; }
    .cart-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: ${theme.muted}; gap: 8px; }
    .cart-empty-icon { font-size: 40px; opacity: 0.3; }
    .cart-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid ${theme.borderSoft}; }
    .cart-item-info { flex: 1; }
    .cart-item-name { font-size: 14px; font-weight: 500; color: ${theme.text}; }
    .cart-item-price { font-size: 13px; color: ${theme.accent}; margin-top: 2px; }
    .qty-ctrl { display: flex; align-items: center; gap: 10px; }
    .qty-btn { width: 26px; height: 26px; border-radius: 50%; border: 1px solid ${theme.borderSoft}; background: ${theme.card}; color: ${theme.text}; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .qty-btn:hover { border-color: ${theme.accent}; color: ${theme.accent}; }
    .qty-num { font-size: 14px; font-weight: 600; min-width: 20px; text-align: center; color: ${theme.text}; }
    .cart-footer { padding: 24px; border-top: 1px solid ${theme.borderSoft}; }
    .cart-row { display: flex; justify-content: space-between; font-size: 13px; color: ${theme.muted}; margin-bottom: 8px; }
    .cart-row.total { font-size: 18px; color: ${theme.text}; font-weight: 600; margin-top: 12px; margin-bottom: 0; padding-top: 12px; border-top: 1px solid ${theme.borderSoft}; }
    .checkout-btn { width: 100%; margin-top: 16px; background: ${theme.accent}; color: #fff; border: none; padding: 16px; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .checkout-btn:hover { background: ${theme.accentDeep}; transform: translateY(-1px); }

    /* Toast */
    .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(100px); background: ${theme.accent}; color: #fff; padding: 12px 24px; border-radius: 100px; font-size: 13px; font-weight: 600; z-index: 999; transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); white-space: nowrap; }
    .toast.show { transform: translateX(-50%) translateY(0); }

    /* Footer divider */
    .divider { height: 1px; background: ${theme.borderSoft}; max-width: 1200px; margin: 0 auto 40px; }

    @media (max-width: 768px) {
      .hero { grid-template-columns: 1fr; }
      .hero-visual { display: none; }
      .hero-title { font-size: 36px; }
      .nav-search { width: 180px; }
      .cart-panel { width: 100%; }
    }
  `;
};

// Geometric SVG pattern for cards
const Pattern = ({ color, style = {} }) => (
  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", ...style }} viewBox="0 0 400 180" preserveAspectRatio="xMidYMid slice">
    <defs>
      <pattern id={`p-${color.replace('#','')}`} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
        <polygon points="30,0 60,52 0,52" fill="none" stroke={color} strokeWidth="1"/>
        <circle cx="30" cy="30" r="8" fill="none" stroke={color} strokeWidth="0.5"/>
      </pattern>
    </defs>
    <rect width="400" height="180" fill={`url(#p-${color.replace('#','')})`}/>
  </svg>
);

export default function FoodDeliveryApp() {
  const [isDark, setIsDark] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRest, setSelectedRest] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState("");

  const theme = isDark ? darkTheme : lightTheme;

  useEffect(() => { injectStyles(theme); }, [isDark]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const addToCart = (item, restName) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === item.id);
      if (ex) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1, restName }];
    });
    showToast(`Added ${item.name}`);
  };

  const changeQty = (id, delta) => {
    setCart(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0);
      return updated;
    });
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const delivery = selectedRest?.delivery || (cart.length ? 0 : 0);
  const total = subtotal + 2.50;
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  const filtered = RESTAURANTS.filter(r => {
    const matchCat = activeCategory === "all" || r.category === activeCategory;
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.cuisine.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="fda-app">
      {/* Nav */}
      <nav className="nav">
        <div className="nav-inner">
          <div className="nav-logo">feast<span>.</span></div>
          <div className="nav-search">
            <span style={{ color: theme.subtle, fontSize: 14 }}>⌕</span>
            <input placeholder="Search restaurants or cuisine…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="nav-actions">
            <button
              className="theme-toggle"
              onClick={() => setIsDark(d => !d)}
              title="Toggle theme"
            >
              <div className={`toggle-option${isDark ? " active" : ""}`}>🌙</div>
              <div className={`toggle-option${!isDark ? " active" : ""}`}>☀️</div>
            </button>
            <button className="btn-icon">♡</button>
            <button className="btn-icon cart-badge" onClick={() => setCartOpen(true)}>
              🛒
              {totalItems > 0 && <span className="badge">{totalItems}</span>}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div>
          <div className="hero-eyebrow">📍 Delivering to Ghaziabad</div>
          <h1 className="hero-title">Food that<br/>feels like <em>home.</em></h1>
          <p className="hero-sub">From Michelin-starred kitchens to local legends — delivered in under 30 minutes.</p>
          <div className="hero-cta">
            <button className="btn-primary" onClick={() => document.querySelector('.section')?.scrollIntoView({ behavior: 'smooth' })}>Order Now</button>
            <button className="btn-secondary">See Offers</button>
          </div>
          <div className="hero-stats">
            <div><div className="stat-num">200+</div><div className="stat-label">Restaurants</div></div>
            <div><div className="stat-num">25min</div><div className="stat-label">Avg. Delivery</div></div>
            <div><div className="stat-num">4.8★</div><div className="stat-label">Avg. Rating</div></div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card featured" style={{ borderColor: `rgba(245,166,35,0.3)` }}>
            <div className="hero-card-tag">Today's Special</div>
            <div className="hero-card-name" style={{ fontFamily: "'Playfair Display', serif" }}>Double Smash Stack</div>
            <div className="hero-card-sub">Smash & Grind · Craft Burgers</div>
            <div className="hero-card-meta">
              <span className="rating-dot">★</span> 4.9
              <span>·</span> 18–25 min
              <span>·</span>
              <span style={{ color: theme.green, fontWeight: 600 }}>Free delivery</span>
            </div>
          </div>
          {RESTAURANTS.slice(1, 3).map(r => (
            <div key={r.id} className="hero-card" onClick={() => setSelectedRest(r)} style={{ cursor: 'pointer' }}>
              <div className="hero-card-tag" style={{ color: r.color }}>{r.tags[0]}</div>
              <div className="hero-card-name" style={{ fontFamily: "'Playfair Display', serif", fontSize: 16 }}>{r.name}</div>
              <div className="hero-card-sub">{r.cuisine}</div>
              <div className="hero-card-meta">
                <span className="rating-dot">★</span> {r.rating}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title serif">Browse by Category</h2>
        </div>
        <div className="cats">
          {CATEGORIES.map(c => (
            <button key={c.id} className={`cat-chip${activeCategory === c.id ? " active" : ""}`} onClick={() => setActiveCategory(c.id)}>
              <span className="cat-icon">{c.icon}</span>
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Restaurant Grid */}
      <section className="section">
        <div className="section-header">
          <h2 className="section-title serif">
            {activeCategory === "all" ? "Featured Restaurants" : CATEGORIES.find(c => c.id === activeCategory)?.label}
            <span style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", color: theme.muted, fontWeight: 400, marginLeft: 10 }}>
              {filtered.length} places
            </span>
          </h2>
          <span className="section-link">Sort by: Rating ↓</span>
        </div>
        <div className="rest-grid">
          {filtered.map(r => (
            <div key={r.id} className="rest-card" onClick={() => setSelectedRest(r)}>
              <div className="rest-banner" style={{ background: `${r.color}18` }}>
                <Pattern color={r.color} />
                <div className="rest-tags">
                  {r.tags.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
              </div>
              <div className="rest-body">
                <div className="rest-name">{r.name}</div>
                <div className="rest-cuisine">{r.cuisine}</div>
                <div className="rest-meta">
                  <div className="meta-item">
                    <span className="meta-icon" style={{ color: theme.accent }}>★</span>
                    <strong>{r.rating}</strong>
                    <span>({(r.reviews / 1000).toFixed(1)}k)</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-icon">⏱</span>
                    <strong>{r.time}</strong> min
                  </div>
                  <div className="meta-item">
                    <span className="meta-icon">🛵</span>
                    {r.delivery === 0
                      ? <strong style={{ color: theme.green }}>Free</strong>
                      : <><strong>₹{r.delivery.toFixed(2)}</strong></>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="divider" />

      {/* Restaurant Modal */}
      {selectedRest && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedRest(null); }}>
          <div className="modal">
            <div className="modal-hero" style={{ background: `${selectedRest.color}20` }}>
              <Pattern color={selectedRest.color} style={{ opacity: 0.25 }} />
              <button className="modal-close" onClick={() => setSelectedRest(null)}>✕</button>
              <div className="modal-title-wrap">
                <div className="modal-rest-name">{selectedRest.name}</div>
                <div className="modal-rest-cuisine">{selectedRest.cuisine}</div>
              </div>
            </div>
            <div className="modal-body">
              <div className="modal-meta-row">
                <div className="modal-meta-pill">
                  <span style={{ color: theme.accent }}>★</span>
                  <strong>{selectedRest.rating}</strong>
                  <span>({selectedRest.reviews.toLocaleString()} reviews)</span>
                </div>
                <div className="modal-meta-pill">⏱ <strong>{selectedRest.time} min</strong></div>
                <div className="modal-meta-pill">
                  🛵 {selectedRest.delivery === 0
                    ? <strong style={{ color: theme.green }}>Free delivery</strong>
                    : <><strong>₹{selectedRest.delivery.toFixed(2)}</strong> delivery</>}
                </div>
                <div className="modal-meta-pill">Min order: <strong>₹{selectedRest.minOrder}</strong></div>
              </div>

              <div className="menu-section-title">Menu</div>
              {selectedRest.items.map(item => (
                <div key={item.id} className="menu-item">
                  <div className="menu-item-info">
                    <div className="menu-item-name">
                      {item.name}
                      {item.popular && <span className="popular-badge">Popular</span>}
                    </div>
                    <div className="menu-item-desc">{item.desc}</div>
                    <div className="menu-item-cal">{item.cal} cal</div>
                  </div>
                  <div className="menu-item-right">
                    <div className="menu-item-price">₹{item.price.toFixed(2)}</div>
                    <button className="add-btn" onClick={(e) => { e.stopPropagation(); addToCart(item, selectedRest.name); }}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cart Panel */}
      <div className={`cart-panel${cartOpen ? " open" : ""}`}>
        <div className="cart-header">
          <div className="cart-title">Your Order</div>
          <button className="cart-close" onClick={() => setCartOpen(false)}>✕</button>
        </div>
        <div className="cart-items">
          {cart.length === 0
            ? <div className="cart-empty"><div className="cart-empty-icon">🛒</div><span>Your cart is empty</span></div>
            : cart.map(item => (
              <div key={item.id} className="cart-item">
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-price">₹{(item.price * item.qty).toFixed(2)}</div>
                </div>
                <div className="qty-ctrl">
                  <button className="qty-btn" onClick={() => changeQty(item.id, -1)}>−</button>
                  <span className="qty-num">{item.qty}</span>
                  <button className="qty-btn" onClick={() => changeQty(item.id, 1)}>+</button>
                </div>
              </div>
            ))}
        </div>
        {cart.length > 0 && (
          <div className="cart-footer">
            <div className="cart-row"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            <div className="cart-row"><span>Delivery fee</span><span style={{ color: theme.green }}>Free</span></div>
            <div className="cart-row"><span>Platform fee</span><span>₹2.50</span></div>
            <div className="cart-row total"><span>Total</span><span style={{ color: theme.accent }}>₹{total.toFixed(2)}</span></div>
            <button className="checkout-btn">Checkout →</button>
          </div>
        )}
      </div>

      {/* Toast */}
      <div className={`toast${toast ? " show" : ""}`}>{toast}</div>
    </div>
  );
}