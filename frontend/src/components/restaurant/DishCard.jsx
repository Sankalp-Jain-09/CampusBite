import { formatCurrency } from '../../utils/format';
import { VegMark } from '../common/Badges';
import DishImage from '../common/DishImage';
import QuantityStepper from './QuantityStepper';

export default function DishCard({ dish, quantity, onAdd, onChangeQuantity, disabled, disabledReason }) {
  return (
    <div className="card flex gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <VegMark veg={dish.is_veg} />
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{dish.category}</span>
        </div>
        <h3 className="mt-1 font-semibold text-gray-900">{dish.name}</h3>
        <p className="mt-0.5 font-semibold text-gray-800">{formatCurrency(dish.price)}</p>
        {dish.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{dish.description}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        <DishImage src={dish.image_url} name={dish.name} className="h-24 w-24 sm:h-28 sm:w-28" />
        {quantity > 0 ? (
          <QuantityStepper value={quantity} onChange={onChangeQuantity} disabled={disabled} label={dish.name} />
        ) : (
          <button type="button" className="btn-secondary btn-sm min-w-[80px] border-brand-200 text-brand-700"
            onClick={onAdd} disabled={disabled} title={disabledReason}>
            Add
          </button>
        )}
      </div>
    </div>
  );
}
