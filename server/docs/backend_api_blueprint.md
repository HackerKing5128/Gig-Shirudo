# Gig Shirudo — Backend API Blueprint
## Team CodeBlooded | Schema Reference Guide for Node.js/Express Developers

---

## 1. THE VERDICT — What Was Merged and Why

| Decision | Winner | Reason |
|---|---|---|
| `platforms` table vs enum | **Schema B** | Table allows adding new platforms via INSERT without an ALTER TYPE migration |
| `user_sessions` | **Schema B** | Custom JWT auth needs server-side revocation. Without this, stolen tokens can't be invalidated before expiry |
| `weather_logs` | **Schema B** | Local API cache prevents hammering OpenWeather on every cron tick; also feeds Phase-2 ML |
| `user_activity_logs` | **Schema B** | The README's "ground truth" anti-spoofing layer (platform activity cross-check) needs its own table |
| `fraud_flags` (case management) | **Schema B** | Has `is_resolved` + resolution workflow, which `fraud_signals` lacked |
| `fraud_signals` (per-signal evidence) | **Schema A** | Granular per-check rows become Phase-2 ML training data. BOTH tables kept: signals = evidence, flags = verdict |
| `disruption_events` | **Schema A** | Better lifecycle status enum (`detected → confirmed → processing → completed → false_alarm`). Charlie's `is_processed` boolean was too binary |
| `weekly_risk_profiles` | **Schema A** (enhanced) | Pre-computed premium audit artifact. Added `subscription_streak_weeks`, `lifetime_subscribed_weeks`, `days_since_last_sub` from our discussion |
| `user_subscription_history` | **Schema B (002)** | Immutable lifecycle event log. Enables the cherry-picker detection query and Phase-2 seasonal ML |
| `user_trust_metrics` | **Schema B (002)** | Centralized, pre-aggregated score components with a GENERATED total column |
| GIST exclusion constraint on policies | **Schema A** | DB-level guarantee prevents two overlapping ACTIVE policies. btree_gist extension required |
| `CONSTRAINT chk_payment_reference` | **Schema B** | DB-level enforcement that premium txn has policy_id and payout txn has claim_id |
| `razorpay_signature` + `retry_count` + `upi_id` | **Schema B** | Essential for production Razorpay webhook verification and retry logic |
| `TIMESTAMPTZ` everywhere | **Schema B** | Correct for a live Indian product. Always store in UTC, display in IST |
| Auto `updated_at` trigger | **Schema B** | `update_updated_at_column()` function is cleaner than manual updates in every controller |
| `plan_code` + `min/max_premium` on plans | **Schema B** | Machine-readable code for API responses; floor/ceiling prevent absurd premium values |
| Split fraud trigger (BEFORE + AFTER) | **Schema C (new)** | Charlie's single BEFORE trigger tried to INSERT fraud_flags before `claim.id` existed — a FK violation. Correctly split into two triggers |

---

## 2. ARCHITECTURE DECISIONS EVERY DEVELOPER MUST UNDERSTAND

### 2.1 Soft Delete Strategy

**Rule**: EVERY query that reads from `users` MUST include `WHERE deleted_at IS NULL` unless you have an explicit reason not to (e.g., an admin "view deleted accounts" endpoint).

```js
// ✅ CORRECT
const user = await db.query(
  'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]
);

// ❌ WRONG — returns deleted users
const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
```

**Soft delete flow**:
```js
// DELETE endpoint — never use SQL DELETE on users
await db.query(
  'UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
  [userId]
);
// Also: revoke all sessions
await db.query(
  'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1',
  [userId]
);
```

**Why partial indexes matter**: `idx_users_email_active` is a UNIQUE index `WHERE deleted_at IS NULL`. This means two users can share the same email if one is deleted — intentional, allowing re-registration. The index also means Postgres only maintains index entries for active users, keeping lookups fast.

---

### 2.2 Custom Auth Session Management

`user_sessions` is your server-side session store. Your JWT strategy should work like this:

