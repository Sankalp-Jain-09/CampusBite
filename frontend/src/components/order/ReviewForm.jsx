import { useState } from 'react';
import { ordersApi } from '../../api/orders';
import { useToast } from '../../hooks/useToast';
import Button from '../common/Button';
import { RatingInput } from '../common/RatingStars';

export default function ReviewForm({ orderId, onDone }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setError('Please choose a rating');
      return;
    }
    setBusy(true);
    try {
      await ordersApi.review(orderId, { rating, comment: comment.trim() || null });
      toast.success('Thanks for your review!');
      onDone?.();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" id="review">
      <p className="text-sm text-gray-600">How was your food?</p>
      <RatingInput value={rating} onChange={(n) => { setRating(n); setError(''); }} disabled={busy} />
      <textarea className="input" rows={3} maxLength={1000} placeholder="Tell others about your order (optional)"
        value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Review comment" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" loading={busy}>Submit review</Button>
    </form>
  );
}
