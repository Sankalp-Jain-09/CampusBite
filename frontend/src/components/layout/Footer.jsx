import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="container-page flex flex-col gap-4 py-8 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} CampusBite · Demo project, no real payments.</p>
        <div className="flex gap-5">
          <Link to="/partner/register" className="link">Partner with us</Link>
          <Link to="/delivery/register" className="link">Ride with us</Link>
        </div>
      </div>
    </footer>
  );
}
