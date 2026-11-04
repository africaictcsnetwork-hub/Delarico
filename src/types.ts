import type { Timestamp } from 'firebase/firestore';

export type AccountType = 'individual' | 'contractor' | 'institution';
export type DeliveryMethod = 'pickup' | 'local_siaya' | 'regional_nyanza' | 'countrywide_freight';
export type PaymentMethod = 'mpesa_stk' | 'mpesa_paybill' | 'mpesa_till' | 'bank_transfer' | 'cod';
export type PaymentStatus = 'pending_verification' | 'verified_paid' | 'failed' | 'refunded';
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'dispatched' | 'delivered' | 'cancelled';
export type QuotationStatus = 'submitted' | 'quoted' | 'accepted' | 'declined';
export type EnquiryType = 'general' | 'bulk_sourcing' | 'supplier_partnership' | 'contractor_onboarding';

export interface AuthSessionUser {
  uid: string;
  displayName: string;
  phone: string;
  email: string;
  isAdmin: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  categoryName: string;
  description: string;
  specSummary: string;
  dimensions: string;
  brand: string;
  unit: string;
  priceKes: number;
  wholesalePriceKes: number;
  minWholesaleQty: number;
  compareAtPriceKes: number;
  stockQty: number;
  lowStockThreshold: number;
  weightKg: number;
  images: string[];
  featured: boolean;
  bestSeller: boolean;
  onPromotion: boolean;
  promoLabel: string;
  isActive: boolean;
  ratingAvg: number;
  reviewCount: number;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface UserPublicProfile {
  uid: string;
  displayName: string;
  accountType: AccountType;
  companyName: string;
  registrationRef: string;
  loyaltyPoints: number;
  wholesaleApproved: boolean;
  favouriteProductIds: string[];
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface UserPrivateContact {
  uid: string;
  email: string;
  phone: string;
  defaultCounty: string;
  defaultTown: string;
  defaultStreetAddress: string;
  updatedAt?: Timestamp | string;
}

export interface DeliveryAddress {
  id: string;
  uid: string;
  label: string;
  recipientName: string;
  phone: string;
  county: string;
  town: string;
  streetDetails: string;
  isDefault: boolean;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  accountType: AccountType;
  branchId: string;
  deliveryCounty: string;
  deliveryTown: string;
  deliveryAddress: string;
  deliveryMethod: DeliveryMethod;
  subtotalKes: number;
  discountKes: number;
  promoCode: string;
  deliveryFeeKes: number;
  totalKes: number;
  itemCount: number;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  notes: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  customerId: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPriceKes: number;
  lineTotalKes: number;
  createdAt?: Timestamp | string;
}

export interface QuotationRequest {
  id: string;
  quoteNumber: string;
  customerId: string;
  contactName: string;
  companyName: string;
  phone: string;
  email: string;
  deliveryLocation: string;
  projectType: string;
  instructions: string;
  itemCount: number;
  estimatedSubtotalKes: number;
  quotedTotalKes: number;
  adminResponseNotes: string;
  validUntil: string;
  status: QuotationStatus;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface QuotationItem {
  id: string;
  quotationId: string;
  customerId: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPriceKes: number;
  createdAt?: Timestamp | string;
}

export interface ProductReview {
  id: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  rating: number;
  title: string;
  comment: string;
  verifiedBuyer: boolean;
  status: 'published' | 'hidden';
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface CustomerEnquiry {
  id: string;
  customerId: string;
  enquiryType: EnquiryType;
  name: string;
  companyName: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  status: 'open' | 'in_review' | 'resolved';
  adminReply: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface Promotion {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'fixed_kes';
  discountValue: number;
  minOrderKes: number;
  isActive: boolean;
  expiresAt: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  movementType: 'restock' | 'sale' | 'adjustment' | 'return';
  quantityDelta: number;
  previousStock: number;
  newStock: number;
  reason: string;
  performedByUid: string;
  createdAt?: Timestamp | string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  county: string;
  town: string;
  address: string;
  phone: string;
  managerName: string;
  deliveryZones: string;
  isHeadquarters: boolean;
  isActive: boolean;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface StoreSettings {
  businessName: string;
  tagline: string;
  location: string;
  whatsappNumber: string;
  email: string;
  website: string;
  mpesaPaybillNumber: string;
  mpesaAccountPrefix: string;
  mpesaTillNumber: string;
  mpesaStkEnabled: boolean;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranch: string;
  codEnabled: boolean;
  freeDeliveryThresholdKes: number;
  loyaltyPointsPer1000Kes: number;
  isPublic: boolean;
  updatedAt?: Timestamp | string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface QuoteDraftItem {
  product: Product;
  quantity: number;
}
