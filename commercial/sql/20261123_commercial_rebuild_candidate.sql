-- Beekeepy reconstructed commercial V2 candidate (PostgreSQL/Supabase).
-- NOT EXECUTED. NOT A COPY of the lost Nov 23 migration. NEVER overwrite app_state.
-- Do not apply to production without schema audit, backup and explicit approval.
BEGIN;
CREATE TABLE IF NOT EXISTS public.bee_commercial_subscription (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
    stripe_subscription_id text UNIQUE,
    stripe_customer_id text,
    status text NOT NULL DEFAULT 'none'
      CHECK(status IN ('none','active','trialing','past_due','unpaid','canceled','incomplete','incomplete_expired','paused')),
    price_id text,
    approved_price boolean NOT NULL DEFAULT false,
    period_end timestamptz,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    stripe_event_created bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.bee_commercial_order (
    order_id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    stripe_session_id text UNIQUE,
    stripe_payment_intent_id text,
    amount_minor bigint NOT NULL CHECK(amount_minor>=0),
    currency text NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.bee_commercial_webhook_event (
    event_id text PRIMARY KEY,
    event_type text NOT NULL,
    stripe_created bigint NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.bee_commercial_refund (
    request_id text PRIMARY KEY,
    order_id text NOT NULL REFERENCES public.bee_commercial_order(order_id) ON DELETE RESTRICT,
    stripe_refund_id text UNIQUE,
    amount_minor bigint NOT NULL CHECK(amount_minor>0),
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.bee_commercial_ticket (
    ticket_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 200),
    message text NOT NULL CHECK(length(message) BETWEEN 1 AND 5000),
    status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.bee_commercial_audit (
    audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor text NOT NULL,
    action text NOT NULL,
    object_id text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bee_commercial_subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bee_commercial_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bee_commercial_webhook_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bee_commercial_refund ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bee_commercial_ticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bee_commercial_audit ENABLE ROW LEVEL SECURITY;

-- Authenticated users may inspect ONLY their own commercial status.
-- Service role exclusively performs entitlement, payment, refund and audit writes.
DROP POLICY IF EXISTS bee_subscription_read_own ON public.bee_commercial_subscription;
CREATE POLICY bee_subscription_read_own ON public.bee_commercial_subscription
 FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
DROP POLICY IF EXISTS bee_order_read_own ON public.bee_commercial_order;
CREATE POLICY bee_order_read_own ON public.bee_commercial_order
 FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
DROP POLICY IF EXISTS bee_ticket_read_own ON public.bee_commercial_ticket;
CREATE POLICY bee_ticket_read_own ON public.bee_commercial_ticket
 FOR SELECT TO authenticated USING (user_id=(select auth.uid()));
-- No direct INSERT/UPDATE/DELETE policies for commercial tables.
-- Account deletion/erasure route is intentionally out of scope and unmodified.
COMMIT;
