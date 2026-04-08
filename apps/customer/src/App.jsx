import { useEffect, useMemo, useState } from "react";
import {
  createOrder,
  fetchCuisines,
  fetchMenuItems,
  fetchMyOrders,
  fetchPublicPaymentGateways,
  fetchSession,
  loginUser,
  logoutUser,
  registerUser,
} from "./lib/api.js";

const emptyCustomer = { name: "", phone: "", address: "" };
const emptyAuth = { name: "", email: "", password: "" };

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function buildOrderPayload(cartItems, customer, paymentMethod, gatewayId) {
  return {
    items: cartItems.map((item) => ({ itemId: item.id, quantity: item.quantity })),
    customer,
    paymentMethod,
    gatewayId: paymentMethod === "card" ? gatewayId || null : null,
  };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState(emptyAuth);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [cuisines, setCuisines] = useState([]);
  const [selectedCuisine, setSelectedCuisine] = useState("all");
  const [search, setSearch] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [gateways, setGateways] = useState([]);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [gatewayId, setGatewayId] = useState("");
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "", success: "" });

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const [sessionUser, cuisineList, gatewayList] = await Promise.all([
          fetchSession().catch(() => null),
          fetchCuisines(),
          fetchPublicPaymentGateways().catch(() => []),
        ]);
        if (cancelled) return;
        setUser(sessionUser);
        setCuisines(cuisineList);
        setGateways(gatewayList);
        if (!gatewayId && gatewayList[0]) {
          setGatewayId(gatewayList[0].id);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus((current) => ({ ...current, error: error.message }));
        }
      } finally {
        if (!cancelled) {
          setStatus((current) => ({ ...current, loading: false }));
        }
      }
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [gatewayId]);

  useEffect(() => {
    let cancelled = false;
    setStatus((current) => ({ ...current, error: "" }));

    fetchMenuItems({ cuisine: selectedCuisine, search })
      .then((items) => {
        if (!cancelled) setMenuItems(items);
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus((current) => ({ ...current, error: error.message }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [search, selectedCuisine]);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }
    fetchMyOrders()
      .then(setOrders)
      .catch((error) => {
        setStatus((current) => ({ ...current, error: error.message }));
      });
  }, [user]);

  const cartSummary = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = cart.length ? 39 : 0;
    const platformFee = cart.length ? 12 : 0;
    return {
      subtotal,
      deliveryFee,
      platformFee,
      total: subtotal + deliveryFee + platformFee,
    };
  }, [cart]);

  function updateAuthField(field, value) {
    setAuthForm((current) => ({ ...current, [field]: value }));
  }

  function updateCustomerField(field, value) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  function addToCart(item) {
    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (existing) {
        return current.map((entry) =>
          entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
        );
      }
      return [...current, { ...item, quantity: 1 }];
    });
  }

  function changeQuantity(itemId, nextQuantity) {
    setCart((current) =>
      current
        .map((entry) =>
          entry.id === itemId ? { ...entry, quantity: Math.max(0, nextQuantity) } : entry,
        )
        .filter((entry) => entry.quantity > 0),
    );
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      const nextUser =
        authMode === "register" ? await registerUser(authForm) : await loginUser(authForm);
      setUser(nextUser);
      setAuthForm(emptyAuth);
      setCustomer((current) => ({ ...current, name: nextUser.name }));
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    await logoutUser();
    setUser(null);
    setOrders([]);
  }

  async function placeOrder(event) {
    event.preventDefault();
    setStatus((current) => ({ ...current, error: "", success: "" }));
    try {
      const order = await createOrder(
        buildOrderPayload(cart, customer, paymentMethod, gatewayId),
      );
      setOrders((current) => [order, ...current]);
      setCart([]);
      setCustomer(emptyCustomer);
      setStatus((current) => ({
        ...current,
        success: `Order ${order.id} placed successfully.`,
      }));
    } catch (error) {
      setStatus((current) => ({ ...current, error: error.message }));
    }
  }

  return (
    <div className="customer-app">
      <header className="hero">
        <div>
          <p className="eyebrow">Customer app</p>
          <h1>Order by cuisine, not by vendor.</h1>
          <p className="hero-copy">
            This standalone storefront is ready to live on its own customer domain and talk to
            your API service through <code>VITE_API_BASE_URL</code>.
          </p>
        </div>
        <div className="hero-card">
          <p className="hero-stat">{cuisines.length || 0}</p>
          <span>live cuisines</span>
          <p className="hero-stat secondary">{menuItems.length || 0}</p>
          <span>visible menu items</span>
        </div>
      </header>

      {status.error ? <p className="banner error">{status.error}</p> : null}
      {status.success ? <p className="banner success">{status.success}</p> : null}

      <main className="customer-layout">
        <section className="panel">
          <div className="panel-head">
            <h2>Discover dishes</h2>
            <input
              className="search"
              placeholder="Search for pasta, sushi, bowls..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="chip-row">
            {cuisines.map((cuisine) => (
              <button
                key={cuisine.id}
                className={selectedCuisine === cuisine.id ? "chip active" : "chip"}
                onClick={() => setSelectedCuisine(cuisine.id)}
                type="button"
              >
                {cuisine.label}
              </button>
            ))}
          </div>

          <div className="item-grid">
            {menuItems.map((item) => (
              <article key={item.id} className="item-card">
                <div className="item-color" style={{ background: item.color }} />
                <div className="item-content">
                  <div className="item-head">
                    <div>
                      <p className="item-cuisine">{item.cuisine}</p>
                      <h3>{item.name}</h3>
                    </div>
                    <strong>{formatCurrency(item.price)}</strong>
                  </div>
                  <p>{item.desc}</p>
                  <div className="meta-row">
                    <span>{item.cal} cal</span>
                    <span>{item.prepTime} mins</span>
                    <span>{item.spice}</span>
                  </div>
                  <button type="button" className="primary-button" onClick={() => addToCart(item)}>
                    Add to cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="sidebar">
          <section className="panel">
            <div className="panel-head">
              <h2>{user ? `Welcome, ${user.name}` : "Sign in"}</h2>
              {user ? (
                <button type="button" className="ghost-button" onClick={handleLogout}>
                  Log out
                </button>
              ) : (
                <div className="toggle-row">
                  <button
                    type="button"
                    className={authMode === "login" ? "chip active" : "chip"}
                    onClick={() => setAuthMode("login")}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    className={authMode === "register" ? "chip active" : "chip"}
                    onClick={() => setAuthMode("register")}
                  >
                    Register
                  </button>
                </div>
              )}
            </div>

            {!user ? (
              <form className="stack" onSubmit={submitAuth}>
                {authMode === "register" ? (
                  <input
                    placeholder="Full name"
                    value={authForm.name}
                    onChange={(event) => updateAuthField("name", event.target.value)}
                  />
                ) : null}
                <input
                  placeholder="Email"
                  type="email"
                  value={authForm.email}
                  onChange={(event) => updateAuthField("email", event.target.value)}
                />
                <input
                  placeholder="Password"
                  type="password"
                  value={authForm.password}
                  onChange={(event) => updateAuthField("password", event.target.value)}
                />
                {authError ? <p className="form-error">{authError}</p> : null}
                <button type="submit" className="primary-button" disabled={authBusy}>
                  {authBusy ? "Please wait..." : authMode === "register" ? "Create account" : "Sign in"}
                </button>
                <p className="hint">Demo account: demo@bkfast.app / Demo123!</p>
              </form>
            ) : (
              <p className="hint">{user.email}</p>
            )}
          </section>

          <section className="panel">
            <h2>Checkout</h2>
            <form className="stack" onSubmit={placeOrder}>
              <div className="cart-list">
                {cart.length === 0 ? <p className="hint">Your cart is empty.</p> : null}
                {cart.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div>
                      <strong>{item.name}</strong>
                      <p>{formatCurrency(item.price)} each</p>
                    </div>
                    <div className="quantity-row">
                      <button type="button" onClick={() => changeQuantity(item.id, item.quantity - 1)}>
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => changeQuantity(item.id, item.quantity + 1)}>
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <input
                placeholder="Full name"
                value={customer.name}
                onChange={(event) => updateCustomerField("name", event.target.value)}
              />
              <input
                placeholder="Phone number"
                value={customer.phone}
                onChange={(event) => updateCustomerField("phone", event.target.value)}
              />
              <textarea
                placeholder="Delivery address"
                value={customer.address}
                onChange={(event) => updateCustomerField("address", event.target.value)}
                rows={3}
              />

              <div className="payment-section">
                <label>
                  <input
                    checked={paymentMethod === "card"}
                    name="paymentMethod"
                    onChange={() => setPaymentMethod("card")}
                    type="radio"
                  />
                  Pay online
                </label>
                <label>
                  <input
                    checked={paymentMethod === "cod"}
                    name="paymentMethod"
                    onChange={() => setPaymentMethod("cod")}
                    type="radio"
                  />
                  Cash on delivery
                </label>
              </div>

              {paymentMethod === "card" ? (
                <select value={gatewayId} onChange={(event) => setGatewayId(event.target.value)}>
                  <option value="">Select gateway</option>
                  {gateways.map((gateway) => (
                    <option key={gateway.id} value={gateway.id}>
                      {gateway.name} ({gateway.mode})
                    </option>
                  ))}
                </select>
              ) : null}

              <div className="totals">
                <div><span>Subtotal</span><strong>{formatCurrency(cartSummary.subtotal)}</strong></div>
                <div><span>Delivery</span><strong>{formatCurrency(cartSummary.deliveryFee)}</strong></div>
                <div><span>Platform</span><strong>{formatCurrency(cartSummary.platformFee)}</strong></div>
                <div className="grand-total">
                  <span>Total</span>
                  <strong>{formatCurrency(cartSummary.total)}</strong>
                </div>
              </div>

              <button type="submit" className="primary-button" disabled={!user || cart.length === 0}>
                Place order
              </button>
            </form>
          </section>

          <section className="panel">
            <h2>Recent orders</h2>
            <div className="stack compact">
              {orders.length === 0 ? <p className="hint">No orders yet.</p> : null}
              {orders.map((order) => (
                <article key={order.id} className="order-card">
                  <div className="item-head">
                    <strong>{order.id}</strong>
                    <span>{order.status.replaceAll("_", " ")}</span>
                  </div>
                  <p>{order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}</p>
                  <div className="meta-row">
                    <span>{order.paymentMethod}</span>
                    <span>{order.paymentStatus}</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
