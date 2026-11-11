import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RestaurantProfileForm from '../components/owner/RestaurantProfileForm';
import { renderWithProviders } from './renderWithProviders';

const restaurant = {
  id: 1,
  name: 'Campus Curry House',
  cuisine: 'North Indian',
  address: 'Food Court, Block A, Main Campus',
  phone: '9876543210',
  description: 'Fresh meals on campus',
  image_url: 'http://localhost:3000/uploads/restaurant.jpg',
};

const createObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const revokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
const pointerEvent = Object.getOwnPropertyDescriptor(window, 'PointerEvent');
const canvasContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
const canvasToBlob = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toBlob');

describe('RestaurantProfileForm', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:restaurant-photo') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    Object.defineProperty(window, 'PointerEvent', {
      configurable: true,
      value: class extends MouseEvent {
        constructor(type, init = {}) {
          super(type, init);
          Object.defineProperty(this, 'pointerId', { value: init.pointerId ?? 1 });
        }
      },
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => ({ drawImage: vi.fn() })),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      configurable: true,
      value: (callback) => callback(new Blob(['cropped'], { type: 'image/jpeg' })),
    });
  });

  afterEach(() => {
    cleanup();
    if (createObjectUrl) Object.defineProperty(URL, 'createObjectURL', createObjectUrl);
    else delete URL.createObjectURL;
    if (revokeObjectUrl) Object.defineProperty(URL, 'revokeObjectURL', revokeObjectUrl);
    else delete URL.revokeObjectURL;
    if (pointerEvent) Object.defineProperty(window, 'PointerEvent', pointerEvent);
    else delete window.PointerEvent;
    if (canvasContext) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', canvasContext);
    else delete HTMLCanvasElement.prototype.getContext;
    if (canvasToBlob) Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', canvasToBlob);
    else delete HTMLCanvasElement.prototype.toBlob;
  });

  it('lets an owner update restaurant details and the photo URL', async () => {
    const onSave = vi.fn().mockResolvedValue({});
    renderWithProviders(<RestaurantProfileForm restaurant={restaurant} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    fireEvent.change(screen.getByLabelText('Restaurant name'), { target: { value: 'Campus Curry' } });
    fireEvent.change(screen.getByLabelText('Restaurant photo URL (optional)'), {
      target: { value: 'https://example.com/new-photo.jpg' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      name: 'Campus Curry',
      cuisine: 'North Indian',
      address: 'Food Court, Block A, Main Campus',
      phone: '9876543210',
      description: 'Fresh meals on campus',
      image_url: 'https://example.com/new-photo.jpg',
      image_crop_x: 0.5,
      image_crop_y: 0.5,
    }, null));
  });

  it('lets an owner drag a selected photo before saving', async () => {
    const onSave = vi.fn().mockResolvedValue({});
    renderWithProviders(<RestaurantProfileForm restaurant={restaurant} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    fireEvent.change(screen.getByLabelText('Upload a photo (optional)'), {
      target: { files: [new File(['photo'], 'restaurant.png', { type: 'image/png' })] },
    });

    const cropFrame = await screen.findByRole('group', { name: 'Drag to position the restaurant photo crop' });
    expect(screen.getByText('Drag the photo to choose what appears in the restaurant listing.')).toBeInTheDocument();
    const image = screen.getByRole('img', { name: 'Drag to position the restaurant photo' });
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 1600 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 1200 });
    Object.defineProperty(image, 'complete', { configurable: true, value: true });
    vi.spyOn(cropFrame, 'getBoundingClientRect').mockReturnValue({
      width: 320, height: 180, top: 0, right: 320, bottom: 180, left: 0, x: 0, y: 0, toJSON: () => {},
    });
    cropFrame.setPointerCapture = vi.fn();
    fireEvent.load(image);

    fireEvent.pointerDown(cropFrame, { pointerId: 1, clientX: 100, clientY: 80 });
    fireEvent.pointerMove(cropFrame, { pointerId: 1, clientX: 100, clientY: 90 });
    await waitFor(() => expect(parseFloat(image.style.top)).toBeCloseTo(-20));
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: restaurant.name, description: restaurant.description }),
      expect.any(File),
    ));
    const croppedFile = onSave.mock.calls[0][1];
    expect(croppedFile.type).toBe('image/jpeg');
    expect(croppedFile.name).toBe('restaurant-cropped.jpg');
  });

  it('saves crop positioning for a photo URL without uploading it', async () => {
    const onSave = vi.fn().mockResolvedValue({});
    renderWithProviders(<RestaurantProfileForm restaurant={restaurant} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    const cropFrame = await screen.findByRole('group', { name: 'Drag to position the restaurant photo crop' });
    const image = screen.getByRole('img', { name: 'Drag to position the restaurant photo' });
    expect(image).toHaveAttribute('src', restaurant.image_url);
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 1600 });
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 1200 });
    Object.defineProperty(image, 'complete', { configurable: true, value: true });
    vi.spyOn(cropFrame, 'getBoundingClientRect').mockReturnValue({
      width: 320, height: 180, top: 0, right: 320, bottom: 180, left: 0, x: 0, y: 0, toJSON: () => {},
    });
    cropFrame.setPointerCapture = vi.fn();
    fireEvent.load(image);
    fireEvent.pointerDown(cropFrame, { pointerId: 1, clientX: 100, clientY: 80 });
    fireEvent.pointerMove(cropFrame, { pointerId: 1, clientX: 100, clientY: 90 });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const [payload, uploadedFile] = onSave.mock.calls[0];
    expect(payload.image_url).toBe(restaurant.image_url);
    expect(payload.image_crop_x).toBe(0.5);
    expect(payload.image_crop_y).toBeLessThan(0.5);
    expect(uploadedFile).toBeNull();
    expect(screen.queryByRole('slider', { name: 'Zoom photo' })).toBeNull();
  });
});
