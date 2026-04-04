import { useEffect, useMemo, useState } from "react";
import {
  advanceAdminOrder,
  createAdminRefund,
  createOrder,
  deleteAdminCuisine,
  deleteAdminPaymentGateway,
  deleteAdminPromo,
  fetchAdminBilling,
  fetchAdminCuisines,
  fetchAdminLiveOrders,
  fetchAdminOrderMetrics,
  fetchAdminOrders,
  fetchAdminPaymentGateways,
  fetchAdminPromos,
  fetchAdminRefunds,
  fetchAdminUsers,
  fetchCuisines,
  fetchMenuItems,
  fetchMyOrders,
  fetchSession,
  loginUser,
  logoutUser,
  registerUser,
  saveAdminCuisine,
  saveAdminPaymentGateway,
  saveAdminPromo,
} from "./lib/api.js";

const theme = {
  bg: "#10151B",
  surface: "#161D24",
  card: "#1D2630",
  cardHover: "#24303C",
  accent: "#FF8A3D",
  accentSoft: "rgba(255,138,61,0.12)",
  text: "#F7F3EE",
  muted: "#A3AFBC",
  border: "rgba(255,255,255,0.08)",
  green: "#5AC77A",
  red: "#FF6B6B",
};

const cuisineMarks = { all: "All", indian: "IN", italian: "IT", japanese: "JP", healthy: "HL", desserts: "DS" };
const rolePermissions = {
  admin: ["orders", "catalog", "users", "promos", "billing", "gateways"],
  manager: ["orders", "catalog", "users", "promos"],
  finance: ["billing", "gateways"],
  operations: ["orders"],
};

function detectPortalMode() {
  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname.toLowerCase();
  return host.startsWith("admin.") || path.startsWith("/admin") ? "admin" : "customer";
}

