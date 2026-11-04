import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, FileText, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { buildQuotationWhatsAppMessage, buildWhatsAppUrl, formatKes } from '../utils/whatsapp';

export const QuotationPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    userProfile,
    userContact,
    products,
    settings,
    quoteDraft,
    addToQuoteDraft,
    updateQuoteDraftQty,
    removeFromQuoteDraft,
    clearQuoteDraft,
    apiFetch,
    notify,
  } = useStore();

  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [addQty, setAddQty] = useState(25);

  const [contactName, setContactName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [projectType, setProjectType] = useState('Residential Construction');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedQuoteNumber, setSubmittedQuoteNumber] = useState<string | null>(null);

  useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  useEffect(() => {
    if (userProfile?.displayName && !contactName) setContactName(userProfile.displayName);
    if (userProfile?.companyName && !companyName) setCompanyName(userProfile.companyName);
    if (user?.email && !email) setEmail(user.email);
    if (userContact?.phone && !phone) setPhone(userContact.phone);
    if (userContact?.defaultTown && !deliveryLocation) {
      setDeliveryLocation(`${userContact.defaultTown}, ${userContact.defaultCounty}`);
    }
  }, [user, userProfile, userContact]);

  const estimatedWholesaleSubtotal = quoteDraft.reduce(
    (sum, item) => sum + item.product.wholesalePriceKes * item.quantity,
    0
  );

  const handleAddSelectedProduct = () => {
    const found = products.find((p) => p.id === selectedProductId);
    if (found) {
      addToQuoteDraft(found, Math.max(1, addQty));
    }
  };

  const waQuoteUrl = buildWhatsAppUrl(
    buildQuotationWhatsAppMessage({
      quoteNumber: submittedQuoteNumber || undefined,
      contactName: contactName || 'Prospective Client',
      companyName,
      phone: phone || 'Not provided',
      deliveryLocation: deliveryLocation || 'Siaya / To be advised',
      projectType,
      instructions,
      items: quoteDraft,
    }),
    settings.whatsappNumber
  );

  const handleSubmitQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quoteDraft.length === 0) {
      notify('Please add at least one building material to your quotation schedule.', 'error');
      return;
    }
    if (!user) {
      navigate('/account?redirect=%2Frequest-quote');
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload = quoteDraft.map(({ product, quantity }) => ({
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        quantity,
        unitPriceKes: product.wholesalePriceKes,
      }));

      const res = await apiFetch<{ quoteNumber: string; id: string }>('/api/customer/quotations', {
        method: 'POST',
        body: JSON.stringify({
          contactName: contactName.trim() || user.displayName || 'Client',
          companyName: companyName.trim(),
          phone: phone.trim(),
          email: email.trim() || user.email || 'client@delarico.co.ke',
          deliveryLocation: deliveryLocation.trim(),
          projectType: projectType.trim(),
          instructions: instructions.trim(),
          estimatedSubtotalKes: estimatedWholesaleSubtotal,
          items: itemsPayload,
        }),
      });

      setSubmittedQuoteNumber(res.quoteNumber);
      notify(`Quotation Request #${res.quoteNumber} submitted to DELARICO Estimating Desk!`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to submit quotation.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 font-sans">
      <div className="pb-6 border-b border-slate-200">
        <p className="text-xs font-semibold text-royal-700 mb-1">Bulk &amp; Project Estimating Desk</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-navy-900">Request an Official Quotation (BOQ)</h1>
        <p className="text-sm text-slate-600 mt-1">
          Select multiple building materials, enter required project quantities, and receive tailored
          wholesale pricing and delivery scheduling from our Siaya headquarters ({settings.whatsappNumber}).
        </p>
      </div>

      {submittedQuoteNumber && (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold text-emerald-950">
                Quotation #{submittedQuoteNumber} Received!
              </h2>
              <p className="text-xs text-emerald-800 mt-0.5">
                Track our official priced response inside your Customer Account, or fast-track on WhatsApp now.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={waQuoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Send to WhatsApp ({settings.whatsappNumber})</span>
            </a>
            <button
              type="button"
              onClick={() => {
                clearQuoteDraft();
                setSubmittedQuoteNumber(null);
              }}
              className="px-3.5 py-2.5 text-xs font-semibold text-emerald-950 bg-white border border-emerald-300 rounded-lg"
            >
              New Quote
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Product Schedule Builder */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <h2 className="text-base font-bold text-navy-900">1. Add Materials to Quotation Schedule</h2>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-7">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                >
                  {products.filter((p) => p.isActive).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatKes(p.wholesalePriceKes)}/{p.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  value={addQty}
                  onChange={(e) => setAddQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-xs tabular-nums bg-white border border-slate-200 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={handleAddSelectedProduct}
                  className="w-full inline-flex items-center justify-center gap-1 py-2 px-3 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>

          {/* Schedule Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="px-5 py-3.5 bg-navy-900 text-white flex items-center justify-between">
              <span className="text-xs font-semibold">Selected Bill of Materials ({quoteDraft.length})</span>
              <span className="text-xs text-gold-400 font-semibold tabular-nums">
                Guide Wholesale Value: {formatKes(estimatedWholesaleSubtotal)}
              </span>
            </div>

            {quoteDraft.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                No materials added yet. Use the selector above to build your multi-item quotation list.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-4 font-semibold">Material</th>
                    <th className="py-2.5 px-3 font-semibold">Qty</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Guide Wholesale</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quoteDraft.map(({ product, quantity }) => (
                    <tr key={product.id}>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{product.name}</p>
                        <p className="text-slate-500">{product.sku} · {product.unit}</p>
                      </td>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          min={1}
                          value={quantity}
                          onChange={(e) => updateQuoteDraftQty(product.id, Number(e.target.value) || 1)}
                          className="w-20 px-2 py-1 tabular-nums border border-slate-200 rounded"
                        />
                      </td>
                      <td className="py-3 px-3 text-right font-medium tabular-nums">
                        {formatKes(product.wholesalePriceKes * quantity)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => removeFromQuoteDraft(product.id)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Project & Contact Submission Form */}
        <form
          onSubmit={handleSubmitQuotation}
          className="lg:col-span-5 p-6 bg-white border border-slate-200 rounded-xl space-y-4"
        >
          <h2 className="text-base font-bold text-navy-900">2. Project &amp; Delivery Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name *</label>
              <input
                type="text"
                required
                maxLength={120}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company / Institution (Optional)
              </label>
              <input
                type="text"
                maxLength={160}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Lakeview Builders Ltd"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone / WhatsApp *</label>
              <input
                type="tel"
                required
                maxLength={30}
                placeholder="e.g. 0712 345 678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs tabular-nums border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address (Optional)</label>
              <input
                type="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Project Category</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            >
              <option>Residential Construction</option>
              <option>Commercial / Apartment Development</option>
              <option>School / Hospital / Institutional Tender</option>
              <option>County Civil / Road / Water Infrastructure</option>
              <option>Retail Hardware Resale Stock</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Delivery Site Location *
            </label>
            <input
              type="text"
              required
              maxLength={250}
              placeholder="e.g. Bondo Town, Rarieda Sub-County"
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Additional Specifications / Phased Delivery Schedule
            </label>
            <textarea
              rows={3}
              maxLength={1500}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Specify custom timber lengths, mabati colour choice, or required delivery date..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-xs font-semibold text-navy-950 bg-gold-500 rounded-lg hover:bg-gold-400 disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>
                {user
                  ? submitting
                    ? 'Submitting Official Quote...'
                    : 'Submit Digital Quotation Request'
                  : 'Sign In & Submit Digital Quotation'}
              </span>
            </button>

            <a
              href={waQuoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Send Quotation via WhatsApp ({settings.whatsappNumber})</span>
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};
