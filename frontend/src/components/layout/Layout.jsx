import { Outlet } from 'react-router-dom';
import Footer from './Footer';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="container-page flex-1 py-6 sm:py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