```
Login → Create user_sessions row → Return access_token (JWT)
         └── JWT payload: { session_id: uuid, user_id: int, exp }

Every Request:
  1. Verify JWT signature
  2. Extract session_id from payload
  3. SELECT * FROM user_sessions WHERE id = $session_id AND revoked_at IS NULL AND expires_at > NOW()
  4. If no row → 401 Unauthorized (token revoked or expired)
  5. UPDATE user_sessions SET last_used_at = NOW() WHERE id = $session_id

Logout → UPDATE user_sessions SET revoked_at = NOW() WHERE id = $session_id
Logout All Devices → UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $userId
```

**IMPORTANT**: Store `SHA-256(jwt_token)` in `access_token_hash`, not the token itself. If your DB is ever compromised, raw tokens can't be extracted and replayed.

---

### 2.3 The Parametric Engine Flow

This is the core of Gig Shirudo. The cron service (`node-cron`) runs the following flow:

```
Every 30 minutes:
  1. Poll OpenWeather API for each active city
  2. INSERT into weather_logs (cache raw response)
  3. Evaluate each active trigger threshold against latest weather_logs row
  4. If threshold crossed:
     a. Check cooldown: any disruption_events with same (trigger_id, city_id)
        in last triggers.cooldown_hours? → skip if yes
     b. INSERT into disruption_events (status='detected')
        — the UNIQUE constraint on (trigger_id, city_id, event_time) makes
          this safe to retry; duplicates are silently ignored on conflict
  5. A separate fan-out worker picks up events WHERE status='detected':
     a. UPDATE disruption_events SET status='confirmed'
     b. SELECT all active user_policies WHERE city_id = event.city_id
        AND end_date > NOW() AND status = 'active'
     c. For each policy: INSERT INTO claims (ON CONFLICT DO NOTHING)
        — idx_claims_no_duplicate prevents double-pays on retry
     d. UPDATE disruption_events SET status='completed', claims_generated=N
```

**Key edge cases**:
- Always check `triggers.cooldown_hours` BEFORE inserting a disruption_event
- The `UNIQUE (trigger_id, city_id, event_time)` constraint is the cron idempotency guard
- `idx_claims_no_duplicate` on `(user_id, disruption_event_id)` is the payout idempotency guard

---

### 2.4 The Legitimacy Score & Fraud Auto-Flagging

When a claim is inserted, two DB triggers fire automatically:

1. **`trg_claims_set_review_status` (BEFORE INSERT)**: If `legitimacy_score < 50`, sets `status = 'under_review'` before the row is written.
2. **`trg_claims_auto_fraud_flag` (AFTER INSERT)**: If `legitimacy_score < 50`, inserts a `fraud_flags` row. Fires AFTER because it needs `claims.id` for the FK.

Your backend legitimacy scoring service runs BEFORE the INSERT:
```js
const legitimacyScore = await computeLegitimacyScore(userId, claimData);
// Score = 40% platform_activity + 30% location_match + 20% history + 10% device
await db.query(
  'INSERT INTO claims (..., legitimacy_score) VALUES (..., $1)',
  [legitimacyScore]
);
// DB trigger handles the rest automatically
```

**Payout decision matrix** (implement in your claims service):
```js
if (score >= 80) → status stays 'approved' → trigger instant payout
if (score >= 50) → status stays 'pending' → queue for 2-4h review
if (score < 50)  → DB trigger sets 'under_review' automatically
```

---

### 2.5 The Subscription Streak System

The `track_subscription_continuity()` trigger fires BEFORE INSERT on `user_policies`. It:
- Computes the gap between this policy's `start_date` and the previous policy's `end_date`
- If gap ≤ 2 days: increments `cycle_number`, applies loyalty discount
- If gap > 2 days: resets `loyalty_discount_percent = 0`, logs 'lapsed' + 'reactivated' events

Your backend only needs to INSERT the policy row with the basic fields. The trigger handles all continuity fields automatically.

```js
// Your controller just does this — trigger handles the rest
await db.query(`
  INSERT INTO user_policies
    (user_id, plan_id, city_id, risk_profile_id, start_date, end_date, calculated_premium, risk_multiplier)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
