import Button from './Button';
import Modal from './Modal';

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, loading = false, onConfirm, onCancel,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={loading ? undefined : onCancel}
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      )}
    >
      <p className="text-sm text-gray-600">{message}</p>
    </Modal>
  );
}
