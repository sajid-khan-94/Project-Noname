import { useEffect, useMemo, useState } from "react";
import {
  advanceAdminOrder,
  createOrder,
  fetchAdminOrders,
  fetchCuisines,
  fetchMenuItems,
  fetchMyOrders,
  fetchSession,
  loginUser,
  logoutUser,
  registerUser,
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

function injectStyles() {
  const id = "bkfast-direct-styles";
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
    .app{min-height:100vh;background:radial-gradient(circle at top left, rgba(255,138,61,.15), transparent 25%),${theme.bg}}
    .shell{max-width:1180px;margin:0 auto;padding:0 24px}
    .nav{position:sticky;top:0;z-index:20;background:rgba(16,21,27,.88);backdrop-filter:blur(16px);border-bottom:1px solid ${theme.border}}
    .nav-inner{min-height:72px;display:flex;align-items:center;justify-content:space-between;gap:16px}
    .logo{font-family:'Playfair Display',serif;font-size:26px;color:${theme.accent}}
    .logo span{color:${theme.text}}
    .search{flex:1;max-width:360px;padding:12px 14px;border-radius:14px;border:1px solid ${theme.border};background:${theme.surface};color:${theme.text}}
    .btn,.btn-alt{border:none;border-radius:14px;padding:12px 16px;cursor:pointer}
    .btn{background:${theme.accent};color:white;font-weight:700}
    .btn-alt{background:${theme.surface};color:${theme.text};border:1px solid ${theme.border}}
    .hero{padding:48px 0 26px;display:grid;grid-template-columns:1.15fr .85fr;gap:22px}
    .hero-main,.hero-side,.panel,.card,.auth-card,.admin-card{background:${theme.surface};border:1px solid ${theme.border};border-radius:24px}
    .hero-main{padding:30px}
    .eyebrow{font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:${theme.accent};margin-bottom:12px}
    h1,h2,h3{font-family:'Playfair Display',serif}
    h1{font-size:54px;line-height:1.04;margin-bottom:14px}
    h1 em{font-style:italic;color:${theme.accent}}
    .copy{color:${theme.muted};line-height:1.7}
    .hero-actions{display:flex;gap:12px;margin-top:22px;flex-wrap:wrap}
    .hero-side{padding:24px;display:grid;gap:14px}
    .stat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
    .stat{background:${theme.card};border:1px solid ${theme.border};border-radius:18px;padding:14px}
    .stat strong{display:block;font-size:22px}
    .section{padding:10px 0 24px}
    .section-head{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:16px}
    .section-copy{color:${theme.muted};font-size:14px}
    .chips{display:flex;gap:10px;flex-wrap:wrap}
    .chip{padding:10px 16px;border-radius:999px;border:1px solid ${theme.border};background:${theme.surface};color:${theme.muted};cursor:pointer}
    .chip.active{background:${theme.accentSoft};color:${theme.accent};border-color:rgba(255,138,61,.35)}
    .layout{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:20px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
    .card{padding:18px;display:grid;gap:14px}
    .card:hover{background:${theme.cardHover}}
    .pill-row{display:flex;gap:8px;flex-wrap:wrap}
    .pill{font-size:11px;padding:5px 9px;border-radius:999px;background:rgba(0,0,0,.2);border:1px solid ${theme.border};color:${theme.muted}}
    .price{font-family:'Playfair Display',serif;font-size:28px;color:${theme.accent}}
    .muted{color:${theme.muted}}
    .panel{padding:20px}
    .panel h3{font-size:24px;margin-bottom:14px}
    .cart-list,.orders,.admin-orders{display:grid;gap:12px}
    .cart-item,.order-card,.admin-order{padding:14px 0;border-bottom:1px solid ${theme.border}}
    .split{display:flex;justify-content:space-between;gap:10px}
    .qty{display:inline-flex;gap:8px;align-items:center}
    .qty button{width:28px;height:28px;border-radius:50%;border:1px solid ${theme.border};background:${theme.card};color:${theme.text};cursor:pointer}
    .form{display:grid;gap:10px}
    .form input,.form textarea,.form select{width:100%;padding:12px 14px;border-radius:14px;border:1px solid ${theme.border};background:${theme.card};color:${theme.text}}
    .status{padding:10px 12px;border-radius:12px;background:${theme.card};font-size:13px}
    .ok{color:${theme.green}}
    .error{color:${theme.red}}
    .auth-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}
    .auth-card,.admin-card{padding:20px}
    .admin-card{margin-top:22px}
    .badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:${theme.accentSoft};color:${theme.accent};font-size:11px;font-weight:700}
    @media (max-width: 960px){.hero,.layout,.auth-grid{grid-template-columns:1fr}}
  `;
}

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function statusLabel(status) {
  return status.replaceAll("_", " ");
}

export default function App() {
  const [cuisines, setCuisines] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCuisine, setActiveCuisine] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", paymentMethod: "card" });
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({ loginEmail: "demo@bkfast.app", loginPassword: "Demo123!", registerName: "", registerEmail: "", registerPassword: "" });
  const [authMessage, setAuthMessage] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [myOrders, setMyOrders] = useState([]);
  const [adminOrders, setAdminOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    let ignore = false;
    async function bootstrap() {
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
    }
    bootstrap();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadItems() {
      try {
        const data = await fetchMenuItems({ cuisine: activeCuisine, search });
        if (!ignore) setItems(data);
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    }
    loadItems();
    return () => {
      ignore = true;
    };
  }, [activeCuisine, search]);

  async function refreshOrders(currentUser = user) {
    try {
      const mine = await fetchMyOrders();
      setMyOrders(mine);
      if (currentUser?.role === "admin") {
        setAdminOrders(await fetchAdminOrders());
      }
    } catch (ordersError) {
      if (ordersError?.message) {
        setCheckoutMessage((current) => current);
      }
    }
  }

  useEffect(() => {
    if (!user) {
      setMyOrders([]);
      setAdminOrders([]);
      return;
    }
    (async () => {
      try {
        const mine = await fetchMyOrders();
        setMyOrders(mine);
        if (user.role === "admin") {
          setAdminOrders(await fetchAdminOrders());
        }
      } catch (ordersError) {
        if (ordersError?.message) {
          setCheckoutMessage((current) => current);
        }
      }
    })();
  }, [user]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const deliveryFee = cart.length ? 39 : 0;
  const platformFee = cart.length ? 12 : 0;
  const total = subtotal + deliveryFee + platformFee;
  const featured = items[0];
  const cuisineCount = useMemo(() => cuisines.filter((entry) => entry.id !== "all").length, [cuisines]);

  function updateCart(item, delta) {
    setCart((current) => {
      const match = current.find((entry) => entry.itemId === item.id);
      if (!match && delta > 0) {
        return [...current, { itemId: item.id, name: item.name, cuisine: item.cuisine, price: item.price, quantity: 1 }];
      }
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
      refreshOrders();
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

  return (
    <div className="app">
      <nav className="nav">
        <div className="shell nav-inner">
          <div className="logo">BKFast<span>.</span></div>
          <input className="search" placeholder="Search dishes or cuisines" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="split">
            {user ? <button className="btn-alt" onClick={handleLogout}>{user.name} • Logout</button> : <button className="btn-alt">Guest</button>}
            <button className="btn">Cart {totalItems}</button>
          </div>
        </div>
      </nav>

      <div className="shell">
        <section className="hero">
          <div className="hero-main">
            <div className="eyebrow">Direct cuisine ordering</div>
            <h1>Order dishes by <em>cuisine</em>, not by restaurant.</h1>
            <p className="copy">The storefront now sells food directly from a centralized cuisine catalog. Authentication, payment-aware order states, and admin fulfillment flow are all wired into the same backend.</p>
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

        {user?.role === "admin" ? (
          <section className="admin-card">
            <div className="section-head">
              <div>
                <h2>Admin Dashboard</h2>
                <div className="section-copy">Advance order states to simulate kitchen and delivery workflow.</div>
              </div>
            </div>
            <div className="admin-orders">
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
          </section>
        ) : null}
      </div>
    </div>
  );
}
