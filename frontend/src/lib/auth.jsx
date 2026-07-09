import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AuthCtx = createContext(null);
axios.defaults.withCredentials = true;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/auth/me`);
      setUser(r.data);
    } catch (err) {
      if (err?.response?.status !== 401) console.error("auth check failed:", err);
      setUser(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // CRITICAL: skip /me if returning from OAuth callback
    if (window.location.hash?.includes("session_id=")) { setLoading(false); return; }
    check();
  }, [check]);

  const logout = useCallback(async () => {
    try { await axios.post(`${API}/auth/logout`); } catch (err) { console.error("logout failed:", err); }
    setUser(null);
  }, []);

  const ctxValue = useMemo(
    () => ({ user, setUser, loading, refresh: check, logout }),
    [user, loading, check, logout],
  );
  return <AuthCtx.Provider value={ctxValue}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export function loginWithGoogle() {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

export function AuthCallback() {
  const nav = useNavigate();
  const { refresh, setUser } = useAuth();
  useEffect(() => {
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) { nav("/", { replace: true }); return; }
    const sid = m[1];
    (async () => {
      try {
        const r = await axios.post(`${API}/auth/session`, { session_id: sid });
        setUser(r.data);
        window.history.replaceState({}, "", window.location.pathname);
        await refresh();
        const back = sessionStorage.getItem("post_login_redirect") || "/dashboard";
        sessionStorage.removeItem("post_login_redirect");
        nav(r.data.onboarded ? back : "/onboarding", { replace: true, state: { back } });
      } catch (err) { console.error("session exchange failed:", err); nav("/", { replace: true }); }
    })();
  }, [nav, refresh, setUser]);
  return <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono text-sm">Signing you in…</div>;
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono text-sm">Checking session…</div>;
  if (!user) {
    sessionStorage.setItem("post_login_redirect", loc.pathname + loc.search);
    return <Navigate to="/signin" replace />;
  }
  return children;
}

export function SignInPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6" style={{ fontFamily: "'Space Grotesk', system-ui" }}>
      <div className="max-w-md w-full">
        <div className="font-mono text-[11px] tracking-[0.28em] text-white/50">SS FILTERS · DASHBOARD ACCESS</div>
        <h1 className="text-4xl font-light mt-4">Sign in to continue.</h1>
        <p className="mt-3 text-white/60 text-sm">This area is for engineers and procurement teams. Please use your work Google account.</p>
        <button onClick={loginWithGoogle} data-testid="google-signin-btn"
          className="mt-8 w-full py-3 bg-white text-black font-medium tracking-wide hover:bg-white/90">
          Sign in with Google →
        </button>
        <a href="/" className="mt-6 inline-block font-mono text-[11px] tracking-[0.22em] text-white/50 hover:text-white">← BACK TO SITE</a>
      </div>
    </div>
  );
}

function OnbField({ k, label, required, value, onChange }) {
  return (
    <div>
      <label className="font-mono text-[10px] tracking-[0.22em] text-white/50">
        {label}{required && " *"}
      </label>
      <input required={required} value={value} onChange={onChange}
        data-testid={`onboard-${k}`}
        className="w-full bg-transparent border-b border-white/25 py-2 text-white focus:outline-none focus:border-white" />
    </div>
  );
}

export function OnboardingPage() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ company_name: "", designation: "", phone: "", plant_location: "" });
  const submit = async (e) => {
    e.preventDefault();
    await axios.post(`${API}/auth/onboarding`, f);
    await refresh();
    nav(loc.state?.back || "/dashboard", { replace: true });
  };
  const setK = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6" style={{ fontFamily: "'Space Grotesk', system-ui" }}>
      <form onSubmit={submit} className="max-w-md w-full space-y-5" data-testid="onboarding-form">
        <div className="font-mono text-[11px] tracking-[0.28em] text-white/50">WELCOME</div>
        <h1 className="text-3xl font-light">A few company details.</h1>
        <OnbField k="company_name" label="COMPANY NAME" required value={f.company_name} onChange={setK("company_name")} />
        <OnbField k="designation" label="DESIGNATION" value={f.designation} onChange={setK("designation")} />
        <OnbField k="phone" label="WORK PHONE" value={f.phone} onChange={setK("phone")} />
        <OnbField k="plant_location" label="PLANT LOCATION" value={f.plant_location} onChange={setK("plant_location")} />
        <button type="submit" data-testid="onboard-submit"
          className="mt-4 px-6 py-3 bg-white text-black text-sm font-medium tracking-wide hover:bg-white/90">
          Continue →
        </button>
      </form>
    </div>
  );
}
