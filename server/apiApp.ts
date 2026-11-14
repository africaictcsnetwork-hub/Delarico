import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { getApps, initializeApp } from 'firebase/app';
import {
  collection,
  type CollectionReference,
  doc,
  type DocumentReference,
  getDoc,
  getDocs,
  getFirestore,
  query,
  type QueryConstraint,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DEFAULT_STORE_SETTINGS,
  INITIAL_BRANCHES,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_PROMOTIONS,
  INITIAL_REVIEWS,
} from '../src/data/seedCatalog.ts';
import { createProductGallery } from '../src/utils/productVisuals.ts';
import { getProductCommissionRatePct, normalizeKenyanPhone } from '../src/utils/whatsapp.ts';

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

const FALLBACK_FIREBASE_CONFIG: FirebaseAppletConfig = {
  projectId: 'earnest-campus-xb34d',
  appId: '1:752368274889:web:69386a5589f244aaff2c18',
  apiKey: 'AIzaSyB9sHJs_yT1RJr3gYZW_vkT1PCcL2zC9_M',
  authDomain: 'earnest-campus-xb34d.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-delaricomerchand-4616acfd-dbd6-4276-bfd5-41c8d9f00001',
  storageBucket: 'earnest-campus-xb34d.firebasestorage.app',
  messagingSenderId: '752368274889',
  measurementId: '',
  oAuthClientId: '752368274889-fiboo2foeqv7fjj3bjnvumcl3gg0hldc.apps.googleusercontent.com',
  recaptchaSiteKey: '',
};

function loadFirebaseConfig(): FirebaseAppletConfig {
  const candidates = [path.resolve(process.cwd(), 'firebase-applet-config.json')];
  try {
    if (typeof __dirname === 'string' && __dirname) {
      candidates.push(
        path.resolve(__dirname, 'firebase-applet-config.json'),
        path.resolve(__dirname, '..', 'firebase-applet-config.json')
      );
    }
  } catch {
    // Ignore in pure ESM mode
  }
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      candidates.push(
        path.resolve(currentDir, '..', 'firebase-applet-config.json'),
        path.resolve(currentDir, '..', '..', 'firebase-applet-config.json'),
        path.resolve(currentDir, 'firebase-applet-config.json')
      );
    }
  } catch {
    // Ignore when bundled as CJS without import.meta.url
  }
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf-8')) as Partial<FirebaseAppletConfig>;
        if (parsed.projectId && parsed.firestoreDatabaseId && parsed.apiKey) {
          return { ...FALLBACK_FIREBASE_CONFIG, ...parsed };
        }
      }
    } catch {
      // Try next path candidate
    }
  }
  return FALLBACK_FIREBASE_CONFIG;
}

const firebaseConfig = loadFirebaseConfig();
const existingFirebaseApp = getApps().find((a) => a.name === 'delarico-server');
const firebaseApp = existingFirebaseApp || initializeApp(firebaseConfig, 'delarico-server');
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const AUTH_SALT = 'dlr_stealth_auth_v2_8f3c19a7';
const EXEC_SESSION_DIGESTS = [
  '1469c34215eb0c2c85ff7cd8ec0758d0edac9e608fcb9f48bf4c4a879931f5aa', // DELARICO-ADMIN2019
  'abfa19848f6fc782ad2f25208a881ace144955cf3275fe420b543ef3cd6d02c1', // DAVID@ADMIN2019
  '17661cfc4e04fc6b48a473a06a062a0ce7cf022ebe7adb50f8463c1287a68f01', // ADMIN2019
  '4ad5705c64d099da7d331b065df28f9f49fa936584c434f328ae589d810acf4c', // ADMIN@DAVID2019
];
const TOKEN_HMAC_SECRET =
  process.env.SESSION_SECRET || 'dlr_hmac_tok_v2_7b94e1c26a80f35d91e4b2c7058a6d3f';
const SERVER_WRITE_SEAL = '9f4c2b8e17a65d30c84b1e729a53f6d0418c7b2e5a9163d4f08b2c7e19a45d63';
const SERVER_VAULT_KEY = '3e8a1d74c29b50f6814e2a9c7d53b08f62419c8e3a75d1b4902f6c8a3e71d54b';

interface SessionTokenPayload {
  uid: string;
  phone: string;
  displayName: string;
  email: string;
  role: 'customer' | 'admin';
  exp: number;
}

interface AuthedRequest extends Request {
  session?: SessionTokenPayload;
}

