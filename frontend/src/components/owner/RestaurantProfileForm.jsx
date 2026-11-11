import { useEffect, useRef, useState } from 'react';
import Button from '../common/Button';
import FormField from '../common/FormField';
import Modal from '../common/Modal';
import { collectErrors, minLength, validatePhone } from '../../utils/validation';
import RestaurantImageCropper from './RestaurantImageCropper';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validate(values, imageFile) {
  return collectErrors({
    name: minLength(values.name, 2, 'Name'),
    cuisine: minLength(values.cuisine, 2, 'Cuisine'),
    address: minLength(values.address, 5, 'Address'),
    phone: validatePhone(values.phone),
    description: values.description.length > 1000 ? 'Use at most 1000 characters' : null,
    image_url: !imageFile && values.image_url && !/^https?:\/\/\S+$/.test(values.image_url)
      ? 'Must start with http:// or https://'
      : values.image_url.length > 500 ? 'Use at most 500 characters' : null,
  });
}

export default function RestaurantProfileForm({ restaurant, onSave }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const cropperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setValues({
      name: restaurant.name,
      cuisine: restaurant.cuisine,
      address: restaurant.address,
      phone: restaurant.phone,
      description: restaurant.description || '',
      image_url: restaurant.image_url || '',
      image_crop_x: restaurant.image_crop_x ?? 0.5,
      image_crop_y: restaurant.image_crop_y ?? 0.5,
    });
    setImageFile(null);
    setErrors({});
    setFormError('');
  }, [open]);

  const set = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === 'image_url' ? { image: undefined } : {}),
    }));
    if (field === 'image_url') {
      setImageFile(null);
      setValues((current) => ({ ...current, image_crop_x: 0.5, image_crop_y: 0.5 }));
    }
  };

  const selectImage = (event) => {
    const file = event.target.files?.[0] || null;
    setImageFile(null);
    setErrors((current) => ({ ...current, image: undefined }));
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setErrors((current) => ({ ...current, image: 'Choose a JPEG, PNG, or WebP image' }));
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setErrors((current) => ({ ...current, image: 'Image must be 5 MB or smaller' }));
      event.target.value = '';
      return;
    }
    setImageFile(file);
    setValues((current) => ({
      ...current,
      image_url: '',
      image_crop_x: 0.5,
      image_crop_y: 0.5,
    }));
    setErrors((current) => ({ ...current, image_url: undefined }));
  };

  const submit = async () => {
    const clientErrors = validate(values, imageFile);
    if (errors.image) clientErrors.image = errors.image;
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: values.name.trim(),
        cuisine: values.cuisine.trim(),
        address: values.address.trim(),
        phone: values.phone.trim(),
        description: values.description.trim() || null,
      };
      if (!imageFile) {
        payload.image_url = values.image_url.trim() || null;
        if (payload.image_url && cropperRef.current) {
          const crop = cropperRef.current.getCrop();
          payload.image_crop_x = crop.x;
          payload.image_crop_y = crop.y;
        }
      }
      const uploadFile = imageFile ? await cropperRef.current.getCroppedFile() : null;
      await onSave(payload, uploadFile);
      setOpen(false);
    } catch (error) {
      setErrors(error.fieldErrors || {});
      setFormError(error.message || 'Could not save your restaurant profile.');
    } finally {
      setSaving(false);
    }
  };

  const imageSrc = values.image_url || '';
  const canCropUrl = /^https?:\/\/\S+$/.test(imageSrc);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit profile</Button>
      <Modal
        open={open}
        title="Edit restaurant profile"
        onClose={saving ? undefined : () => setOpen(false)}
        size="lg"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submit} loading={saving}>Save profile</Button>
          </>
        )}
      >
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submit(); }} noValidate>
          {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Restaurant name" error={errors.name}>
              <input value={values.name || ''} onChange={set('name')} maxLength={150} />
            </FormField>
            <FormField label="Cuisine" error={errors.cuisine}>
              <input value={values.cuisine || ''} onChange={set('cuisine')} maxLength={150} />
            </FormField>
          </div>
          <FormField label="Address" error={errors.address}>
            <textarea rows={2} value={values.address || ''} onChange={set('address')} maxLength={500} />
          </FormField>
          <FormField label="Phone" error={errors.phone}>
            <input type="tel" value={values.phone || ''} onChange={set('phone')} maxLength={16} />
          </FormField>
          <FormField label="Description (optional)" error={errors.description}>
            <textarea rows={3} value={values.description || ''} onChange={set('description')} maxLength={1000} />
          </FormField>
          <FormField
            label="Restaurant photo URL (optional)"
            error={errors.image_url || errors.image}
            hint="Paste an image URL, or choose a JPEG, PNG, or WebP file up to 5 MB."
          >
            <input value={values.image_url || ''} onChange={set('image_url')} placeholder="https://…" maxLength={500} />
          </FormField>
          <FormField label="Upload a photo (optional)">
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} />
          </FormField>
          {imageFile && <RestaurantImageCropper ref={cropperRef} file={imageFile} />}
          {!imageFile && canCropUrl && (
            <RestaurantImageCropper
              key={imageSrc}
              ref={cropperRef}
              src={imageSrc}
              initialCrop={{
                x: values.image_crop_x ?? 0.5,
                y: values.image_crop_y ?? 0.5,
              }}
            />
          )}
        </form>
      </Modal>
    </>
  );
}
