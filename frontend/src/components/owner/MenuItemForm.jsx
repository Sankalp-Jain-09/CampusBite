import { useEffect, useState } from 'react';
import Button from '../common/Button';
import DishImage from '../common/DishImage';
import FormField from '../common/FormField';
import Modal from '../common/Modal';
import { collectErrors, minLength } from '../../utils/validation';

const EMPTY = { name: '', description: '', category: 'Main', price: '', is_veg: true, is_available: true, image_url: '' };

function validate(v) {
  const price = Number(v.price);
  return collectErrors({
    name: minLength(v.name, 2, 'Name'),
    category: minLength(v.category, 2, 'Category'),
    price: !v.price ? 'Price is required'
      : !(price > 0) ? 'Price must be greater than 0'
        : !/^\d+(\.\d{1,2})?$/.test(String(v.price)) ? 'Use at most 2 decimal places' : null,
    image_url: v.image_url && !/^https?:\/\/\S+$/.test(v.image_url) ? 'Must start with http:// or https://' : null,
  });
}

/** Add / edit a dish. `dish` = null for a new dish. `onSave(payload)` should throw API errors. */
export default function MenuItemForm({ open, dish, onClose, onSave }) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(dish ? {
      name: dish.name, description: dish.description || '', category: dish.category, price: String(dish.price),
      is_veg: dish.is_veg, is_available: dish.is_available, image_url: dish.image_url || '',
    } : EMPTY);
    setErrors({});
    setFormError('');
  }, [open, dish]);

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  const submit = async () => {
    const clientErrors = validate(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;
    setSaving(true);
    try {
      await onSave({
        name: values.name.trim(),
        description: values.description.trim() || null,
        category: values.category.trim(),
        price: Number(values.price),
        is_veg: values.is_veg,
        is_available: values.is_available,
        image_url: values.image_url.trim() || null,
      });
      onClose();
    } catch (err) {
      setErrors(err.fieldErrors || {});
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={dish ? `Edit ${dish.name}` : 'Add a dish'}
      onClose={saving ? undefined : onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving}>{dish ? 'Save changes' : 'Add dish'}</Button>
        </>
      )}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        {formError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
        <FormField label="Name" error={errors.name}><input value={values.name} onChange={set('name')} /></FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Category" error={errors.category}><input value={values.category} onChange={set('category')} placeholder="Mains" /></FormField>
          <FormField label="Price (₹)" error={errors.price}><input type="number" min="0" step="0.01" inputMode="decimal" value={values.price} onChange={set('price')} /></FormField>
        </div>
        <FormField label="Description (optional)" error={errors.description}>
          <textarea rows={2} maxLength={1000} value={values.description} onChange={set('description')} />
        </FormField>
        <div className="flex items-end gap-3">
          <FormField label="Image URL (optional)" error={errors.image_url} className="flex-1">
            <input value={values.image_url} onChange={set('image_url')} placeholder="https://…" />
          </FormField>
          <DishImage src={/^https?:\/\/\S+$/.test(values.image_url) ? values.image_url : null} name={values.name || '?'} className="h-[42px] w-[42px]" />
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={values.is_veg} onChange={set('is_veg')} /> Vegetarian</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-600" checked={values.is_available} onChange={set('is_available')} /> Available now</label>
        </div>
      </form>
    </Modal>
  );
}