`, [userId, planId, cityId, riskProfileId, startDate, endDate, premium, multiplier]);
```

**Cherry-picker detection query** (run in your weekly fraud analytics):
```sql
SELECT
    user_id,
    COUNT(*) AS total_subscriptions,
    COUNT(CASE WHEN season IN ('monsoon', 'summer') THEN 1 END) AS seasonal_subs,
    ROUND(
        COUNT(CASE WHEN season IN ('monsoon', 'summer') THEN 1 END)::NUMERIC
        / COUNT(*) * 100, 2
    ) AS seasonal_percent
FROM user_subscription_history
WHERE event_type IN ('subscribed', 'reactivated')
GROUP BY user_id
HAVING COUNT(*) >= 3
   AND ROUND(
       COUNT(CASE WHEN season IN ('monsoon', 'summer') THEN 1 END)::NUMERIC
       / COUNT(*) * 100, 2
   ) > 75
ORDER BY seasonal_percent DESC;
```

---

## 3. TABLE-BY-TABLE DATA DICTIONARY

---

### `platforms`
**Purpose**: Master list of delivery platforms. Add new platforms via INSERT, never via schema migration.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | VARCHAR | Unique. Display name: "Zomato" |
| `code` | VARCHAR | Unique. Machine key: "zomato" |
| `api_endpoint` | VARCHAR | Future platform API base URL for activity cross-check |
| `is_active` | BOOLEAN | Set FALSE to disable a platform without deleting it |

**API Usage**: GET `/api/platforms` returns only `WHERE is_active = TRUE`.

---

### `cities`
**Purpose**: Supported cities. `risk_multiplier` is the city-level factor in the premium formula.

| Column | Type | Notes |
|---|---|---|
| `risk_multiplier` | DECIMAL(4,2) | Delhi = 1.50 (frequent disruptions), Bangalore = 1.00 (baseline) |
| `timezone` | VARCHAR | Default 'Asia/Kolkata'. Used by cron service for local-time event scheduling |

**Premium Formula**:
```
computed_premium = plan.base_premium_percent * user.weekly_income
                    * city.risk_multiplier
                    * user_risk_multiplier
CLAMP to [plan.min_premium, plan.max_premium]
```

---

### `insurance_plans`
**Purpose**: The product catalogue. `plan_code` is used in API responses and frontend routing.

| Column | Type | Notes |
|---|---|---|
| `plan_code` | VARCHAR | 'BASIC' / 'STANDARD' / 'ELITE'. Used in URLs: GET `/api/plans/BASIC` |
| `base_premium_percent` | DECIMAL | Default 5.0%. Per README: "Base Premium = 5% of weekly income" |
| `min_premium` | DECIMAL | Floor (₹49). Prevents ₹5 premiums for very low income workers |
| `max_premium` | DECIMAL | Ceiling (₹600). Prevents absurdly high premiums |
| `max_claims_per_cycle` | SMALLINT | Backend must check `user_policies.claims_count < plan.max_claims_per_cycle` before creating a claim |

---

### `triggers`
**Purpose**: Defines the 5 parametric event types and their evaluation rules.

| Column | Type | Notes |
|---|---|---|
| `event_type` | ENUM | Fixed set. Add new types via `ALTER TYPE trigger_event_type ADD VALUE` |
| `operator` | ENUM | gt/gte/lt/lte/eq — cron service evaluates `detected_value {operator} threshold_value` |
| `api_endpoint` | VARCHAR | Cron reads this to know which URL to poll. Avoids hardcoding in Node.js |
| `cooldown_hours` | SMALLINT | Cron MUST check this before inserting a new disruption_event |

**Cron cooldown check**:
```sql
SELECT id FROM disruption_events
WHERE trigger_id = $1 AND city_id = $2
  AND status IN ('confirmed', 'completed')
  AND event_time > NOW() - (SELECT cooldown_hours FROM triggers WHERE id = $1) * INTERVAL '1 hour'
LIMIT 1;
-- If row found → skip, still in cooldown
```

