# DELARICO MERCHANDISE & SUPPLIES — Firestore Security Specification

## 1. Data Invariants & Master Sources of Truth

1. **Default-Deny Catch-All**: All paths not explicitly matched are denied (`allow read, write: if false;`).
2. **Trusted Admin & Server Capability Gates**:
   - Client-side Firebase Auth admin rights derive strictly from an existing `/admins/{uid}` document or the bootstrapped verified owner email (`calvincewise@gmail.com` with `request.auth.token.email_verified == true`).
   - Backend Express server mutations (`server.ts`) execute atomically via `/writeTickets/{gateKey}` (`allow read: if false;`), verifying a 64-char cryptographic `seal` and `authorizedAt == request.time` (`hasServerWriteGate(gateKey)`). Tickets cannot be read by any client or replayed outside the atomic batch.
   - Server-managed private documents carry a 64-char `vaultKey` stripped before API serialization. Client SDK `get`/`list` branches explicitly enforce `!('vaultKey' in existing())`, preventing any client from ever reading a vaulted record or discovering `vaultKey`.
3. **Verified Identity on Client Writes**: Direct client write operations require `request.auth != null && request.auth.token.email_verified == true`.
4. **Split-Collection PII & Auth Isolation**:
   - Phone authentication hashes in `/authAccounts/{accountId}` have `allow get: if false;` and require `hasServerVaultRead()` on `list`.
   - User contact PII (`email`, `phone`, `defaultStreetAddress`) is isolated inside `/users/{userId}/private/{docId}` and readable on client strictly by `!('vaultKey' in existing()) && (request.auth.uid == userId || isAdmin())`.
5. **Payment Verification Invariant**: Neither customers nor order-creation endpoints can create an order with `paymentStatus == 'verified_paid'` or self-verify payment on update. All newly created orders must start at `paymentStatus == 'pending_verification'` and `orderStatus == 'pending'`.
6. **Master Gate Relational Sync**:
   - `/orders/{orderId}/items/{itemId}` requires the parent `/orders/{orderId}` document to exist (or `existsAfter` during batch creation).
   - `/quotations/{quotationId}/items/{itemId}` requires the parent `/quotations/{quotationId}` document to exist (or `existsAfter` during batch creation).
   - `/users/{userId}/addresses/{addressId}` requires the parent `/users/{userId}` document to exist.
7. **Terminal State Locking**: Once an Order reaches `delivered` or `cancelled`, or a Quotation reaches `accepted` or `declined`, non-admin client updates are permanently rejected.
8. **Temporal Integrity**: Every `createdAt` on `create` and `updatedAt` on `update` must equal `request.time`. Immortal fields (`createdAt`, `customerId`, `uid`, `orderNumber`, `quoteNumber`) cannot be mutated on update.
9. **Query Enforcer (`allow list`)**: No blanket `isSignedIn()` list rules exist. Public catalog collections check `resource.data.isActive == true` (or `status == 'published'` / `isPublic == true`); user-scoped collections check `resource.data.customerId == request.auth.uid`, `resource.data.uid == request.auth.uid`, `resource.data.affiliateUid == request.auth.uid`, or `hasServerVaultRead()`.
10. **Affiliate Commission Integrity & PII Protection**: `/affiliates/{affiliateId}` and `/affiliateReferrals/{referralId}` enforce `commissionRatePct >= 3 && commissionRatePct <= 5`, start with zeroed balances (`pendingCommissionKes == 0`, `availableCommissionKes == 0`, `paidCommissionKes == 0`) on creation, require parent `/users/{affiliateId}` and `/orders/{orderId}` existence, and protect `mpesaPhone` PII via `vaultKey` / owner-or-admin read restrictions.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 — Self-Verified Paid Order Injection**:
   `POST /orders/ord_1` with `{ paymentStatus: "verified_paid", orderStatus: "confirmed", customerId: auth.uid, ... }` -> **PERMISSION_DENIED** (violates Payment Verification Invariant).
2. **Payload 2 — Shadow Field Privilege Escalation on User Profile**:
   `POST /users/uid_1` with `{ uid: "uid_1", ..., wholesaleApproved: true, isAdmin: true }` -> **PERMISSION_DENIED** (`hasOnly` blocks shadow key `isAdmin` and creation rule forces `wholesaleApproved == false`).
3. **Payload 3 — Unverified Admin Email Spoof**:
   `POST /products/prod_1` with `auth.token = { email: "calvincewise@gmail.com", email_verified: false }` -> **PERMISSION_DENIED** (`isAdmin()` requires `email_verified == true`).
4. **Payload 4 — Cross-User PII & Vault Harvesting**:
   `GET /users/victim_uid/private/contact` or `GET /authAccounts/acct_1` by `attacker_uid` -> **PERMISSION_DENIED** (`allow get: if false` on `authAccounts`, and PII Isolation + `!('vaultKey' in existing())` blocks cross-user reads).
5. **Payload 5 — Unfiltered Order Scraping (`list` without owner/vault filter)**:
   `LIST /orders` by `attacker_uid` without `where('customerId', '==', 'attacker_uid')` -> **PERMISSION_DENIED** (`resource.data` check rejects unfiltered queries).
6. **Payload 6 — Terminal Order Resurrection**:
   `PATCH /orders/ord_cancelled` changing `orderStatus` from `"cancelled"` back to `"pending"` by owner -> **PERMISSION_DENIED** (Terminal State Locking).
7. **Payload 7 — ID Poisoning / Resource Exhaustion**:
   `POST /orders/ord$bad!id/items/item_1` or 2KB `notes` string -> **PERMISSION_DENIED** (`isValidId` regex `^[a-zA-Z0-9_\-]+$` and strict `.size()` bounds).
8. **Payload 8 — Orphaned Order Item Creation**:
   `POST /orders/non_existent_order/items/item_1` without parent order in DB or batch -> **PERMISSION_DENIED** (`exists` / `existsAfter` Master Gate fails).
9. **Payload 9 — Loyalty Points Self-Inflation on Profile Update**:
   `PATCH /users/uid_1` modifying `loyaltyPoints: 999999` by customer -> **PERMISSION_DENIED** (`affectedKeys().hasOnly(...)` excludes `loyaltyPoints` for non-admin updates).
10. **Payload 10 — Forged Backdated Timestamp or Replayed WriteTicket**:
    `POST /reviews/rev_1` with `createdAt: Timestamp(2020-01-01)` or stale `writeTickets` `authorizedAt != request.time` -> **PERMISSION_DENIED**.
11. **Payload 11 — Fake Verified Buyer Badge on Review**:
    `POST /reviews/rev_1` with `verifiedBuyer: true` by customer -> **PERMISSION_DENIED** (customer creation forces `verifiedBuyer == false`).
12. **Payload 12 — Value Poisoning on Order Payment Reference**:
    `PATCH /orders/ord_1` updating `paymentReference` to an integer `12345` or 500-char string -> **PERMISSION_DENIED** (`isValidOrder(incoming())` wraps the entire `allow update` block).