function signSessionToken(payload: Omit<SessionTokenPayload, 'exp'>): string {
  const fullPayload: SessionTokenPayload = {
    ...payload,
    exp: Date.now() + 14 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_HMAC_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(rawToken?: string): SessionTokenPayload | null {
  if (!rawToken || !rawToken.includes('.')) return null;
  const [encoded, sig] = rawToken.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', TOKEN_HMAC_SECRET).update(encoded).digest('base64url');
  if (
    sig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8')) as SessionTokenPayload;
    if (!parsed.uid || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function extractBearer(req: Request): SessionTokenPayload | null {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return verifySessionToken(header.slice(7).trim());
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const session = extractBearer(req);
  if (!session) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }
  req.session = session;
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const session = extractBearer(req);
  if (!session || session.role !== 'admin') {
    res.status(403).json({ error: 'Not authorized.' });
    return;
  }
  req.session = session;
  next();
}

function matchesExecCredentials(normalizedPhone: string, rawPassword: string): boolean {
  const trimmed = rawPassword.trim();
  const asciiDashes = trimmed.replace(/[\u2010-\u2015\u2212]/g, '-');
  const compact = asciiDashes.replace(/\s+/g, '');
  const candidates = Array.from(
    new Set([
      rawPassword,
      trimmed,
      trimmed.toUpperCase(),
      asciiDashes,
      asciiDashes.toUpperCase(),
      compact,
      compact.toUpperCase(),
    ])
  ).filter((pwd) => pwd.length > 0);
  const targetBuffers = EXEC_SESSION_DIGESTS.map((hex) => Buffer.from(hex, 'hex'));

  for (const pwd of candidates) {
    const digestHex = crypto
      .createHash('sha256')
      .update(`${AUTH_SALT}:${normalizedPhone}:${pwd}`)
      .digest('hex');
    const candidateBuf = Buffer.from(digestHex, 'hex');

    for (const targetBuf of targetBuffers) {
      if (candidateBuf.length === targetBuf.length && crypto.timingSafeEqual(candidateBuf, targetBuf)) {
        return true;
      }
    }
  }
  return false;
}

type GatedWriteOp =
  | { type: 'set'; ref: DocumentReference; gateKey: string; data: Record<string, unknown> }
  | { type: 'update'; ref: DocumentReference; gateKey: string; data: Record<string, unknown> }
  | { type: 'delete'; ref: DocumentReference; gateKey: string };

async function commitGatedOps(ops: GatedWriteOp[]): Promise<void> {
  const CHUNK_SIZE = 4;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const slice = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    const now = serverTimestamp();
    for (const op of slice) {
      const ticketRef = doc(db, 'writeTickets', op.gateKey);
      batch.set(ticketRef, {
        seal: SERVER_WRITE_SEAL,
        targetPath: op.ref.path.slice(0, 200),
        authorizedAt: now,
      });
      if (op.type === 'set') {
        batch.set(op.ref, op.data);
      } else if (op.type === 'update') {
        batch.update(op.ref, op.data);
      } else {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}

function sanitizeClientDoc<T extends Record<string, unknown>>(id: string, raw: Record<string, unknown>): T {
  const cleaned: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'vaultKey' || k === 'passwordHash' || k === 'passwordSalt') continue;
    if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
      cleaned[k] = (v as { toDate: () => Date }).toDate().toISOString();
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned as T;
}

async function queryVaultDocs<T extends Record<string, unknown>>(
  colRef: CollectionReference,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(colRef, where('vaultKey', '==', SERVER_VAULT_KEY), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => sanitizeClientDoc<T>(d.id, d.data() as Record<string, unknown>));
}

function makeAccountIdFromPhone(normalizedPhone: string): string {
  return `acct_${normalizedPhone.replace(/[^0-9]/g, '')}`;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(windowMs: number, maxRequests: number, label: string) {
  const buckets = new Map<string, RateLimitBucket>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || req.ip || 'unknown';
    const key = `${label}:${ip}`;
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      if (buckets.size > 5000) buckets.clear();
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (existing.count >= maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: `Too many requests. Please wait ${retryAfterSec} seconds and try again.`,
      });
      return;
    }
    existing.count += 1;
    next();
  };
}

async function loadUserBundle(session: SessionTokenPayload) {
  const usersList = await queryVaultDocs<Record<string, unknown>>(
    collection(db, 'users'),
    where('uid', '==', session.uid)
  );
  const profile =
    usersList[0] ||
    ({
      uid: session.uid,
      displayName: session.displayName,
      accountType: 'individual',
      companyName: '',
      registrationRef: '',
      loyaltyPoints: 0,
      wholesaleApproved: session.role === 'admin',
      favouriteProductIds: [],
    } as Record<string, unknown>);

  const privList = await queryVaultDocs<Record<string, unknown>>(
    collection(db, 'users', session.uid, 'private'),
    where('uid', '==', session.uid)
  );
  const contact =
    privList[0] ||
    ({
      uid: session.uid,
      email: session.email,
      phone: session.phone,
      defaultCounty: 'Siaya',
      defaultTown: 'Siaya Town',
      defaultStreetAddress: '',
    } as Record<string, unknown>);

  const addresses = await queryVaultDocs<Record<string, unknown>>(
    collection(db, 'users', session.uid, 'addresses'),
    where('uid', '==', session.uid)
  );

  return {
    user: {
      uid: session.uid,
      displayName: String(profile.displayName || session.displayName),
      phone: String(contact.phone || session.phone),
      email: String(contact.email || session.email),
      isAdmin: session.role === 'admin',
    },
    profile,
    contact,
    addresses,
  };
}

function hasOnlyRealPhotos(imgs: unknown): boolean {
  if (!Array.isArray(imgs) || imgs.length === 0) return false;
  return imgs.every(
    (u) =>
      typeof u === 'string' &&
      u.trim().length > 0 &&
      !u.trim().toLowerCase().startsWith('data:image/svg')
  );
}

function resolveRealGalleryForRecord(id: string, data: Record<string, unknown>): string[] {
  const seed = INITIAL_PRODUCTS.find((p) => p.id === id || p.slug === data.slug);
  if (seed) return seed.images;
  const text = `${String(data.name || '')} ${String(data.categoryName || '')}`.toLowerCase();
  if (text.includes('cement') || text.includes('mortar')) return createProductGallery('cement');
  if (text.includes('mabati') || text.includes('roof')) return createProductGallery('mabati');
  if (text.includes('brc') || text.includes('mesh') || text.includes('rebar') || text.includes('steel')) {
    return createProductGallery('rebar');
  }
  if (text.includes('window')) return createProductGallery('window_casement');
  if (text.includes('door')) return createProductGallery('door_mahogany');
  if (text.includes('timber') || text.includes('cypress') || text.includes('plywood')) {
    return createProductGallery('timber');
  }
  if (text.includes('tank')) return createProductGallery('water_tank');
  if (text.includes('wheelbarrow')) return createProductGallery('wheelbarrow');
  if (text.includes('paint')) return createProductGallery('paint_bucket');
  if (text.includes('solar') || text.includes('light')) return createProductGallery('solar_floodlight');
  return createProductGallery('drill');
}

export async function syncCatalogToFirestore(force = false): Promise<void> {
  try {
    if (!force) {
      const settingsSnap = await getDoc(doc(db, 'settings', 'corporate'));
      const settingsData = settingsSnap.data();
      const hasUpdatedPhone = settingsData?.whatsappNumber === '+254 706 824489';

      const allProdsSnap = await getDocs(
        query(collection(db, 'products'), where('isActive', '==', true))
      );
      const missingSeeds = INITIAL_PRODUCTS.some(
        (seed) => !allProdsSnap.docs.some((d) => d.id === seed.id)
      );
      const staleSvgDocs = allProdsSnap.docs.filter((d) => !hasOnlyRealPhotos(d.data()?.images));

      if (hasUpdatedPhone && !missingSeeds && staleSvgDocs.length === 0) {
        const revSnap = await getDocs(query(collection(db, 'reviews'), where('status', '==', 'published')));
        if (revSnap.empty) {
          const revNow = serverTimestamp();
          const revOps: GatedWriteOp[] = INITIAL_REVIEWS.map((r) => {
            const { id, ...rest } = r;
            return {
              type: 'set',
              ref: doc(db, 'reviews', id),
              gateKey: `rev_${id}`,
              data: {
                ...rest,
                verifiedBuyer: false,
                status: 'published',
                createdAt: revNow,
                updatedAt: revNow,
              },
            };
          });
          await commitGatedOps(revOps);
        }
        return;
      }

      if (hasUpdatedPhone && !missingSeeds && staleSvgDocs.length > 0) {
        const patchNow = serverTimestamp();
        const patchOps: GatedWriteOp[] = staleSvgDocs.map((d) => ({
          type: 'update',
          ref: doc(db, 'products', d.id),
          gateKey: `prod_${d.id}`,
          data: {
            images: resolveRealGalleryForRecord(d.id, d.data() as Record<string, unknown>),
            updatedAt: patchNow,
          },
        }));
        await commitGatedOps(patchOps);
        console.log(`[DELARICO] Upgraded ${staleSvgDocs.length} Firestore products to real Kenyan photos.`);
        return;
      }
    }

    const now = serverTimestamp();

    await commitGatedOps([
      {
        type: 'set',
        ref: doc(db, 'settings', 'corporate'),
        gateKey: 'set_corporate',
        data: {
          ...DEFAULT_STORE_SETTINGS,
          updatedAt: now,
        },
      },
    ]);

    const existingCatsSnap = await getDocs(
      query(collection(db, 'categories'), where('isActive', '==', true))
    );
    const existingCatIds = new Set(existingCatsSnap.docs.map((d) => d.id));
    const catOps: GatedWriteOp[] = INITIAL_CATEGORIES.map((cat) => {
      const { id, ...rest } = cat;
      const ref = doc(db, 'categories', id);
      return existingCatIds.has(id)
        ? { type: 'update', ref, gateKey: `cat_${id}`, data: { ...rest, updatedAt: now } }
        : { type: 'set', ref, gateKey: `cat_${id}`, data: { ...rest, createdAt: now, updatedAt: now } };
    });
    await commitGatedOps(catOps);

    const existingProdsSnap = await getDocs(
      query(collection(db, 'products'), where('isActive', '==', true))
    );
    const existingProdIds = new Set(existingProdsSnap.docs.map((d) => d.id));
    const prodOps: GatedWriteOp[] = INITIAL_PRODUCTS.map((prod) => {
      const { id, ...rest } = prod;
      const ref = doc(db, 'products', id);
      return existingProdIds.has(id)
        ? { type: 'update', ref, gateKey: `prod_${id}`, data: { ...rest, updatedAt: now } }
        : { type: 'set', ref, gateKey: `prod_${id}`, data: { ...rest, createdAt: now, updatedAt: now } };
    });
    const seedIdSet = new Set(INITIAL_PRODUCTS.map((p) => p.id));
    for (const d of existingProdsSnap.docs) {
      if (!seedIdSet.has(d.id) && !hasOnlyRealPhotos(d.data()?.images)) {
        prodOps.push({
          type: 'update',
          ref: doc(db, 'products', d.id),
          gateKey: `prod_${d.id}`,
          data: {
            images: resolveRealGalleryForRecord(d.id, d.data() as Record<string, unknown>),
            updatedAt: now,
          },
        });
      }
    }
    await commitGatedOps(prodOps);

    const [existingPromosSnap, existingBranchesSnap, existingReviewsSnap] = await Promise.all([
      getDocs(query(collection(db, 'promotions'), where('isActive', '==', true))),
      getDocs(query(collection(db, 'branches'), where('isActive', '==', true))),
      getDocs(query(collection(db, 'reviews'), where('status', '==', 'published'))),
    ]);
    const existingPromoIds = new Set(existingPromosSnap.docs.map((d) => d.id));
    const existingBranchIds = new Set(existingBranchesSnap.docs.map((d) => d.id));
    const existingReviewIds = new Set(existingReviewsSnap.docs.map((d) => d.id));

    const miscOps: GatedWriteOp[] = [];
    for (const promo of INITIAL_PROMOTIONS) {
      const { id, ...rest } = promo;
      const ref = doc(db, 'promotions', id);
      miscOps.push(
        existingPromoIds.has(id)
          ? { type: 'update', ref, gateKey: `promo_${id}`, data: { ...rest, updatedAt: now } }
          : { type: 'set', ref, gateKey: `promo_${id}`, data: { ...rest, createdAt: now, updatedAt: now } }
      );
    }
    for (const branch of INITIAL_BRANCHES) {
      const { id, ...rest } = branch;
      const ref = doc(db, 'branches', id);
      miscOps.push(
        existingBranchIds.has(id)
          ? { type: 'update', ref, gateKey: `branch_${id}`, data: { ...rest, updatedAt: now } }
          : { type: 'set', ref, gateKey: `branch_${id}`, data: { ...rest, createdAt: now, updatedAt: now } }
      );
    }
    for (const rev of INITIAL_REVIEWS) {
      const { id, ...rest } = rev;
      if (!existingReviewIds.has(id)) {
        miscOps.push({
          type: 'set',
          ref: doc(db, 'reviews', id),
          gateKey: `rev_${id}`,
          data: {
            ...rest,
            verifiedBuyer: false,
            status: 'published',
            createdAt: now,
            updatedAt: now,
          },
        });
      }
    }
    if (miscOps.length > 0) {
      await commitGatedOps(miscOps);
    }
    console.log('[DELARICO] Live Firestore catalogue synchronized with real Kenyan materials & +254 706 824489.');
  } catch (err) {
    console.error('[DELARICO] Startup catalog sync warning:', err);
  }
}

export function createApiApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (
      err &&
      typeof err === 'object' &&
      'type' in err &&
      (err as { type?: string }).type === 'entity.parse.failed'
    ) {
      res.status(400).json({ error: 'Invalid JSON request payload.' });
      return;
    }
    next(err);
  });

  const authRateLimit = createRateLimiter(10 * 60 * 1000, 30, 'auth');
  const aiRateLimit = createRateLimiter(5 * 60 * 1000, 35, 'ai');
  const publicWriteRateLimit = createRateLimiter(10 * 60 * 1000, 25, 'pubwrite');

  const defaultAllowedOrigins = [
    'https://delarico.co.ke',
    'https://www.delarico.co.ke',
    'http://delarico.co.ke',
    'http://www.delarico.co.ke',
  ];
  if (process.env.APP_URL) {
    defaultAllowedOrigins.push(process.env.APP_URL.trim().replace(/\/+$/, ''));
  }
  if (process.env.VERCEL_URL) {
    defaultAllowedOrigins.push(`https://${process.env.VERCEL_URL.trim().replace(/^https?:\/\//, '')}`);
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    defaultAllowedOrigins.push(
      `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim().replace(/^https?:\/\//, '')}`
    );
  }
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach((o) => {
      const clean = o.trim().replace(/\/+$/, '');
      if (clean) defaultAllowedOrigins.push(clean);
    });
  }
  const allowedOriginSet = new Set(defaultAllowedOrigins);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
    if (origin && allowedOriginSet.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.path.startsWith('/api')) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      if (req.method !== 'GET' || !req.path.startsWith('/api/catalog')) {
        res.setHeader('Cache-Control', 'no-store');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
      }
    }
    next();
  });

  // Normalize Netlify function paths (/.netlify/functions/api/* -> /api/*)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
      const suffix = req.url.slice('/.netlify/functions/api'.length);
      req.url = `/api${suffix.startsWith('/') || suffix.startsWith('?') || !suffix ? suffix : `/${suffix}`}`;
    } else if (!req.url.startsWith('/api') && !req.url.startsWith('/assets')) {
      if (req.headers['x-nf-request-id'] || process.env.NETLIFY) {
        req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
      }
    }
    next();
  });

  interface PublicCatalogBundle {
    categories: Array<Record<string, unknown>>;
    products: Array<Record<string, unknown>>;
    promotions: Array<Record<string, unknown>>;
    branches: Array<Record<string, unknown>>;
    reviews: Array<Record<string, unknown>>;
    settings: Record<string, unknown>;
    source: 'firestore' | 'seed';
    updatedAt: string;
  }

  let cachedPublicCatalog: PublicCatalogBundle | null = null;
  let cachedPublicCatalogAt = 0;

  function invalidateCatalogCaches() {
    cachedPublicCatalog = null;
    cachedPublicCatalogAt = 0;
    cachedCatalogSummary = '';
    cachedCatalogSummaryAt = 0;
  }

  async function loadPublicCatalogBundle(): Promise<PublicCatalogBundle> {
    if (cachedPublicCatalog && Date.now() - cachedPublicCatalogAt < 15_000) {
      return cachedPublicCatalog;
    }

    let source: 'firestore' | 'seed' = 'seed';
    let categories: Array<Record<string, unknown>> = INITIAL_CATEGORIES.map((c) => ({ ...c }));
    let products: Array<Record<string, unknown>> = INITIAL_PRODUCTS.map((p) => ({ ...p }));
    let promotions: Array<Record<string, unknown>> = INITIAL_PROMOTIONS.map((p) => ({ ...p }));
    let branches: Array<Record<string, unknown>> = INITIAL_BRANCHES.map((b) => ({ ...b }));
    let reviews: Array<Record<string, unknown>> = INITIAL_REVIEWS.map((r) => ({
      ...r,
      verifiedBuyer: false,
      status: 'published',
    }));
    let settings: Record<string, unknown> = { ...DEFAULT_STORE_SETTINGS };

    try {
      const [catsSnap, prodsSnap, promosSnap, branchSnap, revsSnap, settingsSnap] = await Promise.race([
        Promise.all([
          getDocs(query(collection(db, 'categories'), where('isActive', '==', true))),
          getDocs(query(collection(db, 'products'), where('isActive', '==', true))),
          getDocs(query(collection(db, 'promotions'), where('isActive', '==', true))),
          getDocs(query(collection(db, 'branches'), where('isActive', '==', true))),
          getDocs(query(collection(db, 'reviews'), where('status', '==', 'published'))),
          getDoc(doc(db, 'settings', 'corporate')),
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Public catalog query timeout')), 3500)
        ),
      ]);

      if (!catsSnap.empty) {
        categories = catsSnap.docs
          .map((d) => sanitizeClientDoc<Record<string, unknown>>(d.id, d.data()))
          .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
        source = 'firestore';
      }
      if (!prodsSnap.empty) {
        products = prodsSnap.docs.map((d) => {
          const item = sanitizeClientDoc<Record<string, unknown>>(d.id, d.data());
          if (!hasOnlyRealPhotos(item.images)) {
            item.images = resolveRealGalleryForRecord(d.id, item);
          }
          return item;
        });
        source = 'firestore';
      }
      if (!promosSnap.empty) {
        promotions = promosSnap.docs.map((d) => sanitizeClientDoc<Record<string, unknown>>(d.id, d.data()));
        source = 'firestore';
      }
      if (!branchSnap.empty) {
        branches = branchSnap.docs.map((d) => sanitizeClientDoc<Record<string, unknown>>(d.id, d.data()));
        source = 'firestore';
      }
      if (!revsSnap.empty) {
        reviews = revsSnap.docs.map((d) => sanitizeClientDoc<Record<string, unknown>>(d.id, d.data()));
      }
      if (settingsSnap.exists()) {
        settings = sanitizeClientDoc<Record<string, unknown>>(
          settingsSnap.id,
          settingsSnap.data() as Record<string, unknown>
        );
        source = 'firestore';
      }
    } catch {
      // Fallback gracefully to bundled catalog constants
    }

    cachedPublicCatalog = {
      categories,
      products,
      promotions,
      branches,
      reviews,
      settings,
      source,
      updatedAt: new Date().toISOString(),
    };
    cachedPublicCatalogAt = Date.now();
    return cachedPublicCatalog;
  }

  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'corporate'));
      res.json({
        ok: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId,
        settingsPresent: settingsSnap.exists(),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        status: 'degraded',
        error: err instanceof Error ? err.message : 'Database connection check failed.',
      });
    }
  });

  // =========================================================================
  // Public Storefront REST Catalog & Pricing Endpoints
  // =========================================================================
  app.get('/api/catalog', async (_req: Request, res: Response) => {
    try {
      const catalog = await loadPublicCatalogBundle();
      res.json(catalog);
    } catch (err) {
      console.error('Public catalog load error:', err);
      res.status(500).json({ error: 'Unable to load product catalogue.' });
    }
  });

  app.get('/api/categories', async (_req: Request, res: Response) => {
    const catalog = await loadPublicCatalogBundle();
    res.json({ categories: catalog.categories, source: catalog.source });
  });

  app.get('/api/products', async (req: Request, res: Response) => {
    const catalog = await loadPublicCatalogBundle();
    let list = [...catalog.products];

    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim().toLowerCase();
    const featured = String(req.query.featured || '').toLowerCase();
    const bestSeller = String(req.query.bestSeller || '').toLowerCase();
    const onPromotion = String(req.query.onPromotion || '').toLowerCase();
    const inStock = String(req.query.inStock || '').toLowerCase();
    const sort = String(req.query.sort || '').toLowerCase();
    const limitRaw = Number(req.query.limit || 0);

    if (category) {
      const matchedCat = catalog.categories.find(
        (c) =>
          String(c.id).toLowerCase() === category || String(c.slug).toLowerCase() === category
      );
      const targetId = matchedCat ? String(matchedCat.id).toLowerCase() : category;
      list = list.filter(
        (p) =>
          String(p.categoryId || '').toLowerCase() === targetId ||
          String(p.categoryName || '').toLowerCase().includes(category)
      );
    }
    if (q) {
      list = list.filter((p) =>
        `${String(p.name || '')} ${String(p.sku || '')} ${String(p.brand || '')} ${String(p.categoryName || '')} ${String(p.specSummary || '')}`
          .toLowerCase()
          .includes(q)
      );
    }
    if (featured === 'true') list = list.filter((p) => Boolean(p.featured));
    if (bestSeller === 'true') list = list.filter((p) => Boolean(p.bestSeller));
    if (onPromotion === 'true') list = list.filter((p) => Boolean(p.onPromotion));
    if (inStock === 'true') list = list.filter((p) => Number(p.stockQty || 0) > 0);

    if (sort === 'price_asc') {
      list.sort((a, b) => Number(a.priceKes || 0) - Number(b.priceKes || 0));
    } else if (sort === 'price_desc') {
      list.sort((a, b) => Number(b.priceKes || 0) - Number(a.priceKes || 0));
    } else if (sort === 'rating') {
      list.sort((a, b) => Number(b.ratingAvg || 0) - Number(a.ratingAvg || 0));
    }

    const total = list.length;
    if (limitRaw > 0 && Number.isFinite(limitRaw)) {
      list = list.slice(0, Math.min(200, Math.floor(limitRaw)));
    }

    res.json({ products: list, total, source: catalog.source });
  });

  app.get('/api/products/:slugOrId', async (req: Request, res: Response) => {
    const key = String(req.params.slugOrId || '').trim().toLowerCase();
    const catalog = await loadPublicCatalogBundle();
    const product = catalog.products.find(
      (p) => String(p.id || '').toLowerCase() === key || String(p.slug || '').toLowerCase() === key
    );
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const reviews = catalog.reviews.filter((r) => String(r.productId) === String(product.id));
    res.json({ product, reviews });
  });

  app.get('/api/promotions', async (_req: Request, res: Response) => {
    const catalog = await loadPublicCatalogBundle();
    res.json({ promotions: catalog.promotions, source: catalog.source });
  });

  app.post('/api/promotions/validate', async (req: Request, res: Response) => {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const subtotalKes = Math.max(0, Number(req.body?.subtotalKes || 0));
    if (!code) {
      res.status(400).json({ valid: false, error: 'Please enter a promotional code.' });
      return;
    }
    const catalog = await loadPublicCatalogBundle();
    const promo = catalog.promotions.find(
      (p) => Boolean(p.isActive) && String(p.code || '').toUpperCase() === code
    );
    if (!promo) {
      res.status(404).json({ valid: false, error: 'Invalid or inactive promotional code.' });
      return;
    }
    const minOrderKes = Number(promo.minOrderKes || 0);
    if (subtotalKes < minOrderKes) {
      res.status(400).json({
        valid: false,
        error: `Minimum order of KES ${minOrderKes.toLocaleString()} required for ${code}.`,
      });
      return;
    }
    const discountValue = Number(promo.discountValue || 0);
    const discountKes =
      promo.discountType === 'percentage'
        ? Math.round((subtotalKes * discountValue) / 100)
        : Math.min(subtotalKes, discountValue);
    res.json({ valid: true, promotion: promo, discountKes });
  });

  app.get('/api/branches', async (_req: Request, res: Response) => {
    const catalog = await loadPublicCatalogBundle();
    res.json({ branches: catalog.branches, source: catalog.source });
  });

  app.get('/api/reviews', async (req: Request, res: Response) => {
    const productId = String(req.query.productId || '').trim();
    const catalog = await loadPublicCatalogBundle();
    const list = productId
      ? catalog.reviews.filter((r) => String(r.productId) === productId)
      : catalog.reviews;
    res.json({ reviews: list });
  });

  app.get('/api/settings', async (_req: Request, res: Response) => {
    const catalog = await loadPublicCatalogBundle();
    res.json({ settings: catalog.settings });
  });

  // =========================================================================
  // Unified Phone + Password Authentication (Stealth Admin Detection)
  // =========================================================================
  app.post('/api/auth/login', authRateLimit, async (req: Request, res: Response) => {
    try {
      const rawPhone = String(req.body?.phone || '');
      const password = String(req.body?.password || '');
      const normalizedPhone = normalizeKenyanPhone(rawPhone);

      if (!normalizedPhone || normalizedPhone.length < 8 || !password) {
        res.status(400).json({ error: 'Please enter a valid phone number and password.' });
        return;
      }

      // Automatic stealth detection for executive credentials
      if (matchesExecCredentials(normalizedPhone, password)) {
        const execUid = 'usr_executive_01';
        const existingExec = await queryVaultDocs<Record<string, unknown>>(
          collection(db, 'users'),
          where('uid', '==', execUid)
        );
        if (existingExec.length === 0) {
          const now = serverTimestamp();
          await commitGatedOps([
            {
              type: 'set',
              ref: doc(db, 'users', execUid),
              gateKey: `usr_${execUid}`,
              data: {
                uid: execUid,
                displayName: 'Delarico Operations',
                accountType: 'contractor',
                companyName: 'DELARICO MERCHANDISE & SUPPLIES',
                registrationRef: 'HQ-SIAYA',
                loyaltyPoints: 0,
                wholesaleApproved: false,
                favouriteProductIds: [],
                vaultKey: SERVER_VAULT_KEY,
                createdAt: now,
                updatedAt: now,
              },
            },
            {
              type: 'set',
              ref: doc(db, 'users', execUid, 'private', 'contact'),
              gateKey: `usrpriv_${execUid}_contact`,
              data: {
                uid: execUid,
                email: 'info@delarico.co.ke',
                phone: '+254 706 824489',
                defaultCounty: 'Siaya',
                defaultTown: 'Siaya Town',
                defaultStreetAddress: 'Along Siaya–Kisumu Highway',
                vaultKey: SERVER_VAULT_KEY,
                updatedAt: now,
              },
            },
          ]);
        }

        const token = signSessionToken({
          uid: execUid,
          phone: '+254 706 824489',
          displayName: 'Delarico Operations',
          email: 'info@delarico.co.ke',
          role: 'admin',
        });

        const payload = verifySessionToken(token)!;
        const bundle = await loadUserBundle(payload);
        res.json({ token, ...bundle });
        return;
      }

      // Standard customer phone + password login
      const acctSnap = await getDocs(
        query(
          collection(db, 'authAccounts'),
          where('vaultKey', '==', SERVER_VAULT_KEY),
          where('normalizedPhone', '==', normalizedPhone)
        )
      );

      if (acctSnap.empty) {
        res.status(401).json({ error: 'Invalid phone number or password.' });
        return;
      }

      const acctData = acctSnap.docs[0].data() as {
        uid: string;
        passwordSalt: string;
        passwordHash: string;
      };

      const computedHash = crypto
        .scryptSync(password, acctData.passwordSalt, 64)
        .toString('hex');

      const hashBuf = Buffer.from(acctData.passwordHash, 'hex');
      const candBuf = Buffer.from(computedHash, 'hex');
      if (hashBuf.length !== candBuf.length || !crypto.timingSafeEqual(hashBuf, candBuf)) {
        res.status(401).json({ error: 'Invalid phone number or password.' });
        return;
      }

      const sessionDraft: Omit<SessionTokenPayload, 'exp'> = {
        uid: acctData.uid,
        phone: normalizedPhone,
        displayName: 'Customer',
        email: 'customer@delarico.co.ke',
        role: 'customer',
      };
      const tempToken = signSessionToken(sessionDraft);
      const bundle = await loadUserBundle(verifySessionToken(tempToken)!);
      const finalToken = signSessionToken({
        uid: acctData.uid,
        phone: bundle.user.phone,
        displayName: bundle.user.displayName,
        email: bundle.user.email,
        role: 'customer',
      });

      res.json({ token: finalToken, ...bundle });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Unable to sign in right now. Please try again.' });
    }
  });

  app.post('/api/auth/register', authRateLimit, async (req: Request, res: Response) => {
    try {
      const displayName = String(req.body?.displayName || '').trim().slice(0, 120);
      const rawPhone = String(req.body?.phone || '');
      const password = String(req.body?.password || '');
      const email = String(req.body?.email || 'customer@delarico.co.ke').trim().slice(0, 254) || 'customer@delarico.co.ke';
      const accountTypeRaw = String(req.body?.accountType || 'individual');
      const accountType = ['individual', 'contractor', 'institution'].includes(accountTypeRaw)
        ? accountTypeRaw
        : 'individual';
      const companyName = String(req.body?.companyName || '').trim().slice(0, 160);
      const registrationRef = String(req.body?.registrationRef || '').trim().slice(0, 80);

      const normalizedPhone = normalizeKenyanPhone(rawPhone);
      if (!displayName || displayName.length < 2) {
        res.status(400).json({ error: 'Please enter your name.' });
        return;
      }
      if (!normalizedPhone || normalizedPhone.length < 9) {
        res.status(400).json({ error: 'Please enter a valid Kenyan phone number (e.g. 0712 345 678).' });
        return;
      }
      if (password.length < 4) {
        res.status(400).json({ error: 'Password must be at least 4 characters.' });
        return;
      }

      if (matchesExecCredentials(normalizedPhone, password)) {
        const execUid = 'usr_executive_01';
        const existingExec = await queryVaultDocs<Record<string, unknown>>(
          collection(db, 'users'),
          where('uid', '==', execUid)
        );
        if (existingExec.length === 0) {
          const now = serverTimestamp();
          await commitGatedOps([
            {
              type: 'set',
              ref: doc(db, 'users', execUid),
              gateKey: `usr_${execUid}`,
              data: {
                uid: execUid,
                displayName: 'Delarico Operations',
                accountType: 'contractor',
                companyName: 'DELARICO MERCHANDISE & SUPPLIES',
                registrationRef: 'HQ-SIAYA',
                loyaltyPoints: 0,
                wholesaleApproved: false,
                favouriteProductIds: [],
                vaultKey: SERVER_VAULT_KEY,
                createdAt: now,
                updatedAt: now,
              },
            },
            {
              type: 'set',
              ref: doc(db, 'users', execUid, 'private', 'contact'),
              gateKey: `usrpriv_${execUid}_contact`,
              data: {
                uid: execUid,
                email: 'info@delarico.co.ke',
                phone: '+254 706 824489',
                defaultCounty: 'Siaya',
                defaultTown: 'Siaya Town',
                defaultStreetAddress: 'Along Siaya–Kisumu Highway',
                vaultKey: SERVER_VAULT_KEY,
                updatedAt: now,
              },
            },
          ]);
        }
        const token = signSessionToken({
          uid: execUid,
          phone: '+254 706 824489',
          displayName: 'Delarico Operations',
          email: 'info@delarico.co.ke',
          role: 'admin',
        });
        const bundle = await loadUserBundle(verifySessionToken(token)!);
        res.json({ token, ...bundle });
        return;
      }

      const execPhoneCheck = crypto
        .createHash('sha256')
        .update(`${AUTH_SALT}:phone:${normalizedPhone}`)
        .digest('hex');
      const reservedPhoneDigest = crypto
        .createHash('sha256')
        .update(`${AUTH_SALT}:phone:+254706824489`)
        .digest('hex');
      if (execPhoneCheck === reservedPhoneDigest) {
        res.status(400).json({ error: 'This phone number is already registered. Please sign in.' });
        return;
      }

      const existingSnap = await getDocs(
        query(
          collection(db, 'authAccounts'),
          where('vaultKey', '==', SERVER_VAULT_KEY),
          where('normalizedPhone', '==', normalizedPhone)
        )
      );
      if (!existingSnap.empty) {
        const existingData = existingSnap.docs[0].data() as {
          uid: string;
          passwordSalt: string;
          passwordHash: string;
        };
        const computedHash = crypto
          .scryptSync(password, existingData.passwordSalt, 64)
          .toString('hex');
        const hashBuf = Buffer.from(existingData.passwordHash, 'hex');
        const candBuf = Buffer.from(computedHash, 'hex');
        if (hashBuf.length === candBuf.length && crypto.timingSafeEqual(hashBuf, candBuf)) {
          const tempToken = signSessionToken({
            uid: existingData.uid,
            phone: normalizedPhone,
            displayName,
            email,
            role: 'customer',
          });
          const bundle = await loadUserBundle(verifySessionToken(tempToken)!);
          const finalToken = signSessionToken({
            uid: existingData.uid,
            phone: bundle.user.phone,
            displayName: bundle.user.displayName,
            email: bundle.user.email,
            role: 'customer',
          });
          res.json({ token: finalToken, ...bundle });
          return;
        }
        res.status(400).json({ error: 'This phone number already has an account. Switch to Sign In.' });
        return;
      }

      const accountId = makeAccountIdFromPhone(normalizedPhone);
      const uid = `usr_${crypto.randomBytes(8).toString('hex')}`;
      const passwordSalt = crypto.randomBytes(16).toString('hex');
      const passwordHash = crypto.scryptSync(password, passwordSalt, 64).toString('hex');
      const now = serverTimestamp();

      await commitGatedOps([
        {
          type: 'set',
          ref: doc(db, 'authAccounts', accountId),
          gateKey: `auth_${accountId}`,
          data: {
            uid,
            normalizedPhone,
            passwordSalt,
            passwordHash,
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
            updatedAt: now,
          },
        },
        {
          type: 'set',
          ref: doc(db, 'users', uid),
          gateKey: `usr_${uid}`,
          data: {
            uid,
            displayName,
            accountType,
            companyName,
            registrationRef,
            loyaltyPoints: 0,
            wholesaleApproved: false,
            favouriteProductIds: [],
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
            updatedAt: now,
          },
        },
        {
          type: 'set',
          ref: doc(db, 'users', uid, 'private', 'contact'),
          gateKey: `usrpriv_${uid}_contact`,
          data: {
            uid,
            email,
            phone: normalizedPhone,
            defaultCounty: 'Siaya',
            defaultTown: 'Siaya Town',
            defaultStreetAddress: '',
            vaultKey: SERVER_VAULT_KEY,
            updatedAt: now,
          },
        },
      ]);

      const token = signSessionToken({
        uid,
        phone: normalizedPhone,
        displayName,
        email,
        role: 'customer',
      });
      const bundle = await loadUserBundle(verifySessionToken(token)!);
      res.json({ token, ...bundle });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Could not create account right now. Please try again.' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const bundle = await loadUserBundle(req.session!);
      res.json(bundle);
    } catch (err) {
      console.error('Session load error:', err);
      res.status(500).json({ error: 'Failed to load account session.' });
    }
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.patch('/api/auth/password', authRateLimit, requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const session = req.session!;
      if (session.role === 'admin' || session.uid === 'usr_executive_01') {
        res.status(400).json({ error: 'Operations access credentials cannot be changed from this form.' });
        return;
      }
      const currentPassword = String(req.body?.currentPassword || '');
      const newPassword = String(req.body?.newPassword || '');
      if (!currentPassword || newPassword.length < 4) {
        res.status(400).json({ error: 'Please provide your current password and a new password (at least 4 characters).' });
        return;
      }

      const acctSnap = await getDocs(
        query(
          collection(db, 'authAccounts'),
          where('vaultKey', '==', SERVER_VAULT_KEY),
          where('uid', '==', session.uid)
        )
      );
      if (acctSnap.empty) {
        res.status(404).json({ error: 'Customer credentials record not found.' });
        return;
      }

      const acctDoc = acctSnap.docs[0];
      const acctData = acctDoc.data() as {
        uid: string;
        normalizedPhone: string;
        passwordSalt: string;
        passwordHash: string;
      };
      const curHash = crypto.scryptSync(currentPassword, acctData.passwordSalt, 64).toString('hex');
      const hashBuf = Buffer.from(acctData.passwordHash, 'hex');
      const candBuf = Buffer.from(curHash, 'hex');
      if (hashBuf.length !== candBuf.length || !crypto.timingSafeEqual(hashBuf, candBuf)) {
        res.status(401).json({ error: 'Current password is incorrect.' });
        return;
      }

      const newSalt = crypto.randomBytes(16).toString('hex');
      const newHash = crypto.scryptSync(newPassword, newSalt, 64).toString('hex');
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'authAccounts', acctDoc.id),
          gateKey: `auth_${acctDoc.id}`,
          data: {
            passwordSalt: newSalt,
            passwordHash: newHash,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Password change error:', err);
      res.status(500).json({ error: 'Unable to update password right now.' });
    }
  });

  // =========================================================================
  // Customer Portal Endpoints
  // =========================================================================
  app.get('/api/customer/dashboard', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const [bundle, orders, quotations, enquiries] = await Promise.all([
        loadUserBundle(req.session!),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'orders'), where('customerId', '==', uid)),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'quotations'), where('customerId', '==', uid)),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'enquiries'), where('customerId', '==', uid)),
      ]);
      res.json({
        ...bundle,
        orders,
        quotations,
        enquiries,
      });
    } catch (err) {
      console.error('Customer dashboard error:', err);
      res.status(500).json({ error: 'Failed to load customer records.' });
    }
  });

  app.put('/api/customer/profile', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const displayName = String(req.body?.displayName || req.session!.displayName).trim().slice(0, 120);
      const accountTypeRaw = String(req.body?.accountType || 'individual');
      const accountType = ['individual', 'contractor', 'institution'].includes(accountTypeRaw)
        ? accountTypeRaw
        : 'individual';
      const companyName = String(req.body?.companyName || '').trim().slice(0, 160);
      const registrationRef = String(req.body?.registrationRef || '').trim().slice(0, 80);
      const phone = String(req.body?.phone || req.session!.phone).trim().slice(0, 30);
      const email = String(req.body?.email || req.session!.email || 'customer@delarico.co.ke').trim().slice(0, 254);
      const defaultCounty = String(req.body?.defaultCounty || 'Siaya').trim().slice(0, 80);
      const defaultTown = String(req.body?.defaultTown || 'Siaya Town').trim().slice(0, 80);
      const defaultStreetAddress = String(req.body?.defaultStreetAddress || '').trim().slice(0, 250);

      const now = serverTimestamp();
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'users', uid),
          gateKey: `usr_${uid}`,
          data: {
            displayName,
            accountType,
            companyName,
            registrationRef,
            updatedAt: now,
          },
        },
        {
          type: 'update',
          ref: doc(db, 'users', uid, 'private', 'contact'),
          gateKey: `usrpriv_${uid}_contact`,
          data: {
            email,
            phone,
            defaultCounty,
            defaultTown,
            defaultStreetAddress,
            updatedAt: now,
          },
        },
      ]);

      const bundle = await loadUserBundle(req.session!);
      res.json(bundle);
    } catch (err) {
      console.error('Update profile error:', err);
      res.status(500).json({ error: 'Failed to update profile.' });
    }
  });

  app.put('/api/customer/favourites', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const rawIds = Array.isArray(req.body?.favouriteProductIds) ? req.body.favouriteProductIds : [];
      const favouriteProductIds = rawIds
        .map((id: unknown) => String(id).trim())
        .filter((id: string) => id.length > 0 && id.length <= 128)
        .slice(0, 50);

      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'users', uid),
          gateKey: `usr_${uid}`,
          data: {
            favouriteProductIds,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ favouriteProductIds });
    } catch (err) {
      console.error('Update favourites error:', err);
      res.status(500).json({ error: 'Failed to update saved items.' });
    }
  });

  app.post('/api/customer/addresses', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const addrRef = doc(collection(db, 'users', uid, 'addresses'));
      const now = serverTimestamp();
      const payload = {
        uid,
        label: String(req.body?.label || 'Site Address').trim().slice(0, 60),
        recipientName: String(req.body?.recipientName || req.session!.displayName).trim().slice(0, 120),
        phone: String(req.body?.phone || req.session!.phone).trim().slice(0, 30),
        county: String(req.body?.county || 'Siaya').trim().slice(0, 80),
        town: String(req.body?.town || 'Siaya Town').trim().slice(0, 80),
        streetDetails: String(req.body?.streetDetails || '').trim().slice(0, 250),
        isDefault: Boolean(req.body?.isDefault),
        vaultKey: SERVER_VAULT_KEY,
        createdAt: now,
        updatedAt: now,
      };
      await commitGatedOps([
        {
          type: 'set',
          ref: addrRef,
          gateKey: `usraddr_${addrRef.id}`,
          data: payload,
        },
      ]);
      const addresses = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'users', uid, 'addresses'),
        where('uid', '==', uid)
      );
      res.json({ addresses });
    } catch (err) {
      console.error('Add address error:', err);
      res.status(500).json({ error: 'Failed to save delivery address.' });
    }
  });

  app.delete('/api/customer/addresses/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const addressId = String(req.params.id);
      await commitGatedOps([
        {
          type: 'delete',
          ref: doc(db, 'users', uid, 'addresses', addressId),
          gateKey: `usraddr_${addressId}`,
        },
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete address error:', err);
      res.status(500).json({ error: 'Failed to delete address.' });
    }
  });

  app.post('/api/customer/orders', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const itemsInput = Array.isArray(req.body?.items) ? req.body.items : [];
      if (itemsInput.length === 0 || itemsInput.length > 200) {
        res.status(400).json({
          error: itemsInput.length === 0
            ? 'Order must contain at least one item.'
            : 'Order cannot exceed 200 distinct line items.',
        });
        return;
      }

      const catalog = await loadPublicCatalogBundle();
      const userBundle = await loadUserBundle(req.session!);
      const wholesaleApproved = Boolean(userBundle.profile?.wholesaleApproved);

      // Authoritatively resolve prices, stock, and totals on the server
      const resolvedItems: Array<{
        productId: string;
        categoryId: string;
        productName: string;
        sku: string;
        unit: string;
        quantity: number;
        unitPriceKes: number;
        lineTotalKes: number;
      }> = [];

      for (const rawItem of itemsInput as Array<Record<string, unknown>>) {
        const productId = String(rawItem?.productId || '').trim().slice(0, 128);
        const qty = Math.max(1, Math.round(Number(rawItem?.quantity || 1)));
        const catalogProduct =
          catalog.products.find((p) => String(p.id) === productId) ||
          INITIAL_PRODUCTS.find((p) => p.id === productId);

        if (catalogProduct) {
          const availableStock = Number(catalogProduct.stockQty ?? 0);
          if (availableStock <= 0) {
            res.status(400).json({
              error: `${String(catalogProduct.name)} is currently out of stock. Request a quotation for restock lead time.`,
            });
            return;
          }
          if (qty > availableStock) {
            res.status(400).json({
              error: `Only ${availableStock} ${String(catalogProduct.unit || 'units')} of ${String(catalogProduct.name)} are available in stock.`,
            });
            return;
          }
          const minBulk = Math.max(1, Number(catalogProduct.minWholesaleQty || 1));
          const isBulk = wholesaleApproved || qty >= minBulk;
          const unitPriceKes = Math.max(
            0,
            Math.round(
              Number(isBulk ? catalogProduct.wholesalePriceKes : catalogProduct.priceKes)
            )
          );
          resolvedItems.push({
            productId: String(catalogProduct.id || productId),
            categoryId: String(catalogProduct.categoryId || 'cat-building-materials'),
            productName: String(catalogProduct.name || 'Material').slice(0, 160),
            sku: String(catalogProduct.sku || 'DLR-ITEM').slice(0, 64),
            unit: String(catalogProduct.unit || 'Piece').slice(0, 40),
            quantity: qty,
            unitPriceKes,
            lineTotalKes: unitPriceKes * qty,
          });
        } else if (productId && /^[a-zA-Z0-9_-]+$/.test(productId)) {
          const fallbackUnit = Math.max(0, Number(rawItem?.unitPriceKes || 0));
          resolvedItems.push({
            productId,
            categoryId: 'cat-building-materials',
            productName: String(rawItem?.productName || 'Material').trim().slice(0, 160) || 'Material',
            sku: String(rawItem?.sku || 'DLR-ITEM').trim().toUpperCase().slice(0, 64) || 'DLR-ITEM',
            unit: String(rawItem?.unit || 'Piece').trim().slice(0, 40) || 'Piece',
            quantity: qty,
            unitPriceKes: fallbackUnit,
            lineTotalKes: fallbackUnit * qty,
          });
        } else {
          res.status(400).json({ error: 'One or more items in your cart are invalid.' });
          return;
        }
      }

      const subtotalKes = resolvedItems.reduce((sum, item) => sum + item.lineTotalKes, 0);
      const requestedPromoCode = String(req.body?.promoCode || '').trim().toUpperCase().slice(0, 40);
      let appliedPromoCode = '';
      let discountKes = 0;

      if (requestedPromoCode) {
        const promo = catalog.promotions.find(
          (p) => Boolean(p.isActive) && String(p.code || '').toUpperCase() === requestedPromoCode
        );
        if (promo && subtotalKes >= Number(promo.minOrderKes || 0)) {
          appliedPromoCode = String(promo.code).toUpperCase().slice(0, 40);
          const val = Number(promo.discountValue || 0);
          discountKes =
            promo.discountType === 'percentage'
              ? Math.round((subtotalKes * val) / 100)
              : Math.min(subtotalKes, val);
        }
      }

      const deliveryMethodRaw = String(req.body?.deliveryMethod || 'local_siaya');
      const deliveryMethod = ['pickup', 'local_siaya', 'regional_nyanza', 'countrywide_freight'].includes(
        deliveryMethodRaw
      )
        ? deliveryMethodRaw
        : 'local_siaya';

      const netMaterialsKes = Math.max(0, subtotalKes - discountKes);
      const freeThreshold = Number(catalog.settings.freeDeliveryThresholdKes ?? 80000);
      const deliveryFeeKes =
        deliveryMethod === 'pickup'
          ? 0
          : deliveryMethod === 'local_siaya'
          ? netMaterialsKes >= freeThreshold
            ? 0
            : 1500
          : deliveryMethod === 'regional_nyanza'
          ? 4500
          : 9500;
      const totalKes = netMaterialsKes + deliveryFeeKes;

      const orderRef = doc(collection(db, 'orders'));
      const orderNumber = `DLR-${Date.now().toString().slice(-6)}${crypto.randomBytes(1).toString('hex').toUpperCase()}`;
      const now = serverTimestamp();

      const rawAffiliateCode = String(req.body?.affiliateCode || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '')
        .slice(0, 24);

      const safeCustomerName = (
        String(req.body?.customerName || req.session!.displayName || 'Customer').trim() || 'Customer'
      ).slice(0, 120);
      const safeCustomerPhone = (
        String(req.body?.customerPhone || req.session!.phone || '+254700000000').trim() || '+254700000000'
      ).slice(0, 30);
      const safeCustomerEmail = (
        String(req.body?.customerEmail || req.session!.email || 'customer@delarico.co.ke').trim() ||
        'customer@delarico.co.ke'
      ).slice(0, 254);
      const safeCounty = (String(req.body?.deliveryCounty || 'Siaya').trim() || 'Siaya').slice(0, 80);
      const safeTown = (String(req.body?.deliveryTown || 'Siaya Town').trim() || 'Siaya Town').slice(0, 80);
      const safeAddress = (
        String(req.body?.deliveryAddress || 'Siaya Yard').trim() || 'Siaya Yard'
      ).slice(0, 300);

      const orderData = {
        orderNumber,
        customerId: uid,
        customerName: safeCustomerName.length >= 2 ? safeCustomerName : 'Customer',
        customerPhone: safeCustomerPhone.length >= 7 ? safeCustomerPhone : '+254706824489',
        customerEmail: safeCustomerEmail.length >= 3 ? safeCustomerEmail : 'customer@delarico.co.ke',
        accountType: ['individual', 'contractor', 'institution'].includes(req.body?.accountType)
          ? req.body.accountType
          : 'individual',
        branchId:
          String(req.body?.branchId || 'branch-siaya-hq').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) ||
          'branch-siaya-hq',
        deliveryCounty: safeCounty.length >= 2 ? safeCounty : 'Siaya',
        deliveryTown: safeTown.length >= 2 ? safeTown : 'Siaya Town',
        deliveryAddress: safeAddress.length >= 2 ? safeAddress : 'Siaya Yard',
        deliveryMethod,
        subtotalKes,
        discountKes,
        promoCode: appliedPromoCode,
        deliveryFeeKes,
        totalKes,
        itemCount: resolvedItems.length,
        paymentMethod: ['mpesa_stk', 'mpesa_paybill', 'mpesa_till', 'bank_transfer', 'cod'].includes(req.body?.paymentMethod)
          ? req.body.paymentMethod
          : 'mpesa_paybill',
        paymentReference: String(req.body?.paymentReference || '').trim().slice(0, 100),
        paymentStatus: 'pending_verification',
        orderStatus: 'pending',
        notes: String(req.body?.notes || '').trim().slice(0, 1000),
        affiliateCode: rawAffiliateCode,
        vaultKey: SERVER_VAULT_KEY,
        createdAt: now,
        updatedAt: now,
      };

      await commitGatedOps([
        {
          type: 'set',
          ref: orderRef,
          gateKey: `ord_${orderRef.id}`,
          data: orderData,
        },
      ]);

      const itemOps: GatedWriteOp[] = [];
      const confirmedItems: Array<Record<string, unknown>> = [];

      resolvedItems.forEach((item, idx) => {
        const itemId = `item_${idx + 1}`;
        const itemRef = doc(db, 'orders', orderRef.id, 'items', itemId);
        const itemPayload = {
          orderId: orderRef.id,
          customerId: uid,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          unit: item.unit,
          quantity: item.quantity,
          unitPriceKes: item.unitPriceKes,
          lineTotalKes: item.lineTotalKes,
          vaultKey: SERVER_VAULT_KEY,
          createdAt: now,
        };
        itemOps.push({
          type: 'set',
          ref: itemRef,
          gateKey: `orditem_${orderRef.id}_${itemId}`,
          data: itemPayload,
        });
        const { vaultKey: _vk, ...cleanItem } = itemPayload;
        confirmedItems.push({
          id: itemId,
          ...cleanItem,
          createdAt: new Date().toISOString(),
        });
      });

      await commitGatedOps(itemOps);

      if (req.body?.saveNewAddress && orderData.deliveryMethod !== 'pickup') {
        const addrRef = doc(collection(db, 'users', uid, 'addresses'));
        await commitGatedOps([
          {
            type: 'set',
            ref: addrRef,
            gateKey: `usraddr_${addrRef.id}`,
            data: {
              uid,
              label: `${orderData.deliveryTown} Site`.slice(0, 60),
              recipientName: orderData.customerName,
              phone: orderData.customerPhone,
              county: orderData.deliveryCounty,
              town: orderData.deliveryTown,
              streetDetails: orderData.deliveryAddress.slice(0, 250),
              isDefault: false,
              vaultKey: SERVER_VAULT_KEY,
              createdAt: now,
              updatedAt: now,
            },
          },
        ]);
      }

      if (rawAffiliateCode.length >= 4) {
        const matchedAffiliates = await queryVaultDocs<Record<string, unknown>>(
          collection(db, 'affiliates'),
          where('affiliateCode', '==', rawAffiliateCode)
        );
        const affiliate = matchedAffiliates[0];
        if (affiliate && affiliate.status === 'active' && String(affiliate.uid) !== uid) {
          const affUid = String(affiliate.uid);
          const baseRate = Math.min(5, Math.max(3, Number(affiliate.commissionRatePct || 3)));
          let weightedCommissionKes = 0;

          for (const item of resolvedItems) {
            const itemRate = getProductCommissionRatePct(item.categoryId, baseRate);
            weightedCommissionKes += (item.lineTotalKes * itemRate) / 100;
          }

          const netSubtotal = Math.max(1, subtotalKes - discountKes);
          const discountRatio = subtotalKes > 0 ? netSubtotal / subtotalKes : 1;
          const finalCommissionKes = Math.max(1, Math.round(weightedCommissionKes * discountRatio));
          const effectiveRatePct = Math.min(
            5,
            Math.max(3, Number(((finalCommissionKes / netSubtotal) * 100).toFixed(1)) || baseRate)
          );
          const buyerFirst = (orderData.customerName.split(' ')[0] || 'Customer').slice(0, 60);
          const refDoc = doc(collection(db, 'affiliateReferrals'));

          await commitGatedOps([
            {
              type: 'set',
              ref: refDoc,
              gateKey: `affref_${refDoc.id}`,
              data: {
                affiliateUid: affUid,
                affiliateCode: rawAffiliateCode,
                affiliateName: String(affiliate.displayName || 'Affiliate Partner').slice(0, 120),
                orderId: orderRef.id,
                orderNumber,
                buyerFirstName: buyerFirst,
                orderTotalKes: netSubtotal,
                commissionRatePct: effectiveRatePct,
                commissionKes: finalCommissionKes,
                status: 'pending',
                vaultKey: SERVER_VAULT_KEY,
                createdAt: now,
                updatedAt: now,
              },
            },
            {
              type: 'update',
              ref: doc(db, 'affiliates', affUid),
              gateKey: `aff_${affUid}`,
              data: {
                totalReferrals: Number(affiliate.totalReferrals || 0) + 1,
                totalSalesKes: Number(affiliate.totalSalesKes || 0) + netSubtotal,
                pendingCommissionKes: Number(affiliate.pendingCommissionKes || 0) + finalCommissionKes,
                updatedAt: now,
              },
            },
          ]);
        }
      }

      const { vaultKey: _ovk, ...cleanOrder } = orderData;
      res.json({
        order: {
          id: orderRef.id,
          ...cleanOrder,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        items: confirmedItems,
      });
    } catch (err) {
      console.error('Create order error:', err);
      res.status(500).json({ error: 'Could not place order right now. Please try again.' });
    }
  });

  app.get('/api/customer/orders/:id/items', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const orderId = String(req.params.id);
      const items = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'orders', orderId, 'items'),
        where('customerId', '==', uid)
      );
      res.json({ items });
    } catch (err) {
      console.error('Fetch order items error:', err);
      res.status(500).json({ error: 'Failed to load invoice items.' });
    }
  });

  app.patch('/api/customer/orders/:id/payment-ref', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const orderId = String(req.params.id);
      const orders = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'orders'),
        where('customerId', '==', uid)
      );
      const found = orders.find((o) => o.id === orderId);
      if (!found) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }
      const paymentReference = String(req.body?.paymentReference || '').trim().toUpperCase().slice(0, 100);
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'orders', orderId),
          gateKey: `ord_${orderId}`,
          data: {
            paymentReference,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true, paymentReference });
    } catch (err) {
      console.error('Save payment ref error:', err);
      res.status(500).json({ error: 'Failed to save payment reference.' });
    }
  });

  app.patch('/api/customer/orders/:id/cancel', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const orderId = String(req.params.id);
      const orders = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'orders'),
        where('customerId', '==', uid)
      );
      const found = orders.find((o) => o.id === orderId);
      if (!found || found.orderStatus !== 'pending') {
        res.status(400).json({ error: 'Only pending orders can be cancelled.' });
        return;
      }
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'orders', orderId),
          gateKey: `ord_${orderId}`,
          data: {
            orderStatus: 'cancelled',
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Cancel order error:', err);
      res.status(500).json({ error: 'Failed to cancel order.' });
    }
  });

  app.post('/api/customer/quotations', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const itemsInput: Array<Record<string, unknown>> = Array.isArray(req.body?.items)
        ? (req.body.items as Array<Record<string, unknown>>)
        : [];
      if (itemsInput.length === 0 || itemsInput.length > 200) {
        res.status(400).json({
          error: itemsInput.length === 0
            ? 'Please include at least one material item.'
            : 'Quotation request cannot exceed 200 line items.',
        });
        return;
      }

      const cleanItems = itemsInput.map((rawItem) => {
        const qty = Math.max(1, Math.round(Number(rawItem.quantity || 1)));
        const unitPrice = Math.max(0, Number(rawItem.unitPriceKes || 0));
        return {
          productId: String(rawItem.productId || `custom_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || 'custom_item',
          productName: (String(rawItem.productName || 'Construction Material').trim() || 'Construction Material').slice(0, 160),
          unit: (String(rawItem.unit || 'Piece').trim() || 'Piece').slice(0, 40),
          quantity: qty,
          unitPriceKes: unitPrice,
        };
      });

      const computedSubtotal = cleanItems.reduce((sum, item) => sum + item.quantity * item.unitPriceKes, 0);
      const quoteRef = doc(collection(db, 'quotations'));
      const quoteNumber = `QT-${Date.now().toString().slice(-6)}${crypto.randomBytes(1).toString('hex').toUpperCase()}`;
      const now = serverTimestamp();

      const contactName = (String(req.body?.contactName || req.session!.displayName || 'Client').trim() || 'Client').slice(0, 120);
      const phone = (String(req.body?.phone || req.session!.phone || '+254706824489').trim() || '+254706824489').slice(0, 30);
      const email = (String(req.body?.email || req.session!.email || 'client@delarico.co.ke').trim() || 'client@delarico.co.ke').slice(0, 254);

      await commitGatedOps([
        {
          type: 'set',
          ref: quoteRef,
          gateKey: `qt_${quoteRef.id}`,
          data: {
            quoteNumber,
            customerId: uid,
            contactName: contactName.length >= 2 ? contactName : 'Client',
            companyName: String(req.body?.companyName || '').trim().slice(0, 160),
            phone: phone.length >= 7 ? phone : '+254706824489',
            email: email.length >= 3 ? email : 'client@delarico.co.ke',
            deliveryLocation: (String(req.body?.deliveryLocation || 'Siaya').trim() || 'Siaya').slice(0, 250),
            projectType: (String(req.body?.projectType || 'Residential Construction').trim() || 'Residential Construction').slice(0, 100),
            instructions: String(req.body?.instructions || '').trim().slice(0, 1500),
            itemCount: cleanItems.length,
            estimatedSubtotalKes: Math.max(0, computedSubtotal || Number(req.body?.estimatedSubtotalKes || 0)),
            quotedTotalKes: 0,
            adminResponseNotes: '',
            validUntil: '',
            status: 'submitted',
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);

      const itemOps: GatedWriteOp[] = cleanItems.map((item, idx) => {
        const itemId = `qitem_${idx + 1}`;
        return {
          type: 'set',
          ref: doc(db, 'quotations', quoteRef.id, 'items', itemId),
          gateKey: `qtitem_${quoteRef.id}_${itemId}`,
          data: {
            quotationId: quoteRef.id,
            customerId: uid,
            productId: item.productId,
            productName: item.productName,
            unit: item.unit,
            quantity: item.quantity,
            unitPriceKes: item.unitPriceKes,
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
          },
        };
      });

      await commitGatedOps(itemOps);
      res.json({ quoteNumber, id: quoteRef.id });
    } catch (err) {
      console.error('Submit quotation error:', err);
      res.status(500).json({ error: 'Failed to submit quotation request.' });
    }
  });

  app.patch('/api/customer/quotations/:id/decision', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const quoteId = String(req.params.id);
      const decision = req.body?.decision === 'accepted' ? 'accepted' : 'declined';
      const quotes = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'quotations'),
        where('customerId', '==', uid)
      );
      const found = quotes.find((q) => q.id === quoteId);
      if (!found) {
        res.status(404).json({ error: 'Quotation not found.' });
        return;
      }
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'quotations', quoteId),
          gateKey: `qt_${quoteId}`,
          data: {
            status: decision,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true, status: decision });
    } catch (err) {
      console.error('Quotation decision error:', err);
      res.status(500).json({ error: 'Failed to update quotation decision.' });
    }
  });

  app.post('/api/customer/enquiries', publicWriteRateLimit, async (req: Request, res: Response) => {
    try {
      const session = extractBearer(req);
      const customerId = session ? session.uid : 'guest_visitor';
      const enquiryRef = doc(collection(db, 'enquiries'));
      const now = serverTimestamp();

      const enquiryTypeRaw = String(req.body?.enquiryType || 'general');
      const enquiryType = ['general', 'bulk_sourcing', 'supplier_partnership', 'contractor_onboarding'].includes(
        enquiryTypeRaw
      )
        ? enquiryTypeRaw
        : 'general';

      const name = (String(req.body?.name || session?.displayName || 'Visitor').trim() || 'Visitor').slice(0, 120);
      const subject = (String(req.body?.subject || 'Website Enquiry').trim() || 'Website Enquiry').slice(0, 160);
      const message = String(req.body?.message || '').trim().slice(0, 2000);
      if (message.length < 5) {
        res.status(400).json({ error: 'Please enter enquiry details (at least 5 characters).' });
        return;
      }

      await commitGatedOps([
        {
          type: 'set',
          ref: enquiryRef,
          gateKey: `enq_${enquiryRef.id}`,
          data: {
            customerId,
            enquiryType,
            name: name.length >= 2 ? name : 'Visitor',
            companyName: String(req.body?.companyName || '').trim().slice(0, 160),
            phone: String(req.body?.phone || session?.phone || '+254 706 824489').trim().slice(0, 30) || '+254 706 824489',
            email: String(req.body?.email || session?.email || 'info@delarico.co.ke').trim().slice(0, 254) || 'info@delarico.co.ke',
            subject: subject.length >= 2 ? subject : 'Website Enquiry',
            message,
            status: 'open',
            adminReply: '',
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);
      res.json({ ok: true, id: enquiryRef.id });
    } catch (err) {
      console.error('Create enquiry error:', err);
      res.status(500).json({ error: 'Failed to submit enquiry.' });
    }
  });

  app.post('/api/customer/reviews', publicWriteRateLimit, async (req: AuthedRequest, res: Response) => {
    try {
      const session = extractBearer(req);
      const productId = String(req.body?.productId || '').trim().slice(0, 128);
      const productName = String(req.body?.productName || 'Product').trim().slice(0, 160);
      const customerName = String(req.body?.customerName || session?.displayName || '')
        .trim()
        .slice(0, 120);
      const title = String(req.body?.title || '').trim().slice(0, 120);
      const comment = String(req.body?.comment || '').trim().slice(0, 1500);
      const rating = Math.min(5, Math.max(1, Math.round(Number(req.body?.rating || 5))));

      if (!productId || !/^[a-zA-Z0-9_-]+$/.test(productId)) {
        res.status(400).json({ error: 'Invalid product selected for review.' });
        return;
      }
      if (customerName.length < 2) {
        res.status(400).json({ error: 'Please enter your name (at least 2 characters).' });
        return;
      }
      if (title.length < 2 || comment.length < 5) {
        res.status(400).json({ error: 'Please enter a review headline and feedback (at least 5 characters).' });
        return;
      }

      const revRef = doc(collection(db, 'reviews'));
      const now = serverTimestamp();
      const customerId = session ? session.uid : `cust_guest_${crypto.randomBytes(6).toString('hex')}`;
      const safeProductName = productName.length >= 2 ? productName : 'Construction Material';

      const ops: GatedWriteOp[] = [
        {
          type: 'set',
          ref: revRef,
          gateKey: `rev_${revRef.id}`,
          data: {
            productId,
            productName: safeProductName,
            customerId,
            customerName,
            rating,
            title,
            comment,
            verifiedBuyer: false,
            status: 'published',
            createdAt: now,
            updatedAt: now,
          },
        },
      ];

      const prodRef = doc(db, 'products', productId);
      const [prodSnap, existingRevSnap] = await Promise.all([
        getDoc(prodRef),
        getDocs(query(collection(db, 'reviews'), where('productId', '==', productId), where('status', '==', 'published'))),
      ]);
      if (prodSnap.exists()) {
        const ratings = existingRevSnap.docs.map((d) => Number(d.data()?.rating || 5));
        ratings.push(rating);
        const totalReviews = ratings.length;
        const avgRating = Number((ratings.reduce((a, b) => a + b, 0) / totalReviews).toFixed(1));
        ops.push({
          type: 'update',
          ref: prodRef,
          gateKey: `prod_${productId}`,
          data: {
            ratingAvg: avgRating,
            reviewCount: totalReviews,
            updatedAt: now,
          },
        });
      }

      await commitGatedOps(ops);
      invalidateCatalogCaches();
      res.json({
        ok: true,
        id: revRef.id,
        review: {
          id: revRef.id,
          productId,
          productName: safeProductName,
          customerId,
          customerName,
          rating,
          title,
          comment,
          verifiedBuyer: false,
          status: 'published',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error('Create review error:', err);
      res.status(500).json({ error: 'Failed to publish review.' });
    }
  });

  // =========================================================================
  // Affiliate Program Endpoints (Free Registration & 3%–5% Commissions)
  // =========================================================================
  app.get('/api/affiliates/me', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const [affDocs, referrals] = await Promise.all([
        queryVaultDocs<Record<string, unknown>>(collection(db, 'affiliates'), where('uid', '==', uid)),
        queryVaultDocs<Record<string, unknown>>(
          collection(db, 'affiliateReferrals'),
          where('affiliateUid', '==', uid)
        ),
      ]);
      res.json({
        affiliate: affDocs[0] || null,
        referrals,
      });
    } catch (err) {
      console.error('Affiliate me error:', err);
      res.status(500).json({ error: 'Unable to load affiliate account.' });
    }
  });

  app.post('/api/affiliates/enroll', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const session = req.session!;
      const uid = session.uid;
      const existing = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'affiliates'),
        where('uid', '==', uid)
      );
      if (existing[0]) {
        const referrals = await queryVaultDocs<Record<string, unknown>>(
          collection(db, 'affiliateReferrals'),
          where('affiliateUid', '==', uid)
        );
        res.json({ affiliate: existing[0], referrals });
        return;
      }

      const mpesaPhone = String(req.body?.mpesaPhone || session.phone || '').trim().slice(0, 30);
      if (mpesaPhone.length < 7) {
        res.status(400).json({ error: 'Please provide a valid M-Pesa phone number for commission payouts.' });
        return;
      }

      const displayName = String(req.body?.displayName || session.displayName || 'Partner').trim().slice(0, 120);
      const cleanPrefix =
        displayName
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 4) || 'PART';
      const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
      const affiliateCode = `DLR-${cleanPrefix}${suffix}`;
      const now = serverTimestamp();

      const payload = {
        uid,
        affiliateCode,
        displayName: displayName.length >= 2 ? displayName : 'Affiliate Partner',
        mpesaPhone,
        commissionRatePct: 3,
        totalClicks: 0,
        totalReferrals: 0,
        totalSalesKes: 0,
        pendingCommissionKes: 0,
        availableCommissionKes: 0,
        paidCommissionKes: 0,
        payoutRequested: false,
        status: 'active',
        vaultKey: SERVER_VAULT_KEY,
        createdAt: now,
        updatedAt: now,
      };

      await commitGatedOps([
        {
          type: 'set',
          ref: doc(db, 'affiliates', uid),
          gateKey: `aff_${uid}`,
          data: payload,
        },
      ]);

      const { vaultKey: _vk, ...cleanAffiliate } = payload;
      res.json({
        affiliate: {
          id: uid,
          ...cleanAffiliate,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        referrals: [],
      });
    } catch (err) {
      console.error('Affiliate enroll error:', err);
      res.status(500).json({ error: 'Unable to activate affiliate account right now.' });
    }
  });

  app.post('/api/affiliates/track-click', async (req: Request, res: Response) => {
    try {
      const code = String(req.body?.code || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '')
        .slice(0, 24);
      if (code.length < 4) {
        res.json({ ok: false });
        return;
      }
      const matched = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'affiliates'),
        where('affiliateCode', '==', code)
      );
      const aff = matched[0];
      if (!aff || aff.status !== 'active') {
        res.json({ ok: false });
        return;
      }
      const affUid = String(aff.uid);
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'affiliates', affUid),
          gateKey: `aff_${affUid}`,
          data: {
            totalClicks: Number(aff.totalClicks || 0) + 1,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true, affiliateName: aff.displayName, code });
    } catch {
      res.json({ ok: false });
    }
  });

  app.patch('/api/affiliates/payout', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const uid = req.session!.uid;
      const matched = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'affiliates'),
        where('uid', '==', uid)
      );
      const aff = matched[0];
      if (!aff) {
        res.status(404).json({ error: 'Affiliate profile not found.' });
        return;
      }
      const mpesaPhone = String(req.body?.mpesaPhone || aff.mpesaPhone || '').trim().slice(0, 30);
      const requestPayout = Boolean(req.body?.payoutRequested ?? true);
      if (requestPayout && Number(aff.availableCommissionKes || 0) < 100) {
        res.status(400).json({
          error: 'You need at least KES 100 in approved commission before requesting an M-Pesa payout.',
        });
        return;
      }

      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'affiliates', uid),
          gateKey: `aff_${uid}`,
          data: {
            mpesaPhone,
            payoutRequested: requestPayout,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true, mpesaPhone, payoutRequested: requestPayout });
    } catch (err) {
      console.error('Affiliate payout request error:', err);
      res.status(500).json({ error: 'Unable to submit payout request.' });
    }
  });

  // =========================================================================
  // Privacy-Compliant Newsletter Endpoints
  // =========================================================================
  app.post('/api/newsletter/subscribe', publicWriteRateLimit, async (req: Request, res: Response) => {
    try {
      const rawEmail = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
      const privacyConsent = Boolean(req.body?.privacyConsent);
      const sourceRaw = String(req.body?.source || 'footer');
      const source = ['footer', 'checkout', 'account'].includes(sourceRaw) ? sourceRaw : 'footer';

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawEmail)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (!privacyConsent) {
        res.status(400).json({
          error: 'Please tick the privacy consent box to confirm marketing updates permission.',
        });
        return;
      }

      const subId = `sub_${crypto.createHash('sha256').update(rawEmail).digest('hex').slice(0, 24)}`;
      const subRef = doc(db, 'newsletterSubscribers', subId);
      const existingSnap = await getDoc(subRef).catch(() => null);
      const now = serverTimestamp();
      const consentText =
        'Opted in to Delarico price alerts, new arrivals & promotional offers under the Kenya Data Protection Act (2019).';

      if (existingSnap && existingSnap.exists()) {
        const existingData = existingSnap.data() as Record<string, unknown>;
        if (existingData.status === 'subscribed') {
          res.json({ ok: true, alreadySubscribed: true, email: rawEmail });
          return;
        }
        await commitGatedOps([
          {
            type: 'update',
            ref: subRef,
            gateKey: `news_${subId}`,
            data: {
              consentAccepted: true,
              consentPolicyVersion: 'KE-DPA-2026-v1',
              consentText,
              source,
              status: 'subscribed',
              updatedAt: now,
            },
          },
        ]);
        res.json({ ok: true, alreadySubscribed: false, email: rawEmail });
        return;
      }

      await commitGatedOps([
        {
          type: 'set',
          ref: subRef,
          gateKey: `news_${subId}`,
          data: {
            email: rawEmail,
            consentAccepted: true,
            consentPolicyVersion: 'KE-DPA-2026-v1',
            consentText,
            source,
            status: 'subscribed',
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);
      res.json({ ok: true, alreadySubscribed: false, email: rawEmail });
    } catch (err) {
      console.error('Newsletter subscribe error:', err);
      res.status(500).json({ error: 'Unable to save subscription right now.' });
    }
  });

  app.post('/api/newsletter/unsubscribe', async (req: Request, res: Response) => {
    try {
      const rawEmail = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawEmail)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      const subId = `sub_${crypto.createHash('sha256').update(rawEmail).digest('hex').slice(0, 24)}`;
      const subRef = doc(db, 'newsletterSubscribers', subId);
      const existingSnap = await getDoc(subRef).catch(() => null);
      if (!existingSnap || !existingSnap.exists()) {
        res.json({ ok: true, email: rawEmail });
        return;
      }
      await commitGatedOps([
        {
          type: 'update',
          ref: subRef,
          gateKey: `news_${subId}`,
          data: {
            status: 'unsubscribed',
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true, email: rawEmail });
    } catch (err) {
      console.error('Newsletter unsubscribe error:', err);
      res.status(500).json({ error: 'Unable to process unsubscribe request.' });
    }
  });

  // =========================================================================
  // Protected Operations Console Endpoints (Admin Only)
  // =========================================================================
  app.get('/api/ops/bootstrap', requireAdmin, async (_req: AuthedRequest, res: Response) => {
    try {
      const [
        orders,
        quotations,
        rawCustomers,
        enquiries,
        stockMovements,
        affiliates,
        affiliateReferrals,
        newsletterSubscribers,
        pubReviewsSnap,
        hiddenReviews,
        activeProdsSnap,
        inactiveProds,
      ] = await Promise.all([
        queryVaultDocs<Record<string, unknown>>(collection(db, 'orders')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'quotations')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'users')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'enquiries')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'stockMovements')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'affiliates')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'affiliateReferrals')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'newsletterSubscribers')),
        getDocs(query(collection(db, 'reviews'), where('status', '==', 'published'))),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'reviews'), where('status', '==', 'hidden')),
        getDocs(query(collection(db, 'products'), where('isActive', '==', true))),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'products'), where('isActive', '==', false)),
      ]);

      const customers = await Promise.all(
        rawCustomers.map(async (cust) => {
          const uid = String(cust.uid || cust.id || '');
          if (!uid) return cust;
          try {
            const contactSnap = await getDoc(doc(db, 'users', uid, 'private', 'contact'));
            if (contactSnap.exists()) {
              const contact = sanitizeClientDoc<Record<string, unknown>>(
                contactSnap.id,
                contactSnap.data()
              );
              return {
                ...cust,
                email: contact.email || '',
                phone: contact.phone || '',
                defaultCounty: contact.defaultCounty || '',
                defaultTown: contact.defaultTown || '',
                defaultStreetAddress: contact.defaultStreetAddress || '',
              };
            }
          } catch {
            // ignore missing contact doc
          }
          return cust;
        })
      );

      const pubReviews = pubReviewsSnap.docs.map((d) =>
        sanitizeClientDoc<Record<string, unknown>>(d.id, d.data())
      );
      const revMap = new Map<string, Record<string, unknown>>();
      [...pubReviews, ...hiddenReviews].forEach((r) => revMap.set(String(r.id), r));
      const reviews = Array.from(revMap.values());

      const activeProds = activeProdsSnap.docs.map((d) =>
        sanitizeClientDoc<Record<string, unknown>>(d.id, d.data())
      );
      const prodMap = new Map<string, Record<string, unknown>>();
      [...activeProds, ...inactiveProds].forEach((p) => prodMap.set(String(p.id), p));
      const allProducts = Array.from(prodMap.values());

      res.json({
        orders,
        quotations,
        customers,
        enquiries,
        stockMovements,
        affiliates,
        affiliateReferrals,
        newsletterSubscribers,
        reviews,
        allProducts,
      });
    } catch (err) {
      console.error('Ops bootstrap error:', err);
      res.status(500).json({ error: 'Failed to load operations data.' });
    }
  });

  app.get('/api/ops/orders/:id/items', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const orderId = String(req.params.id);
      const items = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'orders', orderId, 'items')
      );
      res.json({ items });
    } catch (err) {
      console.error('Ops order items error:', err);
      res.status(500).json({ error: 'Failed to load order items.' });
    }
  });

  app.patch('/api/ops/orders/:id/payment', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const orderId = String(req.params.id);
      const nextPaymentStatus = String(req.body?.paymentStatus || 'pending_verification');
      if (!['pending_verification', 'verified_paid', 'failed', 'refunded'].includes(nextPaymentStatus)) {
        res.status(400).json({ error: 'Invalid payment status.' });
        return;
      }

      const orders = await queryVaultDocs<Record<string, unknown>>(collection(db, 'orders'));
      const order = orders.find((o) => o.id === orderId);
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }

      const nextOrderStatus =
        nextPaymentStatus === 'verified_paid' && order.orderStatus === 'pending'
          ? 'confirmed'
          : String(order.orderStatus);

      const now = serverTimestamp();
      const ops: GatedWriteOp[] = [
        {
          type: 'update',
          ref: doc(db, 'orders', orderId),
          gateKey: `ord_${orderId}`,
          data: {
            paymentStatus: nextPaymentStatus,
            orderStatus: nextOrderStatus,
            updatedAt: now,
          },
        },
      ];

      if (nextPaymentStatus === 'verified_paid' && order.paymentStatus !== 'verified_paid') {
        const customerId = String(order.customerId);
        const customers = await queryVaultDocs<Record<string, unknown>>(
          collection(db, 'users'),
          where('uid', '==', customerId)
        );
        if (customers[0]) {
          const settingsSnap = await getDoc(doc(db, 'settings', 'corporate'));
          const ptsPer1000 = Number(settingsSnap.data()?.loyaltyPointsPer1000Kes ?? 10);
          const earned = Math.floor(Number(order.totalKes || 0) / 1000) * ptsPer1000;
          ops.push({
            type: 'update',
            ref: doc(db, 'users', customerId),
            gateKey: `usr_${customerId}`,
            data: {
              loyaltyPoints: Number(customers[0].loyaltyPoints || 0) + earned,
              updatedAt: now,
            },
          });
        }

        const items = await queryVaultDocs<Record<string, unknown>>(
          collection(db, 'orders', orderId, 'items')
        );
        for (const item of items) {
          const productId = String(item.productId || '');
          if (!productId) continue;
          const prodRef = doc(db, 'products', productId);
          let prodSnap = null;
          try {
            prodSnap = await getDoc(prodRef);
          } catch {
            prodSnap = null;
          }
          if (prodSnap && prodSnap.exists()) {
            const pData = prodSnap.data();
            const prevStock = Number(pData.stockQty || 0);
            const qty = Number(item.quantity || 0);
            const newStock = Math.max(0, prevStock - qty);
            const movRef = doc(collection(db, 'stockMovements'));
            ops.push(
              {
                type: 'update',
                ref: prodRef,
                gateKey: `prod_${productId}`,
                data: {
                  stockQty: newStock,
                  updatedAt: now,
                },
              },
              {
                type: 'set',
                ref: movRef,
                gateKey: `stk_${movRef.id}`,
                data: {
                  productId,
                  productName: String(pData.name || item.productName || 'Material').slice(0, 160),
                  sku: String(pData.sku || item.sku || 'DLR').slice(0, 64),
                  movementType: 'sale',
                  quantityDelta: -qty,
                  previousStock: prevStock,
                  newStock,
                  reason: `Verified Order #${order.orderNumber}`.slice(0, 300),
                  performedByUid: req.session!.uid,
                  vaultKey: SERVER_VAULT_KEY,
                  createdAt: now,
                },
              }
            );
          }
        }

        const orderReferrals = await queryVaultDocs<Record<string, unknown>>(
          collection(db, 'affiliateReferrals'),
          where('orderId', '==', orderId)
        );
        for (const refItem of orderReferrals) {
          if (refItem.status === 'pending') {
            const affUid = String(refItem.affiliateUid);
            const commKes = Number(refItem.commissionKes || 0);
            const affDocs = await queryVaultDocs<Record<string, unknown>>(
              collection(db, 'affiliates'),
              where('uid', '==', affUid)
            );
            const aff = affDocs[0];
            ops.push({
              type: 'update',
              ref: doc(db, 'affiliateReferrals', String(refItem.id)),
              gateKey: `affref_${refItem.id}`,
              data: {
                status: 'approved',
                updatedAt: now,
              },
            });
            if (aff) {
              ops.push({
                type: 'update',
                ref: doc(db, 'affiliates', affUid),
                gateKey: `aff_${affUid}`,
                data: {
                  pendingCommissionKes: Math.max(0, Number(aff.pendingCommissionKes || 0) - commKes),
                  availableCommissionKes: Number(aff.availableCommissionKes || 0) + commKes,
                  updatedAt: now,
                },
              });
            }
          }
        }
      } else if (nextPaymentStatus === 'failed' || nextPaymentStatus === 'refunded') {
        const orderReferrals = await queryVaultDocs<Record<string, unknown>>(
          collection(db, 'affiliateReferrals'),
          where('orderId', '==', orderId)
        );
        for (const refItem of orderReferrals) {
          if (refItem.status === 'pending') {
            const affUid = String(refItem.affiliateUid);
            const commKes = Number(refItem.commissionKes || 0);
            const affDocs = await queryVaultDocs<Record<string, unknown>>(
              collection(db, 'affiliates'),
              where('uid', '==', affUid)
            );
            const aff = affDocs[0];
            ops.push({
              type: 'update',
              ref: doc(db, 'affiliateReferrals', String(refItem.id)),
              gateKey: `affref_${refItem.id}`,
              data: {
                status: 'cancelled',
                updatedAt: now,
              },
            });
            if (aff) {
              ops.push({
                type: 'update',
                ref: doc(db, 'affiliates', affUid),
                gateKey: `aff_${affUid}`,
                data: {
                  pendingCommissionKes: Math.max(0, Number(aff.pendingCommissionKes || 0) - commKes),
                  updatedAt: now,
                },
              });
            }
          }
        }
      }

      await commitGatedOps(ops);
      res.json({ ok: true, paymentStatus: nextPaymentStatus, orderStatus: nextOrderStatus });
    } catch (err) {
      console.error('Verify payment error:', err);
      res.status(500).json({ error: 'Failed to update payment status.' });
    }
  });

  app.patch('/api/ops/orders/:id/status', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const orderId = String(req.params.id);
      const orderStatus = String(req.body?.orderStatus || 'pending');
      if (!['pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled'].includes(orderStatus)) {
        res.status(400).json({ error: 'Invalid order status.' });
        return;
      }
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'orders', orderId),
          gateKey: `ord_${orderId}`,
          data: {
            orderStatus,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true, orderStatus });
    } catch (err) {
      console.error('Update order status error:', err);
      res.status(500).json({ error: 'Failed to update order status.' });
    }
  });

  app.post('/api/ops/products', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const prodId = String(req.body?.id || `prod-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
      const now = serverTimestamp();
      const payload = req.body as Record<string, unknown>;
      const rawName = (String(payload.name || 'Construction Material').trim() || 'Construction Material').slice(0, 160);
      const name = rawName.length >= 2 ? rawName : 'Material Item';
      const rawDesc = String(payload.description || name).trim();
      const description = (
        rawDesc.length >= 10
          ? rawDesc
          : `${rawDesc || 'Hardware item'} — Certified Kenyan hardware supply from Delarico.`
      ).slice(0, 3000);
      const rawSlug = String(payload.slug || name || prodId)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const slug = (rawSlug.length >= 2 ? rawSlug : `item-${Date.now()}`).slice(0, 160);
      const rawSku = String(payload.sku || `DLR-${Date.now()}`)
        .toUpperCase()
        .replace(/[^A-Z0-9-]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const sku = (rawSku.length >= 2 ? rawSku : `DLR-${Date.now()}`).slice(0, 64);

      const categoryId = String(payload.categoryId || 'cat-building-materials').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || 'cat-building-materials';
      const categoryNameRaw = String(payload.categoryName || 'Building Materials').trim().slice(0, 100);
      const specSummaryRaw = String(payload.specSummary || 'KEBS Certified Yard Stock').trim().slice(0, 1000);
      const dimensionsRaw = String(payload.dimensions || 'Standard').trim().slice(0, 200);
      const brandRaw = String(payload.brand || 'Delarico').trim().slice(0, 120);
      const unitRaw = String(payload.unit || 'Piece').trim().slice(0, 40);
      const imgs = hasOnlyRealPhotos(payload.images)
        ? (payload.images as string[]).slice(0, 6)
        : resolveRealGalleryForRecord(prodId, { name, categoryName: categoryNameRaw, slug });

      await commitGatedOps([
        {
          type: 'set',
          ref: doc(db, 'products', prodId),
          gateKey: `prod_${prodId}`,
          data: {
            name,
            slug,
            sku,
            categoryId,
            categoryName: categoryNameRaw.length >= 2 ? categoryNameRaw : 'Materials',
            description,
            specSummary: specSummaryRaw.length >= 2 ? specSummaryRaw : 'Yard Certified',
            dimensions: dimensionsRaw.length >= 1 ? dimensionsRaw : 'Standard',
            brand: brandRaw.length >= 1 ? brandRaw : 'Delarico',
            unit: unitRaw.length >= 1 ? unitRaw : 'Piece',
            priceKes: Math.max(0, Number(payload.priceKes ?? 0)),
            wholesalePriceKes: Math.max(0, Number(payload.wholesalePriceKes ?? 0)),
            minWholesaleQty: Math.max(1, Number(payload.minWholesaleQty ?? 1)),
            compareAtPriceKes: Math.max(0, Number(payload.compareAtPriceKes ?? 0)),
            stockQty: Math.max(0, Number(payload.stockQty ?? 0)),
            lowStockThreshold: Math.max(0, Number(payload.lowStockThreshold ?? 10)),
            weightKg: Math.max(0, Number(payload.weightKg ?? 1)),
            images: imgs,
            featured: Boolean(payload.featured),
            bestSeller: Boolean(payload.bestSeller),
            onPromotion: Boolean(payload.onPromotion),
            promoLabel: String(payload.promoLabel || '').trim().slice(0, 80),
            isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
            ratingAvg: Math.min(5, Math.max(0, Number(payload.ratingAvg ?? 5.0))),
            reviewCount: Math.max(0, Number(payload.reviewCount ?? 0)),
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);
      invalidateCatalogCaches();
      res.json({ ok: true, id: prodId });
    } catch (err) {
      console.error('Create product error:', err);
      res.status(500).json({ error: 'Failed to create product.' });
    }
  });

  app.put('/api/ops/products/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const prodId = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const prodRef = doc(db, 'products', prodId);
      const payload = req.body as Record<string, unknown>;
      const patchData: Record<string, unknown> = {
        vaultKey: SERVER_VAULT_KEY,
        updatedAt: serverTimestamp(),
      };
      if (payload.name !== undefined) {
        const n = String(payload.name).trim().slice(0, 160);
        if (n.length >= 2) patchData.name = n;
      }
      if (payload.slug !== undefined) {
        const s = String(payload.slug).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 160);
        if (s.length >= 2) patchData.slug = s;
      }
      if (payload.sku !== undefined) {
        const k = String(payload.sku).toUpperCase().replace(/[^A-Z0-9-]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 64);
        if (k.length >= 2) patchData.sku = k;
      }
      if (payload.categoryId !== undefined) patchData.categoryId = String(payload.categoryId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
      if (payload.categoryName !== undefined) patchData.categoryName = (String(payload.categoryName).trim() || 'Materials').slice(0, 100);
      if (typeof payload.description === 'string') {
        const d = payload.description.trim();
        patchData.description = (
          d.length >= 10 ? d : `${d || 'Hardware item'} — Certified Kenyan hardware supply.`
        ).slice(0, 3000);
      }
      if (payload.specSummary !== undefined) patchData.specSummary = (String(payload.specSummary).trim() || 'Yard Certified').slice(0, 1000);
      if (payload.dimensions !== undefined) patchData.dimensions = (String(payload.dimensions).trim() || 'Standard').slice(0, 200);
      if (payload.brand !== undefined) patchData.brand = (String(payload.brand).trim() || 'Delarico').slice(0, 120);
      if (payload.unit !== undefined) patchData.unit = (String(payload.unit).trim() || 'Piece').slice(0, 40);
      if (payload.priceKes !== undefined) patchData.priceKes = Math.max(0, Number(payload.priceKes));
      if (payload.wholesalePriceKes !== undefined) patchData.wholesalePriceKes = Math.max(0, Number(payload.wholesalePriceKes));
      if (payload.minWholesaleQty !== undefined) patchData.minWholesaleQty = Math.max(1, Number(payload.minWholesaleQty));
      if (payload.compareAtPriceKes !== undefined) patchData.compareAtPriceKes = Math.max(0, Number(payload.compareAtPriceKes));
      if (payload.stockQty !== undefined) patchData.stockQty = Math.max(0, Number(payload.stockQty));
      if (payload.lowStockThreshold !== undefined) patchData.lowStockThreshold = Math.max(0, Number(payload.lowStockThreshold));
      if (payload.weightKg !== undefined) patchData.weightKg = Math.max(0, Number(payload.weightKg));
      if (hasOnlyRealPhotos(payload.images)) patchData.images = (payload.images as string[]).slice(0, 6);
      if (payload.featured !== undefined) patchData.featured = Boolean(payload.featured);
      if (payload.bestSeller !== undefined) patchData.bestSeller = Boolean(payload.bestSeller);
      if (payload.onPromotion !== undefined) patchData.onPromotion = Boolean(payload.onPromotion);
      if (payload.promoLabel !== undefined) patchData.promoLabel = String(payload.promoLabel).trim().slice(0, 80);
      if (payload.isActive !== undefined) patchData.isActive = Boolean(payload.isActive);

      await commitGatedOps([
        {
          type: 'update',
          ref: prodRef,
          gateKey: `prod_${prodId}`,
          data: patchData,
        },
      ]);
      invalidateCatalogCaches();
      res.json({ ok: true });
    } catch (err) {
      console.error('Update product error:', err);
      res.status(500).json({ error: 'Failed to update product.' });
    }
  });

  app.patch('/api/ops/products/:id/quick', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const prodId = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const prodRef = doc(db, 'products', prodId);
      const prodSnap = await getDoc(prodRef);
      if (!prodSnap.exists()) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }
      const updates: Record<string, unknown> = {
        vaultKey: SERVER_VAULT_KEY,
        updatedAt: serverTimestamp(),
      };
      if (req.body?.priceKes !== undefined) updates.priceKes = Math.max(0, Number(req.body.priceKes));
      if (req.body?.wholesalePriceKes !== undefined)
        updates.wholesalePriceKes = Math.max(0, Number(req.body.wholesalePriceKes));
      if (req.body?.compareAtPriceKes !== undefined)
        updates.compareAtPriceKes = Math.max(0, Number(req.body.compareAtPriceKes));
      if (req.body?.stockQty !== undefined) updates.stockQty = Math.max(0, Number(req.body.stockQty));
      if (req.body?.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);
      if (req.body?.onPromotion !== undefined) updates.onPromotion = Boolean(req.body.onPromotion);
      if (req.body?.featured !== undefined) updates.featured = Boolean(req.body.featured);
      if (req.body?.bestSeller !== undefined) updates.bestSeller = Boolean(req.body.bestSeller);

      await commitGatedOps([
        {
          type: 'update',
          ref: prodRef,
          gateKey: `prod_${prodId}`,
          data: updates,
        },
      ]);
      invalidateCatalogCaches();
      res.json({ ok: true });
    } catch (err) {
      console.error('Quick update product error:', err);
      res.status(500).json({ error: 'Failed to update product price or stock.' });
    }
  });

  app.delete('/api/ops/products/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const prodId = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
      await commitGatedOps([
        {
          type: 'delete',
          ref: doc(db, 'products', prodId),
          gateKey: `prod_${prodId}`,
        },
      ]);
      invalidateCatalogCaches();
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete product error:', err);
      res.status(500).json({ error: 'Failed to delete product.' });
    }
  });

  app.post('/api/ops/categories', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const catId = String(req.body?.id || `cat-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
      const now = serverTimestamp();
      const payload = req.body as Record<string, unknown>;
      const name = (String(payload.name || 'Hardware Category').trim() || 'Hardware Category').slice(0, 100);
      const rawSlug = String(payload.slug || name).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '');
      const slug = (rawSlug.length >= 2 ? rawSlug : `cat-${Date.now()}`).slice(0, 100);
      const rawDesc = String(payload.description || '').trim();
      const description = (rawDesc.length >= 5 ? rawDesc : `${name} materials supplied by Delarico.`).slice(0, 500);
      const imageUrl = String(payload.imageUrl || '/assets/aistudio/cement.jpg').slice(0, 120000);

      await commitGatedOps([
        {
          type: 'set',
          ref: doc(db, 'categories', catId),
          gateKey: `cat_${catId}`,
          data: {
            name: name.length >= 2 ? name : 'Hardware',
            slug,
            description,
            imageUrl,
            sortOrder: Number(payload.sortOrder ?? 10),
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);
      invalidateCatalogCaches();
      res.json({ ok: true, id: catId });
    } catch (err) {
      console.error('Create category error:', err);
      res.status(500).json({ error: 'Failed to create category.' });
    }
  });

  app.delete('/api/ops/categories/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const catId = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
      await commitGatedOps([
        {
          type: 'delete',
          ref: doc(db, 'categories', catId),
          gateKey: `cat_${catId}`,
        },
      ]);
      invalidateCatalogCaches();
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete category error:', err);
      res.status(500).json({ error: 'Failed to delete category.' });
    }
  });

  app.post('/api/ops/stock-movements', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const productId = String(req.body?.productId || '');
      const movementType = ['restock', 'adjustment', 'return', 'sale'].includes(req.body?.movementType)
        ? req.body.movementType
        : 'restock';
      const rawDelta = Number(req.body?.quantityDelta || 0);
      const signedDelta = movementType === 'adjustment' ? rawDelta : Math.abs(rawDelta);
      const reason = String(req.body?.reason || 'Yard stock update').trim().slice(0, 300);

      const prodRef = doc(db, 'products', productId);
      const prodSnap = await getDoc(prodRef);
      if (!prodSnap.exists()) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }
      const pData = prodSnap.data();
      const previousStock = Number(pData.stockQty || 0);
      const newStock = Math.max(0, previousStock + signedDelta);
      const movRef = doc(collection(db, 'stockMovements'));
      const now = serverTimestamp();

      await commitGatedOps([
        {
          type: 'update',
          ref: prodRef,
          gateKey: `prod_${productId}`,
          data: {
            stockQty: newStock,
            updatedAt: now,
          },
        },
        {
          type: 'set',
          ref: movRef,
          gateKey: `stk_${movRef.id}`,
          data: {
            productId,
            productName: String(pData.name || 'Material').slice(0, 160),
            sku: String(pData.sku || 'DLR').slice(0, 64),
            movementType,
            quantityDelta: signedDelta,
            previousStock,
            newStock,
            reason,
            performedByUid: req.session!.uid,
            vaultKey: SERVER_VAULT_KEY,
            createdAt: now,
          },
        },
      ]);
      res.json({ ok: true, newStock });
    } catch (err) {
      console.error('Stock movement error:', err);
      res.status(500).json({ error: 'Failed to post stock movement.' });
    }
  });

  app.get('/api/ops/quotations/:id/items', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const quoteId = String(req.params.id);
      const items = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'quotations', quoteId, 'items')
      );
      res.json({ items });
    } catch (err) {
      console.error('Load quote items error:', err);
      res.status(500).json({ error: 'Failed to load quotation items.' });
    }
  });

  app.patch('/api/ops/quotations/:id/respond', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const quoteId = String(req.params.id);
      const quotedTotalKes = Math.max(0, Number(req.body?.quotedTotalKes || 0));
      const adminResponseNotes = String(req.body?.adminResponseNotes || '').trim().slice(0, 1500);
      const validUntil = String(req.body?.validUntil || '14 Days').trim().slice(0, 40);

      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'quotations', quoteId),
          gateKey: `qt_${quoteId}`,
          data: {
            quotedTotalKes,
            adminResponseNotes,
            validUntil,
            status: 'quoted',
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Respond quotation error:', err);
      res.status(500).json({ error: 'Failed to dispatch quotation offer.' });
    }
  });

  app.patch('/api/ops/customers/:uid/wholesale', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const targetUid = String(req.params.uid);
      const wholesaleApproved = Boolean(req.body?.wholesaleApproved);
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'users', targetUid),
          gateKey: `usr_${targetUid}`,
          data: {
            wholesaleApproved,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true, wholesaleApproved });
    } catch (err) {
      console.error('Toggle wholesale error:', err);
      res.status(500).json({ error: 'Failed to update customer wholesale status.' });
    }
  });

  app.patch('/api/ops/customers/:uid', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const targetUid = String(req.params.uid).replace(/[^a-zA-Z0-9_-]/g, '');
      const userRef = doc(db, 'users', targetUid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        res.status(404).json({ error: 'Customer account not found.' });
        return;
      }

      const now = serverTimestamp();
      const pubUpdates: Record<string, unknown> = { updatedAt: now };
      if (req.body?.displayName !== undefined)
        pubUpdates.displayName = String(req.body.displayName).trim().slice(0, 120) || 'Customer';
      if (req.body?.accountType !== undefined) {
        const at = String(req.body.accountType);
        pubUpdates.accountType = ['individual', 'contractor', 'institution'].includes(at)
          ? at
          : 'individual';
      }
      if (req.body?.companyName !== undefined)
        pubUpdates.companyName = String(req.body.companyName).trim().slice(0, 160);
      if (req.body?.registrationRef !== undefined)
        pubUpdates.registrationRef = String(req.body.registrationRef).trim().slice(0, 80);
      if (req.body?.wholesaleApproved !== undefined)
        pubUpdates.wholesaleApproved = Boolean(req.body.wholesaleApproved);
      if (req.body?.loyaltyPoints !== undefined)
        pubUpdates.loyaltyPoints = Math.max(0, Math.round(Number(req.body.loyaltyPoints || 0)));

      const ops: GatedWriteOp[] = [
        {
          type: 'update',
          ref: userRef,
          gateKey: `usr_${targetUid}`,
          data: pubUpdates,
        },
      ];

      const contactRef = doc(db, 'users', targetUid, 'private', 'contact');
      const contactSnap = await getDoc(contactRef).catch(() => null);
      if (
        contactSnap &&
        contactSnap.exists() &&
        (req.body?.email !== undefined ||
          req.body?.phone !== undefined ||
          req.body?.defaultCounty !== undefined ||
          req.body?.defaultTown !== undefined)
      ) {
        const privUpdates: Record<string, unknown> = { updatedAt: now };
        if (req.body?.email !== undefined)
          privUpdates.email = String(req.body.email).trim().slice(0, 254) || 'customer@delarico.co.ke';
        if (req.body?.phone !== undefined)
          privUpdates.phone = String(req.body.phone).trim().slice(0, 30);
        if (req.body?.defaultCounty !== undefined)
          privUpdates.defaultCounty = String(req.body.defaultCounty).trim().slice(0, 80);
        if (req.body?.defaultTown !== undefined)
          privUpdates.defaultTown = String(req.body.defaultTown).trim().slice(0, 80);

        ops.push({
          type: 'update',
          ref: contactRef,
          gateKey: `usrpriv_${targetUid}_contact`,
          data: privUpdates,
        });
      }

      await commitGatedOps(ops);
      res.json({ ok: true });
    } catch (err) {
      console.error('Update customer error:', err);
      res.status(500).json({ error: 'Failed to update customer account.' });
    }
  });

  app.delete('/api/ops/customers/:uid', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const targetUid = String(req.params.uid).replace(/[^a-zA-Z0-9_-]/g, '');
      if (targetUid === 'usr_executive_01') {
        res.status(400).json({ error: 'Cannot delete primary operations account.' });
        return;
      }

      const ops: GatedWriteOp[] = [];
      const contactRef = doc(db, 'users', targetUid, 'private', 'contact');
      const contactSnap = await getDoc(contactRef).catch(() => null);
      if (contactSnap && contactSnap.exists()) {
        const phone = String(contactSnap.data()?.phone || '');
        const norm = normalizeKenyanPhone(phone);
        if (norm) {
          const acctId = makeAccountIdFromPhone(norm);
          ops.push({
            type: 'delete',
            ref: doc(db, 'authAccounts', acctId),
            gateKey: `auth_${acctId}`,
          });
        }
        ops.push({
          type: 'delete',
          ref: contactRef,
          gateKey: `usrpriv_${targetUid}_contact`,
        });
      }

      ops.push({
        type: 'delete',
        ref: doc(db, 'users', targetUid),
        gateKey: `usr_${targetUid}`,
      });

      await commitGatedOps(ops);
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete customer error:', err);
      res.status(500).json({ error: 'Failed to delete customer account.' });
    }
  });

  app.patch('/api/ops/enquiries/:id/reply', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const enqId = String(req.params.id);
      const adminReply = String(req.body?.adminReply || '').trim().slice(0, 1500);
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'enquiries', enqId),
          gateKey: `enq_${enqId}`,
          data: {
            adminReply,
            status: 'resolved',
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Reply enquiry error:', err);
      res.status(500).json({ error: 'Failed to send reply.' });
    }
  });

  app.patch('/api/ops/reviews/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const revId = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const revRef = doc(db, 'reviews', revId);
      const revSnap = await getDoc(revRef);
      if (!revSnap.exists()) {
        res.status(404).json({ error: 'Review not found.' });
        return;
      }
      const rData = revSnap.data();
      const nextStatus = req.body?.status === 'hidden' ? 'hidden' : 'published';
      const verifiedBuyer =
        req.body?.verifiedBuyer !== undefined ? Boolean(req.body.verifiedBuyer) : Boolean(rData.verifiedBuyer);
      const now = serverTimestamp();

      const ops: GatedWriteOp[] = [
        {
          type: 'update',
          ref: revRef,
          gateKey: `rev_${revId}`,
          data: {
            status: nextStatus,
            verifiedBuyer,
            vaultKey: SERVER_VAULT_KEY,
            updatedAt: now,
          },
        },
      ];

      const productId = String(rData.productId || '');
      if (productId) {
        const prodRef = doc(db, 'products', productId);
        const [prodSnap, pubRevsSnap] = await Promise.all([
          getDoc(prodRef),
          getDocs(
            query(
              collection(db, 'reviews'),
              where('productId', '==', productId),
              where('status', '==', 'published')
            )
          ),
        ]);
        if (prodSnap.exists()) {
          const ratingMap = new Map<string, number>();
          pubRevsSnap.docs.forEach((d) => ratingMap.set(d.id, Number(d.data()?.rating || 5)));
          if (nextStatus === 'published') {
            ratingMap.set(revId, Number(rData.rating || 5));
          } else {
            ratingMap.delete(revId);
          }
          const activeRatings = Array.from(ratingMap.values());
          const reviewCount = activeRatings.length;
          const ratingAvg =
            reviewCount > 0
              ? Number((activeRatings.reduce((a, b) => a + b, 0) / reviewCount).toFixed(1))
              : 5.0;
          ops.push({
            type: 'update',
            ref: prodRef,
            gateKey: `prod_${productId}`,
            data: { ratingAvg, reviewCount, updatedAt: now },
          });
        }
      }

      await commitGatedOps(ops);
      res.json({ ok: true, status: nextStatus, verifiedBuyer });
    } catch (err) {
      console.error('Moderate review error:', err);
      res.status(500).json({ error: 'Failed to update review.' });
    }
  });

  app.delete('/api/ops/reviews/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const revId = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const revRef = doc(db, 'reviews', revId);
      const revSnap = await getDoc(revRef);
      const ops: GatedWriteOp[] = [
        {
          type: 'delete',
          ref: revRef,
          gateKey: `rev_${revId}`,
        },
      ];
      if (revSnap.exists()) {
        const productId = String(revSnap.data()?.productId || '');
        if (productId) {
          const prodRef = doc(db, 'products', productId);
          const [prodSnap, revsSnap] = await Promise.all([
            getDoc(prodRef),
            getDocs(
              query(
                collection(db, 'reviews'),
                where('productId', '==', productId),
                where('status', '==', 'published')
              )
            ),
          ]);
          if (prodSnap.exists()) {
            const activeRatings = revsSnap.docs
              .filter((d) => d.id !== revId)
              .map((d) => Number(d.data()?.rating || 5));
            const reviewCount = activeRatings.length;
            const ratingAvg =
              reviewCount > 0
                ? Number((activeRatings.reduce((a, b) => a + b, 0) / reviewCount).toFixed(1))
                : 5.0;
            ops.push({
              type: 'update',
              ref: prodRef,
              gateKey: `prod_${productId}`,
              data: { ratingAvg, reviewCount, updatedAt: serverTimestamp() },
            });
          }
        }
      }
      await commitGatedOps(ops);
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete review error:', err);
      res.status(500).json({ error: 'Failed to delete review.' });
    }
  });

  app.patch('/api/ops/newsletter/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const subId = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const status = req.body?.status === 'unsubscribed' ? 'unsubscribed' : 'subscribed';
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'newsletterSubscribers', subId),
          gateKey: `news_${subId}`,
          data: {
            status,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true, status });
    } catch (err) {
      console.error('Update subscriber error:', err);
      res.status(500).json({ error: 'Failed to update subscriber.' });
    }
  });

  app.delete('/api/ops/newsletter/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const subId = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
      await commitGatedOps([
        {
          type: 'delete',
          ref: doc(db, 'newsletterSubscribers', subId),
          gateKey: `news_${subId}`,
        },
      ]);
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete subscriber error:', err);
      res.status(500).json({ error: 'Failed to delete subscriber.' });
    }
  });

  app.post('/api/ops/promotions', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const promoId = String(req.body?.id || `promo-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
      const now = serverTimestamp();
      const payload = req.body as Record<string, unknown>;
      const rawCode = String(payload.code || `DLR${Date.now().toString().slice(-4)}`)
        .toUpperCase()
        .replace(/[^A-Z0-9-]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 32);
      const code = rawCode.length >= 3 ? rawCode : `DLR${Date.now().toString().slice(-4)}`;
      const rawTitle = (String(payload.title || 'Yard Promotion').trim() || 'Yard Promotion').slice(0, 120);
      const title = rawTitle.length >= 2 ? rawTitle : 'Yard Promotion';
      const rawDesc = String(payload.description || title).trim();
      const description = (rawDesc.length >= 5 ? rawDesc : `${title} — Valid at Delarico Yard.`).slice(0, 400);
      const discountType = payload.discountType === 'fixed_kes' ? 'fixed_kes' : 'percentage';
      const discountValue = Math.max(1, Number(payload.discountValue ?? 5));
      const minOrderKes = Math.max(0, Number(payload.minOrderKes ?? 0));
      const expiresAt = String(payload.expiresAt || '2026-12-31').trim().slice(0, 40);

      await commitGatedOps([
        {
          type: 'set',
          ref: doc(db, 'promotions', promoId),
          gateKey: `promo_${promoId}`,
          data: {
            code,
            title,
            description,
            discountType,
            discountValue,
            minOrderKes,
            isActive: true,
            expiresAt,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);
      invalidateCatalogCaches();
      res.json({ ok: true, id: promoId });
    } catch (err) {
      console.error('Create promo error:', err);
      res.status(500).json({ error: 'Failed to create promotion.' });
    }
  });

  app.patch('/api/ops/promotions/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const promoId = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const promoRef = doc(db, 'promotions', promoId);
      const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (req.body?.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);
      if (req.body?.discountValue !== undefined)
        updates.discountValue = Math.max(1, Number(req.body.discountValue));
      if (req.body?.minOrderKes !== undefined)
        updates.minOrderKes = Math.max(0, Number(req.body.minOrderKes));
      await commitGatedOps([
        {
          type: 'update',
          ref: promoRef,
          gateKey: `promo_${promoId}`,
          data: updates,
        },
      ]);
      invalidateCatalogCaches();
      res.json({ ok: true });
    } catch (err) {
      console.error('Update promo error:', err);
      res.status(500).json({ error: 'Failed to update promotion.' });
    }
  });

  app.delete('/api/ops/promotions/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const promoId = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
      await commitGatedOps([
        {
          type: 'delete',
          ref: doc(db, 'promotions', promoId),
          gateKey: `promo_${promoId}`,
        },
      ]);
      invalidateCatalogCaches();
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete promo error:', err);
      res.status(500).json({ error: 'Failed to delete promotion.' });
    }
  });

  app.post('/api/ops/branches', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const branchId = String(req.body?.id || `branch-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '');
      const now = serverTimestamp();
      const payload = req.body as Record<string, unknown>;
      const name = (String(payload.name || 'Regional Yard').trim() || 'Regional Yard').slice(0, 120);
      const rawCode = String(payload.code || `DLR-${Date.now().toString().slice(-3)}`)
        .toUpperCase()
        .replace(/[^A-Z0-9-]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 24);
      const code = rawCode.length >= 2 ? rawCode : `BR-${Date.now().toString().slice(-3)}`;
      const county = (String(payload.county || 'Siaya').trim() || 'Siaya').slice(0, 80);
      const town = (String(payload.town || 'Siaya Town').trim() || 'Siaya Town').slice(0, 80);
      const rawAddr = String(payload.address || `${town} Supply Yard`).trim();
      const address = (rawAddr.length >= 5 ? rawAddr : `${rawAddr} Yard Depot`).slice(0, 250);
      const rawPhone = String(payload.phone || '+254 706 824489').trim();
      const phone = (rawPhone.length >= 7 ? rawPhone : '+254 706 824489').slice(0, 30);
      const managerName = (String(payload.managerName || 'Branch Operations Manager').trim() || 'Branch Operations Manager').slice(0, 120);
      const deliveryZones = (String(payload.deliveryZones || `${town} CBD, Surrounding Estates`).trim() || `${town} CBD`).slice(0, 300);

      await commitGatedOps([
        {
          type: 'set',
          ref: doc(db, 'branches', branchId),
          gateKey: `branch_${branchId}`,
          data: {
            name: name.length >= 2 ? name : 'Regional Yard',
            code,
            county: county.length >= 2 ? county : 'Siaya',
            town: town.length >= 2 ? town : 'Siaya Town',
            address,
            phone,
            managerName: managerName.length >= 2 ? managerName : 'Yard Manager',
            deliveryZones: deliveryZones.length >= 2 ? deliveryZones : 'Local Region',
            isHeadquarters: false,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
        },
      ]);
      invalidateCatalogCaches();
      res.json({ ok: true, id: branchId });
    } catch (err) {
      console.error('Create branch error:', err);
      res.status(500).json({ error: 'Failed to create branch.' });
    }
  });

  app.patch('/api/ops/branches/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const branchId = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
      const branchRef = doc(db, 'branches', branchId);
      const snap = await getDoc(branchRef);
      if (!snap.exists()) {
        res.status(404).json({ error: 'Branch not found.' });
        return;
      }
      const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (req.body?.name !== undefined) {
        const n = String(req.body.name).trim().slice(0, 120);
        if (n.length >= 2) updates.name = n;
      }
      if (req.body?.phone !== undefined) {
        const p = String(req.body.phone).trim().slice(0, 30);
        if (p.length >= 7) updates.phone = p;
      }
      if (req.body?.address !== undefined) {
        const a = String(req.body.address).trim().slice(0, 250);
        if (a.length >= 5) updates.address = a;
      }
      if (req.body?.deliveryZones !== undefined) {
        const z = String(req.body.deliveryZones).trim().slice(0, 300);
        if (z.length >= 2) updates.deliveryZones = z;
      }
      if (req.body?.isActive !== undefined) updates.isActive = Boolean(req.body.isActive);

      await commitGatedOps([
        {
          type: 'update',
          ref: branchRef,
          gateKey: `branch_${branchId}`,
          data: updates,
        },
      ]);
      invalidateCatalogCaches();
      res.json({ ok: true });
    } catch (err) {
      console.error('Update branch error:', err);
      res.status(500).json({ error: 'Failed to update branch.' });
    }
  });

  app.delete('/api/ops/branches/:id', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const branchId = String(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
      if (branchId === 'branch-siaya-hq') {
        res.status(400).json({ error: 'Primary Siaya Headquarters branch cannot be removed.' });
        return;
      }
      await commitGatedOps([
        {
          type: 'delete',
          ref: doc(db, 'branches', branchId),
          gateKey: `branch_${branchId}`,
        },
      ]);
      invalidateCatalogCaches();
      res.json({ ok: true });
    } catch (err) {
      console.error('Delete branch error:', err);
      res.status(500).json({ error: 'Failed to delete branch.' });
    }
  });

  app.put('/api/ops/settings', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const incoming = req.body as Record<string, unknown>;
      const merged = {
        businessName: String(incoming.businessName ?? DEFAULT_STORE_SETTINGS.businessName).trim().slice(0, 160) || DEFAULT_STORE_SETTINGS.businessName,
        tagline: String(incoming.tagline ?? DEFAULT_STORE_SETTINGS.tagline).trim().slice(0, 160) || DEFAULT_STORE_SETTINGS.tagline,
        location: String(incoming.location ?? DEFAULT_STORE_SETTINGS.location).trim().slice(0, 160) || DEFAULT_STORE_SETTINGS.location,
        whatsappNumber: String(incoming.whatsappNumber ?? DEFAULT_STORE_SETTINGS.whatsappNumber).trim().slice(0, 30) || DEFAULT_STORE_SETTINGS.whatsappNumber,
        email: String(incoming.email ?? DEFAULT_STORE_SETTINGS.email).trim().slice(0, 254) || DEFAULT_STORE_SETTINGS.email,
        website: String(incoming.website ?? DEFAULT_STORE_SETTINGS.website).trim().slice(0, 160) || DEFAULT_STORE_SETTINGS.website,
        mpesaPaybillNumber: String(incoming.mpesaPaybillNumber ?? DEFAULT_STORE_SETTINGS.mpesaPaybillNumber).trim().slice(0, 30),
        mpesaAccountPrefix: String(incoming.mpesaAccountPrefix ?? DEFAULT_STORE_SETTINGS.mpesaAccountPrefix).trim().slice(0, 30),
        mpesaTillNumber: String(incoming.mpesaTillNumber ?? DEFAULT_STORE_SETTINGS.mpesaTillNumber).trim().slice(0, 30),
        mpesaStkEnabled: Boolean(incoming.mpesaStkEnabled ?? DEFAULT_STORE_SETTINGS.mpesaStkEnabled),
        bankName: String(incoming.bankName ?? DEFAULT_STORE_SETTINGS.bankName).trim().slice(0, 120),
        bankAccountName: String(incoming.bankAccountName ?? DEFAULT_STORE_SETTINGS.bankAccountName).trim().slice(0, 160),
        bankAccountNumber: String(incoming.bankAccountNumber ?? DEFAULT_STORE_SETTINGS.bankAccountNumber).trim().slice(0, 60),
        bankBranch: String(incoming.bankBranch ?? DEFAULT_STORE_SETTINGS.bankBranch).trim().slice(0, 120),
        codEnabled: Boolean(incoming.codEnabled ?? DEFAULT_STORE_SETTINGS.codEnabled),
        freeDeliveryThresholdKes: Math.max(0, Number(incoming.freeDeliveryThresholdKes ?? DEFAULT_STORE_SETTINGS.freeDeliveryThresholdKes)),
        loyaltyPointsPer1000Kes: Math.max(0, Number(incoming.loyaltyPointsPer1000Kes ?? DEFAULT_STORE_SETTINGS.loyaltyPointsPer1000Kes)),
        isPublic: true,
        updatedAt: serverTimestamp(),
      };
      await commitGatedOps([
        {
          type: 'set',
          ref: doc(db, 'settings', 'corporate'),
          gateKey: 'set_corporate',
          data: merged,
        },
      ]);
      invalidateCatalogCaches();
      res.json({ ok: true });
    } catch (err) {
      console.error('Update settings error:', err);
      res.status(500).json({ error: 'Failed to save settings.' });
    }
  });

  app.get('/api/ops/analytics', requireAdmin, async (_req: AuthedRequest, res: Response) => {
    try {
      const [orders, quotations, customers, affiliates, subscribers, prodsSnap] = await Promise.all([
        queryVaultDocs<Record<string, unknown>>(collection(db, 'orders')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'quotations')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'users')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'affiliates')),
        queryVaultDocs<Record<string, unknown>>(collection(db, 'newsletterSubscribers')),
        getDocs(query(collection(db, 'products'), where('isActive', '==', true))),
      ]);

      const activeOrders = orders.filter((o) => o.orderStatus !== 'cancelled');
      const paidRevenueKes = activeOrders
        .filter((o) => o.paymentStatus === 'verified_paid')
        .reduce((sum, o) => sum + Number(o.totalKes || 0), 0);
      const pendingVerificationKes = activeOrders
        .filter((o) => o.paymentStatus === 'pending_verification')
        .reduce((sum, o) => sum + Number(o.totalKes || 0), 0);
      const lowStockProducts = prodsSnap.docs
        .map((d) => sanitizeClientDoc<Record<string, unknown>>(d.id, d.data()))
        .filter((p) => Number(p.stockQty || 0) <= Number(p.lowStockThreshold || 0));

      res.json({
        totalOrders: orders.length,
        paidRevenueKes,
        pendingVerificationKes,
        openQuotations: quotations.filter((q) => q.status === 'submitted').length,
        totalCustomers: customers.length,
        activeAffiliates: affiliates.filter((a) => a.status === 'active').length,
        affiliateCommissionOwedKes: affiliates.reduce(
          (sum, a) => sum + Number(a.availableCommissionKes || 0),
          0
        ),
        activeSubscribers: subscribers.filter((s) => s.status === 'subscribed').length,
        lowStockCount: lowStockProducts.length,
        lowStockProducts: lowStockProducts.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          stockQty: p.stockQty,
        })),
      });
    } catch (err) {
      console.error('Ops analytics error:', err);
      res.status(500).json({ error: 'Failed to compute operations analytics.' });
    }
  });

  app.patch('/api/ops/affiliates/:uid/rate', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const affUid = String(req.params.uid);
      const commissionRatePct = Math.min(5, Math.max(3, Number(req.body?.commissionRatePct || 3)));
      const status = req.body?.status === 'suspended' ? 'suspended' : 'active';
      await commitGatedOps([
        {
          type: 'update',
          ref: doc(db, 'affiliates', affUid),
          gateKey: `aff_${affUid}`,
          data: {
            commissionRatePct,
            status,
            updatedAt: serverTimestamp(),
          },
        },
      ]);
      res.json({ ok: true, commissionRatePct, status });
    } catch (err) {
      console.error('Update affiliate rate error:', err);
      res.status(500).json({ error: 'Failed to update affiliate tier.' });
    }
  });

  app.patch('/api/ops/affiliates/:uid/settle', requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const affUid = String(req.params.uid);
      const affDocs = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'affiliates'),
        where('uid', '==', affUid)
      );
      const aff = affDocs[0];
      if (!aff) {
        res.status(404).json({ error: 'Affiliate not found.' });
        return;
      }
      const payoutAmount = Number(aff.availableCommissionKes || 0);
      if (payoutAmount <= 0) {
        res.status(400).json({ error: 'No approved commission balance available to settle.' });
        return;
      }

      const referrals = await queryVaultDocs<Record<string, unknown>>(
        collection(db, 'affiliateReferrals'),
        where('affiliateUid', '==', affUid)
      );
      const now = serverTimestamp();
      const ops: GatedWriteOp[] = [
        {
          type: 'update',
          ref: doc(db, 'affiliates', affUid),
          gateKey: `aff_${affUid}`,
          data: {
            availableCommissionKes: 0,
            paidCommissionKes: Number(aff.paidCommissionKes || 0) + payoutAmount,
            payoutRequested: false,
            updatedAt: now,
          },
        },
      ];
      for (const r of referrals) {
        if (r.status === 'approved') {
          ops.push({
            type: 'update',
            ref: doc(db, 'affiliateReferrals', String(r.id)),
            gateKey: `affref_${r.id}`,
            data: {
              status: 'paid',
              updatedAt: now,
            },
          });
        }
      }
      await commitGatedOps(ops);
      res.json({ ok: true, settledKes: payoutAmount });
    } catch (err) {
      console.error('Settle affiliate payout error:', err);
      res.status(500).json({ error: 'Failed to settle affiliate payout.' });
    }
  });

  app.post('/api/ops/seed', requireAdmin, async (_req: AuthedRequest, res: Response) => {
    try {
      await syncCatalogToFirestore(true);
      invalidateCatalogCaches();
      res.json({ ok: true });
    } catch (err) {
      console.error('Manual seed error:', err);
      res.status(500).json({ error: 'Failed to synchronize catalogue.' });
    }
  });

  // =========================================================================
  // AI Customer Service Chatbot (Server-Side Gemini 3.8 Flash)
  // =========================================================================
  let cachedCatalogSummary = '';
  let cachedCatalogSummaryAt = 0;

  async function getAiPlatformContext(): Promise<string> {
    if (cachedCatalogSummary && Date.now() - cachedCatalogSummaryAt < 60_000) {
      return cachedCatalogSummary;
    }

    let prodList: Array<Record<string, unknown>> = INITIAL_PRODUCTS as unknown as Array<Record<string, unknown>>;
    let promoList: Array<Record<string, unknown>> = INITIAL_PROMOTIONS as unknown as Array<Record<string, unknown>>;
    let branchList: Array<Record<string, unknown>> = INITIAL_BRANCHES as unknown as Array<Record<string, unknown>>;
    let corpSettings: Record<string, unknown> = DEFAULT_STORE_SETTINGS as unknown as Record<string, unknown>;

    try {
      const [prodsSnap, promosSnap, branchSnap, settingsSnap] = await Promise.race([
        Promise.all([
          getDocs(query(collection(db, 'products'), where('isActive', '==', true))),
          getDocs(query(collection(db, 'promotions'), where('isActive', '==', true))),
          getDocs(query(collection(db, 'branches'), where('isActive', '==', true))),
          getDoc(doc(db, 'settings', 'corporate')),
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Catalog context lookup timeout')), 2500)
        ),
      ]);
      if (!prodsSnap.empty) {
        prodList = prodsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      if (!promosSnap.empty) {
        promoList = promosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      if (!branchSnap.empty) {
        branchList = branchSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      if (settingsSnap.exists()) {
        corpSettings = settingsSnap.data() as Record<string, unknown>;
      }
    } catch {
      // Fallback cleanly to seed catalog constants
    }

    const catalogLines = prodList
      .map(
        (p) =>
          `- ${String(p.name)} (SKU: ${String(p.sku)}, Category: ${String(p.categoryName)}, Unit: ${String(p.unit)}): Retail KES ${Number(p.priceKes || 0).toLocaleString()}, Bulk Wholesale (${Number(p.minWholesaleQty || 1)}+ units) KES ${Number(p.wholesalePriceKes || 0).toLocaleString()}, In stock: ${Number(p.stockQty || 0)}`
      )
      .join('\n');

    const promoLines = promoList
      .map(
        (pr) =>
          `- Code ${String(pr.code)}: ${Number(pr.discountValue || pr.discountPercent || 0)}% off${pr.minOrderKes || pr.minSpendKes ? ` (min order KES ${Number(pr.minOrderKes || pr.minSpendKes).toLocaleString()})` : ''}`
      )
      .join('\n');

    const branchLines = branchList
      .map(
        (b) =>
          `- ${String(b.name)}: ${String(b.address || b.town)}, Hours: ${String(b.hours || 'Mon–Sat 7:30am–6:00pm')}, Phone: ${String(b.phone || '+254 706 824489')}`
      )
      .join('\n');

    cachedCatalogSummary = `BUSINESS: ${String(corpSettings.businessName || 'DELARICO MERCHANDISE & SUPPLIES')} — "${String(corpSettings.tagline || 'Built on Quality. Driven by Trust.')}"
LOCATION: ${String(corpSettings.location || 'Siaya, Kenya')}
OFFICIAL WHATSAPP / CALL / M-PESA NUMBER: ${String(corpSettings.whatsappNumber || '+254 706 824489')} (Paybill / Till / Pochi Recipient: ${String(corpSettings.bankAccountName || 'DELARICO MERCHANDISE & SUPPLIES')})
EMAIL: ${String(corpSettings.email || 'info@delarico.co.ke')}
FREE DELIVERY THRESHOLD: Orders above KES ${Number(corpSettings.freeDeliveryThresholdKes || 80000).toLocaleString()} within Siaya County qualify for free delivery; fast dispatch across Kisumu, Bondo, Ugenya, Busia, Kisii & nationwide transport arranged.

PLATFORM FEATURES & PAGES:
- Direct Online Store (/ and /products): Choose quantity right on product cards and click Add to Cart; cart is always visible at the top bar; checkout supports M-Pesa, Cash on Delivery (COD), and direct WhatsApp order.
- Quick Search: Instant autocomplete bar at the top header (shortcut '/' or Ctrl+K) to find any material, brand, or SKU.
- Saved Items / Wishlist (/saved or top Saved button): Save preferred construction materials in localStorage for later, move all to cart, or send via WhatsApp.
- Compare Specs (/compare): Side-by-side comparison of dimensions, weight, compliance, retail & bulk prices.
- Bulk Project Quotations & BOQ (/request-quote): Request custom proforma quotes for large house/school/commercial builds.
- Customer Star Ratings & Reviews: Available on every product detail page (/product/<slug>); customers can rate 1–5 stars directly.
- Affiliate Program (/affiliates): Free to join; share referral links and earn 3%–5% commission (Cement/Steel/Roofing 3%, Timber/Doors/Windows 4%, Hardware/Tools/Paint/Water Tanks 5%), paid via M-Pesa.
- Customer Account (/account): Quick phone + password registration & login to track orders, loyalty points, saved items, and quotes.

ACTIVE PROMOTIONS:
${promoLines || '- Code CONTRACTOR5: 5% off contractor orders'}

BRANCHES & COLLECTION YARDS:
${branchLines}

LIVE PRODUCT CATALOGUE & KES PRICING:
${catalogLines}`;

    cachedCatalogSummaryAt = Date.now();
    return cachedCatalogSummary;
  }

  app.post('/api/ai/chat', aiRateLimit, async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(503).json({
          error:
            'AI Customer Care requires a GEMINI_API_KEY in Settings > Secrets. Meanwhile, reach us directly on WhatsApp +254 706 824489.',
        });
        return;
      }

      const message = String(req.body?.message || '').trim().slice(0, 1000);
      if (!message) {
        res.status(400).json({ error: 'Please type a question for Customer Care.' });
        return;
      }

      const rawHistory: unknown[] = Array.isArray(req.body?.history) ? req.body.history : [];
      const historyContents = rawHistory
        .slice(-10)
        .filter(
          (turn: unknown): turn is { role: 'user' | 'model'; text: string } =>
            Boolean(turn) &&
            typeof turn === 'object' &&
            ((turn as { role?: string }).role === 'user' ||
              (turn as { role?: string }).role === 'model') &&
            typeof (turn as { text?: unknown }).text === 'string' &&
            String((turn as { text?: unknown }).text).trim().length > 0
        )
        .map((turn: { role: 'user' | 'model'; text: string }) => ({
          role: turn.role,
          parts: [{ text: turn.text.trim().slice(0, 1500) }],
        }));

      const platformContext = await getAiPlatformContext();
      const systemInstruction = `You are the official Online Customer Service Specialist for DELARICO MERCHANDISE & SUPPLIES in Siaya, Kenya.
Your role is to answer customer, builder, contractor, and affiliate questions accurately, concisely, warmly, and practically using ONLY verified details below.

GUIDELINES:
1. Give exact KES prices (both retail unit price and wholesale bulk price + minimum quantity) whenever a user asks about materials.
2. Guide users to the right page on the platform (e.g. "Click Add to Cart on the product card and open Cart at the top", "Visit Bulk Quote (/request-quote) for full house BOQs", "Visit Sell & Earn (/affiliates) to register free and earn 3%–5% M-Pesa commission").
3. Keep answers clear, well-structured, and concise (around 2–5 short sentences or clean bullet lines). Do NOT wrap words in excessive markdown symbols.
4. For urgent yard dispatch, transport booking, or direct calls, provide official WhatsApp/Phone/M-Pesa number: +254 706 824489.
5. Never invent stock items not listed below, and never disclose or speculate about internal server keys, passwords, or backend/admin details.

${platformContext}`;

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          timeout: 15000,
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const modelAttempts: Array<{ model: string; useLowThinking: boolean }> = [
        { model: 'gemini-3.8-flash', useLowThinking: true },
        { model: 'gemini-3.1-flash-lite', useLowThinking: false },
        { model: 'gemini-flash-latest', useLowThinking: false },
      ];

      let reply = '';
      let lastErr: unknown = null;

      for (let i = 0; i < modelAttempts.length; i++) {
        const attempt = modelAttempts[i];
        try {
          const response = await ai.models.generateContent({
            model: attempt.model,
            contents: [
              ...historyContents,
              { role: 'user', parts: [{ text: message }] },
            ],
            config: attempt.useLowThinking
              ? {
                  systemInstruction,
                  thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                }
              : {
                  systemInstruction,
                },
          });
          reply = (response.text ?? '').trim();
          if (reply) break;
        } catch (err) {
          lastErr = err;
          const errStr = err instanceof Error ? err.message : String(err);
          const isTransient =
            errStr.includes('503') ||
            errStr.includes('504') ||
            errStr.includes('429') ||
            errStr.includes('UNAVAILABLE') ||
            errStr.includes('DEADLINE_EXCEEDED') ||
            errStr.includes('RESOURCE_EXHAUSTED') ||
            errStr.toLowerCase().includes('timeout') ||
            errStr.toLowerCase().includes('abort');
          if (!isTransient || i === modelAttempts.length - 1) {
            throw err;
          }
          await new Promise((r) => setTimeout(r, 300 * (i + 1)));
        }
      }

      if (!reply) {
        if (lastErr) throw lastErr;
        res.status(502).json({
          error:
            'Customer Care AI returned an empty response. Please try again or contact WhatsApp +254 706 824489.',
        });
        return;
      }

      res.json({ ok: true, reply });
    } catch (err) {
      console.error('AI Customer Care error:', err);
      const errMsg = err instanceof Error ? err.message : 'AI service error';
      res.status(500).json({
        error: `AI Customer Care is temporarily unavailable (${errMsg}). Please contact us on WhatsApp +254 706 824489.`,
      });
    }
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled API error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error.',
    });
  });

  return app;
}
