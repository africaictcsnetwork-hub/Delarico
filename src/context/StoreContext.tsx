import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AccountType,
  AuthSessionUser,
  Branch,
  CartItem,
  Category,
  DeliveryAddress,
  Product,
  ProductReview,
  Promotion,
  QuoteDraftItem,
  StoreSettings,
  UserPrivateContact,
  UserPublicProfile,
} from '../types';
import {
  DEFAULT_STORE_SETTINGS,
  INITIAL_BRANCHES,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_PROMOTIONS,
  INITIAL_REVIEWS,
} from '../data/seedCatalog';

export interface ToastNotice {
  id: string;
  message: string;
  tone: 'success' | 'info' | 'error';
}

export interface RegisterPhoneParams {
  displayName: string;
  phone: string;
  password: string;
  email?: string;
  accountType?: AccountType;
  companyName?: string;
  registrationRef?: string;
}

interface StoreContextValue {
  user: AuthSessionUser | null;
  authToken: string | null;
  authReady: boolean;
  isAdmin: boolean;
  userProfile: UserPublicProfile | null;
  userContact: UserPrivateContact | null;
  addresses: DeliveryAddress[];
  setAddresses: React.Dispatch<React.SetStateAction<DeliveryAddress[]>>;
  categories: Category[];
  products: Product[];
  promotions: Promotion[];
  branches: Branch[];
  reviews: ProductReview[];
  settings: StoreSettings;
  isCatalogSeeded: boolean;
  cart: CartItem[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (product: Product, quantity?: number) => void;
  updateCartQty: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  getEffectiveUnitPrice: (product: Product, quantity: number) => number;
  cartSubtotalKes: number;
  cartDiscountKes: number;
  appliedPromo: Promotion | null;
  applyPromoCode: (code: string) => boolean;
  removePromoCode: () => void;
  compareIds: string[];
  toggleCompare: (productId: string) => void;
  clearCompare: () => void;
  favouriteIds: string[];
  toggleFavourite: (productId: string) => Promise<void>;
  clearSavedItems: () => Promise<void>;
  isWishlistOpen: boolean;
  setIsWishlistOpen: (open: boolean) => void;
  quoteDraft: QuoteDraftItem[];
  addToQuoteDraft: (product: Product, quantity?: number) => void;
  updateQuoteDraftQty: (productId: string, quantity: number) => void;
  removeFromQuoteDraft: (productId: string) => void;
  clearQuoteDraft: () => void;
  loginWithPhone: (phone: string, password: string) => Promise<AuthSessionUser | null>;
  registerWithPhone: (params: RegisterPhoneParams) => Promise<AuthSessionUser | null>;
  refreshAccountSession: () => Promise<void>;
  apiFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
  logout: () => Promise<void>;
  affiliateRef: string;
  captureAffiliateRef: (code: string) => void;
  toasts: ToastNotice[];
  notify: (message: string, tone?: 'success' | 'info' | 'error') => void;
  dismissToast: (id: string) => void;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

const AUTH_TOKEN_KEY = 'delarico_session_token_v2';
const CART_STORAGE_KEY = 'delarico_cart_v1';
const QUOTE_STORAGE_KEY = 'delarico_quote_v1';
const COMPARE_STORAGE_KEY = 'delarico_compare_v1';
const WISHLIST_STORAGE_KEY = 'delarico_wishlist_v1';
const LEGACY_GUEST_FAV_KEY = 'delarico_guest_fav_v1';
const AFFILIATE_REF_KEY = 'delarico_affiliate_ref_v1';

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserPublicProfile | null>(null);
  const [userContact, setUserContact] = useState<UserPrivateContact | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);

  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [dbPromotions, setDbPromotions] = useState<Promotion[]>([]);
  const [dbBranches, setDbBranches] = useState<Branch[]>([]);
  const [dbReviews, setDbReviews] = useState<ProductReview[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [isCatalogSeeded, setIsCatalogSeeded] = useState(false);

  const [cartSnapshotIds, setCartSnapshotIds] = useState<Array<{ productId: string; quantity: number }>>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string>('');

  const [compareIds, setCompareIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(COMPARE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [isWishlistOpen, setIsWishlistOpen] = useState(false);

  const [savedLocalIds, setSavedLocalIds] = useState<string[]>(() => {
    try {
      const primary = localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (primary) return JSON.parse(primary);
      const legacy = localStorage.getItem(LEGACY_GUEST_FAV_KEY);
      return legacy ? JSON.parse(legacy) : [];
    } catch {
      return [];
    }
  });

  const [quoteSnapshotIds, setQuoteSnapshotIds] = useState<Array<{ productId: string; quantity: number }>>(() => {
    try {
      const raw = localStorage.getItem(QUOTE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [affiliateRef, setAffiliateRef] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = (params.get('ref') || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      if (fromUrl.length >= 4) {
        localStorage.setItem(AFFILIATE_REF_KEY, fromUrl);
        return fromUrl;
      }
      return localStorage.getItem(AFFILIATE_REF_KEY) || '';
    } catch {
      return '';
    }
  });

  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  const notify = useCallback((message: string, tone: 'success' | 'info' | 'error' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const apiFetch = useCallback(
    async <T = unknown>(path: string, init: RequestInit = {}): Promise<T> => {
      const headers = new Headers(init.headers || {});
      if (!headers.has('Content-Type') && init.body) {
        headers.set('Content-Type', 'application/json');
      }
      const activeToken =
        authToken ||
        (() => {
          try {
            return localStorage.getItem(AUTH_TOKEN_KEY);
          } catch {
            return null;
          }
        })();
      if (activeToken) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }
      const res = await fetch(path, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string })?.error || `Request failed (${res.status})`);
      }
      return data as T;
    },
    [authToken]
  );

  const applyBundle = (bundle: {
    user: AuthSessionUser;
    profile: UserPublicProfile;
    contact: UserPrivateContact;
    addresses: DeliveryAddress[];
  }) => {
    setUser(bundle.user);
    setUserProfile(bundle.profile);
    setUserContact(bundle.contact);
    setAddresses(bundle.addresses || []);
  };

  const refreshAccountSession = useCallback(async () => {
    if (!authToken) {
      setUser(null);
      setUserProfile(null);
      setUserContact(null);
      setAddresses([]);
      setAuthReady(true);
      return;
    }
    try {
      const bundle = await apiFetch<{
        user: AuthSessionUser;
        profile: UserPublicProfile;
        contact: UserPrivateContact;
        addresses: DeliveryAddress[];
      }>('/api/auth/me');
      applyBundle(bundle);
    } catch {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setAuthToken(null);
      setUser(null);
      setUserProfile(null);
      setUserContact(null);
      setAddresses([]);
    } finally {
      setAuthReady(true);
    }
  }, [authToken, apiFetch]);

  useEffect(() => {
    void refreshAccountSession();
  }, [refreshAccountSession]);

  // Subscribe to public storefront catalog collections in live Firestore
  useEffect(() => {
    const catQuery = query(collection(db, 'categories'), where('isActive', '==', true));
    const prodQuery = query(collection(db, 'products'), where('isActive', '==', true));
    const promoQuery = query(collection(db, 'promotions'), where('isActive', '==', true));
    const branchQuery = query(collection(db, 'branches'), where('isActive', '==', true));
    const revQuery = query(collection(db, 'reviews'), where('status', '==', 'published'));
    const settingsQuery = query(collection(db, 'settings'), where('isPublic', '==', true));

    const unsubCat = onSnapshot(
      catQuery,
      (snap) => {
        const items = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }))
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setDbCategories(items);
        setIsCatalogSeeded(!snap.empty);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'categories')
    );

    const unsubProd = onSnapshot(
      prodQuery,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }));
        setDbProducts(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const unsubPromo = onSnapshot(
      promoQuery,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Promotion, 'id'>) }));
        setDbPromotions(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'promotions')
    );

    const unsubBranch = onSnapshot(
      branchQuery,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, 'id'>) }));
        setDbBranches(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'branches')
    );

    const unsubRev = onSnapshot(
      revQuery,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ProductReview, 'id'>) }));
        setDbReviews(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reviews')
    );

    const unsubSettings = onSnapshot(
      settingsQuery,
      (snap) => {
        const corpDoc = snap.docs.find((d) => d.id === 'corporate') || snap.docs[0];
        if (corpDoc) {
          setSettings(corpDoc.data() as StoreSettings);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'settings')
    );

    return () => {
      unsubCat();
      unsubProd();
      unsubPromo();
      unsubBranch();
      unsubRev();
      unsubSettings();
    };
  }, []);

  const categories = useMemo(
    () => (dbCategories.length > 0 ? dbCategories : INITIAL_CATEGORIES),
    [dbCategories]
  );
  const products = useMemo(
    () => (dbProducts.length > 0 ? dbProducts : INITIAL_PRODUCTS),
    [dbProducts]
  );
  const promotions = useMemo(
    () => (dbPromotions.length > 0 ? dbPromotions : INITIAL_PROMOTIONS),
    [dbPromotions]
  );
  const branches = useMemo(
    () => (dbBranches.length > 0 ? dbBranches : INITIAL_BRANCHES),
    [dbBranches]
  );

  const reviews: ProductReview[] = useMemo(() => {
    if (dbReviews.length > 0) return dbReviews;
    return INITIAL_REVIEWS.map((r) => ({
      ...r,
      verifiedBuyer: false,
      status: 'published' as const,
    }));
  }, [dbReviews]);

  // Persist local storage states
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartSnapshotIds));
  }, [cartSnapshotIds]);

  useEffect(() => {
    localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(quoteSnapshotIds));
  }, [quoteSnapshotIds]);

  useEffect(() => {
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(compareIds));
  }, [compareIds]);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(savedLocalIds));
      localStorage.setItem(LEGACY_GUEST_FAV_KEY, JSON.stringify(savedLocalIds));
    } catch {
      // ignore storage quota errors
    }
  }, [savedLocalIds]);

  const captureAffiliateRef = useCallback((rawCode: string) => {
    const clean = rawCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (clean.length < 4 && clean.length !== 0) return;
    setAffiliateRef(clean);
    try {
      if (clean) {
        localStorage.setItem(AFFILIATE_REF_KEY, clean);
      } else {
        localStorage.removeItem(AFFILIATE_REF_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (!affiliateRef || affiliateRef.length < 4) return;
    const sessionKey = `delarico_tracked_click_${affiliateRef}`;
    try {
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, '1');
    } catch {
      // ignore
    }
    void fetch('/api/affiliates/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: affiliateRef }),
    }).catch(() => {});
  }, [affiliateRef]);

  const cart: CartItem[] = useMemo(() => {
    return cartSnapshotIds
      .map((entry) => {
        const product = products.find((p) => p.id === entry.productId && p.isActive);
        return product ? { product, quantity: entry.quantity } : null;
      })
      .filter((item): item is CartItem => item !== null);
  }, [cartSnapshotIds, products]);

  const quoteDraft: QuoteDraftItem[] = useMemo(() => {
    return quoteSnapshotIds
      .map((entry) => {
        const product = products.find((p) => p.id === entry.productId);
        return product ? { product, quantity: entry.quantity } : null;
      })
      .filter((item): item is QuoteDraftItem => item !== null);
  }, [quoteSnapshotIds, products]);

  const getEffectiveUnitPrice = (product: Product, quantity: number): number => {
    const wholesaleEligible =
      Boolean(userProfile?.wholesaleApproved) || quantity >= product.minWholesaleQty;
    return wholesaleEligible ? product.wholesalePriceKes : product.priceKes;
  };

  const cartSubtotalKes = useMemo(() => {
    return cart.reduce((sum, item) => {
      const unitPrice = getEffectiveUnitPrice(item.product, item.quantity);
      return sum + unitPrice * item.quantity;
    }, 0);
  }, [cart, userProfile]);

  const appliedPromo = useMemo(() => {
    if (!appliedPromoCode) return null;
    const match = promotions.find(
      (p) => p.isActive && p.code.toUpperCase() === appliedPromoCode.toUpperCase()
    );
    if (!match || cartSubtotalKes < match.minOrderKes) return null;
    return match;
  }, [appliedPromoCode, promotions, cartSubtotalKes]);

  const cartDiscountKes = useMemo(() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.discountType === 'percentage') {
      return Math.round((cartSubtotalKes * appliedPromo.discountValue) / 100);
    }
    return Math.min(cartSubtotalKes, appliedPromo.discountValue);
  }, [appliedPromo, cartSubtotalKes]);

  const addToCart = (product: Product, quantity = 1) => {
    if (product.stockQty <= 0) {
      notify(`${product.name} is currently out of stock. Request a quotation for restock lead time.`, 'error');
      return;
    }
    setCartSnapshotIds((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        const nextQty = Math.min(product.stockQty, existing.quantity + quantity);
        return prev.map((i) => (i.productId === product.id ? { ...i, quantity: nextQty } : i));
      }
      return [...prev, { productId: product.id, quantity: Math.min(product.stockQty, Math.max(1, quantity)) }];
    });
    notify(`Added ${product.name} to cart`, 'success');
  };

  const updateCartQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    const prod = products.find((p) => p.id === productId);
    const maxQty = prod ? prod.stockQty : quantity;
    setCartSnapshotIds((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity: Math.min(maxQty, quantity) } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCartSnapshotIds((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => {
    setCartSnapshotIds([]);
    setAppliedPromoCode('');
  };

  const applyPromoCode = (code: string): boolean => {
    const clean = code.trim().toUpperCase();
    const match = promotions.find((p) => p.isActive && p.code.toUpperCase() === clean);
    if (!match) {
      notify('Invalid or inactive promotional code.', 'error');
      return false;
    }
    if (cartSubtotalKes < match.minOrderKes) {
      notify(`Minimum order of KES ${match.minOrderKes.toLocaleString()} required for ${match.code}.`, 'error');
      return false;
    }
    setAppliedPromoCode(clean);
    notify(`Promotional code ${match.code} applied.`, 'success');
    return true;
  };

  const removePromoCode = () => {
    setAppliedPromoCode('');
  };

  const toggleCompare = (productId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }
      if (prev.length >= 4) {
        notify('You can compare up to 4 products side by side.', 'info');
        return prev;
      }
      notify('Added product to specification comparison.', 'info');
      return [...prev, productId];
    });
  };

  const clearCompare = () => setCompareIds([]);

  const favouriteIds = useMemo(() => {
    if (!userProfile) return savedLocalIds;
    const merged = Array.from(new Set([...savedLocalIds, ...(userProfile.favouriteProductIds || [])]));
    return merged.slice(0, 50);
  }, [userProfile, savedLocalIds]);

  const toggleFavourite = async (productId: string) => {
    const existsInFav = favouriteIds.includes(productId);
    const nextIds = existsInFav
      ? favouriteIds.filter((id) => id !== productId)
      : [...favouriteIds, productId].slice(0, 50);

    // Always persist in localStorage for instant access across sessions
    setSavedLocalIds(nextIds);

    if (!user || !userProfile) {
      notify(existsInFav ? 'Removed from Saved Items.' : 'Saved to your Wishlist!', 'info');
      return;
    }

    setUserProfile((prev) => (prev ? { ...prev, favouriteProductIds: nextIds } : prev));
    try {
      await apiFetch('/api/customer/favourites', {
        method: 'PUT',
        body: JSON.stringify({ favouriteProductIds: nextIds }),
      });
      notify(existsInFav ? 'Removed from Saved Items.' : 'Saved to your Wishlist!', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Saved locally; account sync pending.', 'info');
    }
  };

  const clearSavedItems = async () => {
    setSavedLocalIds([]);
    if (user && userProfile) {
      setUserProfile((prev) => (prev ? { ...prev, favouriteProductIds: [] } : prev));
      try {
        await apiFetch('/api/customer/favourites', {
          method: 'PUT',
          body: JSON.stringify({ favouriteProductIds: [] }),
        });
      } catch {
        // local list cleared already
      }
    }
    notify('Saved items list cleared.', 'info');
  };

  const addToQuoteDraft = (product: Product, quantity = 10) => {
    setQuoteSnapshotIds((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { productId: product.id, quantity: Math.max(1, quantity) }];
    });
    notify(`Added ${product.name} to quotation schedule.`, 'success');
  };

  const updateQuoteDraftQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromQuoteDraft(productId);
      return;
    }
    setQuoteSnapshotIds((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
  };

  const removeFromQuoteDraft = (productId: string) => {
    setQuoteSnapshotIds((prev) => prev.filter((i) => i.productId !== productId));
  };

  const clearQuoteDraft = () => setQuoteSnapshotIds([]);

  const loginWithPhone = async (phone: string, password: string): Promise<AuthSessionUser | null> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify((data as { error?: string })?.error || 'Invalid phone number or password.', 'error');
        return null;
      }
      const typed = data as {
        token: string;
        user: AuthSessionUser;
        profile: UserPublicProfile;
        contact: UserPrivateContact;
        addresses: DeliveryAddress[];
      };
      localStorage.setItem(AUTH_TOKEN_KEY, typed.token);
      setAuthToken(typed.token);
      applyBundle(typed);
      setAuthReady(true);
      notify(`Welcome back, ${typed.user.displayName}!`, 'success');
      return typed.user;
    } catch {
      notify('Unable to sign in right now. Please check your connection.', 'error');
      return null;
    }
  };

  const registerWithPhone = async (params: RegisterPhoneParams): Promise<AuthSessionUser | null> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify((data as { error?: string })?.error || 'Could not create account.', 'error');
        return null;
      }
      const typed = data as {
        token: string;
        user: AuthSessionUser;
        profile: UserPublicProfile;
        contact: UserPrivateContact;
        addresses: DeliveryAddress[];
      };
      localStorage.setItem(AUTH_TOKEN_KEY, typed.token);
      setAuthToken(typed.token);
      applyBundle(typed);
      setAuthReady(true);
      notify(`Account created! Welcome, ${typed.user.displayName}.`, 'success');
      return typed.user;
    } catch {
      notify('Unable to create account right now. Please try again.', 'error');
      return null;
    }
  };

  const logout = async () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
    setUserProfile(null);
    setUserContact(null);
    setAddresses([]);
    notify('Signed out.', 'info');
  };

  const isAdmin = Boolean(user?.isAdmin);

  return (
    <StoreContext.Provider
      value={{
        user,
        authToken,
        authReady,
        isAdmin,
        userProfile,
        userContact,
        addresses,
        setAddresses,
        categories,
        products,
        promotions,
        branches,
        reviews,
        settings,
        isCatalogSeeded,
        cart,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        getEffectiveUnitPrice,
        cartSubtotalKes,
        cartDiscountKes,
        appliedPromo,
        applyPromoCode,
        removePromoCode,
        compareIds,
        toggleCompare,
        clearCompare,
        favouriteIds,
        toggleFavourite,
        clearSavedItems,
        isWishlistOpen,
        setIsWishlistOpen,
        quoteDraft,
        addToQuoteDraft,
        updateQuoteDraftQty,
        removeFromQuoteDraft,
        clearQuoteDraft,
        loginWithPhone,
        registerWithPhone,
        refreshAccountSession,
        apiFetch,
        logout,
        affiliateRef,
        captureAffiliateRef,
        toasts,
        notify,
        dismissToast,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used inside StoreProvider');
  }
  return ctx;
}
