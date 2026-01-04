# Knowledge Points Rewards Integration with Plans

## Overview

The rewards system now fully integrates Knowledge Points (KP) redemptions with user subscription plans. When users redeem KP for subscriptions, their plan is immediately updated in the `profiles` table, and the system works seamlessly with Stripe subscriptions.

## Changes Made

### 1. Updated `redeem_subscription` Function

**File:** `supabase/migrations/20250120000003_update_redeem_subscription_to_set_plan.sql`

**Changes:**
- Now updates `profiles.plan` and `profiles.plan_expires_at` when redeeming KP
- Handles plan upgrades intelligently:
  - If redeeming Pro, always upgrades to Pro
  - If redeeming Plus and user is on Free/expired, upgrades to Plus
  - If user already has Plus, extends expiration date
  - If user has Pro that expires later, keeps the Pro plan
- Returns the new plan and expiration date in the response

### 2. Created Plan Sync Function

**File:** `supabase/migrations/20250120000004_sync_plan_from_redemptions_and_stripe.sql`

**Purpose:**
- Syncs user plans from both KP redemptions and Stripe subscriptions
- Always uses the highest plan (pro > plus > free)
- Uses the latest expiration date
- Automatically triggered when redemptions are created/updated

### 3. Updated Rewards Page

**File:** `src/pages/Rewards.tsx`

**Changes:**
- Fetches `plan` and `plan_expires_at` when loading profile
- Updates profile state after redemption with new plan info
- Refreshes profile from database to ensure latest data
- Real-time subscription listens for plan changes
- Better toast messages showing the new plan

### 4. Updated Stripe Webhook Handler

**File:** `backend/server.js`

**Changes:**
- Calls `sync_user_plan` after updating plan from Stripe
- Ensures KP redemptions and Stripe subscriptions work together
- Gracefully handles if sync function doesn't exist yet

## How It Works

### Plan Priority Logic

1. **Pro Plan** - Highest priority
   - If user has Pro that expires later, keep it
   - If redeeming Pro, always upgrade to Pro

2. **Plus Plan** - Medium priority
   - Upgrades from Free to Plus
   - Extends Plus expiration if already on Plus
   - Downgrades if Pro expires and only Plus remains

3. **Free Plan** - Default
   - Used when no active subscriptions exist
   - Used when all subscriptions expire

### Integration with Stripe

- Stripe subscriptions update `profiles.plan` directly
- KP redemptions also update `profiles.plan`
- The `sync_user_plan` function ensures the best plan is always used
- If user has both Stripe Pro and KP Plus, Pro is used
- If user has Stripe Plus expiring in 2 months and KP Pro expiring in 1 month, Pro is used

## Database Functions

### `redeem_subscription(p_subscription_type, p_knowledge_points_cost)`

Redeems a subscription using knowledge points and updates the user's plan.

**Parameters:**
- `p_subscription_type`: 'plus' or 'pro'
- `p_knowledge_points_cost`: Number of KP to deduct

**Returns:**
```json
{
  "success": true,
  "redemption_id": "uuid",
  "expires_at": "2025-02-01T00:00:00Z",
  "plan": "plus" | "pro",
  "remaining_points": 150
}
```

### `sync_user_plan(p_user_id)`

Syncs user's plan from both KP redemptions and Stripe subscriptions.

**Parameters:**
- `p_user_id`: User UUID

**Returns:**
```json
{
  "success": true,
  "plan": "plus" | "pro" | "free",
  "expires_at": "2025-02-01T00:00:00Z" | null
}
```

## Applying Migrations

To apply the migrations, run them in order:

1. `20250120000003_update_redeem_subscription_to_set_plan.sql`
2. `20250120000004_sync_plan_from_redemptions_and_stripe.sql`

You can apply them via:
- Supabase Dashboard SQL Editor
- Supabase CLI: `supabase migration up`
- Or manually execute the SQL

## Testing

1. **Test KP Redemption:**
   - Go to `/app/rewards`
   - Redeem Plus or Pro subscription
   - Verify plan updates in profile
   - Check that plan features are immediately available

2. **Test Plan Priority:**
   - Redeem Plus subscription
   - Redeem Pro subscription
   - Verify Pro plan is active (higher priority)
   - Check expiration uses the latest date

3. **Test with Stripe:**
   - Purchase subscription via Stripe
   - Redeem KP subscription
   - Verify highest plan is used
   - Check that expiration uses latest date

## Pricing

- **Plus Plan:** 300 KP (or 200 KP with Plus discount, 100 KP with Pro discount)
- **Pro Plan:** 900 KP (or 700 KP with Plus discount, 650 KP with Pro discount)

## Features

✅ KP redemptions immediately update user plan  
✅ Works seamlessly with Stripe subscriptions  
✅ Automatic plan syncing  
✅ Real-time plan updates in UI  
✅ Plan priority handling (pro > plus > free)  
✅ Expiration date management  
✅ Plan extension when redeeming same plan  

## Next Steps

1. Apply the migrations to your database
2. Test the rewards page redemption flow
3. Verify plan changes are reflected immediately
4. Test integration with Stripe subscriptions
5. Monitor for any edge cases


