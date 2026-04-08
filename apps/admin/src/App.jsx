import { useEffect, useMemo, useState } from "react";
import {
  advanceAdminOrder,
  createAdminRefund,
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
  fetchSession,
  loginUser,
  logoutUser,
  saveAdminCuisine,
  saveAdminPaymentGateway,
  saveAdminPromo,
} from "./lib/api.js";

const rolePermissions = {
  admin: ["orders", "catalog", "users", "promos", "billing", "gateways"],
  manager: ["orders", "catalog", "users", "promos"],
  finance: ["billing", "gateways"],
  operations: ["orders"],
};

const emptyLogin = { email: "", password: "" };
const emptyCuisine = { id: "", label: "", thumbnail: "", enabled: true };
const emptyPromo = { code: "", title: "", discountPercent: 10, cuisineIds: [], enabled: true };
const emptyRefund = { orderId: "", amount: "", reason: "" };
const emptyGateway = {
  id: "",
  name: "",
  provider: "",
  mode: "test",
  enabled: true,
  supportsRefunds: true,
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function Panel({ title, children, actions }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loginForm, setLoginForm] = useState(emptyLogin);
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ error: "", success: "" });

  const [orders, setOrders] = useState([]);
  const [liveOrders, setLiveOrders] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [cuisines, setCuisines] = useState([]);
  const [users, setUsers] = useState([]);
  const [promos, setPromos] = useState([]);
  const [billing, setBilling] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [gateways, setGateways] = useState([]);

  const [cuisineForm, setCuisineForm] = useState(emptyCuisine);
  const [promoForm, setPromoForm] = useState(emptyPromo);
  const [refundForm, setRefundForm] = useState(emptyRefund);
  const [gatewayForm, setGatewayForm] = useState(emptyGateway);

  const permissions = useMemo(() => {
    return new Set(user?.permissions ?? rolePermissions[user?.role] ?? []);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    fetchSession()
      .then((sessionUser) => {
        if (!cancelled) setUser(sessionUser);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const tasks = [];
    if (permissions.has("orders")) {
      tasks.push(fetchAdminOrders().then(setOrders));
      tasks.push(fetchAdminLiveOrders().then(setLiveOrders));
      tasks.push(fetchAdminOrderMetrics().then(setMetrics));
    }
    if (permissions.has("catalog")) {
      tasks.push(fetchAdminCuisines().then(setCuisines));
    }
    if (permissions.has("users")) {
      tasks.push(fetchAdminUsers().then(setUsers));
    }
    if (permissions.has("promos")) {
      tasks.push(fetchAdminPromos().then(setPromos));
    }
    if (permissions.has("billing")) {
      tasks.push(fetchAdminBilling().then(setBilling));
      tasks.push(fetchAdminRefunds().then(setRefunds));
      if (!permissions.has("orders")) {
        tasks.push(fetchAdminOrderMetrics().then(setMetrics));
      }
    }
    if (permissions.has("gateways")) {
      tasks.push(fetchAdminPaymentGateways().then(setGateways));
    }

    Promise.all(tasks).catch((error) => {
      setMessage({ error: error.message, success: "" });
    });
  }, [permissions, user]);

  function updateMessage(next) {
    setMessage(next);
  }

  function updateLogin(field, value) {
    setLoginForm((current) => ({ ...current, [field]: value }));
  }

  async function submitLogin(event) {
    event.preventDefault();
    setLoginError("");
    try {
      const nextUser = await loginUser(loginForm);
      setUser(nextUser);
      setLoginForm(emptyLogin);
    } catch (error) {
      setLoginError(error.message);
    }
  }

  async function handleLogout() {
    await logoutUser();
    setUser(null);
  }

  async function handleAdvanceOrder(orderId) {
    try {
      const updated = await advanceAdminOrder(orderId);
      setOrders((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setLiveOrders((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      updateMessage({ success: `Order ${updated.id} moved to ${updated.status}.`, error: "" });
    } catch (error) {
      updateMessage({ error: error.message, success: "" });
    }
  }

  async function submitCuisine(event) {
    event.preventDefault();
    try {
      const saved = await saveAdminCuisine(cuisineForm);
      setCuisines((current) => {
        const exists = current.some((entry) => entry.id === saved.id);
        return exists ? current.map((entry) => (entry.id === saved.id ? saved : entry)) : [...current, saved];
      });
      setCuisineForm(emptyCuisine);
      updateMessage({ success: `Cuisine ${saved.label} saved.`, error: "" });
    } catch (error) {
      updateMessage({ error: error.message, success: "" });
    }
  }

  async function removeCuisine(id) {
    try {
      await deleteAdminCuisine(id);
      setCuisines((current) => current.filter((entry) => entry.id !== id));
      updateMessage({ success: `Cuisine ${id} removed.`, error: "" });
    } catch (error) {
      updateMessage({ error: error.message, success: "" });
    }
  }

  async function submitPromo(event) {
    event.preventDefault();
    try {
      const payload = {
        ...promoForm,
        discountPercent: Number(promoForm.discountPercent),
      };
      const saved = await saveAdminPromo(payload);
      setPromos((current) => {
        const exists = current.some((entry) => entry.id === saved.id);
        return exists ? current.map((entry) => (entry.id === saved.id ? saved : entry)) : [...current, saved];
      });
      setPromoForm(emptyPromo);
      updateMessage({ success: `Promo ${saved.code} saved.`, error: "" });
    } catch (error) {
      updateMessage({ error: error.message, success: "" });
    }
  }

  async function removePromo(id) {
    try {
      await deleteAdminPromo(id);
      setPromos((current) => current.filter((entry) => entry.id !== id));
      updateMessage({ success: `Promo ${id} deleted.`, error: "" });
    } catch (error) {
      updateMessage({ error: error.message, success: "" });
    }
  }

  async function submitRefund(event) {
    event.preventDefault();
    try {
      const saved = await createAdminRefund({
        ...refundForm,
        amount: refundForm.amount ? Number(refundForm.amount) : undefined,
      });
      setRefunds((current) => [saved, ...current]);
      setRefundForm(emptyRefund);
      updateMessage({ success: `Refund ${saved.id} created.`, error: "" });
    } catch (error) {
      updateMessage({ error: error.message, success: "" });
    }
  }

  async function submitGateway(event) {
    event.preventDefault();
    try {
      const saved = await saveAdminPaymentGateway(gatewayForm);
      setGateways((current) => {
        const exists = current.some((entry) => entry.id === saved.id);
        return exists ? current.map((entry) => (entry.id === saved.id ? saved : entry)) : [...current, saved];
      });
      setGatewayForm(emptyGateway);
      updateMessage({ success: `Gateway ${saved.name} saved.`, error: "" });
    } catch (error) {
      updateMessage({ error: error.message, success: "" });
    }
  }

  async function removeGateway(id) {
    try {
      await deleteAdminPaymentGateway(id);
      setGateways((current) => current.filter((entry) => entry.id !== id));
      updateMessage({ success: `Gateway ${id} removed.`, error: "" });
    } catch (error) {
      updateMessage({ error: error.message, success: "" });
    }
  }

  if (loading) {
    return <div className="admin-shell loading">Loading admin workspace...</div>;
  }

  if (!user) {
    return (
      <div className="admin-shell login-shell">
        <section className="login-card">
          <p className="eyebrow">Admin app</p>
          <h1>Sign in to the staff console</h1>
          <p className="muted">Deploy this app on an isolated admin domain and point it at your API service.</p>
          <form className="stack" onSubmit={submitLogin}>
            <input
              placeholder="Staff email"
              type="email"
              value={loginForm.email}
              onChange={(event) => updateLogin("email", event.target.value)}
            />
            <input
              placeholder="Password"
              type="password"
              value={loginForm.password}
              onChange={(event) => updateLogin("password", event.target.value)}
            />
            {loginError ? <p className="error-text">{loginError}</p> : null}
            <button className="primary-button" type="submit">
              Enter admin portal
            </button>
          </form>
          <div className="demo-grid">
            <span>admin@bkfast.app / Admin123!</span>
            <span>manager@bkfast.app / Manager123!</span>
            <span>finance@bkfast.app / Finance123!</span>
            <span>ops@bkfast.app / Ops123!</span>
          </div>
        </section>
      </div>
    );
  }

  if (user.role === "customer") {
    return (
      <div className="admin-shell login-shell">
        <section className="login-card">
          <h1>Customer accounts cannot enter the admin app.</h1>
          <button className="primary-button" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Admin app</p>
          <h1>Operations control center</h1>
          <p className="muted">{user.name} ({user.role})</p>
        </div>
        <button className="ghost-button" type="button" onClick={handleLogout}>
          Log out
        </button>
      </header>

      {message.error ? <p className="banner error">{message.error}</p> : null}
      {message.success ? <p className="banner success">{message.success}</p> : null}

      {metrics ? (
        <section className="metrics-grid">
          <article className="metric-card"><span>Total orders</span><strong>{metrics.totalOrders}</strong></article>
          <article className="metric-card"><span>Live orders</span><strong>{metrics.liveOrders}</strong></article>
          <article className="metric-card"><span>Delivered</span><strong>{metrics.deliveredOrders}</strong></article>
          <article className="metric-card"><span>Revenue</span><strong>{formatCurrency(metrics.totalRevenue)}</strong></article>
        </section>
      ) : null}

      <main className="admin-grid">
        {permissions.has("orders") ? (
          <>
            <Panel title="Live delivery monitoring">
              <div className="stack compact">
                {liveOrders.map((order) => (
                  <article className="list-card" key={order.id}>
                    <div className="row spread">
                      <strong>{order.id}</strong>
                      <span>{order.status.replaceAll("_", " ")}</span>
                    </div>
                    <p>{order.customer.name} • {order.customer.address}</p>
                    <div className="row spread">
                      <span>{order.etaMinutes} min ETA</span>
                      <span>{formatCurrency(order.total)}</span>
                    </div>
                  </article>
                ))}
                {liveOrders.length === 0 ? <p className="muted">No active deliveries.</p> : null}
              </div>
            </Panel>

            <Panel title="Order history">
              <div className="stack compact">
                {orders.map((order) => (
                  <article className="list-card" key={order.id}>
                    <div className="row spread">
                      <strong>{order.id}</strong>
                      <span>{order.status.replaceAll("_", " ")}</span>
                    </div>
                    <p>{order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}</p>
                    <div className="row spread">
                      <span>{order.paymentStatus}</span>
                      <button className="ghost-button" type="button" onClick={() => handleAdvanceOrder(order.id)}>
                        Advance
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          </>
        ) : null}

        {permissions.has("catalog") ? (
          <Panel title="Manage cuisines">
            <form className="stack" onSubmit={submitCuisine}>
              <input placeholder="Cuisine id" value={cuisineForm.id} onChange={(event) => setCuisineForm((current) => ({ ...current, id: event.target.value }))} />
              <input placeholder="Label" value={cuisineForm.label} onChange={(event) => setCuisineForm((current) => ({ ...current, label: event.target.value }))} />
              <input placeholder="Thumbnail URL" value={cuisineForm.thumbnail} onChange={(event) => setCuisineForm((current) => ({ ...current, thumbnail: event.target.value }))} />
              <label className="check-row">
                <input checked={cuisineForm.enabled} type="checkbox" onChange={(event) => setCuisineForm((current) => ({ ...current, enabled: event.target.checked }))} />
                Enabled
              </label>
              <button className="primary-button" type="submit">Save cuisine</button>
            </form>
            <div className="stack compact top-gap">
              {cuisines.map((cuisine) => (
                <article className="list-card" key={cuisine.id}>
                  <div className="row spread">
                    <strong>{cuisine.label}</strong>
                    <span>{cuisine.enabled ? "enabled" : "disabled"}</span>
                  </div>
                  <p>{cuisine.id}</p>
                  <div className="row spread">
                    <button className="ghost-button" type="button" onClick={() => setCuisineForm(cuisine)}>Edit</button>
                    {cuisine.id !== "all" ? (
                      <button className="ghost-button danger" type="button" onClick={() => removeCuisine(cuisine.id)}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        ) : null}

        {permissions.has("users") ? (
          <Panel title="Active users and accounts">
            <div className="stack compact">
              {users.map((account) => (
                <article className="list-card" key={account.id}>
                  <div className="row spread">
                    <strong>{account.name}</strong>
                    <span>{account.role}</span>
                  </div>
                  <p>{account.email}</p>
                  <span className="muted">{account.activeSessions} active sessions</span>
                </article>
              ))}
            </div>
          </Panel>
        ) : null}

        {permissions.has("promos") ? (
          <Panel title="Promo codes by cuisine">
            <form className="stack" onSubmit={submitPromo}>
              <input placeholder="Promo code" value={promoForm.code} onChange={(event) => setPromoForm((current) => ({ ...current, code: event.target.value }))} />
              <input placeholder="Title" value={promoForm.title} onChange={(event) => setPromoForm((current) => ({ ...current, title: event.target.value }))} />
              <input placeholder="Discount percent" type="number" value={promoForm.discountPercent} onChange={(event) => setPromoForm((current) => ({ ...current, discountPercent: event.target.value }))} />
              <select
                multiple
                value={promoForm.cuisineIds}
                onChange={(event) =>
                  setPromoForm((current) => ({
                    ...current,
                    cuisineIds: Array.from(event.target.selectedOptions, (option) => option.value),
                  }))
                }
              >
                {cuisines.filter((entry) => entry.id !== "all").map((cuisine) => (
                  <option key={cuisine.id} value={cuisine.id}>{cuisine.label}</option>
                ))}
              </select>
              <button className="primary-button" type="submit">Save promo</button>
            </form>
            <div className="stack compact top-gap">
              {promos.map((promo) => (
                <article className="list-card" key={promo.id}>
                  <div className="row spread">
                    <strong>{promo.code}</strong>
                    <span>{promo.discountPercent}%</span>
                  </div>
                  <p>{promo.title}</p>
                  <p className="muted">{promo.cuisineIds.join(", ")}</p>
                  <button className="ghost-button danger" type="button" onClick={() => removePromo(promo.id)}>
                    Delete
                  </button>
                </article>
              ))}
            </div>
          </Panel>
        ) : null}

        {permissions.has("billing") ? (
          <>
            <Panel title="Billing and refunds">
              {billing ? (
                <div className="stack compact">
                  <article className="list-card"><strong>Gross revenue</strong><span>{formatCurrency(billing.grossRevenue)}</span></article>
                  <article className="list-card"><strong>Refunded</strong><span>{formatCurrency(billing.refundedAmount)}</span></article>
                  <article className="list-card"><strong>Net revenue</strong><span>{formatCurrency(billing.netRevenue)}</span></article>
                </div>
              ) : null}
              <form className="stack top-gap" onSubmit={submitRefund}>
                <input placeholder="Order id" value={refundForm.orderId} onChange={(event) => setRefundForm((current) => ({ ...current, orderId: event.target.value }))} />
                <input placeholder="Amount" type="number" value={refundForm.amount} onChange={(event) => setRefundForm((current) => ({ ...current, amount: event.target.value }))} />
                <input placeholder="Reason" value={refundForm.reason} onChange={(event) => setRefundForm((current) => ({ ...current, reason: event.target.value }))} />
                <button className="primary-button" type="submit">Create refund</button>
              </form>
            </Panel>

            <Panel title="Refund history">
              <div className="stack compact">
                {refunds.map((refund) => (
                  <article className="list-card" key={refund.id}>
                    <div className="row spread">
                      <strong>{refund.orderId}</strong>
                      <span>{formatCurrency(refund.amount)}</span>
                    </div>
                    <p>{refund.reason}</p>
                    <span className="muted">{refund.status}</span>
                  </article>
                ))}
              </div>
            </Panel>
          </>
        ) : null}

        {permissions.has("gateways") ? (
          <Panel title="Manage payment gateways">
            <form className="stack" onSubmit={submitGateway}>
              <input placeholder="Gateway id (optional)" value={gatewayForm.id} onChange={(event) => setGatewayForm((current) => ({ ...current, id: event.target.value }))} />
              <input placeholder="Gateway name" value={gatewayForm.name} onChange={(event) => setGatewayForm((current) => ({ ...current, name: event.target.value }))} />
              <input placeholder="Provider" value={gatewayForm.provider} onChange={(event) => setGatewayForm((current) => ({ ...current, provider: event.target.value }))} />
              <select value={gatewayForm.mode} onChange={(event) => setGatewayForm((current) => ({ ...current, mode: event.target.value }))}>
                <option value="test">test</option>
                <option value="live">live</option>
              </select>
              <label className="check-row">
                <input checked={gatewayForm.enabled} type="checkbox" onChange={(event) => setGatewayForm((current) => ({ ...current, enabled: event.target.checked }))} />
                Enabled
              </label>
              <label className="check-row">
                <input checked={gatewayForm.supportsRefunds} type="checkbox" onChange={(event) => setGatewayForm((current) => ({ ...current, supportsRefunds: event.target.checked }))} />
                Supports refunds
              </label>
              <button className="primary-button" type="submit">Save gateway</button>
            </form>
            <div className="stack compact top-gap">
              {gateways.map((gateway) => (
                <article className="list-card" key={gateway.id}>
                  <div className="row spread">
                    <strong>{gateway.name}</strong>
                    <span>{gateway.mode}</span>
                  </div>
                  <p>{gateway.provider}</p>
                  <div className="row spread">
                    <span className="muted">{gateway.enabled ? "enabled" : "disabled"}</span>
                    <button className="ghost-button danger" type="button" onClick={() => removeGateway(gateway.id)}>
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        ) : null}
      </main>
    </div>
  );
}