---

### `admins`
**Purpose**: Separate auth table for admin portal. Never mix with `users`.

| Column | Type | Notes |
|---|---|---|
| `role` | ENUM | super_admin > admin > reviewer > analyst > support |
| `permissions` | JSONB | Override fine-grained permissions beyond role defaults. e.g., `{ "can_export_data": true }` |
| `created_by` | INT (self-FK) | Audit trail: which admin created this account |

**IMPORTANT edge case**: `idx_admins_email_active` is `WHERE is_active = TRUE`. This means deactivating an admin frees their email slot in the unique index. If you re-activate them, their email is back in the index. This is intentional — a deactivated admin's email can be taken by a new account.

---

### `users`
**Purpose**: Gig worker accounts. The central entity everything else references.

| Column | Type | Notes |
|---|---|---|
| `platform_id` | INT FK → platforms | SET NULL on platform delete — user account is preserved |
| `city_id` | INT FK → cities | SET NULL on city delete — user account is preserved |
| `is_verified` | BOOLEAN | DENORMALIZED. Set TRUE when `verifications.status` flips to 'verified'. Avoids a JOIN on auth |
| `legitimacy_score` | SMALLINT | Lifetime snapshot score. Update it when `user_trust_metrics.total_trust_score` is recalculated |
| `deleted_at` | TIMESTAMPTZ | Soft delete. ALL queries MUST filter `WHERE deleted_at IS NULL` |

**Soft delete controller pattern**:
```js
// Before deleting, anonymize PII (GDPR-style)
await db.query(`
  UPDATE users SET
    email      = 'deleted_' || id || '@removed.invalid',
    phone      = NULL,
    password_hash = 'REDACTED',
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE id = $1
`, [userId]);
```

---

### `user_sessions`
**Purpose**: Server-side JWT session store for revocation and multi-device management.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Becomes the `session_id` claim in your JWT payload |
| `access_token_hash` | VARCHAR | Store `crypto.createHash('sha256').update(token).digest('hex')` |
| `device_info` | JSONB | `{ ua: '...', device_type: 'mobile', os: 'Android 14' }` |
| `revoked_at` | TIMESTAMPTZ | NULL = active. SET NOW() on logout |
| `expires_at` | TIMESTAMPTZ | Cron deletes rows WHERE `expires_at < NOW() - INTERVAL '30 days'` |

**Auth middleware (Express)**:
```js
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { rows } = await db.query(`
    SELECT s.*, u.* FROM user_sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = $1
      AND s.access_token_hash = $2
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
      AND u.deleted_at IS NULL
  `, [decoded.session_id, tokenHash]);

  if (!rows.length) return res.status(401).json({ error: 'Session invalid' });
  req.user = rows[0];

  // Slide the last_used_at timestamp
  await db.query('UPDATE user_sessions SET last_used_at = NOW() WHERE id = $1', [decoded.session_id]);
  next();
}
```

---

### `verifications`
**Purpose**: KYC record — 1:1 with users. UNIQUE on `user_id` enforces this at DB level.

| Column | Type | Notes |
|---|---|---|
| `partner_proof_url` | VARCHAR | URL to file in Supabase Storage. Never store file content in DB |
| `rejection_reason` | TEXT | Backend must enforce: required when `status = 'rejected'` |
| `verified_by` | INT FK → admins | Records which reviewer made the decision |

**Verification flow**:
```js
// Admin approves verification
await db.transaction(async (trx) => {
  await trx.query(
    `UPDATE verifications SET status='verified', verified_at=NOW(), verified_by=$1 WHERE user_id=$2`,
    [adminId, userId]
  );
  // Sync the denormalized flag
  await trx.query(
    `UPDATE users SET is_verified=TRUE, updated_at=NOW() WHERE id=$1`,
    [userId]
  );
  // Write audit log
  await trx.query(
    `INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_values)
     VALUES ($1, 'user_verified', 'verifications', $2, '{"status":"verified"}')`,
    [adminId, verificationId]
  );
});
```

---

