-- ============================================================================
--  GIG SHIRUDO — SCHEMA FINAL VERSION
--  Team: CodeBlooded | Guidewire DEVTrails 2026
--  Database: PostgreSQL (Supabase, public schema, NO RLS, NO Supabase Auth)
--  Auth: Custom Node.js/Express JWT
--
-- ============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID for user_sessions PK
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- Required for GIST exclusion on user_policies

-- ============================================================================
-- SECTION 0: ENUM TYPES
-- Enums enforce valid values at the DB level, not just the API layer.
-- Adding a new value requires: ALTER TYPE <type> ADD VALUE '<val>';
-- ============================================================================

-- User / Worker
CREATE TYPE verification_status    AS ENUM ('pending', 'verified', 'rejected', 'expired');
CREATE TYPE risk_level             AS ENUM ('low', 'medium', 'high');

-- Policy lifecycle
-- pending_payment → active → expired (happy path)
-- pending_payment → cancelled (user cancelled before paying)
-- active → suspended (fraud hold)
CREATE TYPE policy_status AS ENUM (
    'pending_payment', 'active', 'expired', 'cancelled', 'suspended'
);

-- Claim lifecycle
-- pending → under_review (low legitimacy score) OR approved (high score)
-- approved → processing → paid
-- under_review → approved | rejected
CREATE TYPE claim_status AS ENUM (
    'pending', 'under_review', 'approved', 'processing', 'paid', 'rejected'
);

-- Payments
CREATE TYPE payment_type   AS ENUM ('premium', 'payout');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Admin
CREATE TYPE admin_role AS ENUM (
    'super_admin', 'admin', 'reviewer', 'analyst', 'support'
);

-- Parametric engine
-- Fixed enum: these are the 5 defined trigger types in the README.
-- To add a new type: ALTER TYPE trigger_event_type ADD VALUE 'new_event';
CREATE TYPE trigger_event_type AS ENUM (
    'heavy_rain', 'extreme_heat', 'high_pollution', 'curfew', 'platform_downtime'
);

-- How the threshold is evaluated
CREATE TYPE trigger_operator AS ENUM ('gt', 'gte', 'lt', 'lte', 'eq');

-- Full lifecycle of a detected real-world event
CREATE TYPE disruption_status AS ENUM (
    'detected',    -- API value crossed threshold; not yet fanned out
    'confirmed',   -- Validated by secondary check; fan-out starting
    'processing',  -- Claims are being batch-created
    'completed',   -- All eligible claims generated
    'false_alarm'  -- Reverted after secondary validation failed
);

-- Notifications
CREATE TYPE notification_channel AS ENUM ('sms', 'push', 'email');
CREATE TYPE notification_status  AS ENUM ('pending', 'sent', 'failed', 'read');

-- Fraud
CREATE TYPE fraud_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Subscription history
CREATE TYPE sub_event_type AS ENUM ('subscribed', 'renewed', 'lapsed', 'reactivated');
CREATE TYPE season_type    AS ENUM ('monsoon', 'summer', 'winter', 'normal');


-- ============================================================================
-- SECTION 1: REFERENCE / LOOKUP TABLES
-- No foreign key dependencies. Created first.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: platforms
-- WHY: A normalized table beats a platform_type enum because adding Zepto or
-- Blinkit in production requires only an INSERT, not an ALTER TYPE + migration.
-- api_endpoint enables future platform API integration for activity cross-check.
-- ----------------------------------------------------------------------------
CREATE TABLE platforms (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    code         VARCHAR(20)  NOT NULL,    -- machine key: 'zomato', 'swiggy'
    api_endpoint VARCHAR(500),             -- future: Swiggy partner API base URL
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_platform_name UNIQUE (name),
    CONSTRAINT uq_platform_code UNIQUE (code)
);

CREATE INDEX idx_platforms_active ON platforms(id) WHERE is_active = TRUE;


-- ----------------------------------------------------------------------------
-- TABLE: cities
-- timezone: IST-first but required for accurate cron-job disruption timing.
-- risk_multiplier: city-level base multiplier for premium formula.
--   Final premium = base_plan_premium × city_multiplier × user_risk_multiplier
-- ----------------------------------------------------------------------------
CREATE TABLE cities (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(100)   NOT NULL,
    state            VARCHAR(100)   NOT NULL,
    latitude         DECIMAL(9, 6)  NOT NULL,
    longitude        DECIMAL(9, 6)  NOT NULL,
    timezone         VARCHAR(50)    NOT NULL DEFAULT 'Asia/Kolkata',
    risk_multiplier  DECIMAL(4, 2)  NOT NULL DEFAULT 1.00 CHECK (risk_multiplier > 0),
    is_active        BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_city_state UNIQUE (name, state)
);

CREATE INDEX idx_cities_active      ON cities(id) WHERE is_active = TRUE;
CREATE INDEX idx_cities_coordinates ON cities(latitude, longitude);


-- ----------------------------------------------------------------------------
-- TABLE: insurance_plans  (renamed from platform_policies / platform_policies)
-- plan_code: machine-readable key used in API responses ('BASIC', 'PREMIUM').
-- base_premium_percent: implements the README formula (5% of weekly income).
-- min_premium / max_premium: floor/ceiling so the % formula never produces
--   an absurdly low or high number regardless of income input.
-- ----------------------------------------------------------------------------
CREATE TABLE insurance_plans (
    id                    SERIAL PRIMARY KEY,
    plan_name             VARCHAR(100)   NOT NULL,
    plan_code             VARCHAR(20)    NOT NULL,   -- 'BASIC', 'STANDARD', 'ELITE'
    description           TEXT,
    base_premium_percent  DECIMAL(5, 2)  NOT NULL DEFAULT 5.00
                              CHECK (base_premium_percent > 0),
    min_premium           DECIMAL(10, 2) NOT NULL DEFAULT 50.00
                              CHECK (min_premium >= 0),
    max_premium           DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
    coverage_amount       DECIMAL(10, 2) NOT NULL CHECK (coverage_amount > 0),
    duration_days         SMALLINT       NOT NULL DEFAULT 7
                              CHECK (duration_days > 0),
    max_claims_per_cycle  SMALLINT       NOT NULL DEFAULT 3
                              CHECK (max_claims_per_cycle > 0),
    is_active             BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_plan_code UNIQUE (plan_code),
    CONSTRAINT chk_premium_range CHECK (min_premium <= max_premium)
);

CREATE INDEX idx_plans_active ON insurance_plans(id) WHERE is_active = TRUE;


