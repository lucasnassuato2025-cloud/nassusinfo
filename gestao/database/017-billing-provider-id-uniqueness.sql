BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS ux_subscriptions_provider_subscription_id
  ON public.subscriptions(provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

COMMIT;