### `weekly_risk_profiles`
**Purpose**: Serialized output of the weekly risk engine. Created by a Sunday-night cron job before the new coverage week starts.

| Column | Type | Notes |
|---|---|---|
| `subscription_streak_weeks` | SMALLINT | Consecutive weeks subscribed (resets on gap > 14 days) |
| `lifetime_subscribed_weeks` | SMALLINT | Total weeks ever subscribed (NEVER resets) |
| `days_since_last_sub` | SMALLINT | Raw input snapshot used to compute streak |
| `scoring_factors` | JSONB | `{ "city_risk": 1.2, "streak_bonus": 0.95, "new_account_penalty": 1.1 }` |

**Streak computation logic (Node.js service)**:
```js
const STREAK_BREAK_DAYS = 14; // configurable

async function computeStreakForUser(userId) {
  const policies = await db.query(`
    SELECT start_date, end_date FROM user_policies
    WHERE user_id = $1 AND status IN ('active','expired')
    ORDER BY end_date DESC
  `, [userId]);

  let streak = 0;
  let lifetime = policies.rows.length;
  let daysSinceLast = null;

  for (let i = 0; i < policies.rows.length - 1; i++) {
    const gap = daysBetween(policies.rows[i+1].end_date, policies.rows[i].start_date);
    if (i === 0) daysSinceLast = gap;
    if (gap > STREAK_BREAK_DAYS) break;
    streak++;
  }
  if (lifetime > 0) streak++; // count current week

  return { streak, lifetime, daysSinceLast };
}
```

---

### `user_policies`
**Purpose**: Weekly insurance coverage records. The GIST exclusion constraint prevents overlapping active policies.

| Column | Type | Notes |
|---|---|---|
| `city_id` | INT FK | Denormalized. Used in the disruption fan-out JOIN: `WHERE city_id = $event.city_id AND status = 'active'` |
| `cycle_number` | SMALLINT | Set by `track_subscription_continuity` trigger automatically |
| `loyalty_discount_percent` | DECIMAL | Set by trigger. 4+ weeks = 5%, 8+ = 10%, 12+ = 15% off |
| `claims_count` | SMALLINT | Incremented by `trg_claims_update_policy_count` trigger on claim approval |
| `lifetime_claims_count` | SMALLINT | Also incremented by same trigger |

**GIST exclusion note**: Requires `btree_gist` extension. If you forget to install it, the CREATE TABLE statement will fail. The extension is installed at the top of the schema.

