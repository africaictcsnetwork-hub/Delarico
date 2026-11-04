import React from 'react';
import { CheckCircle2, Clock, Printer, X } from 'lucide-react';
import { OFFICIAL_LOGO_PATH } from '../firebase';
import { Order, OrderItem, StoreSettings } from '../types';
import { formatKes } from '../utils/whatsapp';

interface InvoiceModalProps {
  order: Order;
  items: OrderItem[];
  settings: StoreSettings;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  order,
  items,
  settings,
  onClose,
}) => {
  const isPaid = order.paymentStatus === 'verified_paid';
  const documentTitle = isPaid ? 'OFFICIAL PAYMENT RECEIPT & TAX INVOICE' : 'PROFORMA COMMERCIAL INVOICE';

  const formatTimestamp = (ts: unknown): string => {
    if (!ts) return new Date().toLocaleDateString('en-KE');
    if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
      return (ts as { toDate: () => Date }).toDate().toLocaleString('en-KE');
    }
    const parsed = Date.parse(String(ts));
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toLocaleString('en-KE');
    }
    return String(ts);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto font-sans">
      <div className="bg-white w-full max-w-3xl rounded-xl border border-slate-200 shadow-xl overflow-hidden my-8">
        {/* Modal Action Toolbar (Hidden when printing) */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-navy-900 text-white">
          <span className="text-sm font-semibold">{documentTitle} — #{order.orderNumber}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold bg-gold-500 text-navy-950 rounded-lg hover:bg-gold-400 transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice"
              className="p-1.5 text-slate-300 hover:text-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Canvas */}
        <div className="p-8 space-y-6 text-slate-900">
          {/* Corporate Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-200">
            <div className="flex items-center gap-4">
              <img
                src={OFFICIAL_LOGO_PATH}
                alt="DELARICO Logo"
                className="w-16 h-16 object-contain"
              />
              <div>
                <h2 className="text-lg font-bold text-navy-900">{settings.businessName}</h2>
                <p className="text-xs font-medium text-gold-600">{settings.tagline}</p>
                <p className="text-xs text-slate-600 mt-1">{settings.location}</p>
                <p className="text-xs text-slate-600 tabular-nums">
                  Tel / WhatsApp / M-Pesa: {settings.whatsappNumber} · {settings.email}
                </p>
              </div>
            </div>

            <div className="sm:text-right">
              <p className="text-xs font-semibold text-slate-500">{documentTitle}</p>
              <p className="text-lg font-bold text-navy-900 mt-0.5 tabular-nums">#{order.orderNumber}</p>
              <p className="text-xs text-slate-500 mt-1">Issued: {formatTimestamp(order.createdAt)}</p>
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold">
                {isPaid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span className="text-emerald-700">VERIFIED PAID</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-amber-700" />
                    <span className="text-amber-700">PAYMENT PENDING VERIFICATION</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Customer & Delivery Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <p className="font-semibold text-slate-500 mb-1">Billed To</p>
              <p className="text-sm font-semibold text-slate-900">{order.customerName}</p>
              <p className="text-slate-600 capitalize">Account Tier: {order.accountType}</p>
              <p className="text-slate-600 tabular-nums">{order.customerPhone}</p>
              <p className="text-slate-600">{order.customerEmail}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-500 mb-1">Dispatch &amp; Payment Details</p>
              <p className="text-slate-800">
                Destination: {order.deliveryAddress}, {order.deliveryTown} ({order.deliveryCounty})
              </p>
              <p className="text-slate-600">
                Method: {order.paymentMethod.replace(/_/g, ' ').toUpperCase()}
              </p>
              {order.paymentReference && (
                <p className="text-slate-800 font-medium">Reference: {order.paymentReference}</p>
              )}
              <p className="text-slate-600 capitalize">Order Status: {order.orderStatus}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-semibold">Item Description</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Qty</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Unit Price</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 px-4">
                      <p className="font-medium text-slate-900">{item.productName}</p>
                      <p className="text-slate-500">{item.sku} · {item.unit}</p>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatKes(item.unitPriceKes)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                      {formatKes(item.lineTotalKes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Totals & Payment Settlement Channels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <p className="font-semibold text-navy-900 mb-1">Official Payment Details</p>
              <p className="tabular-nums">
                M-Pesa Number: <strong className="text-slate-900">{settings.mpesaPaybillNumber}</strong> (Ref: {order.orderNumber})
              </p>
              <p className="tabular-nums">
                WhatsApp Confirmation: <strong className="text-slate-900">{settings.whatsappNumber}</strong>
              </p>
              <p>Account Name: <strong className="text-slate-900">{settings.bankAccountName}</strong></p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Materials Subtotal</span>
                <span className="tabular-nums">{formatKes(order.subtotalKes)}</span>
              </div>
              {order.discountKes > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount {order.promoCode ? `(${order.promoCode})` : ''}</span>
                  <span className="tabular-nums">-{formatKes(order.discountKes)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Delivery &amp; Handling</span>
                <span className="tabular-nums">
                  {order.deliveryFeeKes === 0 ? 'FREE' : formatKes(order.deliveryFeeKes)}
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-200 text-base font-bold text-navy-900">
                <span>Total Amount (KES)</span>
                <span className="tabular-nums">{formatKes(order.totalKes)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center pt-4 border-t border-slate-200">
            Thank you for building with {settings.businessName} — {settings.tagline}
          </p>
        </div>
      </div>
    </div>
  );
};
