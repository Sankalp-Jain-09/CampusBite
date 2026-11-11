import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 675;

const RestaurantImageCropper = forwardRef(function RestaurantImageCropper({ file, src, initialCrop }, ref) {
  const frameRef = useRef(null);
  const imageRef = useRef(null);
  const dragRef = useRef(null);
  const [dimensions, setDimensions] = useState(null);
  const [position, setPosition] = useState({ x: initialCrop?.x ?? 0.5, y: initialCrop?.y ?? 0.5 });
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : src;
    setPreviewUrl(url);
    setDimensions(null);
    setImageError(false);
    setPosition({ x: initialCrop?.x ?? 0.5, y: initialCrop?.y ?? 0.5 });
    return () => {
      if (file) URL.revokeObjectURL(url);
    };
  }, [file, initialCrop?.x, initialCrop?.y, src]);

  useEffect(() => {
    if (!previewUrl || typeof ResizeObserver === 'undefined' || !frameRef.current) return undefined;
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [previewUrl]);

  const updateDimensions = () => {
    const image = imageRef.current;
    const frame = frameRef.current;
    if (!image?.naturalWidth || !frame) return;
    const { width, height } = frame.getBoundingClientRect();
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    setDimensions({
      frameWidth: width,
      frameHeight: height,
      imageWidth: image.naturalWidth * scale,
      imageHeight: image.naturalHeight * scale,
    });
  };

  const imageStyle = dimensions ? {
    width: dimensions.imageWidth,
    height: dimensions.imageHeight,
    left: (dimensions.frameWidth - dimensions.imageWidth) * position.x,
    top: (dimensions.frameHeight - dimensions.imageHeight) * position.y,
  } : undefined;

  const startDrag = (event) => {
    if (!dimensions) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const drag = (event) => {
    const previous = dragRef.current;
    if (
      !previous
      || previous.pointerId !== event.pointerId
      || !dimensions
      || !Number.isFinite(event.clientX)
      || !Number.isFinite(event.clientY)
    ) return;
    const xRange = dimensions.imageWidth - dimensions.frameWidth;
    const yRange = dimensions.imageHeight - dimensions.frameHeight;
    setPosition((current) => ({
      x: xRange ? Math.max(0, Math.min(1, current.x - (event.clientX - previous.x) / xRange)) : 0.5,
      y: yRange ? Math.max(0, Math.min(1, current.y - (event.clientY - previous.y) / yRange)) : 0.5,
    }));
    dragRef.current = { ...previous, x: event.clientX, y: event.clientY };
  };

  const finishDrag = () => {
    dragRef.current = null;
  };

  useImperativeHandle(ref, () => ({
    getCrop() {
      return { x: position.x, y: position.y };
    },
    async getCroppedFile() {
      if (!file) return null;
      const image = imageRef.current;
      if (!image?.complete || !dimensions) throw new Error('Wait for the photo preview to load before saving.');
      const sourceScale = image.naturalWidth / dimensions.imageWidth;
      const sourceX = ((dimensions.frameWidth - dimensions.imageWidth) * position.x) * -sourceScale;
      const sourceY = ((dimensions.frameHeight - dimensions.imageHeight) * position.y) * -sourceScale;
      const sourceWidth = dimensions.frameWidth * sourceScale;
      const sourceHeight = dimensions.frameHeight * sourceScale;
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not prepare the cropped photo.');
      context.drawImage(
        image,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT,
      );
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Could not crop this photo. Please try another image.');
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'restaurant-photo';
      return new File([blob], `${baseName}-cropped.jpg`, { type: 'image/jpeg' });
    },
  }), [dimensions, file, position]);

  return (
    <div className="space-y-3">
      <div
        ref={frameRef}
        className="relative aspect-video w-full touch-none cursor-grab overflow-hidden rounded-lg bg-gray-900 active:cursor-grabbing"
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        role="group"
        aria-label="Drag to position the restaurant photo crop"
      >
        <img
          ref={imageRef}
          src={previewUrl}
          alt="Drag to position the restaurant photo"
          className="pointer-events-none absolute max-w-none select-none"
          style={imageStyle}
          draggable="false"
          onLoad={() => {
            setImageError(false);
            updateDimensions();
          }}
          onError={() => setImageError(true)}
        />
        <div className="pointer-events-none absolute inset-0 border-2 border-white/80" />
      </div>
      {imageError && <p role="alert" className="text-sm text-red-600">Could not load this image URL. Check the URL and try again.</p>}
      <p className="text-xs text-gray-500">Drag the photo to choose what appears in the restaurant listing.</p>
      {!file && <p className="text-xs text-gray-500">Your selection is saved and used wherever your restaurant photo appears.</p>}
    </div>
  );
});

export default RestaurantImageCropper;
