# LemonSqueezy Setup Guide — Shopify Compressor Pro

This guide walks you through setting up your LemonSqueezy store to sell Shopify Compressor Pro licenses.

---

## 1. Create Your LemonSqueezy Account & Store

1. Go to [app.lemonsqueezy.com/register](https://app.lemonsqueezy.com/register) and sign up
2. Complete the onboarding flow (payout method, tax info, etc.)
3. Your store will be created automatically

---

## 2. Create the Product

1. Go to **Products** → **New Product**
2. Fill in:
   - **Name:** `Shopify Compressor Pro`
   - **Description:** Advanced asset optimization for Shopify themes
   - **Media:** Add your logo/screenshots
3. Under **General** → **Product type**, choose **Software license**
4. Under **Licensing**:
   - ✅ Enable **Generate license keys**
   - Set **License length** (leave empty for lifetime, or set a duration for subscriptions)

---

## 3. Create Pricing Variants

Create **3 variants** that map to Pro tiers. The variant **name** determines the tier (case-insensitive matching):

### Individual — $29/year (or one-time)
1. Click **Add variant**
2. **Name:** `Individual`
3. **Price:** $29 (or your preferred price)
4. Under **License** settings:
   - **Activation limit:** `3` (3 machines per license)
5. Save

### Team — $99/year
1. Click **Add variant**
2. **Name:** `Team`
3. **Price:** $99
4. Under **License** settings:
   - **Activation limit:** `10`
5. Save

### Enterprise — $249/year
1. Click **Add variant**
2. **Name:** `Enterprise`
3. **Price:** $249
4. Under **License** settings:
   - **Activation limit:** `50` (or unlimited)
5. Save

> **Variant name → Tier mapping:**
> The license manager automatically maps variant names to tiers:
> | Variant Name | Tier |
> |---|---|
> | Individual, Solo, Personal, Default | `individual` |
> | Team, Business | `team` |
> | Enterprise, Unlimited | `enterprise` |
>
> If your variant names differ, set the `SCOMP_PRO_VARIANT_MAP` env var (see [Custom mapping](#custom-variant-mapping)).

---

## 4. Publish & Get Your Checkout Links

1. Click **Publish** on the product
2. Go to **Share** → Copy the checkout URL for each variant
3. Use these URLs on your website's pricing page (`https://shopifycompressor.com/pro`)

Checkout URLs look like:
```
https://yourstore.lemonsqueezy.com/checkout/buy/abc123-def456
```

---

## 5. Set Up Webhooks (Optional but Recommended)

Webhooks let you respond to events like subscription cancellations, refunds, and license updates in real-time.

1. Go to **Settings** → **Webhooks** → **Add Webhook**
2. **URL:** `https://shopifycompressor.com/api/webhooks/lemonsqueezy`
3. **Events to listen for:**
   - `order_created` — New purchase
   - `subscription_updated` — Plan changes
   - `subscription_cancelled` — Cancellation
   - `subscription_expired` — Expiry
   - `license_key_updated` — Manual license changes
4. **Signing secret:** Copy this value and set it as `LEMONSQUEEZY_WEBHOOK_SECRET` in your server's environment

### Webhook Handler Example

If you have a server/API for your marketing site, here's how to verify and handle webhooks:

```typescript
import { createHmac } from 'crypto';

export async function handleLemonSqueezyWebhook(req: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
  const body = await req.text();

  // Verify signature
  const signature = req.headers.get('x-signature');
  const hmac = createHmac('sha256', secret).update(body).digest('hex');

  if (signature !== hmac) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(body);
  const eventName = event.meta.event_name;

  switch (eventName) {
    case 'order_created':
      // New purchase — could send welcome email, update analytics, etc.
      console.log('New order:', event.data.attributes.identifier);
      break;

    case 'subscription_expired':
    case 'subscription_cancelled':
      // Could notify internal systems
      console.log('Subscription ended:', event.data.id);
      break;

    case 'license_key_updated':
      // License was manually changed in dashboard
      console.log('License updated:', event.data.id);
      break;
  }

  return new Response('OK', { status: 200 });
}
```

---

## 6. How License Activation Works

Here's the flow when a customer uses their license key:

```
Customer                    scomp-pro CLI              LemonSqueezy API
    │                            │                            │
    │  scomp-pro activate <key>  │                            │
    │ ─────────────────────────► │                            │
    │                            │  POST /licenses/activate   │
    │                            │  { license_key, instance } │
    │                            │ ──────────────────────────► │
    │                            │                            │
    │                            │  { activated: true,        │
    │                            │    instance: { id },       │
    │                            │    meta: { variant_name,   │
    │                            │      customer_email } }    │
    │                            │ ◄────────────────────────── │
    │                            │                            │
    │                            │  Save license locally      │
    │                            │  ~/.shopify-compressor-pro/ │
    │                            │                            │
    │  ✅ License activated!     │                            │
    │  Tier: individual          │                            │
    │ ◄───────────────────────── │                            │
```

### Revalidation
- Every **24 hours**, the CLI re-validates the license key with LemonSqueezy
- If offline, there's a **7-day grace period** before the license is considered invalid
- This means customers can work on planes, in bad-connectivity areas, etc.

### Machine Fingerprinting
- Each activation is tied to a machine fingerprint (SHA256 of homedir + arch + platform)
- Customers can deactivate and reactivate on different machines
- The activation limit (set per variant) controls how many machines they can use simultaneously

---

## 7. Custom Variant Mapping

If your LemonSqueezy variant names don't match the defaults, you can map variant **IDs** to tiers using an environment variable:

```bash
# Find your variant IDs in LemonSqueezy Dashboard → Products → Variants
# Each variant has a numeric ID

export SCOMP_PRO_VARIANT_MAP='{"123456":"individual","234567":"team","345678":"enterprise"}'
```

This is useful if you name your variants something like "Starter", "Growth", "Scale" instead of the default names.

---

## 8. Testing Your Setup

### Test Activation
```bash
# Generate a test license key in LemonSqueezy Dashboard:
# Products → Your Product → License Keys → Generate

scomp-pro activate YOUR-TEST-LICENSE-KEY

# Should output:
# ✅ License activated!
# Tier: individual
# Email: your@email.com
```

### Test Status
```bash
scomp-pro status

# Should output:
# License: XXXX****XXXX
# Status: Active
# Tier: Individual
# Email: your@email.com
```

### Test Deactivation
```bash
scomp-pro deactivate

# Should output:
# ✅ License deactivated
```

### Test Build with Pro Features
```bash
scomp-pro build --parallel --report html
```

---

## 9. CI/CD Setup for Customers

Customers can use their license key in CI without interactive activation:

```yaml
# GitHub Actions
env:
  SCOMP_PRO_LICENSE_KEY: ${{ secrets.SCOMP_PRO_LICENSE_KEY }}

steps:
  - run: npx shopify-compressor-pro build --parallel --report json --fail-on-budget
```

The `SCOMP_PRO_LICENSE_KEY` environment variable is automatically detected — no `activate` command needed.

---

## 10. Dashboard Checklist

- [ ] LemonSqueezy account created and verified
- [ ] Payout method configured
- [ ] Product created: "Shopify Compressor Pro"
- [ ] License key generation enabled on the product
- [ ] 3 variants created: Individual, Team, Enterprise
- [ ] Activation limits set per variant (3, 10, 50)
- [ ] Pricing set for each variant
- [ ] Product published
- [ ] Checkout URLs added to your website
- [ ] (Optional) Webhook endpoint configured
- [ ] Test license key generated and tested locally