**Policy creation flow**:
```js
// 1. Compute premium
const riskProfile = await createWeeklyRiskProfile(userId, planId);
const basePremium = plan.base_premium_percent / 100 * user.weekly_income;
const premium = clamp(
  basePremium * city.risk_multiplier * riskProfile.risk_multiplier,
  plan.min_premium, plan.max_premium
);
// 2. Create policy (trigger handles streak/loyalty automatically)
const policy = await db.query(`
  INSERT INTO user_policies
    (user_id, plan_id, city_id, risk_profile_id, start_date, end_date,
     calculated_premium, risk_multiplier)
  VALUES ($1,$2,$3,$4,CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days',$5,$6)
  RETURNING *
`, [userId, planId, user.city_id, riskProfile.id, premium, riskProfile.risk_multiplier]);
// 3. Create premium payment transaction
await createPaymentTransaction({ userId, policyId: policy.id, type: 'premium', amount: premium });
```

---

### `user_subscription_history`
**Purpose**: Immutable, append-only event log of subscription lifecycle. NEVER UPDATE rows here.

| Column | Type | Notes |
|---|---|---|
| `event_type` | ENUM | subscribed / renewed / lapsed / reactivated |
| `gap_days` | SMALLINT | Days between this and previous policy. NULL for first-ever subscription |
| `season` | ENUM | Computed from `start_date` month by the DB trigger |
| `triggered_by` | VARCHAR | 'manual' (user chose) / 'auto_renewal' / 'campaign' |

**Do NOT insert manually**. The `track_subscription_continuity` trigger writes these rows automatically.

---

### `user_trust_metrics`
**Purpose**: Pre-aggregated trust score components. 1:1 with users. The `total_trust_score` is a GENERATED ALWAYS column — never write to it.

| Column | Type | Notes |
|---|---|---|
| `total_trust_score` | SMALLINT GENERATED | Sum of 4 sub-scores. Automatically computed by Postgres |
| `claims_score` | SMALLINT | Starts at 20, deducted when `suspicious_claims_count` rises |
| `activity_score` | SMALLINT | Calculated from `user_activity_logs` in your weekly analytics job |

**Update pattern (run weekly)**:
```js
await db.query(`
  INSERT INTO user_trust_metrics (user_id, subscription_score, ...)
  VALUES ($1, $2, ...)
  ON CONFLICT (user_id) DO UPDATE SET
    subscription_score     = EXCLUDED.subscription_score,
    activity_score         = EXCLUDED.activity_score,
    claims_score           = EXCLUDED.claims_score,
    verification_score     = EXCLUDED.verification_score,
    last_calculated_at     = NOW()
  -- total_trust_score auto-recomputes from the 4 updated values
`, [userId, subscriptionScore, ...]);
```

---

### `disruption_events`
**Purpose**: Single source of truth for every detected real-world parametric event.

| Column | Type | Notes |
|---|---|---|
| `event_time` | TIMESTAMPTZ | When the disruption occurred (from API), not when we detected it |
| `radius_km` | DECIMAL | Workers whose last known GPS is outside this radius do NOT get a claim |
| `raw_api_response` | JSONB | Full JSON from OpenWeather/AQI API. Essential for fraud audit and dispute |
| `status` | ENUM | detected → confirmed → processing → completed. false_alarm if secondary check fails |
| UNIQUE (trigger_id, city_id, event_time) | — | Cron idempotency guard. Use `ON CONFLICT DO NOTHING` in your INSERT |

**Fan-out query (core of the parametric engine)**:
```sql
-- Step 1: Find eligible policies in this city
SELECT up.id AS policy_id, up.user_id
FROM user_policies up
JOIN users u ON up.user_id = u.id
WHERE up.city_id = $1         -- event's city
  AND up.status = 'active'
  AND up.end_date > NOW()
  AND u.deleted_at IS NULL
  AND up.claims_count < (
    SELECT max_claims_per_cycle FROM insurance_plans
    WHERE id = up.plan_id
  );

-- Step 2: Batch insert claims (idempotent)
INSERT INTO claims (user_id, policy_id, disruption_event_id, trigger_id, ...)
SELECT up.user_id, up.id, $event_id, $trigger_id, ...
FROM user_policies up WHERE ...
ON CONFLICT (user_id, disruption_event_id) DO NOTHING;
```

---

### `weather_logs`
**Purpose**: Local cache of external API responses. The parametric engine reads from here, not directly from external APIs on every tick.

| Column | Type | Notes |
|---|---|---|
| `recorded_at` | TIMESTAMPTZ | Timestamp of the weather measurement itself |
| `api_fetched_at` | TIMESTAMPTZ | When our server fetched it (can differ from recorded_at) |

**Always query latest row per city**:
```sql
SELECT DISTINCT ON (city_id) *
FROM weather_logs
WHERE city_id = $1
ORDER BY city_id, recorded_at DESC;
```

---

### `user_activity_logs`
**Purpose**: Platform activity feed for anti-spoofing (Layer 1 fraud defense). Phase-1: mocked. Phase-2: live Swiggy/Zomato API integration.

| Column | Type | Notes |
|---|---|---|
| `activity_type` | VARCHAR | 'order_accepted', 'delivery_completed', 'shift_started', 'shift_ended', 'app_opened' |
| `device_fingerprint` | VARCHAR | Hash of device characteristics. Used to detect multiple accounts on same device |

**Anti-spoofing query used in legitimacy scoring**:
```sql
-- "Was this worker actually active in the last 2 hours?"
SELECT COUNT(*) AS recent_activity_count
FROM user_activity_logs
WHERE user_id = $1
  AND activity_type IN ('order_accepted', 'delivery_completed')
  AND logged_at > NOW() - INTERVAL '2 hours';
-- 0 activity → reduce legitimacy score (no_platform_activity signal)
```

---

### `claims`
**Purpose**: Generated automatically by the parametric engine fan-out. Manual claims are NOT a feature of this system.

| Column | Type | Notes |
|---|---|---|
| `legitimacy_score` | SMALLINT | SNAPSHOT at claim time. The user's score may change later; this records what it was when the claim was processed |
| `device_data` | JSONB | PWA sends: `{ accelerometer: true, motion: 'moving', cell_tower: 'BTSid-4421', battery_ok: true }` |
| `idx_claims_no_duplicate` | UNIQUE INDEX | `(user_id, disruption_event_id) WHERE disruption_event_id IS NOT NULL`. Critical idempotency guard |

**NEVER manually update `claims_count` on `user_policies`**. The `trg_claims_update_policy_count` trigger handles this automatically when a claim status changes to 'approved'.

---

### `fraud_signals`
**Purpose**: Granular per-signal evidence rows. One row per check per claim.

| Column | Type | Notes |
|---|---|---|
| `signal_type` | VARCHAR | 'gps_mismatch', 'no_platform_activity', 'mass_claim_spike', 'new_account', 'stationary_device', 'cell_tower_mismatch' |
| `weight` | DECIMAL | 0.0–1.0 contribution to the legitimacy score formula |
| `is_suspicious` | BOOLEAN | Set TRUE when this specific check failed. Used as ML training labels in Phase-2 |

**Insert pattern** (your fraud service calls this after computing each signal):
```js
await db.query(`
  INSERT INTO fraud_signals (claim_id, signal_type, signal_value, weight, is_suspicious)
  VALUES ($1, $2, $3, $4, $5)
`, [claimId, 'gps_mismatch', { reported: [28.6, 77.2], tower_estimated: [28.9, 77.5] }, 0.30, true]);
```

---

### `fraud_flags`
**Purpose**: Actionable case management. One flag per incident requiring human review.

| Column | Type | Notes |
|---|---|---|
| `severity` | ENUM | critical (<20), high (<35), medium (<50). Set by `insert_fraud_flag_for_claim` trigger |
| `is_resolved` | BOOLEAN | Admin sets TRUE when case is closed |
| `resolved_by` | INT FK → admins | Required when `is_resolved = TRUE`. Enforce in backend |
| `detection_signals` | JSONB | Summary for admin dashboard: `{ "gps_mismatch": true, "no_activity": true }` |

**Auto-created by DB trigger** when `claims.legitimacy_score < 50`. Admin portal reads:
```sql
SELECT * FROM fraud_flags WHERE is_resolved = FALSE
ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
flagged_at ASC;
```

---

### `payment_transactions`
**Purpose**: Complete financial ledger for both premium payments (inbound) and claim payouts (outbound).

| Column | Type | Notes |
|---|---|---|
| `razorpay_signature` | VARCHAR | Store for webhook verification: `crypto.createHmac('sha256', secret).update(orderId + '|' + paymentId).digest('hex')` |
| `upi_id` / `bank_account` / `ifsc_code` | VARCHAR | Snapshot of payout destination at time of transaction. DO NOT reference verifications table for financial records — use these snapshots |
| `retry_count` | SMALLINT | Alert your ops team when `retry_count > 3` |
| `CONSTRAINT chk_payment_reference` | — | DB enforces: premium txn must have policy_id; payout txn must have claim_id |

**Payout flow**:
```js
// 1. Copy bank details from verifications as snapshot
const { bank_account, ifsc_code } = await getVerification(userId);
// 2. Create transaction record
await db.query(`
  INSERT INTO payment_transactions
    (user_id, claim_id, payment_type, amount, bank_account, ifsc_code, status)
  VALUES ($1, $2, 'payout', $3, $4, $5, 'pending')
`, [userId, claimId, amount, bank_account, ifsc_code]);
// 3. Call Razorpay/UPI API
// 4. On webhook confirmation: UPDATE status='completed', completed_at=NOW()
```

---

### `notifications`
**Purpose**: Multi-channel notification log (SMS, push, email) with retry support.

| Column | Type | Notes |
|---|---|---|
| `channel` | ENUM | sms / push / email |
| `reference_type` + `reference_id` | VARCHAR + INT | Generic deep-link: `{ type: 'claim', id: 42 }` → PWA routes to /claims/42 |
| `metadata` | JSONB | Extended data: `{ "payout_amount": 800, "trigger": "heavy_rain", "city": "Delhi" }` |
| `read_at` | TIMESTAMPTZ | Set when PWA calls PATCH `/api/notifications/:id/read` |

---

### `audit_logs`
**Purpose**: Immutable append-only record of every admin and system action. NEVER UPDATE OR DELETE rows here.

| Column | Type | Notes |
|---|---|---|
| `admin_id` | INT (nullable) | NULL for system-initiated actions (cron auto-approvals) |
| `old_values` / `new_values` | JSONB | Snapshot before and after. Without these, it's a note, not an audit trail |
| `user_agent` | TEXT | For admin portal security forensics |

**Always write audit logs in a transaction with the actual change**:
```js
await db.transaction(async (trx) => {
  const [old] = await trx.query('SELECT * FROM claims WHERE id=$1', [claimId]);
  await trx.query('UPDATE claims SET status=$1, reviewed_by=$2 WHERE id=$3', ['approved', adminId, claimId]);
  await trx.query(`
    INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, old_values, new_values, ip_address)
    VALUES ($1, 'claim_approved', 'claims', $2, $3, '{"status":"approved"}', $4)
  `, [adminId, claimId, JSON.stringify(old), req.ip]);
});
```

