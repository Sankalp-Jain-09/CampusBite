import Spinner from './Spinner';

export default function Loader({ text = 'Loading…', className = 'py-16' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-gray-500 ${className}`} role="status">
      <Spinner className="h-7 w-7 text-brand-600" />
      <span className="text-sm">{text}</span>
    </div>
  );
}
