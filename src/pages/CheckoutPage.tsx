import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, FileText, Lock, MessageCircle, ShieldCheck, Smartphone, Truck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { DeliveryMethod, Order, OrderItem, PaymentMethod } from '../types';
import { buildCartEnquiryMessage, buildOrderFollowUpMessage, buildWhatsAppUrl, formatKes } from '../utils/whatsapp';
import { InvoiceModal } from '../components/InvoiceModal';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    userProfile,
    userContact,
    addresses,
    branches,
    settings,
    cart,
    getEffectiveUnitPrice,
    cartSubtotalKes,
    cartDiscountKes,
    appliedPromo,
    clearCart,
    apiFetch,
    refreshAccountSession,
    notify,
  } = useStore();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id || 'branch-siaya-hq');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('local_siaya');
  const [deliveryCounty, setDeliveryCounty] = useState('Siaya');
  const [deliveryTown, setDeliveryTown] = useState('Siaya Town');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [saveNewAddress, setSaveNewAddress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mpesa_paybill');
  const [paymentReference, setPaymentReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [placedOrder, setPlacedOrder] = useState<{ order: Order; items: OrderItem[] } | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    if (userProfile?.displayName && !customerName) setCustomerName(userProfile.displayName);
    if (user?.email && !customerEmail) setCustomerEmail(user.email);
    if (userContact) {
      if (userContact.phone && !customerPhone) setCustomerPhone(userContact.phone);
      if (userContact.defaultCounty) setDeliveryCounty(userContact.defaultCounty);
      if (userContact.defaultTown) setDeliveryTown(userContact.defaultTown);
      if (userContact.defaultStreetAddress && !deliveryAddress) {
        setDeliveryAddress(userContact.defaultStreetAddress);
      }
    }
  }, [user, userProfile, userContact]);

  const netMaterialsKes = Math.max(0, cartSubtotalKes - cartDiscountKes);

  const deliveryFeeKes = useMemo(() => {
    if (deliveryMethod === 'pickup') return 0;
    if (deliveryMethod === 'local_siaya') {
      return netMaterialsKes >= settings.freeDeliveryThresholdKes ? 0 : 1500;
    }
    if (deliveryMethod === 'regional_nyanza') return 4500;
    return 9500;
  }, [deliveryMethod, netMaterialsKes, settings.freeDeliveryThresholdKes]);

  const totalKes = netMaterialsKes + deliveryFeeKes;
  const estimatedLoyaltyPoints = Math.floor(totalKes / 1000) * settings.loyaltyPointsPer1000Kes;

  const handleSelectSavedAddress = (addrId: string) => {
    const found = addresses.find((a) => a.id === addrId);
    if (!found) return;
    setCustomerName(found.recipientName);
    setCustomerPhone(found.phone);
    setDeliveryCounty(found.county);
    setDeliveryTown(found.town);
    setDeliveryAddress(found.streetDetails);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/account?redirect=%2Fcheckout');
      return;
    }
    if (cart.length === 0) {
      notify('Your cart is empty.', 'error');
      return;
    }
    if (customerPhone.trim().length < 7 || (deliveryMethod !== 'pickup' && deliveryAddress.trim().length < 2)) {
      notify('Please enter a valid phone number and site/pickup address details.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload = cart.map(({ product, quantity }) => {
        const unitPriceKes = getEffectiveUnitPrice(product, quantity);
        return {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unit: product.unit,
          quantity,
          unitPriceKes,
          lineTotalKes: unitPriceKes * quantity,
        };
      });

      const resolvedAddress =
        deliveryMethod === 'pickup'
          ? `Yard Pickup — ${branches.find((b) => b.id === selectedBranchId)?.name || 'Siaya Yard'}`
          : deliveryAddress.trim();

      const res = await apiFetch<{ order: Order; items: OrderItem[] }>('/api/customer/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim() || user.email || 'customer@delarico.co.ke',
          accountType: userProfile?.accountType || 'individual',
          branchId: selectedBranchId,
          deliveryCounty: deliveryCounty.trim(),
          deliveryTown: deliveryTown.trim(),
          deliveryAddress: resolvedAddress,
          deliveryMethod,
          subtotalKes: cartSubtotalKes,
          discountKes: cartDiscountKes,
          promoCode: appliedPromo ? appliedPromo.code : '',
          deliveryFeeKes,
          totalKes,
          paymentMethod,
          paymentReference: paymentReference.trim().toUpperCase(),
          notes: notes.trim(),
          saveNewAddress: saveNewAddress && deliveryMethod !== 'pickup',
          items: itemsPayload,
        }),
      });

      if (saveNewAddress && deliveryMethod !== 'pickup') {
        void refreshAccountSession();
      }

      setPlacedOrder(res);
      clearCart();
      notify(`Order #${res.order.orderNumber} placed! Awaiting payment verification.`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not place order right now.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (placedOrder) {
    const waConfirmUrl = buildWhatsAppUrl(
      buildOrderFollowUpMessage(placedOrder.order),
      settings.whatsappNumber
    );

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 space-y-8 font-sans">
        <div className="p-8 bg-white border border-slate-200 rounded-xl space-y-6">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-700 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-royal-700">Order Recorded &amp; Queued for Dispatch</p>
              <h1 className="text-2xl font-bold text-navy-900 mt-0.5 tabular-nums">
                Order #{placedOrder.order.orderNumber} Confirmed
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Payment Status:{' '}
                <strong className="text-amber-700">Pending Verification</strong>. Orders are marked
                as Paid once our finance desk verifies your M-Pesa or payment confirmation.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5">
            <p className="font-semibold text-navy-900">Next Step — Official Payment Details</p>
            {placedOrder.order.paymentMethod !== 'cod' ? (
              <p className="leading-relaxed">
                Send <strong className="tabular-nums">{formatKes(placedOrder.order.totalKes)}</strong> via M-Pesa to{' '}
                <strong className="tabular-nums text-navy-900">{settings.mpesaPaybillNumber}</strong> (Reference:{' '}
                <strong>{placedOrder.order.orderNumber}</strong>), then share your M-Pesa code in your Account or via WhatsApp below.
              </p>
            ) : (
              <p className="leading-relaxed">
                Cash / M-Pesa on Delivery selected (<strong className="tabular-nums">{formatKes(placedOrder.order.totalKes)}</strong>). Our Siaya
                dispatch coordinator ({settings.whatsappNumber}) will call <span className="tabular-nums font-medium">{placedOrder.order.customerPhone}</span> prior to loading.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowInvoiceModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400"
            >
              <FileText className="w-4 h-4" />
              <span>View &amp; Print Proforma Invoice</span>
            </button>

            <a
              href={waConfirmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Confirm on WhatsApp ({settings.whatsappNumber})</span>
            </a>

            <Link
              to="/account"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-navy-900 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              <span>Track Order in My Account</span>
            </Link>
          </div>
        </div>

        {showInvoiceModal && (
          <InvoiceModal
            order={placedOrder.order}
            items={placedOrder.items}
            settings={settings}
            onClose={() => setShowInvoiceModal(false)}
          />
        )}
      </div>
    );
  }

  const cartWaUrl = buildWhatsAppUrl(
    buildCartEnquiryMessage(cart, cartSubtotalKes - cartDiscountKes),
    settings.whatsappNumber
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 font-sans">
      <div className="pb-6 border-b border-slate-200 mb-8">
        <p className="text-xs font-semibold text-royal-700 mb-1">Material Order Checkout</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-navy-900">Complete Your Order</h1>
      </div>

      {!user ? (
        <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl max-w-xl space-y-5">
          <div className="flex items-center gap-2.5 text-navy-900 font-bold text-lg">
            <Lock className="w-5 h-5 text-gold-600 shrink-0" />
            <span>Sign In or Create an Account to Checkout</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Log in with your phone number and password (or create a free account in 20 seconds) to track lorry
            dispatch, earn loyalty points, and download official DELARICO invoices and receipts.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/account?redirect=%2Fcheckout"
              className="inline-flex items-center justify-center px-6 py-3 text-xs sm:text-sm font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 transition-colors"
            >
              Sign In / Create Account
            </Link>
            {cart.length > 0 && (
              <a
                href={cartWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Order Directly on WhatsApp</span>
              </a>
            )}
          </div>
        </div>
      ) : cart.length === 0 ? (
        <div className="p-10 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
          <p className="text-sm font-semibold text-navy-900">Your shopping cart is currently empty.</p>
          <Link
            to="/products"
            className="inline-flex items-center px-5 py-2.5 text-xs font-semibold text-white bg-navy-900 rounded-lg"
          >
            Browse Building Materials
          </Link>
        </div>
      ) : (
        <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Checkout Form */}
          <div className="lg:col-span-7 space-y-8">
            {/* 1. Customer Contact */}
            <section className="p-6 bg-white border border-slate-200 rounded-xl space-y-4">
              <h2 className="text-base font-bold text-navy-900">1. Customer &amp; Site Contact</h2>

              {addresses.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Load Saved Delivery Address
                  </label>
                  <select
                    onChange={(e) => handleSelectSavedAddress(e.target.value)}
                    defaultValue=""
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="" disabled>Select from your saved addresses...</option>
                    {addresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.label} — {addr.town}, {addr.county} ({addr.phone})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name / Site Foreman *</label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact / M-Pesa Phone *</label>
                  <input
                    type="tel"
                    required
                    maxLength={30}
                    placeholder="e.g. 0712 345 678"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs tabular-nums border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </section>

            {/* 2. Dispatch Branch & Delivery Mode */}
            <section className="p-6 bg-white border border-slate-200 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-royal-700" />
                <h2 className="text-base font-bold text-navy-900">2. Dispatch Yard &amp; Site Delivery</h2>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Origin Yard / Branch</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.town})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: 'local_siaya' as const,
                    title: 'Siaya County Site Delivery',
                    fee: netMaterialsKes >= settings.freeDeliveryThresholdKes ? 'FREE' : 'KES 1,500',
                    desc: `Free above ${formatKes(settings.freeDeliveryThresholdKes)}`,
                  },
                  {
                    id: 'pickup' as const,
                    title: 'Direct Yard Collection',
                    fee: 'FREE',
                    desc: 'Same-day crew loading at yard',
                  },
                  {
                    id: 'regional_nyanza' as const,
                    title: 'Regional Nyanza & Western',
                    fee: 'KES 4,500',
                    desc: 'Kisumu, Busia, Kakamega, Homa Bay, Vihiga',
                  },
                  {
                    id: 'countrywide_freight' as const,
                    title: 'Countrywide Heavy Freight',
                    fee: 'KES 9,500',
                    desc: 'Scheduled haulage across Kenya',
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDeliveryMethod(opt.id)}
                    className={`p-3.5 text-left rounded-lg border transition-colors ${
                      deliveryMethod === opt.id
                        ? 'border-navy-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs font-bold text-navy-900">
                      <span>{opt.title}</span>
                      <span className="text-gold-600 tabular-nums">{opt.fee}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {deliveryMethod !== 'pickup' && (
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">County *</label>
                      <input
                        type="text"
                        required
                        value={deliveryCounty}
                        onChange={(e) => setDeliveryCounty(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Town / Ward *</label>
                      <input
                        type="text"
                        required
                        value={deliveryTown}
                        onChange={(e) => setDeliveryTown(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Exact Site Location / Road / Landmark *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 400m off Siaya–Bondo Rd near Karemo Market"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveNewAddress}
                      onChange={(e) => setSaveNewAddress(e.target.checked)}
                    />
                    <span>Save this site address to my account address book</span>
                  </label>
                </div>
              )}
            </section>

            {/* 3. Payment Method Selection */}
            <section className="p-6 bg-white border border-slate-200 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-700" />
                <h2 className="text-base font-bold text-navy-900">3. Payment Method ({settings.mpesaPaybillNumber})</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {settings.mpesaStkEnabled && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('mpesa_stk')}
                    className={`p-3.5 text-left rounded-lg border text-xs ${
                      paymentMethod === 'mpesa_stk' ? 'border-navy-900 bg-slate-50 font-semibold' : 'border-slate-200'
                    }`}
                  >
                    <p className="font-bold text-navy-900">M-Pesa Direct ({settings.mpesaPaybillNumber})</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Send Money / M-Pesa prompt &amp; code verification</p>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('mpesa_paybill')}
                  className={`p-3.5 text-left rounded-lg border text-xs ${
                    paymentMethod === 'mpesa_paybill' ? 'border-navy-900 bg-slate-50 font-semibold' : 'border-slate-200'
                  }`}
                >
                  <p className="font-bold text-navy-900">M-Pesa Payment ({settings.mpesaPaybillNumber})</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Official DELARICO M-Pesa settlement line</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('mpesa_till')}
                  className={`p-3.5 text-left rounded-lg border text-xs ${
                    paymentMethod === 'mpesa_till' ? 'border-navy-900 bg-slate-50 font-semibold' : 'border-slate-200'
                  }`}
                >
                  <p className="font-bold text-navy-900">Mobile Money ({settings.mpesaTillNumber})</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Retail &amp; yard settlement</p>
                </button>
                {settings.codEnabled && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-3.5 text-left rounded-lg border text-xs ${
                      paymentMethod === 'cod' ? 'border-navy-900 bg-slate-50 font-semibold' : 'border-slate-200'
                    }`}
                  >
                    <p className="font-bold text-navy-900">Cash / M-Pesa on Site Delivery (COD)</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Pay upon physical material inspection at your site
                    </p>
                  </button>
                )}
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                {paymentMethod !== 'cod' ? (
                  <p className="leading-relaxed">
                    Send <strong className="tabular-nums">{formatKes(totalKes)}</strong> via M-Pesa to{' '}
                    <strong className="text-navy-900 tabular-nums">{settings.mpesaPaybillNumber}</strong> ({settings.bankAccountName}), then enter your M-Pesa transaction code below (or submit it later from your Account).
                  </p>
                ) : (
                  <p className="leading-relaxed">
                    Total payable upon offloading verification: <strong className="tabular-nums">{formatKes(totalKes)}</strong>. Official dispatch line: <strong className="tabular-nums">{settings.whatsappNumber}</strong>.
                  </p>
                )}

                {paymentMethod !== 'cod' && (
                  <div className="pt-1">
                    <label className="block font-semibold text-slate-700 mb-1">
                      M-Pesa Transaction Code (Optional now — can also be added later)
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      placeholder="e.g. SJK84L92PQ"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg uppercase"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Offloading / Cutting Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Call site foreman 30 mins before arrival..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
            </section>
          </div>

          {/* Right Order Summary */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-5">
            <h2 className="text-base font-bold text-navy-900">Order Summary ({cart.length} Lines)</h2>

            <div className="divide-y divide-slate-200 max-h-72 overflow-y-auto pr-1">
              {cart.map(({ product, quantity }) => {
                const unitPrice = getEffectiveUnitPrice(product, quantity);
                return (
                  <div key={product.id} className="py-2.5 flex justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{product.name}</p>
                      <p className="text-slate-500 tabular-nums">
                        {quantity} {product.unit} × {formatKes(unitPrice)}
                      </p>
                    </div>
                    <span className="font-semibold text-slate-900 tabular-nums shrink-0">
                      {formatKes(unitPrice * quantity)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Materials Subtotal</span>
                <span className="tabular-nums">{formatKes(cartSubtotalKes)}</span>
              </div>
              {cartDiscountKes > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Promotional Discount ({appliedPromo?.code})</span>
                  <span className="tabular-nums">-{formatKes(cartDiscountKes)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Delivery &amp; Logistics</span>
                <span className="tabular-nums">
                  {deliveryFeeKes === 0 ? 'FREE' : formatKes(deliveryFeeKes)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-navy-900 pt-2 border-t border-slate-200">
                <span>Total Payable</span>
                <span className="tabular-nums">{formatKes(totalKes)}</span>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                Rewards: Earn <strong className="text-navy-900 tabular-nums">+{estimatedLoyaltyPoints} Loyalty Points</strong> upon payment verification.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-5 text-sm font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 disabled:opacity-50 transition-colors tabular-nums"
            >
              {submitting ? 'Placing Order...' : `Place Order — ${formatKes(totalKes)}`}
            </button>

            <div className="flex items-start gap-2 text-[11px] text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>
                Verified Dispatch Protection: Orders start in <em>Pending Verification</em> until confirmed by DELARICO Finance ({settings.whatsappNumber}).
              </span>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
