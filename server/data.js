export const cuisines = [
  { id: "all", label: "All", thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80", enabled: true },
  { id: "indian", label: "Indian", thumbnail: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80", enabled: true },
  { id: "italian", label: "Italian", thumbnail: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80", enabled: true },
  { id: "japanese", label: "Japanese", thumbnail: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80", enabled: true },
  { id: "healthy", label: "Healthy", thumbnail: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&q=80", enabled: true },
  { id: "desserts", label: "Desserts", thumbnail: "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=600&q=80", enabled: true },
];

export const menuItems = [
  { id: 101, cuisine: "indian", name: "Butter Chicken Bowl", desc: "Tandoori chicken, silky makhani gravy, jeera rice, pickled onions", price: 289, cal: 720, prepTime: "20-25", popular: true, spice: "Medium", color: "#D96A41" },
  { id: 102, cuisine: "indian", name: "Paneer Tikka Wrap", desc: "Charred paneer, mint chutney, onion salad, flaky roomali wrap", price: 219, cal: 540, prepTime: "15-20", popular: true, spice: "Mild", color: "#C4572A" },
  { id: 103, cuisine: "italian", name: "Truffle Mushroom Pasta", desc: "Tagliatelle, roasted mushrooms, parmesan cream, black pepper", price: 349, cal: 640, prepTime: "18-22", popular: true, spice: "None", color: "#B88A4A" },
  { id: 104, cuisine: "italian", name: "Margherita Flatbread", desc: "Fresh mozzarella, basil oil, blistered tomato sauce", price: 299, cal: 610, prepTime: "16-20", popular: false, spice: "None", color: "#CE8B2C" },
  { id: 105, cuisine: "japanese", name: "Salmon Sushi Box", desc: "Nigiri, spicy roll, cucumber maki, soy pearls, wasabi", price: 429, cal: 480, prepTime: "22-30", popular: true, spice: "Mild", color: "#5A8FD8" },
  { id: 106, cuisine: "japanese", name: "Teriyaki Rice Plate", desc: "Sticky rice, glazed chicken, sesame greens, soft egg", price: 319, cal: 590, prepTime: "18-24", popular: false, spice: "None", color: "#4E79BB" },
  { id: 107, cuisine: "healthy", name: "Green Goddess Salad", desc: "Avocado, kale, quinoa, citrus seeds, herbed yogurt dressing", price: 259, cal: 410, prepTime: "10-15", popular: true, spice: "None", color: "#5CA06C" },
  { id: 108, cuisine: "healthy", name: "Protein Power Bowl", desc: "Brown rice, grilled chicken, roasted pumpkin, tahini crunch", price: 309, cal: 530, prepTime: "14-18", popular: true, spice: "Mild", color: "#4B8C5A" },
  { id: 109, cuisine: "desserts", name: "Chocolate Fondant", desc: "Warm center cake, vanilla anglaise, cocoa crumble", price: 189, cal: 360, prepTime: "12-16", popular: true, spice: "None", color: "#9A5A6D" },
  { id: 110, cuisine: "desserts", name: "Berry Cheesecake Jar", desc: "Whipped cream cheese, berry compote, biscuit crumbs", price: 169, cal: 320, prepTime: "8-12", popular: false, spice: "None", color: "#B86A9B" },
];

export const seededUsers = [
  { id: "user_demo", name: "Demo User", email: "demo@bkfast.app", password: "Demo123!", role: "customer" },
  { id: "admin_demo", name: "Admin", email: "admin@bkfast.app", password: "Admin123!", role: "admin" },
  { id: "manager_demo", name: "Store Manager", email: "manager@bkfast.app", password: "Manager123!", role: "manager" },
  { id: "finance_demo", name: "Finance Lead", email: "finance@bkfast.app", password: "Finance123!", role: "finance" },
  { id: "ops_demo", name: "Ops Controller", email: "ops@bkfast.app", password: "Ops123!", role: "operations" },
];

export function listMenuItems({ cuisine = "all", search = "" } = {}) {
  const term = search.trim().toLowerCase();
  return menuItems.filter((item) => {
    const matchesCuisine = cuisine === "all" || !cuisine || item.cuisine === cuisine;
    const matchesSearch = !term || item.name.toLowerCase().includes(term) || item.desc.toLowerCase().includes(term) || item.cuisine.toLowerCase().includes(term);
    return matchesCuisine && matchesSearch;
  });
}

export function getMenuItemById(id) {
  return menuItems.find((item) => item.id === Number(id)) ?? null;
}

export function findCuisineLabel(id) {
  return cuisines.find((entry) => entry.id === id)?.label ?? id;
}

export function buildOrder(cartItems = [], itemLookup = getMenuItemById) {
  const items = cartItems.map((cartItem) => {
    const menuItem = itemLookup(cartItem.itemId);
    if (!menuItem) return null;
    const quantity = Math.max(1, Number(cartItem.quantity) || 1);
    const lineTotal = menuItem.price * quantity;
    return { itemId: menuItem.id, name: menuItem.name, cuisine: menuItem.cuisine, cuisineLabel: findCuisineLabel(menuItem.cuisine), quantity, unitPrice: menuItem.price, lineTotal };
  }).filter(Boolean);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryFee = items.length ? 39 : 0;
  const platformFee = items.length ? 12 : 0;
  return { items, subtotal, deliveryFee, platformFee, total: subtotal + deliveryFee + platformFee };
}

export async function buildOrderAsync(cartItems = [], itemLookup) {
  const items = (await Promise.all(cartItems.map(async (cartItem) => {
    const menuItem = await itemLookup(cartItem.itemId);
    if (!menuItem) return null;
    const quantity = Math.max(1, Number(cartItem.quantity) || 1);
    const lineTotal = menuItem.price * quantity;
    return { itemId: menuItem.id, name: menuItem.name, cuisine: menuItem.cuisine, cuisineLabel: findCuisineLabel(menuItem.cuisine), quantity, unitPrice: menuItem.price, lineTotal };
  }))).filter(Boolean);
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryFee = items.length ? 39 : 0;
  const platformFee = items.length ? 12 : 0;
  return { items, subtotal, deliveryFee, platformFee, total: subtotal + deliveryFee + platformFee };
}
