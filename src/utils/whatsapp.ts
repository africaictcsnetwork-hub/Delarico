import type { CartItem, Order, Product, QuoteDraftItem } from '../types.ts';

export const DEFAULT_WHATSAPP_NUMBER = '+254 706 824489';

export function normalizeKenyanPhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('00254') && digits.length === 14) {
    return `+${digits.slice(2)}`;
  }
  if (digits.startsWith('2540') && digits.length === 13) {
    return `+254${digits.slice(4)}`;
  }
  if (digits.startsWith('254') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+254${digits.slice(1)}`;
  }
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    return `+254${digits}`;
  }
  return `+${digits}`;
}

function sanitizePhoneForWa(phone: string): string {
  const normalized = normalizeKenyanPhone(phone || DEFAULT_WHATSAPP_NUMBER);
  const digits = normalized.replace(/[^0-9]/g, '');
  return digits || '254706824489';
}

export function buildWhatsAppUrl(message: string, rawNumber: string = DEFAULT_WHATSAPP_NUMBER): string {
  const cleanNumber = sanitizePhoneForWa(rawNumber);
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}

export function formatKes(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString('en-KE')}`;
}

export function buildProductEnquiryMessage(product: Product, quantity: number, effectiveUnitPrice: number): string {
  const total = effectiveUnitPrice * quantity;
  return [
    'Hello DELARICO MERCHANDISE & SUPPLIES,',
    '',
    'I would like to enquire about ordering the following item:',
    `- Product: ${product.name}`,
    `- SKU: ${product.sku}`,
    `- Category: ${product.categoryName}`,
    `- Quantity: ${quantity} ${product.unit}(s)`,
    `- Unit Price: ${formatKes(effectiveUnitPrice)}`,
    `- Estimated Total: ${formatKes(total)}`,
    '',
    'Please confirm current stock availability and delivery options from Siaya.',
  ].join('\n');
}

export function buildCartEnquiryMessage(items: CartItem[], subtotalKes: number, locationNote?: string): string {
  const lines = items.map(
    (item, index) =>
      `${index + 1}. ${item.product.name} (${item.product.sku}) — ${item.quantity} ${item.product.unit} @ ${formatKes(item.product.priceKes)}`
  );
  return [
    'Hello DELARICO MERCHANDISE & SUPPLIES,',
    '',
    'I would like assistance placing this order:',
    ...lines,
    '',
    `Estimated Subtotal: ${formatKes(subtotalKes)}`,
    locationNote ? `Delivery Location: ${locationNote}` : 'Delivery Location: Please advise delivery cost',
    '',
    'Kindly share payment confirmation and dispatch schedule.',
  ].join('\n');
}

export function buildOrderFollowUpMessage(order: Order): string {
  return [
    'Hello DELARICO MERCHANDISE & SUPPLIES,',
    '',
    `I have placed Order #${order.orderNumber} on your website.`,
    `- Customer: ${order.customerName}`,
    `- Total Amount: ${formatKes(order.totalKes)}`,
    `- Payment Method: ${order.paymentMethod.replace(/_/g, ' ').toUpperCase()}`,
    order.paymentReference ? `- Payment Reference: ${order.paymentReference}` : '- Payment Status: Ready for payment verification',
    `- Delivery Destination: ${order.deliveryTown}, ${order.deliveryCounty}`,
    '',
    'Kindly verify and confirm dispatch.',
  ].join('\n');
}

export function buildQuotationWhatsAppMessage(params: {
  quoteNumber?: string;
  contactName: string;
  companyName?: string;
  phone: string;
  deliveryLocation: string;
  projectType: string;
  instructions?: string;
  items: QuoteDraftItem[];
}): string {
  const itemLines = params.items.map(
    (item, idx) => `${idx + 1}. ${item.product.name} — Qty: ${item.quantity} ${item.product.unit}`
  );
  return [
    'Hello DELARICO MERCHANDISE & SUPPLIES,',
    '',
    params.quoteNumber
      ? `Formal Quotation Request (${params.quoteNumber}):`
      : 'I would like to request a Bulk / Project Quotation:',
    `- Contact: ${params.contactName}${params.companyName ? ` (${params.companyName})` : ''}`,
    `- Phone: ${params.phone}`,
    `- Project Type: ${params.projectType}`,
    `- Delivery Site: ${params.deliveryLocation}`,
    '',
    'Requested Materials:',
    ...itemLines,
    params.instructions ? `\nAdditional Instructions: ${params.instructions}` : '',
    '',
    'Please share your best wholesale/project pricing and lead time.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function getProductCommissionRatePct(categoryId: string, baseRatePct: number = 3): number {
  let categoryRate = 3;
  if (categoryId === 'cat-hardware-tools' || categoryId === 'cat-general-merchandise') {
    categoryRate = 5;
  } else if (
    categoryId === 'cat-timber-wood' ||
    categoryId === 'cat-doors-windows' ||
    categoryId === 'cat-construction-supplies'
  ) {
    categoryRate = 4;
  } else {
    categoryRate = 3;
  }
  return Math.min(5, Math.max(3, Math.max(categoryRate, baseRatePct)));
}

export function buildAffiliateShareMessage(product: Product, referralUrl: string): string {
  return [
    `🔥 *${product.name}* — Genuine Stock at DELARICO MERCHANDISE & SUPPLIES!`,
    `💰 Retail Price: *${formatKes(product.priceKes)}* per ${product.unit}`,
    `📦 Wholesale Rate: *${formatKes(product.wholesalePriceKes)}* (${product.minWholesaleQty}+ ${product.unit}s)`,
    `🚚 Fast Lorry Delivery Across Siaya, Bondo, Ugunja & Western Kenya.`,
    '',
    `Order directly using my link below:`,
    referralUrl,
  ].join('\n');
}
