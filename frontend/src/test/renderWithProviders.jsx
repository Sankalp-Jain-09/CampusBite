import { render } from '@testing-library/react';
import { MemoryRouter, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { ToastProvider } from '../context/ToastContext';

/** Render `ui` (or a set of routes) inside all app providers at `route`. */
export function renderWithProviders(ui, { route = '/', routes } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            {routes ? <Routes>{routes}</Routes> : ui}
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}