---

## 4. CRITICAL GOTCHAS CHECKLIST

Before shipping any endpoint, verify:

- [ ] Every `users` query has `AND deleted_at IS NULL`
- [ ] Every `user_sessions` query has `AND revoked_at IS NULL AND expires_at > NOW()`
- [ ] JWT tokens are stored as SHA-256 hashes in `access_token_hash`, not raw
- [ ] Policy creation goes through the trigger — do NOT manually set `cycle_number`, `loyalty_discount_percent`, or `is_first_policy`
- [ ] Claim creation provides a `legitimacy_score` — the fraud-flag trigger needs it
- [ ] Premium transactions have `policy_id`, payout transactions have `claim_id` (DB constraint enforces this, but set it correctly)
- [ ] Disruption event inserts use `ON CONFLICT DO NOTHING` for cron idempotency
- [ ] Claim fan-out inserts use `ON CONFLICT (user_id, disruption_event_id) DO NOTHING`
- [ ] `user_trust_metrics.total_trust_score` is NEVER manually written — it's a GENERATED ALWAYS column
- [ ] Audit logs are always written in the same transaction as the change they record
- [ ] `btree_gist` extension is installed before running schema (for GIST exclusion constraint)
- [ ] `uuid-ossp` extension is installed before running schema (for `user_sessions` UUID PK)

---

## 5. RECOMMENDED CRON JOBS

| Job | Schedule | Action |
|---|---|---|
| Weather poller | Every 30 min | INSERT into `weather_logs`, evaluate `triggers`, INSERT `disruption_events` |
| Disruption fan-out | Every 5 min | Process `disruption_events WHERE status='detected'`, create claims |
| Policy expiry | Daily 00:30 IST | UPDATE `user_policies SET status='expired' WHERE end_date < NOW() AND status='active'` |
| Trust score refresh | Weekly Sunday 02:00 | Recompute `user_trust_metrics` + `weekly_risk_profiles` for all users |
| Session cleanup | Daily 04:00 | DELETE `user_sessions WHERE expires_at < NOW() - INTERVAL '30 days'` |
| Notification retry | Every 15 min | Re-send `notifications WHERE status='failed' AND retry_count < 5` |
| Payment retry | Every 30 min | Retry `payment_transactions WHERE status='pending' AND retry_count < 3` |
