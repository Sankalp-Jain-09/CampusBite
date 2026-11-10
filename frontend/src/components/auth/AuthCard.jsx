export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto w-full max-w-md py-4 sm:py-10">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-4 text-center text-sm text-gray-600">{footer}</div>}
    </div>
  );
}
