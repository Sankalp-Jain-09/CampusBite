import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../hooks/useCart';
import { ROLE_LABELS, ROLES } from '../../utils/constants';

const LINKS = {
  guest: [{ to: '/', label: 'Restaurants', end: true }],
  [ROLES.CUSTOMER]: [
    { to: '/', label: 'Restaurants', end: true },
    { to: '/customer/dashboard', label: 'My orders' },
    { to: '/customer/ai-insights', label: 'AI insights' },
  ],
  [ROLES.OWNER]: [
    { to: '/owner/dashboard', label: 'Dashboard' },
    { to: '/owner/orders', label: 'Orders' },
    { to: '/owner/menu', label: 'Menu' },
    { to: '/owner/returns', label: 'Returns' },
  ],
  [ROLES.PARTNER]: [
    { to: '/delivery/dashboard', label: 'Deliveries' },
    { to: '/delivery/history', label: 'History' },
  ],
};

function navClass({ isActive }) {
  return `rounded-lg px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`;
}

function CartLink({ count, onClick }) {
  return (
    <NavLink to="/cart" className={navClass} onClick={onClick} aria-label={`Cart, ${count} items`}>
      <span className="inline-flex items-center gap-1.5">
        Cart
        {count > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">{count}</span>}
      </span>
    </NavLink>
  );
}

export default function Navbar() {
  const { user, isAuthenticated, logout, homePath } = useAuth();
  const { itemCount } = useCart();
  const [open, setOpen] = useState(false);
  const links = LINKS[user?.role] || LINKS.guest;
  const isCustomer = user?.role === ROLES.CUSTOMER;
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to={homePath} className="flex items-center gap-2" onClick={close}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-black text-white">CB</span>
          <span className="text-lg font-bold tracking-tight">CampusBite</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={navClass}>{l.label}</NavLink>)}
          {isCustomer && <CartLink count={itemCount} />}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <>
              <div className="text-right leading-tight">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-gray-500">{ROLE_LABELS[user.role]}</div>
              </div>
              <button type="button" className="btn-secondary btn-sm" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost btn-sm">Log in</Link>
              <Link to="/register" className="btn-primary btn-sm">Sign up</Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          {isCustomer && <CartLink count={itemCount} onClick={close} />}
          <button
            type="button"
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {open ? <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /> : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 bg-white md:hidden">
          <nav className="container-page flex flex-col gap-1 py-3" aria-label="Mobile">
            {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={navClass} onClick={close}>{l.label}</NavLink>)}
            <div className="mt-2 border-t border-gray-100 pt-3">
              {isAuthenticated ? (
                <div className="flex items-center justify-between px-3">
                  <div className="text-sm">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-gray-500">{ROLE_LABELS[user.role]}</div>
                  </div>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => { close(); logout(); }}>Log out</button>
                </div>
              ) : (
                <div className="flex gap-2 px-3">
                  <Link to="/login" className="btn-secondary flex-1" onClick={close}>Log in</Link>
                  <Link to="/register" className="btn-primary flex-1" onClick={close}>Sign up</Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
