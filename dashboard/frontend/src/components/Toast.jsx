import React from 'react';
import { Check, X } from 'lucide-react';

export function Toast({ toast }) {
  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-lg sheet-slide-up flex items-center gap-2 backdrop-blur-sm ${
        toast.type === 'error'
          ? 'bg-red-500/90 text-white'
          : toast.type === 'success'
          ? 'bg-ws-teal/90 text-white'
          : 'bg-ws-card/95 text-ws-text border border-ws-border'
      }`}
    >
      {toast.type === 'success' && <Check className="w-4 h-4 copy-success" />}
      {toast.type === 'error' && <X className="w-4 h-4" />}
      <span className="text-sm">{toast.message}</span>
    </div>
  );
}

export function ToastContainer({ toasts }) {
  return (
    <div
      className="fixed bottom-4 right-4 z-50 space-y-2"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

export default ToastContainer;