function injectStyles() {
  const id = "bkfast-admin-styles";
  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    document.head.appendChild(style);
  }

  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:${theme.bg};color:${theme.text};font-family:'DM Sans',sans-serif}
    button,input,textarea,select{font:inherit}
    .app{min-height:100vh;background:radial-gradient(circle at top left, rgba(255,138,61,.16), transparent 24%),${theme.bg}}
    .shell{max-width:1180px;margin:0 auto;padding:0 24px}
    .nav{position:sticky;top:0;z-index:20;background:rgba(16,21,27,.88);backdrop-filter:blur(16px);border-bottom:1px solid ${theme.border}}
    .nav-inner{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:16px}
    .logo{font-family:'Playfair Display',serif;font-size:26px;color:${theme.accent}}
    .logo span{color:${theme.text}}
    .search{flex:1;max-width:360px;padding:12px 14px;border-radius:14px;border:1px solid ${theme.border};background:${theme.surface};color:${theme.text}}
    .btn,.btn-alt{border:none;border-radius:14px;padding:12px 16px;cursor:pointer}
    .btn{background:${theme.accent};color:white;font-weight:700}
    .btn-alt{background:${theme.surface};color:${theme.text};border:1px solid ${theme.border}}
    .hero,.layout,.auth-grid,.admin-grid{display:grid;gap:20px}
    .hero{padding:48px 0 26px;grid-template-columns:1.15fr .85fr}
    .layout{grid-template-columns:minmax(0,1fr) 360px}
    .auth-grid{grid-template-columns:1fr 1fr}
    .admin-grid{grid-template-columns:1fr 1fr;margin-top:14px}
    .hero-main,.hero-side,.panel,.card,.auth-card,.admin-card,.admin-box{background:${theme.surface};border:1px solid ${theme.border};border-radius:24px}
    .hero-main,.hero-side,.panel,.auth-card,.admin-card,.admin-box{padding:22px}
    .eyebrow{font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:${theme.accent};margin-bottom:12px}
    h1,h2,h3{font-family:'Playfair Display',serif}
    h1{font-size:54px;line-height:1.04;margin-bottom:14px}
    h1 em{font-style:italic;color:${theme.accent}}
    .copy,.muted,.section-copy{color:${theme.muted};line-height:1.7}
    .hero-actions,.chips,.pill-row{display:flex;gap:10px;flex-wrap:wrap}
    .stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
    .stat{background:${theme.card};border:1px solid ${theme.border};border-radius:18px;padding:14px}
    .stat strong{display:block;font-size:22px}
    .section{padding:10px 0 24px}
    .section-head,.split{display:flex;justify-content:space-between;gap:10px}
    .section-head{align-items:end;margin-bottom:16px}
    .chip{padding:10px 16px;border-radius:999px;border:1px solid ${theme.border};background:${theme.surface};color:${theme.muted};cursor:pointer}
    .chip.active{background:${theme.accentSoft};color:${theme.accent};border-color:rgba(255,138,61,.35)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
    .card{padding:18px;display:grid;gap:14px}
    .card:hover{background:${theme.cardHover}}
    .pill{font-size:11px;padding:5px 9px;border-radius:999px;background:rgba(0,0,0,.2);border:1px solid ${theme.border};color:${theme.muted}}
    .price{font-family:'Playfair Display',serif;font-size:28px;color:${theme.accent}}
    .cart-list,.orders,.admin-orders{display:grid;gap:12px}
    .cart-item,.order-card,.admin-order{padding:14px 0;border-bottom:1px solid ${theme.border}}
    .qty{display:inline-flex;gap:8px;align-items:center}
    .qty button{width:28px;height:28px;border-radius:50%;border:1px solid ${theme.border};background:${theme.card};color:${theme.text};cursor:pointer}
    .form{display:grid;gap:10px}
    .form input,.form textarea,.form select{width:100%;padding:12px 14px;border-radius:14px;border:1px solid ${theme.border};background:${theme.card};color:${theme.text}}
    .status{padding:10px 12px;border-radius:12px;background:${theme.card};font-size:13px}
    .ok{color:${theme.green}}
    .error{color:${theme.red}}
    .badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:${theme.accentSoft};color:${theme.accent};font-size:11px;font-weight:700}
    .thumb{width:72px;height:48px;border-radius:12px;object-fit:cover;border:1px solid ${theme.border};background:${theme.card}}
    .check-row{display:flex;gap:8px;align-items:center;color:${theme.muted};font-size:14px}
    @media (max-width: 960px){.hero,.layout,.auth-grid,.admin-grid{grid-template-columns:1fr}}
  `;
}

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const statusLabel = (value) => value.replaceAll("_", " ");

export default function App() {
  const portalMode = useMemo(() => detectPortalMode(), []);
  const [cuisines, setCuisines] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCuisine, setActiveCuisine] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", paymentMethod: "card" });
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({ loginEmail: portalMode === "admin" ? "admin@bkfast.app" : "demo@bkfast.app", loginPassword: portalMode === "admin" ? "Admin123!" : "Demo123!", registerName: "", registerEmail: "", registerPassword: "" });
  const [authMessage, setAuthMessage] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [myOrders, setMyOrders] = useState([]);
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminCuisines, setAdminCuisines] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminPromos, setAdminPromos] = useState([]);
  const [adminLiveOrders, setAdminLiveOrders] = useState([]);
  const [adminMetrics, setAdminMetrics] = useState(null);
  const [billingSummary, setBillingSummary] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [paymentGateways, setPaymentGateways] = useState([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [cuisineForm, setCuisineForm] = useState({ id: "", label: "", thumbnail: "", enabled: true });
  const [promoForm, setPromoForm] = useState({ code: "", title: "", discountPercent: 15, cuisineIds: [] });
  const [refundForm, setRefundForm] = useState({ orderId: "", amount: "", reason: "" });
  const [gatewayForm, setGatewayForm] = useState({ id: "", name: "", provider: "", mode: "test", enabled: true, supportsRefunds: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const permissions = new Set(user?.permissions ?? rolePermissions[user?.role] ?? []);
  const canOrders = permissions.has("orders");
  const canCatalog = permissions.has("catalog");
  const canUsers = permissions.has("users");
  const canPromos = permissions.has("promos");
  const canBilling = permissions.has("billing");
  const canGateways = permissions.has("gateways");

  useEffect(() => {
    injectStyles();
  }, [portalMode]);

  useEffect(() => {
    if (portalMode === "admin") return undefined;
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const [cuisineData, itemData] = await Promise.all([fetchCuisines(), fetchMenuItems()]);
        if (!ignore) {
          setCuisines(cuisineData);
          setItems(itemData);
        }
        try {
          const sessionUser = await fetchSession();
          if (!ignore) setUser(sessionUser);
        } catch (sessionError) {
          if (!ignore && sessionError?.message) {
            setAuthMessage("");
          }
        }
      } catch (err) {
        if (!ignore) setError(err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [portalMode]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await fetchMenuItems({ cuisine: activeCuisine, search });
        if (!ignore) setItems(data);
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [activeCuisine, portalMode, search]);

  useEffect(() => {
    if (!user) {
      setMyOrders([]);
      setAdminOrders([]);
      setAdminCuisines([]);
      setAdminUsers([]);
      setAdminPromos([]);
      setAdminLiveOrders([]);
      setAdminMetrics(null);
      setBillingSummary(null);
      setRefunds([]);
      setPaymentGateways([]);
      return;
    }
    (async () => {
      try {
        if (portalMode === "customer") {
          setMyOrders(await fetchMyOrders());
        }
        if (portalMode === "admin" && user.role !== "customer") {
          if (canOrders) {
            const [orders, liveOrders, metrics] = await Promise.all([
              fetchAdminOrders(),
              fetchAdminLiveOrders(),
              fetchAdminOrderMetrics(),
            ]);
            setAdminOrders(orders);
            setAdminLiveOrders(liveOrders);
            setAdminMetrics(metrics);
          }
          if (canCatalog) setAdminCuisines(await fetchAdminCuisines());
          if (canUsers) setAdminUsers(await fetchAdminUsers());
          if (canPromos) setAdminPromos(await fetchAdminPromos());
          if (canBilling) {
            setBillingSummary(await fetchAdminBilling());
            setRefunds(await fetchAdminRefunds());
          }
          if (canGateways) setPaymentGateways(await fetchAdminPaymentGateways());
        }
      } catch (dashboardError) {
        if (dashboardError?.message) {
          setAdminMessage((current) => current);
        }
      }
    })();
  }, [canBilling, canCatalog, canGateways, canOrders, canPromos, canUsers, portalMode, user]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const deliveryFee = cart.length ? 39 : 0;
  const platformFee = cart.length ? 12 : 0;
  const total = subtotal + deliveryFee + platformFee;
  const featured = items[0];
  const cuisineCount = useMemo(() => cuisines.filter((entry) => entry.id !== "all").length, [cuisines]);

  function updateCart(item, delta) {
    setCart((current) => {
      const exists = current.find((entry) => entry.itemId === item.id);
      if (!exists && delta > 0) return [...current, { itemId: item.id, name: item.name, cuisine: item.cuisine, price: item.price, quantity: 1 }];
      return current.map((entry) => entry.itemId === item.id ? { ...entry, quantity: entry.quantity + delta } : entry).filter((entry) => entry.quantity > 0);
    });
  }

  async function handleLogin() {
    try {
      const nextUser = await loginUser({ email: authForm.loginEmail, password: authForm.loginPassword });
      setUser(nextUser);
      setAuthMessage(`Signed in as ${nextUser.name}`);
    } catch (err) {
      setAuthMessage(err.message);
    }
  }

  async function handleRegister() {
    try {
      const nextUser = await registerUser({ name: authForm.registerName, email: authForm.registerEmail, password: authForm.registerPassword });
      setUser(nextUser);
      setAuthMessage(`Welcome, ${nextUser.name}`);
    } catch (err) {
      setAuthMessage(err.message);
    }
  }

  async function handleCheckout() {
    try {
      const order = await createOrder({
        items: cart.map((item) => ({ itemId: item.itemId, quantity: item.quantity })),
        customer: { name: customer.name, phone: customer.phone, address: customer.address },
        paymentMethod: customer.paymentMethod,
      });
      setCheckoutMessage(`Order ${order.id} created with ${statusLabel(order.status)} status`);
      setCart([]);
      setMyOrders(await fetchMyOrders());
    } catch (err) {
      setCheckoutMessage(err.message);
    }
  }

  async function handleLogout() {
    await logoutUser();
    setUser(null);
    setAuthMessage("Signed out");
  }

  async function handleAdvance(orderId) {
    await advanceAdminOrder(orderId);
    setAdminOrders(await fetchAdminOrders());
  }

  async function handleCuisineSave() {
    try {
      await saveAdminCuisine(cuisineForm);
      setAdminMessage("Cuisine saved");
      setCuisineForm({ id: "", label: "", thumbnail: "", enabled: true });
      setAdminCuisines(await fetchAdminCuisines());
      setCuisines(await fetchCuisines());
      setItems(await fetchMenuItems({ cuisine: activeCuisine, search }));
    } catch (err) {
      setAdminMessage(err.message);
    }
  }

  async function handleCuisineDelete(cuisineId) {
    try {
      await deleteAdminCuisine(cuisineId);
      setAdminMessage("Cuisine removed");
      setAdminCuisines(await fetchAdminCuisines());
      setCuisines(await fetchCuisines());
      setItems(await fetchMenuItems({ cuisine: activeCuisine, search }));
    } catch (err) {
      setAdminMessage(err.message);
    }
  }

  async function handlePromoSave() {
    try {
      await saveAdminPromo(promoForm);
      setAdminMessage("Promo saved");
      setPromoForm({ code: "", title: "", discountPercent: 15, cuisineIds: [] });
      setAdminPromos(await fetchAdminPromos());
    } catch (err) {
      setAdminMessage(err.message);
    }
  }

  async function handlePromoDelete(promoId) {
    await deleteAdminPromo(promoId);
    setAdminMessage("Promo removed");
    setAdminPromos(await fetchAdminPromos());
  }

  async function handleRefundCreate() {
    try {
      await createAdminRefund({ orderId: refundForm.orderId, amount: refundForm.amount ? Number(refundForm.amount) : undefined, reason: refundForm.reason });
      setAdminMessage("Refund recorded");
      setRefundForm({ orderId: "", amount: "", reason: "" });
      setRefunds(await fetchAdminRefunds());
      setBillingSummary(await fetchAdminBilling());
      setAdminOrders(await fetchAdminOrders());
      setAdminLiveOrders(await fetchAdminLiveOrders());
      setAdminMetrics(await fetchAdminOrderMetrics());
    } catch (err) {
      setAdminMessage(err.message);
    }
  }

  async function handleGatewaySave() {
    try {
      await saveAdminPaymentGateway(gatewayForm);
      setAdminMessage("Payment gateway saved");
      setGatewayForm({ id: "", name: "", provider: "", mode: "test", enabled: true, supportsRefunds: true });
      setPaymentGateways(await fetchAdminPaymentGateways());
    } catch (err) {
      setAdminMessage(err.message);
    }
  }

  async function handleGatewayDelete(gatewayId) {
    try {
      await deleteAdminPaymentGateway(gatewayId);
      setAdminMessage("Payment gateway removed");
      setPaymentGateways(await fetchAdminPaymentGateways());
    } catch (err) {
      setAdminMessage(err.message);
    }
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="shell nav-inner">
          <div className="logo">{portalMode === "admin" ? "BKFastAdmin" : "BKFast"}<span>.</span></div>
          {portalMode === "customer"
            ? <input className="search" placeholder="Search dishes or cuisines" value={search} onChange={(event) => setSearch(event.target.value)} />
            : <div className="status">Separate staff portal mode</div>}
          <div className="split">
            {user ? <button className="btn-alt" onClick={handleLogout}>{user.name} • Logout</button> : <button className="btn-alt">Guest</button>}
            <button className="btn">Cart {totalItems}</button>
          </div>
        </div>
      </nav>

      <div className="shell">
        {portalMode === "customer" ? (
        <>
        <section className="hero">
          <div className="hero-main">
            <div className="eyebrow">Direct cuisine ordering</div>
            <h1>Order dishes by <em>cuisine</em>, not by restaurant.</h1>
            <p className="copy">The storefront now sells food directly from a centralized cuisine catalog. Admins can manage cuisines, user accounts, promo groups, and live order progression from one portal.</p>
            <div className="hero-actions">
              <button className="btn" onClick={() => setSearch("bowl")}>Try a quick search</button>
              <button className="btn-alt" onClick={() => setActiveCuisine("desserts")}>Open desserts</button>
            </div>
          </div>
          <div className="hero-side">
            <div>
              <div className="eyebrow">Service snapshot</div>
              <h3>{featured?.name ?? "Loading menu"}</h3>
              <p className="copy">{featured ? `${featured.desc} • ${featured.prepTime} mins` : "Fetching direct-order menu catalog."}</p>
            </div>
            <div className="stat-grid">
              <div className="stat"><strong>{cuisineCount || "--"}</strong><span className="muted">cuisines</span></div>
              <div className="stat"><strong>{items.length || "--"}</strong><span className="muted">menu items</span></div>
              <div className="stat"><strong>{user ? user.role : "guest"}</strong><span className="muted">session role</span></div>
              <div className="stat"><strong>{myOrders.length || "--"}</strong><span className="muted">your orders</span></div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <h2>Cuisines</h2>
              <div className="section-copy">Browse and buy directly under cuisine categories.</div>
            </div>
          </div>
          <div className="chips">
            {cuisines.map((cuisine) => (
              <button key={cuisine.id} className={`chip${activeCuisine === cuisine.id ? " active" : ""}`} onClick={() => setActiveCuisine(cuisine.id)}>
                {cuisineMarks[cuisine.id] ?? cuisine.id} {cuisine.label}
              </button>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <h2>Menu Catalog</h2>
              <div className="section-copy">{loading ? "Loading..." : `${items.length} dishes available right now`}</div>
            </div>
          </div>
          {error ? <div className="status error">{error}</div> : null}
          <div className="layout">
            <div className="grid">
              {items.map((item) => {
                const cartItem = cart.find((entry) => entry.itemId === item.id);
                return (
                  <article key={item.id} className="card">
                    <div className="split">
                      <span className="badge">{item.cuisine}</span>
                      <span className="muted">{item.prepTime} min</span>
                    </div>
                    <div>
                      <h3>{item.name}</h3>
                      <p className="copy">{item.desc}</p>
                    </div>
                    <div className="pill-row">
                      <span className="pill">{item.cal} cal</span>
                      <span className="pill">{item.spice}</span>
                      {item.popular ? <span className="pill">Popular</span> : null}
                    </div>
                    <div className="split" style={{ alignItems: "center" }}>
                      <div className="price">{money(item.price)}</div>
                      <div className="qty">
                        <button onClick={() => updateCart(item, -1)}>-</button>
                        <span>{cartItem?.quantity ?? 0}</span>
                        <button onClick={() => updateCart(item, 1)}>+</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <aside className="panel">
              <h3>Checkout</h3>
              <div className="cart-list">
                {cart.length === 0 ? <div className="status">Add dishes from different cuisines to build a single order.</div> : cart.map((item) => (
                  <div key={item.itemId} className="cart-item">
                    <div className="split">
                      <div>
                        <strong>{item.name}</strong>
                        <div className="muted">{item.cuisine}</div>
                      </div>
                      <strong>{money(item.price * item.quantity)}</strong>
                    </div>
                  </div>
                ))}
              </div>
              <div className="form">
                <input placeholder="Your name" value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} />
                <input placeholder="Phone number" value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} />
                <textarea rows="3" placeholder="Delivery address" value={customer.address} onChange={(event) => setCustomer((current) => ({ ...current, address: event.target.value }))} />
                <select value={customer.paymentMethod} onChange={(event) => setCustomer((current) => ({ ...current, paymentMethod: event.target.value }))}>
                  <option value="card">Card / UPI</option>
                  <option value="cod">Cash on delivery</option>
                </select>
              </div>
              <div className="orders" style={{ marginTop: 16 }}>
                <div className="split"><span className="muted">Subtotal</span><strong>{money(subtotal)}</strong></div>
                <div className="split"><span className="muted">Delivery</span><strong>{money(deliveryFee)}</strong></div>
                <div className="split"><span className="muted">Platform</span><strong>{money(platformFee)}</strong></div>
                <div className="split"><span>Total</span><strong>{money(total)}</strong></div>
              </div>
              <button className="btn" style={{ width: "100%", marginTop: 16 }} onClick={handleCheckout}>Place Order</button>
              {checkoutMessage ? <div className={`status ${checkoutMessage.includes("Order") ? "ok" : "error"}`} style={{ marginTop: 14 }}>{checkoutMessage}</div> : null}
            </aside>
          </div>
        </section>

        <section className="auth-grid">
          <div className="auth-card">
            <div className="section-head">
              <div>
                <h2>Authentication</h2>
                <div className="section-copy">Demo customer: `demo@bkfast.app` / `Demo123!`</div>
                <div className="section-copy">Demo admin: `admin@bkfast.app` / `Admin123!`</div>
              </div>
            </div>
            <div className="form">
              <input placeholder="Login email" value={authForm.loginEmail} onChange={(event) => setAuthForm((current) => ({ ...current, loginEmail: event.target.value }))} />
              <input type="password" placeholder="Login password" value={authForm.loginPassword} onChange={(event) => setAuthForm((current) => ({ ...current, loginPassword: event.target.value }))} />
              <button className="btn" onClick={handleLogin}>Login</button>
            </div>
            <div className="form" style={{ marginTop: 16 }}>
              <input placeholder="Register name" value={authForm.registerName} onChange={(event) => setAuthForm((current) => ({ ...current, registerName: event.target.value }))} />
              <input placeholder="Register email" value={authForm.registerEmail} onChange={(event) => setAuthForm((current) => ({ ...current, registerEmail: event.target.value }))} />
              <input type="password" placeholder="Register password" value={authForm.registerPassword} onChange={(event) => setAuthForm((current) => ({ ...current, registerPassword: event.target.value }))} />
              <button className="btn-alt" onClick={handleRegister}>Create account</button>
            </div>
            {authMessage ? <div className="status" style={{ marginTop: 14 }}>{authMessage}</div> : null}
          </div>

          <div className="auth-card">
            <div className="section-head">
              <div>
                <h2>Your Orders</h2>
                <div className="section-copy">Payment-ready state changes appear here after checkout.</div>
              </div>
            </div>
            <div className="orders">
              {myOrders.length === 0 ? <div className="status">Sign in and place an order to see tracking.</div> : myOrders.map((order) => (
                <div key={order.id} className="order-card">
                  <div className="split">
                    <strong>{order.id}</strong>
                    <span className="badge">{statusLabel(order.status)}</span>
                  </div>
                  <div className="muted">Payment: {statusLabel(order.paymentStatus)} via {order.paymentMethod}</div>
                  <div className="muted">ETA {order.etaMinutes} min • {money(order.total)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
        </>
        ) : null}

        {portalMode === "admin" ? (
          !user ? (
            <section className="auth-grid" style={{ paddingTop: 48 }}>
              <div className="auth-card">
                <div className="eyebrow">Separate Admin Portal</div>
                <h2>Staff Sign In</h2>
                <p className="copy">Use a dedicated admin domain such as `admin.yourdomain.com` or the `/admin` route for staff access.</p>
                <div className="form" style={{ marginTop: 16 }}>
                  <input placeholder="Login email" value={authForm.loginEmail} onChange={(event) => setAuthForm((current) => ({ ...current, loginEmail: event.target.value }))} />
                  <input type="password" placeholder="Login password" value={authForm.loginPassword} onChange={(event) => setAuthForm((current) => ({ ...current, loginPassword: event.target.value }))} />
                  <button className="btn" onClick={handleLogin}>Login to Admin Portal</button>
                </div>
                {authMessage ? <div className="status" style={{ marginTop: 14 }}>{authMessage}</div> : null}
              </div>
              <div className="auth-card">
                <h2>Staff Roles</h2>
                <div className="orders" style={{ marginTop: 16 }}>
                  <div className="status">Admin: `admin@bkfast.app` / `Admin123!`</div>
                  <div className="status">Manager: `manager@bkfast.app` / `Manager123!`</div>
                  <div className="status">Finance: `finance@bkfast.app` / `Finance123!`</div>
                  <div className="status">Operations: `ops@bkfast.app` / `Ops123!`</div>
                </div>
              </div>
            </section>
          ) : user.role === "customer" ? (
            <section className="auth-card" style={{ marginTop: 48 }}>
              <h2>Admin Access Required</h2>
              <p className="copy">This portal is available only to staff roles like admin, manager, finance, and operations.</p>
            </section>
          ) : (
          <section className="admin-card">
            <div className="section-head">
              <div>
                <h2>Admin Dashboard</h2>
                <div className="section-copy">Manage operations based on your role permissions.</div>
              </div>
            </div>
            {adminMessage ? <div className="status" style={{ marginBottom: 14 }}>{adminMessage}</div> : null}
            <div className="admin-grid">
              {canCatalog ? <div className="admin-box">
                <h3>Cuisine Manager</h3>
                <div className="form" style={{ marginTop: 12 }}>
                  <input placeholder="Cuisine id" value={cuisineForm.id} onChange={(event) => setCuisineForm((current) => ({ ...current, id: event.target.value }))} />
                  <input placeholder="Cuisine label" value={cuisineForm.label} onChange={(event) => setCuisineForm((current) => ({ ...current, label: event.target.value }))} />
                  <input placeholder="Thumbnail URL" value={cuisineForm.thumbnail} onChange={(event) => setCuisineForm((current) => ({ ...current, thumbnail: event.target.value }))} />
                  <label className="check-row">
                    <input type="checkbox" checked={cuisineForm.enabled} onChange={(event) => setCuisineForm((current) => ({ ...current, enabled: event.target.checked }))} />
                    Enabled in storefront
                  </label>
                  <button className="btn" onClick={handleCuisineSave}>Save Cuisine</button>
                </div>
                <div className="admin-orders" style={{ marginTop: 16 }}>
                  {adminCuisines.filter((cuisine) => cuisine.id !== "all").map((cuisine) => (
                    <div key={cuisine.id} className="admin-order">
                      <div className="split">
                        <div style={{ display: "flex", gap: 12 }}>
                          <img className="thumb" src={cuisine.thumbnail} alt={cuisine.label} />
                          <div>
                            <strong>{cuisine.label}</strong>
                            <div className="muted">{cuisine.id} • {cuisine.enabled ? "enabled" : "disabled"}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn-alt" onClick={() => setCuisineForm(cuisine)}>Edit</button>
                          <button className="btn-alt" onClick={() => handleCuisineDelete(cuisine.id)}>Remove</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div> : null}

              {canUsers ? <div className="admin-box">
                <h3>Active Users</h3>
                <div className="admin-orders" style={{ marginTop: 12 }}>
                  {adminUsers.map((account) => (
                    <div key={account.id} className="admin-order">
                      <div className="split">
                        <div>
                          <strong>{account.name}</strong>
                          <div className="muted">{account.email}</div>
                        </div>
                        <span className="badge">{account.role}</span>
                      </div>
                      <div className="muted">Active sessions: {account.activeSessions}</div>
                    </div>
                  ))}
                </div>
              </div> : null}

              {canPromos ? <div className="admin-box">
                <h3>Promo Codes by Cuisine</h3>
                <div className="form" style={{ marginTop: 12 }}>
                  <input placeholder="Promo code" value={promoForm.code} onChange={(event) => setPromoForm((current) => ({ ...current, code: event.target.value }))} />
                  <input placeholder="Promo title" value={promoForm.title} onChange={(event) => setPromoForm((current) => ({ ...current, title: event.target.value }))} />
                  <input type="number" min="1" max="100" value={promoForm.discountPercent} onChange={(event) => setPromoForm((current) => ({ ...current, discountPercent: Number(event.target.value) }))} />
                  <select multiple value={promoForm.cuisineIds} onChange={(event) => setPromoForm((current) => ({ ...current, cuisineIds: Array.from(event.target.selectedOptions, (option) => option.value) }))}>
                    {adminCuisines.filter((cuisine) => cuisine.id !== "all").map((cuisine) => (
                      <option key={cuisine.id} value={cuisine.id}>{cuisine.label}</option>
                    ))}
                  </select>
                  <button className="btn" onClick={handlePromoSave}>Save Promo</button>
                </div>
                <div className="admin-orders" style={{ marginTop: 16 }}>
                  {adminPromos.map((promo) => (
                    <div key={promo.id} className="admin-order">
                      <div className="split">
                        <div>
                          <strong>{promo.code}</strong>
                          <div className="muted">{promo.title}</div>
                        </div>
                        <button className="btn-alt" onClick={() => handlePromoDelete(promo.id)}>Delete</button>
                      </div>
                      <div className="muted">{promo.discountPercent}% off • {promo.cuisineIds.join(", ")}</div>
                    </div>
                  ))}
                </div>
              </div> : null}

              {canOrders ? <div className="admin-box">
                <h3>Order Operations</h3>
                <div className="admin-orders" style={{ marginTop: 12 }}>
                  {adminOrders.map((order) => (
                    <div key={order.id} className="admin-order">
                      <div className="split">
                        <div>
                          <strong>{order.id}</strong>
                          <div className="muted">{order.customer.name} • {order.customer.phone}</div>
                        </div>
                        <button className="btn-alt" onClick={() => handleAdvance(order.id)}>Advance</button>
                      </div>
                      <div className="muted">{statusLabel(order.status)} • payment {statusLabel(order.paymentStatus)} • {money(order.total)}</div>
                    </div>
                  ))}
                </div>
              </div> : null}

              {canOrders ? <div className="admin-box">
                <h3>Currently Delivering</h3>
                <div className="admin-orders" style={{ marginTop: 12 }}>
                  {adminLiveOrders.length === 0 ? <div className="status">No active delivery orders right now.</div> : adminLiveOrders.map((order) => (
                    <div key={order.id} className="admin-order">
                      <div className="split">
                        <strong>{order.id}</strong>
                        <span className="badge">{statusLabel(order.status)}</span>
                      </div>
                      <div className="muted">{order.customer.name} • ETA {order.etaMinutes} min</div>
                      <div className="muted">{order.customer.address}</div>
                    </div>
                  ))}
                </div>
              </div> : null}

              {(canOrders || canBilling) ? <div className="admin-box">
                <h3>Order History & Count</h3>
                <div className="admin-orders" style={{ marginTop: 12 }}>
                  <div className="status">Total orders: {adminMetrics?.totalOrders ?? 0}</div>
                  <div className="status">Delivered orders: {adminMetrics?.deliveredOrders ?? 0}</div>
                  <div className="status">Live orders: {adminMetrics?.liveOrders ?? 0}</div>
                  <div className="status">Revenue tracked: {money(adminMetrics?.totalRevenue ?? 0)}</div>
                </div>
              </div> : null}

              {canBilling ? <div className="admin-box">
                <h3>Billing & Refunds</h3>
                <div className="admin-orders" style={{ marginTop: 12 }}>
                  <div className="status">Gross revenue: {money(billingSummary?.grossRevenue ?? 0)}</div>
                  <div className="status">Refunded: {money(billingSummary?.refundedAmount ?? 0)}</div>
                  <div className="status">Net revenue: {money(billingSummary?.netRevenue ?? 0)}</div>
                  <div className="status">Refund count: {billingSummary?.refundCount ?? 0}</div>
                </div>
                <div className="form" style={{ marginTop: 12 }}>
                  <input placeholder="Order id" value={refundForm.orderId} onChange={(event) => setRefundForm((current) => ({ ...current, orderId: event.target.value }))} />
                  <input placeholder="Refund amount (optional)" value={refundForm.amount} onChange={(event) => setRefundForm((current) => ({ ...current, amount: event.target.value }))} />
                  <input placeholder="Refund reason" value={refundForm.reason} onChange={(event) => setRefundForm((current) => ({ ...current, reason: event.target.value }))} />
                  <button className="btn" onClick={handleRefundCreate}>Create Refund</button>
                </div>
                <div className="admin-orders" style={{ marginTop: 16 }}>
                  {refunds.map((refund) => (
                    <div key={refund.id} className="admin-order">
                      <div className="split">
                        <strong>{refund.orderId}</strong>
                        <span className="badge">{refund.status}</span>
                      </div>
                      <div className="muted">{money(refund.amount)} • {refund.reason}</div>
                    </div>
                  ))}
                </div>
              </div> : null}

              {canGateways ? <div className="admin-box">
                <h3>Payment Gateways</h3>
                <div className="form" style={{ marginTop: 12 }}>
                  <input placeholder="Gateway name" value={gatewayForm.name} onChange={(event) => setGatewayForm((current) => ({ ...current, name: event.target.value }))} />
                  <input placeholder="Provider key" value={gatewayForm.provider} onChange={(event) => setGatewayForm((current) => ({ ...current, provider: event.target.value }))} />
                  <select value={gatewayForm.mode} onChange={(event) => setGatewayForm((current) => ({ ...current, mode: event.target.value }))}>
                    <option value="test">Test</option>
                    <option value="live">Live</option>
                  </select>
                  <label className="check-row">
                    <input type="checkbox" checked={gatewayForm.enabled} onChange={(event) => setGatewayForm((current) => ({ ...current, enabled: event.target.checked }))} />
                    Enabled gateway
                  </label>
                  <label className="check-row">
                    <input type="checkbox" checked={gatewayForm.supportsRefunds} onChange={(event) => setGatewayForm((current) => ({ ...current, supportsRefunds: event.target.checked }))} />
                    Supports refunds
                  </label>
                  <button className="btn" onClick={handleGatewaySave}>Save Gateway</button>
                </div>
                <div className="admin-orders" style={{ marginTop: 16 }}>
                  {paymentGateways.map((gateway) => (
                    <div key={gateway.id} className="admin-order">
                      <div className="split">
                        <div>
                          <strong>{gateway.name}</strong>
                          <div className="muted">{gateway.provider} • {gateway.mode}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn-alt" onClick={() => setGatewayForm(gateway)}>Edit</button>
                          <button className="btn-alt" onClick={() => handleGatewayDelete(gateway.id)}>Remove</button>
                        </div>
                      </div>
                      <div className="muted">{gateway.enabled ? "enabled" : "disabled"} • {gateway.supportsRefunds ? "refund-ready" : "no refunds"}</div>
                    </div>
                  ))}
                </div>
              </div> : null}
            </div>
          </section>
          )) : null}
      </div>
    </div>
  );
}
