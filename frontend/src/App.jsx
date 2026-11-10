import { Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import CustomerHome from './components/routing/CustomerHome';
import GuestOnly from './components/routing/GuestOnly';
import ProtectedRoute from './components/routing/ProtectedRoute';
import RoleRoute from './components/routing/RoleRoute';
import CustomerRegisterPage from './pages/auth/CustomerRegisterPage';
import DeliveryRegisterPage from './pages/auth/DeliveryRegisterPage';
import LoginPage from './pages/auth/LoginPage';
import PartnerRegisterPage from './pages/auth/PartnerRegisterPage';
import AIInsightsPage from './pages/customer/AIInsightsPage';
import CartPage from './pages/customer/CartPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import CustomerDashboardPage from './pages/customer/CustomerDashboardPage';
import RestaurantListPage from './pages/customer/RestaurantListPage';
import RestaurantMenuPage from './pages/customer/RestaurantMenuPage';
import DeliveryDashboardPage from './pages/delivery/DeliveryDashboardPage';
import DeliveryHistoryPage from './pages/delivery/DeliveryHistoryPage';
import NotFoundPage from './pages/NotFoundPage';
import OrderDetailPage from './pages/OrderDetailPage';
import MenuManagementPage from './pages/owner/MenuManagementPage';
import OrderManagementPage from './pages/owner/OrderManagementPage';
import OwnerDashboardPage from './pages/owner/OwnerDashboardPage';
import ReturnRequestsPage from './pages/owner/ReturnRequestsPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import { ROLES } from './utils/constants';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Guests only */}
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><CustomerRegisterPage /></GuestOnly>} />
        <Route path="/partner/register" element={<GuestOnly><PartnerRegisterPage /></GuestOnly>} />
        <Route path="/delivery/register" element={<GuestOnly><DeliveryRegisterPage /></GuestOnly>} />

        {/* Public browsing (owners/partners are redirected to their dashboards) */}
        <Route path="/" element={<CustomerHome><RestaurantListPage /></CustomerHome>} />
        <Route path="/restaurants/:id" element={<CustomerHome><RestaurantMenuPage /></CustomerHome>} />

        {/* Customer */}
        <Route element={<RoleRoute roles={[ROLES.CUSTOMER]} />}>
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/customer/dashboard" element={<CustomerDashboardPage />} />
          <Route path="/customer/ai-insights" element={<AIInsightsPage />} />
        </Route>

        {/* Restaurant owner */}
        <Route element={<RoleRoute roles={[ROLES.OWNER]} />}>
          <Route path="/owner/dashboard" element={<OwnerDashboardPage />} />
          <Route path="/owner/orders" element={<OrderManagementPage />} />
          <Route path="/owner/menu" element={<MenuManagementPage />} />
          <Route path="/owner/returns" element={<ReturnRequestsPage />} />
        </Route>

        {/* Delivery partner */}
        <Route element={<RoleRoute roles={[ROLES.PARTNER]} />}>
          <Route path="/delivery/dashboard" element={<DeliveryDashboardPage />} />
          <Route path="/delivery/history" element={<DeliveryHistoryPage />} />
        </Route>

        {/* Any logged-in user; the API decides whether this order is theirs */}
        <Route element={<ProtectedRoute />}>
          <Route path="/orders/:id" element={<OrderDetailPage />} />
        </Route>

        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