-- ----------------------------------------------------------------------------
-- TABLE: triggers
-- Defines each parametric trigger type and its evaluation rule.
-- api_endpoint: stored here so the cron service can look up which URL to poll
--   without hardcoding it in Node.js code.
-- cooldown_hours: prevents the same storm from re-triggering every poll cycle.
-- ----------------------------------------------------------------------------
CREATE TABLE triggers (
    id               SERIAL PRIMARY KEY,
    event_type       trigger_event_type NOT NULL UNIQUE,
    event_name       VARCHAR(100)       NOT NULL,   -- 'Heavy Rain' (display label)
    description      TEXT,
    condition_text   VARCHAR(500)       NOT NULL,   -- 'Rainfall > 50mm' (shown to worker)
    threshold_value  DECIMAL(10, 2)     NOT NULL,
    threshold_unit   VARCHAR(20),                   -- 'mm', '°C', 'AQI', 'minutes'
    operator         trigger_operator   NOT NULL DEFAULT 'gt',
    base_payout      DECIMAL(10, 2)     NOT NULL CHECK (base_payout > 0),
    data_source      VARCHAR(100)       NOT NULL,   -- 'openweather', 'aqi_api'
    api_endpoint     VARCHAR(500),                  -- actual API URL for cron service
    cooldown_hours   SMALLINT           NOT NULL DEFAULT 6
                         CHECK (cooldown_hours >= 0),
    is_active        BOOLEAN            NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_triggers_active ON triggers(id) WHERE is_active = TRUE;
CREATE INDEX idx_triggers_event  ON triggers(event_type);


-- ============================================================================
-- SECTION 2: ADMIN TABLE
-- Must be created before `verifications` and `claims` which FK into it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: admins
-- Completely separate from users. Admins are never gig workers.
-- created_by: self-referential FK; the super_admin who added this admin.
-- ----------------------------------------------------------------------------
CREATE TABLE admins (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(150) NOT NULL,
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    role           admin_role   NOT NULL DEFAULT 'analyst',
    permissions    JSONB        NOT NULL DEFAULT '{}',
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by     INTEGER REFERENCES admins(id) ON DELETE SET NULL
);

-- Active-only unique email: deactivated admin email slot is freed intentionally
-- so it can be re-registered with a different account if needed.
CREATE UNIQUE INDEX idx_admins_email_active ON admins(email) WHERE is_active = TRUE;
CREATE INDEX idx_admins_role_active ON admins(role) WHERE is_active = TRUE;


-- ============================================================================
-- SECTION 3: CORE USER TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: users
-- platform_id: FK to platforms table (normalized, not enum).
-- partner_id: external worker ID on delivery platform (string, not int FK).
-- legitimacy_score: snapshot score on the user; updated after each claim cycle.
--   The per-week computed score lives in weekly_risk_profiles.
-- is_verified: denormalized flag. Backend sets TRUE when verifications.status
--   flips to 'verified'. Avoids a JOIN on every auth check.
-- last_login_at: tracked here for security audit; set by auth middleware.
-- SOFT DELETE: deleted_at IS NULL = active. ALL queries must include this filter.
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(150) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    password_hash       VARCHAR(255) NOT NULL,
    phone               VARCHAR(15),
    platform_id         INTEGER      REFERENCES platforms(id) ON DELETE SET NULL,
    partner_id          VARCHAR(100),              -- Swiggy/Zomato worker ID string
    city_id             INTEGER      REFERENCES cities(id) ON DELETE SET NULL,
    weekly_income       DECIMAL(10, 2) CHECK (weekly_income > 0),
    legitimacy_score    SMALLINT     NOT NULL DEFAULT 50
                            CHECK (legitimacy_score BETWEEN 0 AND 100),
    is_verified         BOOLEAN      NOT NULL DEFAULT FALSE,
    last_login_at       TIMESTAMPTZ,
    deleted_at          TIMESTAMPTZ,               -- NULL = active (soft delete)
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Partial unique: active users must have unique email.
-- A deleted user's email is freed after their account is deleted.
CREATE UNIQUE INDEX idx_users_email_active
    ON users(email) WHERE deleted_at IS NULL;

-- Disruption fan-out query: "all active users in city X"
CREATE INDEX idx_users_city_active
    ON users(city_id) WHERE deleted_at IS NULL;

-- Platform-scoped fraud analysis
CREATE INDEX idx_users_platform_active
    ON users(platform_id) WHERE deleted_at IS NULL;

-- Trust score range queries for admin dashboard
CREATE INDEX idx_users_legitimacy_active
    ON users(legitimacy_score) WHERE deleted_at IS NULL;

-- Fraud multi-signal phone cross-check
CREATE INDEX idx_users_phone
    ON users(phone) WHERE phone IS NOT NULL AND deleted_at IS NULL;


-- ----------------------------------------------------------------------------
-- TABLE: user_sessions
-- WHY: Custom JWT needs server-side session tracking for token revocation,
--   multi-device logout, and security audit. Without this table, a stolen
--   token is valid until expiry with no way to invalidate it.
-- id: UUID (not serial) for session tokens — harder to enumerate.
-- access_token_hash: store HASH of the JWT (SHA-256), not the token itself.
-- device_info JSONB: { "ua": "...", "device_type": "mobile", "os": "Android" }
-- ----------------------------------------------------------------------------
CREATE TABLE user_sessions (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token_hash   VARCHAR(255) NOT NULL,
    refresh_token_hash  VARCHAR(255),
    device_info         JSONB,
    ip_address          INET,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at          TIMESTAMPTZ NOT NULL,
    last_used_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at          TIMESTAMPTZ            -- NULL = active session
);

-- Auth middleware: "is this session valid?"
CREATE INDEX idx_sessions_user_active
    ON user_sessions(user_id) WHERE revoked_at IS NULL;

-- Cleanup cron: expired sessions to purge
CREATE INDEX idx_sessions_expiry
    ON user_sessions(expires_at) WHERE revoked_at IS NULL;


-- ----------------------------------------------------------------------------
-- TABLE: verifications  (1:1 with users)
-- verified_by: FK to admins — records which reviewer approved/rejected.
-- Documents (PAN, Aadhar, partner_proof_url) must be stored encrypted
--   in Supabase Storage; only the URL/hash is stored here.
-- ----------------------------------------------------------------------------
CREATE TABLE verifications (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER             NOT NULL UNIQUE
                          REFERENCES users(id) ON DELETE CASCADE,
    bank_account      VARCHAR(20),
    ifsc_code         VARCHAR(11),
    pan_number        VARCHAR(10),
    aadhar_number     VARCHAR(12),
    partner_proof_url VARCHAR(500),        -- Supabase Storage / S3 URL
    status            verification_status NOT NULL DEFAULT 'pending',
    rejection_reason  TEXT,               -- required when status = 'rejected'
    submitted_at      TIMESTAMPTZ         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at       TIMESTAMPTZ,
    verified_by       INTEGER REFERENCES admins(id) ON DELETE SET NULL
);

CREATE INDEX idx_verifications_pending
    ON verifications(submitted_at ASC) WHERE status = 'pending';


-- ============================================================================
-- SECTION 4: RISK, POLICY & SUBSCRIPTION TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: weekly_risk_profiles
-- The serialized output of the risk engine for each user per week.
-- This is the DB artifact of "dynamic premium calculation" from the README.
-- subscription_streak_weeks: resets to 0 after inactivity gap > threshold.
-- lifetime_subscribed_weeks: NEVER resets. Protects seasonal workers.
-- days_since_last_sub: raw input snapshot; explains why streak was set to N.
-- scoring_factors JSONB: full breakdown for admin dashboard auditability.
--   Example: { "city_risk": 1.2, "streak_bonus": 0.95, "new_account": 1.1 }
-- ----------------------------------------------------------------------------
CREATE TABLE weekly_risk_profiles (
    id                          SERIAL PRIMARY KEY,
    user_id                     INTEGER        NOT NULL
                                    REFERENCES users(id) ON DELETE CASCADE,
    week_start_date             DATE           NOT NULL,
    risk_level                  risk_level     NOT NULL DEFAULT 'medium',
    risk_multiplier             DECIMAL(4, 2)  NOT NULL DEFAULT 1.00
                                    CHECK (risk_multiplier > 0),
    computed_premium            DECIMAL(10, 2) NOT NULL CHECK (computed_premium > 0),
    -- Subscription behaviour signals (see discussion in docs)
    subscription_streak_weeks   SMALLINT       NOT NULL DEFAULT 0
                                    CHECK (subscription_streak_weeks >= 0),
    lifetime_subscribed_weeks   SMALLINT       NOT NULL DEFAULT 0
                                    CHECK (lifetime_subscribed_weeks >= 0),
    days_since_last_sub         SMALLINT       CHECK (days_since_last_sub >= 0),
    scoring_factors             JSONB,
    created_at                  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_risk_profile_user_week UNIQUE (user_id, week_start_date)
);

CREATE INDEX idx_risk_profiles_user_week
    ON weekly_risk_profiles(user_id, week_start_date DESC);

-- Identify zero-streak users at claim time for fraud scrutiny
CREATE INDEX idx_risk_profiles_zero_streak
    ON weekly_risk_profiles(user_id) WHERE subscription_streak_weeks = 0;


-- ----------------------------------------------------------------------------
-- TABLE: user_policies  (plural naming convention throughout)
-- risk_profile_id: links the policy to the exact risk calculation snapshot.
-- city_id: denormalized for the disruption fan-out JOIN performance.
-- GIST exclusion constraint: DB-level guarantee that one user cannot have two
--   ACTIVE policies with overlapping date ranges simultaneously.
--   Requires btree_gist extension (installed above).
-- loyalty_discount_percent: populated by track_subscription_continuity trigger.
-- is_first_policy: set by trigger; useful for new-account fraud detection.
-- ----------------------------------------------------------------------------
CREATE TABLE user_policies (
    id                       SERIAL PRIMARY KEY,
    user_id                  INTEGER        NOT NULL
                                 REFERENCES users(id) ON DELETE RESTRICT,
    plan_id                  INTEGER        NOT NULL
                                 REFERENCES insurance_plans(id) ON DELETE RESTRICT,
    risk_profile_id          INTEGER
                                 REFERENCES weekly_risk_profiles(id) ON DELETE SET NULL,
    city_id                  INTEGER        NOT NULL
                                 REFERENCES cities(id) ON DELETE RESTRICT,
    status                   policy_status  NOT NULL DEFAULT 'pending_payment',
    start_date               DATE           NOT NULL,
    end_date                 DATE           NOT NULL,
    cycle_number             SMALLINT       NOT NULL DEFAULT 1
                                 CHECK (cycle_number > 0),
    calculated_premium       DECIMAL(10, 2) NOT NULL CHECK (calculated_premium >= 0),
    risk_multiplier          DECIMAL(4, 2)  NOT NULL DEFAULT 1.00,
    loyalty_discount_percent DECIMAL(5, 2)  NOT NULL DEFAULT 0.00
                                 CHECK (loyalty_discount_percent BETWEEN 0 AND 100),
    claims_count             SMALLINT       NOT NULL DEFAULT 0
                                 CHECK (claims_count >= 0),
    lifetime_claims_count    SMALLINT       NOT NULL DEFAULT 0
                                 CHECK (lifetime_claims_count >= 0),
    is_first_policy          BOOLEAN        NOT NULL DEFAULT TRUE,
    renewed_at               TIMESTAMPTZ,   -- when this was renewed from previous policy
    cancelled_at             TIMESTAMPTZ,
    created_at               TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_policy_dates CHECK (end_date > start_date),
    -- GIST exclusion: prevent overlapping ACTIVE policies for same user
    CONSTRAINT uq_one_active_policy_per_user
        EXCLUDE USING gist (user_id WITH =, daterange(start_date, end_date) WITH &&)
        WHERE (status = 'active')
        DEFERRABLE INITIALLY DEFERRED
);

-- Auth/claim check: "does this user have an active policy right now?"
CREATE INDEX idx_user_policies_user_active
    ON user_policies(user_id) WHERE status = 'active';

-- Expiry cron: policies ending in next 24h (send reminder notifications)
CREATE INDEX idx_user_policies_expiry
    ON user_policies(end_date ASC) WHERE status = 'active';

-- Disruption fan-out: "all active policies in city X" → batch-create claims
CREATE INDEX idx_user_policies_city_active
    ON user_policies(city_id, end_date) WHERE status = 'active';

-- Most loyal users query
CREATE INDEX idx_user_policies_loyalty
    ON user_policies(cycle_number DESC) WHERE status = 'active';


-- ----------------------------------------------------------------------------
-- TABLE: user_subscription_history
-- Immutable event log of every subscription lifecycle state change.
-- Used as training data for Phase-2 ML seasonal pattern detection.
-- "Cherry-picker" detection query runs against this table (see docs).
-- season: computed from start_date month by the trigger function.
-- gap_days: NULL for first-ever subscription; populated on renewal/lapse events.
-- ----------------------------------------------------------------------------
CREATE TABLE user_subscription_history (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type        sub_event_type NOT NULL,
    policy_id         INTEGER        REFERENCES user_policies(id) ON DELETE SET NULL,
    consecutive_count SMALLINT       NOT NULL DEFAULT 0,
    gap_days          SMALLINT       CHECK (gap_days >= 0),
    season            season_type,
    triggered_by      VARCHAR(100),   -- 'manual', 'auto_renewal', 'campaign'
    event_date        DATE           NOT NULL,
    recorded_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sub_history_user
    ON user_subscription_history(user_id, event_date DESC);
CREATE INDEX idx_sub_history_event_type
    ON user_subscription_history(event_type);
CREATE INDEX idx_sub_history_season
    ON user_subscription_history(user_id, season) WHERE season IS NOT NULL;


-- ----------------------------------------------------------------------------
-- TABLE: user_trust_metrics  (1:1 with users)
-- Centralized, pre-aggregated trust score components.
-- total_trust_score: GENERATED column — always in sync, never manually updated.
-- Each sub-score maps to a scoring layer:
--   subscription_score (0–40): loyalty/streak signals
--   activity_score     (0–30): platform delivery activity
--   claims_score       (0–20): clean claim history (starts at 20, deducted on fraud)
--   verification_score (0–10): KYC completion
-- IMPORTANT: Backend must call UPDATE user_trust_metrics after each claim cycle
--   and after each policy renewal. The generated column auto-recomputes total.
-- ----------------------------------------------------------------------------
CREATE TABLE user_trust_metrics (
    user_id                  INTEGER PRIMARY KEY
                                 REFERENCES users(id) ON DELETE CASCADE,
    -- Subscription layer (max 40)
    subscription_score       SMALLINT       NOT NULL DEFAULT 0
                                 CHECK (subscription_score BETWEEN 0 AND 40),
    consecutive_weeks        SMALLINT       NOT NULL DEFAULT 0,
    total_subscribed_weeks   SMALLINT       NOT NULL DEFAULT 0,
    lapse_count              SMALLINT       NOT NULL DEFAULT 0,
    longest_active_streak    SMALLINT       NOT NULL DEFAULT 0,
    -- Platform activity layer (max 30)
    activity_score           SMALLINT       NOT NULL DEFAULT 0
                                 CHECK (activity_score BETWEEN 0 AND 30),
    avg_weekly_deliveries    DECIMAL(5, 2)  NOT NULL DEFAULT 0.00,
    platform_tenure_days     INTEGER        NOT NULL DEFAULT 0,
    -- Claims behaviour layer (max 20; starts full, deducted on suspicious claims)
    claims_score             SMALLINT       NOT NULL DEFAULT 20
                                 CHECK (claims_score BETWEEN 0 AND 20),
    claim_to_premium_ratio   DECIMAL(6, 4)  NOT NULL DEFAULT 0.0000,
    suspicious_claims_count  SMALLINT       NOT NULL DEFAULT 0,
    -- Identity verification layer (max 10)
    verification_score       SMALLINT       NOT NULL DEFAULT 0
                                 CHECK (verification_score BETWEEN 0 AND 10),
    is_kyc_complete          BOOLEAN        NOT NULL DEFAULT FALSE,
    verification_age_days    INTEGER        NOT NULL DEFAULT 0,
    -- Composite (auto-computed, never manually set)
    total_trust_score        SMALLINT GENERATED ALWAYS AS
                                 (subscription_score + activity_score +
                                  claims_score + verification_score) STORED,
    last_calculated_at       TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_total_trust CHECK (
        subscription_score + activity_score + claims_score + verification_score
        BETWEEN 0 AND 100
    )
);

CREATE INDEX idx_trust_total_score
    ON user_trust_metrics(total_trust_score DESC);
CREATE INDEX idx_trust_low_score
    ON user_trust_metrics(total_trust_score)
    WHERE total_trust_score < 50;


-- ============================================================================
-- SECTION 5: PARAMETRIC ENGINE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: disruption_events
-- Single source of truth for every detected real-world event.
-- Flow: cron polls API → threshold crossed → INSERT here (status='detected')
--       → validation pass → status='confirmed'
--       → fan-out service batch-creates claims → status='processing'
--       → all claims created → status='completed'
-- CRITICAL: The UNIQUE constraint on (trigger_id, city_id, event_time) is the
--   idempotency guard for the cron job. A retry cannot double-insert the same event.
-- cooldown enforcement: backend checks that no 'confirmed'/'completed' event
--   exists for this (trigger_id, city_id) within the last triggers.cooldown_hours
--   before inserting a new one.
-- radius_km: the geographic radius within which worker GPS must fall to qualify.
-- ----------------------------------------------------------------------------
CREATE TABLE disruption_events (
    id                SERIAL PRIMARY KEY,
    trigger_id        INTEGER            NOT NULL REFERENCES triggers(id) ON DELETE RESTRICT,
    city_id           INTEGER            NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
    detected_value    DECIMAL(10, 2)     NOT NULL,    -- actual measured value
    event_time        TIMESTAMPTZ        NOT NULL,    -- when disruption occurred
    radius_km         DECIMAL(5, 2)      NOT NULL DEFAULT 10.00,
    latitude          DECIMAL(9, 6),                 -- epicentre of event
    longitude         DECIMAL(9, 6),
    raw_api_response  JSONB,                          -- full API JSON for audit
    data_source       VARCHAR(100),
    status            disruption_status  NOT NULL DEFAULT 'detected',
    claims_generated  INTEGER            NOT NULL DEFAULT 0 CHECK (claims_generated >= 0),
    created_at        TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at      TIMESTAMPTZ,
    CONSTRAINT uq_disruption_event UNIQUE (trigger_id, city_id, event_time)
);

CREATE INDEX idx_disruption_city_time
    ON disruption_events(city_id, event_time DESC);
CREATE INDEX idx_disruption_trigger_city
    ON disruption_events(trigger_id, city_id);
-- Fan-out worker queue: pick up unprocessed events
CREATE INDEX idx_disruption_pending_status
    ON disruption_events(status)
    WHERE status IN ('detected', 'confirmed', 'processing');


-- ----------------------------------------------------------------------------
-- TABLE: weather_logs
-- Caches raw API responses from OpenWeather / AQI APIs.
-- WHY: Prevents hammering external APIs on every cron tick; provides a local
--   data store for the parametric engine to evaluate thresholds against.
--   Also provides historical data for Phase-2 ML seasonal weather modelling.
-- recorded_at vs api_fetched_at: recorded_at is the timestamp of the weather
--   data itself; api_fetched_at is when our server fetched it.
-- ----------------------------------------------------------------------------
CREATE TABLE weather_logs (
    id             SERIAL PRIMARY KEY,
    city_id        INTEGER        NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    temperature    DECIMAL(5, 2),                  -- °C
    rainfall_mm    DECIMAL(6, 2),                  -- mm in last hour
    aqi            INTEGER,
    humidity       SMALLINT,                       -- %
    wind_speed     DECIMAL(5, 2),                  -- km/h
    raw_response   JSONB,
    data_source    VARCHAR(50)    NOT NULL,
    recorded_at    TIMESTAMPTZ    NOT NULL,         -- timestamp of weather data
    api_fetched_at TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Most common query: latest weather for a city
CREATE INDEX idx_weather_city_time
    ON weather_logs(city_id, recorded_at DESC);
-- Recent data window for threshold evaluation
-- NOTE: Cannot use CURRENT_TIMESTAMP in partial index (not immutable).
-- Query will filter by date at runtime instead.
CREATE INDEX idx_weather_recent
    ON weather_logs(recorded_at DESC);


-- ============================================================================
-- SECTION 6: FRAUD & CLAIMS TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: user_activity_logs
-- Platform activity data fed from Swiggy/Zomato API (Phase-1: mocked).
-- This is the "ground truth" for anti-spoofing (see README Layer 1 defense).
-- activity_type: 'order_accepted', 'delivery_completed', 'shift_started',
--                'shift_ended', 'app_opened'
-- device_fingerprint: used to detect multiple accounts on same device.
-- ----------------------------------------------------------------------------
CREATE TABLE user_activity_logs (
    id                 SERIAL PRIMARY KEY,
    user_id            INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type      VARCHAR(50)  NOT NULL,
    activity_data      JSONB,                   -- flexible per activity type
    latitude           DECIMAL(9, 6),
    longitude          DECIMAL(9, 6),
    device_fingerprint VARCHAR(100),
    ip_address         INET,
    logged_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Anti-spoofing check: "what was this user doing in the last 2 hours?"
CREATE INDEX idx_activity_user_time
    ON user_activity_logs(user_id, logged_at DESC);
-- Fraud ring detection: cluster activity by type in time window
CREATE INDEX idx_activity_type_time
    ON user_activity_logs(activity_type, logged_at DESC);
-- Recent-window partial index for legitimacy score computation
-- NOTE: Cannot use CURRENT_TIMESTAMP in partial index (not immutable).
-- Query will filter by date at runtime instead.
CREATE INDEX idx_activity_recent_window
    ON user_activity_logs(user_id, logged_at DESC);


-- ----------------------------------------------------------------------------
-- TABLE: claims
-- Auto-generated when disruption_events is fanned out to eligible user_policies.
-- CRITICAL IDEMPOTENCY INDEX: idx_claims_no_duplicate prevents double-paying
--   the same user for the same disruption event even if the fan-out job retries.
-- device_data JSONB: accelerometer / gyroscope / cell tower data from PWA.
--   Example: { "accelerometer": true, "cell_tower": "BTSid-4421", "motion": "moving" }
-- legitimacy_score here is a SNAPSHOT at claim time, not the current user score.
-- ----------------------------------------------------------------------------
CREATE TABLE claims (
    id                   SERIAL PRIMARY KEY,
    user_id              INTEGER       NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    policy_id            INTEGER       NOT NULL REFERENCES user_policies(id) ON DELETE RESTRICT,
    disruption_event_id  INTEGER       REFERENCES disruption_events(id) ON DELETE SET NULL,
    trigger_id           INTEGER       NOT NULL REFERENCES triggers(id) ON DELETE RESTRICT,
    trigger_value        DECIMAL(10, 2),           -- measured value at trigger time
    payout_amount        DECIMAL(10, 2) NOT NULL CHECK (payout_amount >= 0),
    status               claim_status  NOT NULL DEFAULT 'pending',
    legitimacy_score     SMALLINT      CHECK (legitimacy_score BETWEEN 0 AND 100),
    location_lat         DECIMAL(9, 6),
    location_lng         DECIMAL(9, 6),
    device_data          JSONB,                    -- PWA sensor data for anti-spoofing
    review_notes         TEXT,
    reviewed_by          INTEGER       REFERENCES admins(id) ON DELETE SET NULL,
    triggered_at         TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at          TIMESTAMPTZ,
    processed_at         TIMESTAMPTZ,
    paid_at              TIMESTAMPTZ
);

-- Worker's claim history
CREATE INDEX idx_claims_user
    ON claims(user_id, triggered_at DESC);
-- Admin review queues
CREATE INDEX idx_claims_pending
    ON claims(triggered_at ASC) WHERE status = 'pending';
CREATE INDEX idx_claims_under_review
    ON claims(triggered_at ASC) WHERE status = 'under_review';
-- Link back to source event
CREATE INDEX idx_claims_disruption_event
    ON claims(disruption_event_id);
-- Fraud ring temporal analysis
CREATE INDEX idx_claims_triggered_at
    ON claims(triggered_at DESC);
-- Legitimacy score distribution for ML training
CREATE INDEX idx_claims_legitimacy_pending
    ON claims(legitimacy_score) WHERE status = 'pending';
-- CRITICAL: Idempotency guard — one claim per user per disruption event
CREATE UNIQUE INDEX idx_claims_no_duplicate
    ON claims(user_id, disruption_event_id)
    WHERE disruption_event_id IS NOT NULL;
-- GPS cluster fraud detection
-- NOTE: Cannot use CURRENT_TIMESTAMP in partial index (not immutable).
-- Query will filter by date at runtime instead.
CREATE INDEX idx_claims_location
    ON claims(location_lat, location_lng);


-- ----------------------------------------------------------------------------
-- TABLE: fraud_signals
-- Granular per-signal log for every fraud check evaluated on a claim.
-- WHY A SEPARATE TABLE from fraud_flags: fraud_signals captures the raw
--   per-check evidence rows (one row per signal). fraud_flags is the actionable
--   case management record. Think of it as: signals = evidence, flags = verdict.
-- signal_type examples: 'gps_mismatch', 'no_platform_activity',
--   'mass_claim_spike', 'new_account', 'stationary_device', 'cell_tower_mismatch'
-- Rows here become Phase-2 ML training data (labeled as is_suspicious T/F).
-- ----------------------------------------------------------------------------
CREATE TABLE fraud_signals (
    id             SERIAL PRIMARY KEY,
    claim_id       INTEGER        NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    signal_type    VARCHAR(100)   NOT NULL,
    signal_value   JSONB,          -- raw evidence: { "gps": [28.6, 77.2], "tower": "BTSid-91" }
    weight         DECIMAL(4, 2)  NOT NULL DEFAULT 0.00
                       CHECK (weight BETWEEN 0 AND 1),
    is_suspicious  BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fraud_signals_claim
    ON fraud_signals(claim_id);
CREATE INDEX idx_fraud_signals_suspicious_type
    ON fraud_signals(signal_type) WHERE is_suspicious = TRUE;


-- ----------------------------------------------------------------------------
-- TABLE: fraud_flags
-- Actionable fraud case management record (one per user/claim incident).
-- WHY SEPARATE from fraud_signals: fraud_flags is the case that an admin
--   resolves. It has a resolution workflow (is_resolved, resolved_by, notes).
--   fraud_signals are the raw evidence rows. A flag can aggregate many signals.
-- Auto-populated by the auto_flag_suspicious_claims() trigger when a claim's
--   legitimacy_score < 50.
-- ----------------------------------------------------------------------------
CREATE TABLE fraud_flags (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    claim_id          INTEGER         REFERENCES claims(id) ON DELETE SET NULL,
    severity          fraud_severity  NOT NULL,
    reason            TEXT            NOT NULL,
    detection_signals JSONB,          -- summary: { "gps_mismatch": true, "no_activity": true }
    is_resolved       BOOLEAN         NOT NULL DEFAULT FALSE,
    resolved_at       TIMESTAMPTZ,
    resolved_by       INTEGER         REFERENCES admins(id) ON DELETE SET NULL,
    resolution_notes  TEXT,
    flagged_at        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fraud_flags_user
    ON fraud_flags(user_id);
CREATE INDEX idx_fraud_flags_unresolved_severity
    ON fraud_flags(severity, flagged_at) WHERE is_resolved = FALSE;
CREATE INDEX idx_fraud_flags_claim
    ON fraud_flags(claim_id) WHERE claim_id IS NOT NULL;


-- ============================================================================
-- SECTION 7: PAYMENT TABLE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: payment_transactions
-- Covers BOTH inbound (worker pays weekly premium) and outbound (payout on claim).
-- CONSTRAINT chk_payment_reference: DB-level enforcement that a premium txn
--   always has a policy_id and a payout txn always has a claim_id.
--   This prevents orphaned financial records.
-- razorpay_signature: stored for webhook verification security.
-- upi_id / bank_account / ifsc_code: populated for payout transactions so
--   each transaction is self-contained for financial audit.
-- retry_count: incremented by the payment retry service; alert on > 3 retries.
-- ----------------------------------------------------------------------------
CREATE TABLE payment_transactions (
    id                    SERIAL PRIMARY KEY,
    user_id               INTEGER        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    policy_id             INTEGER        REFERENCES user_policies(id) ON DELETE SET NULL,
    claim_id              INTEGER        REFERENCES claims(id) ON DELETE SET NULL,
    payment_type          payment_type   NOT NULL,
    amount                DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    currency              CHAR(3)        NOT NULL DEFAULT 'INR',
    payment_method        VARCHAR(50),   -- 'razorpay', 'upi', 'bank_transfer', 'mock'
    status                payment_status NOT NULL DEFAULT 'pending',
    razorpay_order_id     VARCHAR(100),
    razorpay_payment_id   VARCHAR(100),
    razorpay_signature    VARCHAR(255),  -- for webhook verification
    -- Payout destination snapshot (populated for payment_type = 'payout')
    upi_id                VARCHAR(100),
    bank_account          VARCHAR(20),
    ifsc_code             VARCHAR(11),
    failure_reason        TEXT,
    retry_count           SMALLINT       NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    initiated_at          TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at          TIMESTAMPTZ,
    CONSTRAINT chk_payment_reference CHECK (
        (payment_type = 'premium' AND policy_id IS NOT NULL) OR
        (payment_type = 'payout'  AND claim_id  IS NOT NULL)
    )
);

CREATE INDEX idx_payments_user
    ON payment_transactions(user_id, initiated_at DESC);
CREATE INDEX idx_payments_policy
    ON payment_transactions(policy_id) WHERE policy_id IS NOT NULL;
CREATE INDEX idx_payments_claim
    ON payment_transactions(claim_id) WHERE claim_id IS NOT NULL;
CREATE INDEX idx_payments_razorpay_order
    ON payment_transactions(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX idx_payments_pending_retry
    ON payment_transactions(initiated_at ASC) WHERE status = 'pending';
CREATE INDEX idx_payments_type_status
    ON payment_transactions(payment_type, status);


-- ============================================================================
-- SECTION 8: OPERATIONAL TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: notifications
-- channel: sms (Twilio/MSG91), push (FCM), email (SendGrid).
-- reference_type + reference_id: generic polymorphic link for PWA deep links.
--   e.g., { reference_type: 'claim', reference_id: 42 }
-- retry_count: notification delivery service increments on failure.
-- read_at: set by the PWA when user taps the notification.
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title          VARCHAR(200)          NOT NULL,
    body           TEXT                  NOT NULL,
    channel        notification_channel  NOT NULL,
    status         notification_status   NOT NULL DEFAULT 'pending',
    reference_type VARCHAR(50),          -- 'claim', 'policy', 'payment', 'trigger_alert'
    reference_id   INTEGER,
    metadata       JSONB,                -- PWA deep-link data
    failure_reason TEXT,
    retry_count    SMALLINT              NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at        TIMESTAMPTZ,
    read_at        TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_time
    ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_pending
    ON notifications(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_notifications_unread
    ON notifications(user_id, status) WHERE status = 'sent';


-- ----------------------------------------------------------------------------
-- TABLE: audit_logs
-- Immutable append-only record of every admin or system action.
-- admin_id NULL: system-initiated actions (cron auto-approval, etc.).
-- old_values / new_values: JSONB snapshot of the record before and after.
--   Without these, audit_logs are just a note, not a real audit trail.
-- user_agent: for security forensics on admin portal access.
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id           SERIAL PRIMARY KEY,
    admin_id     INTEGER     REFERENCES admins(id) ON DELETE SET NULL,
    action       VARCHAR(100) NOT NULL,    -- 'claim_approved', 'user_banned', etc.
    entity_type  VARCHAR(50)  NOT NULL,    -- 'claims', 'users', 'user_policies'
    entity_id    INTEGER      NOT NULL,
    old_values   JSONB,
    new_values   JSONB,
    reason       TEXT,
    ip_address   INET,
    user_agent   TEXT,
    performed_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_entity
    ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_admin
    ON audit_logs(admin_id, performed_at DESC) WHERE admin_id IS NOT NULL;
CREATE INDEX idx_audit_action
    ON audit_logs(action, performed_at DESC);
CREATE INDEX idx_audit_date
    ON audit_logs(performed_at DESC);


-- ============================================================================
-- SECTION 9: FUNCTIONS & TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FUNCTION: update_updated_at_column()
-- Automatically keeps updated_at in sync on any UPDATE. Attach to any table
-- that has an updated_at column via a BEFORE UPDATE trigger.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_cities_updated_at
    BEFORE UPDATE ON cities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_insurance_plans_updated_at
    BEFORE UPDATE ON insurance_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_triggers_updated_at
    BEFORE UPDATE ON triggers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_user_policies_updated_at
    BEFORE UPDATE ON user_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_admins_updated_at
    BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ----------------------------------------------------------------------------
-- FUNCTION: update_policy_claims_count()
-- Fires AFTER a claim status changes TO 'approved'.
-- Increments both the current-cycle count and lifetime count on the policy.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_policy_claims_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        UPDATE user_policies
        SET
            claims_count          = claims_count + 1,
            lifetime_claims_count = lifetime_claims_count + 1,
            updated_at            = CURRENT_TIMESTAMP
        WHERE id = NEW.policy_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claims_update_policy_count
    AFTER INSERT OR UPDATE OF status ON claims
    FOR EACH ROW EXECUTE FUNCTION update_policy_claims_count();


-- ----------------------------------------------------------------------------
-- FUNCTION: auto_flag_suspicious_claims()
-- Fires BEFORE INSERT on claims.
-- If legitimacy_score < 50: sets status to 'under_review' and creates a
--   fraud_flag record automatically. This implements the Payout Decision Matrix
--   from the README (score 0-49 → manual investigation).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_flag_suspicious_claims()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.legitimacy_score IS NOT NULL AND NEW.legitimacy_score < 50 THEN
        -- Escalate status before insert
        NEW.status := 'under_review';

        -- Create a fraud flag (INSERT after the claim row exists via AFTER trigger
        -- would be cleaner, but we use a deferred approach here for simplicity:
        -- the backend service should also call this explicitly for full control)
        INSERT INTO fraud_flags (user_id, claim_id, severity, reason, detection_signals)
        VALUES (
            NEW.user_id,
            NEW.id,
            CASE
                WHEN NEW.legitimacy_score < 20 THEN 'critical'::fraud_severity
                WHEN NEW.legitimacy_score < 35 THEN 'high'::fraud_severity
                ELSE                                'medium'::fraud_severity
            END,
            'Auto-flagged: legitimacy_score = ' || NEW.legitimacy_score,
            jsonb_build_object(
                'legitimacy_score', NEW.legitimacy_score,
                'auto_flagged', TRUE
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- NOTE: This is AFTER INSERT to ensure claim.id exists for the fraud_flags FK.
-- The status mutation above is fine on BEFORE; fraud_flags insert needs AFTER.
-- Split into two triggers for correctness:

CREATE OR REPLACE FUNCTION set_claim_under_review()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.legitimacy_score IS NOT NULL AND NEW.legitimacy_score < 50 THEN
        NEW.status := 'under_review';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claims_set_review_status
    BEFORE INSERT ON claims
    FOR EACH ROW EXECUTE FUNCTION set_claim_under_review();

CREATE OR REPLACE FUNCTION insert_fraud_flag_for_claim()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.legitimacy_score IS NOT NULL AND NEW.legitimacy_score < 50 THEN
        INSERT INTO fraud_flags (user_id, claim_id, severity, reason, detection_signals)
        VALUES (
            NEW.user_id,
            NEW.id,
            CASE
                WHEN NEW.legitimacy_score < 20 THEN 'critical'::fraud_severity
                WHEN NEW.legitimacy_score < 35 THEN 'high'::fraud_severity
                ELSE                                'medium'::fraud_severity
            END,
            'Auto-flagged: legitimacy_score = ' || NEW.legitimacy_score,
            jsonb_build_object('legitimacy_score', NEW.legitimacy_score, 'auto_flagged', TRUE)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claims_auto_fraud_flag
    AFTER INSERT ON claims
    FOR EACH ROW EXECUTE FUNCTION insert_fraud_flag_for_claim();


-- ----------------------------------------------------------------------------
-- FUNCTION: track_subscription_continuity()
-- Fires BEFORE INSERT on user_policies.
-- Computes streak, gap, and loyalty discount by comparing to the most recent
-- previous policy for this user. Writes an event row to user_subscription_history.
-- STREAK_BREAK_GAP = 2 days grace period (handles payment processing delays).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION track_subscription_continuity()
RETURNS TRIGGER AS $$
DECLARE
    v_last_policy  RECORD;
    v_gap_days     INTEGER;
    v_season       season_type;
BEGIN
    -- Determine season from start_date month
    v_season := CASE
        WHEN EXTRACT(MONTH FROM NEW.start_date) IN (6, 7, 8, 9) THEN 'monsoon'::season_type
        WHEN EXTRACT(MONTH FROM NEW.start_date) IN (3, 4, 5)    THEN 'summer'::season_type
        WHEN EXTRACT(MONTH FROM NEW.start_date) IN (12, 1, 2)   THEN 'winter'::season_type
        ELSE 'normal'::season_type
    END;

    -- Get most recent prior policy for this user
    SELECT * INTO v_last_policy
    FROM user_policies
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND status IN ('active', 'expired')
    ORDER BY end_date DESC
    LIMIT 1;

    IF v_last_policy IS NULL THEN
        -- First-ever policy
        NEW.is_first_policy  := TRUE;
        NEW.cycle_number     := 1;
        INSERT INTO user_subscription_history
            (user_id, event_type, policy_id, consecutive_count, season, event_date)
        VALUES
            (NEW.user_id, 'subscribed', NEW.id, 0, v_season, NEW.start_date);

    ELSE
        v_gap_days           := NEW.start_date - v_last_policy.end_date;
        NEW.is_first_policy  := FALSE;
        NEW.cycle_number     := v_last_policy.cycle_number + 1;

        IF v_gap_days <= 2 THEN
            -- Continuous renewal (within 2-day grace period)
            NEW.loyalty_discount_percent := CASE
                WHEN v_last_policy.cycle_number >= 12 THEN 15.00
                WHEN v_last_policy.cycle_number >= 8  THEN 10.00
                WHEN v_last_policy.cycle_number >= 4  THEN  5.00
                ELSE 0.00
            END;

            INSERT INTO user_subscription_history
                (user_id, event_type, policy_id, consecutive_count, gap_days, season, event_date)
            VALUES
                (NEW.user_id, 'renewed', NEW.id, NEW.cycle_number, v_gap_days, v_season, NEW.start_date);

        ELSE
            -- Lapse detected — reset loyalty discount
            NEW.loyalty_discount_percent := 0.00;

            -- Log the lapse event against the OLD policy
            INSERT INTO user_subscription_history
                (user_id, event_type, policy_id, consecutive_count, gap_days, season, event_date)
            VALUES
                (NEW.user_id, 'lapsed', v_last_policy.id, 0, v_gap_days, v_season, v_last_policy.end_date);

            -- Log the reactivation event for the NEW policy
            INSERT INTO user_subscription_history
                (user_id, event_type, policy_id, consecutive_count, gap_days, season, event_date)
            VALUES
                (NEW.user_id, 'reactivated', NEW.id, 0, v_gap_days, v_season, NEW.start_date);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_track_subscription_continuity
    BEFORE INSERT ON user_policies
    FOR EACH ROW EXECUTE FUNCTION track_subscription_continuity();


-- ----------------------------------------------------------------------------
-- FUNCTION: calculate_subscription_trust_score(p_user_id)
-- Callable by the Node.js backend via: SELECT calculate_subscription_trust_score($1)
-- Returns the subscription sub-score (0–40) based on current policy state.
-- Backend should also UPDATE user_trust_metrics.subscription_score after calling.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_subscription_trust_score(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_score        INTEGER := 0;
    v_consecutive  SMALLINT;
    v_total_weeks  SMALLINT;
    v_lapse_count  SMALLINT;
    v_days_lapse   INTEGER;
BEGIN
    SELECT
        COALESCE(cycle_number, 0),
        COALESCE(lifetime_claims_count, 0),
        NULL  -- days_since_last_lapse not directly on policy; use history table
    INTO v_consecutive, v_total_weeks, v_days_lapse
    FROM user_policies
    WHERE user_id = p_user_id AND status = 'active'
    ORDER BY created_at DESC LIMIT 1;

    SELECT COUNT(*) INTO v_lapse_count
    FROM user_subscription_history
    WHERE user_id = p_user_id AND event_type = 'lapsed';

    -- Consecutive streak: 2 pts/week, max 25
    v_score := v_score + LEAST(COALESCE(v_consecutive, 0) * 2, 25);
    -- Lifetime weeks: 1 pt/week, max 10
    v_score := v_score + LEAST(COALESCE(v_total_weeks, 0), 10);
    -- Lapse penalty: -3 per lapse, max -10
    v_score := v_score - LEAST(COALESCE(v_lapse_count, 0) * 3, 10);

    RETURN GREATEST(0, LEAST(v_score, 40));
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- SECTION 10: VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW v_active_users AS
SELECT
    u.id,
    u.name,
    u.email,
    u.phone,
    p.name   AS platform_name,
    c.name   AS city_name,
    u.weekly_income,
    u.legitimacy_score,
    v.status AS verification_status,
    utm.total_trust_score,
    u.created_at
FROM users u
LEFT JOIN platforms          p   ON u.platform_id = p.id
LEFT JOIN cities             c   ON u.city_id     = c.id
LEFT JOIN verifications      v   ON u.id          = v.user_id
LEFT JOIN user_trust_metrics utm ON u.id          = utm.user_id
WHERE u.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_user_policies AS
SELECT
    up.id,
    up.user_id,
    u.name          AS user_name,
    ip.plan_name,
    ip.plan_code,
    up.status,
    up.start_date,
    up.end_date,
    up.calculated_premium,
    up.loyalty_discount_percent,
    up.claims_count,
    ip.max_claims_per_cycle,
    up.cycle_number,
    up.created_at
FROM user_policies up
JOIN users          u  ON up.user_id = u.id
JOIN insurance_plans ip ON up.plan_id = ip.id
WHERE u.deleted_at IS NULL;

CREATE OR REPLACE VIEW v_pending_claims AS
SELECT
    c.id            AS claim_id,
    c.user_id,
    u.name          AS user_name,
    t.event_name    AS trigger_name,
    c.trigger_value,
    c.payout_amount,
    c.legitimacy_score,
    c.status,
    c.triggered_at,
    ff.severity     AS fraud_flag_severity
FROM claims c
JOIN users    u  ON c.user_id    = u.id
JOIN triggers t  ON c.trigger_id = t.id
LEFT JOIN fraud_flags ff ON c.id = ff.claim_id AND ff.is_resolved = FALSE
WHERE c.status IN ('pending', 'under_review')
  AND u.deleted_at IS NULL
ORDER BY
    CASE c.status WHEN 'under_review' THEN 0 ELSE 1 END,
    c.triggered_at ASC;

CREATE OR REPLACE VIEW v_user_loyalty_tiers AS
SELECT
    u.id                         AS user_id,
    u.name,
    up.cycle_number              AS consecutive_renewals,
    up.loyalty_discount_percent,
    up.lifetime_claims_count,
    CASE
        WHEN up.cycle_number >= 12 THEN 'platinum'
        WHEN up.cycle_number >= 8  THEN 'gold'
        WHEN up.cycle_number >= 4  THEN 'silver'
        WHEN up.cycle_number >= 1  THEN 'bronze'
        ELSE 'new'
    END                          AS loyalty_tier,
    calculate_subscription_trust_score(u.id) AS subscription_score
FROM users u
LEFT JOIN user_policies up ON u.id = up.user_id AND up.status = 'active'
WHERE u.deleted_at IS NULL;


-- ============================================================================
-- SECTION 11: SEED DATA
-- ============================================================================

INSERT INTO platforms (name, code) VALUES
    ('Zomato',     'zomato'),
    ('Swiggy',     'swiggy');

INSERT INTO cities (name, state, latitude, longitude, risk_multiplier) VALUES
    ('Delhi',     'Delhi',         28.6139, 77.2090, 1.50),
    ('Mumbai',    'Maharashtra',   19.0760, 72.8777, 1.30),
    ('Bangalore', 'Karnataka',     12.9716, 77.5946, 1.00),
    ('Chennai',   'Tamil Nadu',    13.0827, 80.2707, 1.20),
    ('Hyderabad', 'Telangana',     17.3850, 78.4867, 1.10),
    ('Kolkata',   'West Bengal',   22.5726, 88.3639, 1.40),
    ('Pune',      'Maharashtra',   18.5204, 73.8567, 1.10),
    ('Ahmedabad', 'Gujarat',       23.0225, 72.5714, 1.20);

INSERT INTO insurance_plans
    (plan_name, plan_code, description, base_premium_percent, min_premium, max_premium, coverage_amount, max_claims_per_cycle)
VALUES
    ('Basic Shield',    'BASIC',    'Entry-level weekly income protection.',                5.00,  49.00, 300.00, 2000.00, 2),
    ('Standard Guard',  'STANDARD', 'Full disruption coverage for active workers.',        7.50,  99.00, 450.00, 4000.00, 3),
    ('Elite Armour',    'ELITE',    'Maximum protection for high-earning workers.',        10.00, 149.00, 600.00, 6000.00, 5);

INSERT INTO triggers
    (event_type, event_name, condition_text, threshold_value, threshold_unit, operator, base_payout, data_source, cooldown_hours)
VALUES
    ('heavy_rain',        'Heavy Rain',         'Rainfall > 50mm in last hour',    50.00,  'mm',      'gt',  800.00, 'openweather',    8),
    ('extreme_heat',      'Extreme Heat',       'Temperature >= 42°C',             42.00,  '°C',      'gte', 600.00, 'openweather',   12),
    ('high_pollution',    'High Pollution',     'AQI > 350',                      350.00,  'AQI',     'gt',  500.00, 'aqicn_api',     12),
    ('curfew',            'Curfew/Lockdown',    'Government curfew/alert active',   1.00,  'boolean', 'gte',1000.00, 'govt_news_api', 24),
    ('platform_downtime', 'Platform Downtime',  'App API failure > 30 minutes',    30.00,  'minutes', 'gt',  700.00, 'platform_mon',   6);

-- ============================================================================
-- END OF SCHEMA 
-- ============================================================================
