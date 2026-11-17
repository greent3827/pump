CREATE TABLE subscriptions (
 user_id TEXT PRIMARY KEY NOT NULL,
 customer_key TEXT NOT NULL UNIQUE,
 billing_cipher TEXT,
 status TEXT NOT NULL DEFAULT 'awaiting_auth',
 anchor_day INTEGER,
 period_start TEXT,
 period_end TEXT,
 next_charge_at TEXT,
 cancel_at_end INTEGER NOT NULL DEFAULT 0,
 current_order TEXT,
 lock_until INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL
);
CREATE TABLE billing_sessions (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 customer_key TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 completed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE subscription_payments (
 order_id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount = 9900),
 status TEXT NOT NULL DEFAULT 'pending',
 payment_key TEXT,
 period_start TEXT NOT NULL,
 period_end TEXT NOT NULL,
 created_at TEXT NOT NULL,
 error_code TEXT
);
CREATE INDEX subscriptions_due ON subscriptions(status, next_charge_at);
CREATE INDEX subscription_payments_user ON subscription_payments(user_id, created_at);
