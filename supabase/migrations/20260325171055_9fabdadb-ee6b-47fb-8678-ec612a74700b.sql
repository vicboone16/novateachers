-- Fix RLS policies on reward tables to allow anon role (matching all other Cloud tables)
-- The Cloud client has no authenticated session since auth is against Nova Core

-- beacon_rewards: drop and recreate with anon+authenticated
DROP POLICY IF EXISTS "Authenticated users can insert rewards" ON public.beacon_rewards;
DROP POLICY IF EXISTS "Authenticated users can read active rewards" ON public.beacon_rewards;
DROP POLICY IF EXISTS "Authenticated users can update rewards" ON public.beacon_rewards;

CREATE POLICY "Open read beacon_rewards" ON public.beacon_rewards FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert beacon_rewards" ON public.beacon_rewards FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update beacon_rewards" ON public.beacon_rewards FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Open delete beacon_rewards" ON public.beacon_rewards FOR DELETE TO anon, authenticated USING (true);

-- beacon_reward_redemptions: drop and recreate
DROP POLICY IF EXISTS "Authenticated users can insert redemptions" ON public.beacon_reward_redemptions;
DROP POLICY IF EXISTS "Authenticated users can read redemptions" ON public.beacon_reward_redemptions;

CREATE POLICY "Open read beacon_reward_redemptions" ON public.beacon_reward_redemptions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert beacon_reward_redemptions" ON public.beacon_reward_redemptions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Open update beacon_reward_redemptions" ON public.beacon_reward_redemptions FOR UPDATE TO anon, authenticated USING (true);

-- reward_transactions: drop and recreate
DROP POLICY IF EXISTS "Authenticated users can insert reward transactions" ON public.reward_transactions;
DROP POLICY IF EXISTS "Authenticated users can read reward transactions" ON public.reward_transactions;

CREATE POLICY "Open read reward_transactions" ON public.reward_transactions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Open insert reward_transactions" ON public.reward_transactions FOR INSERT TO anon, authenticated WITH CHECK (true);