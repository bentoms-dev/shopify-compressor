# LemonSqueezy Verification Response

*Copy/paste or adapt this for your LemonSqueezy application response.*

---

Hi,

Thanks for reviewing my application. Here are the details you requested:

---

## 1. Pricing Information

Shopify Compressor Pro is an annual subscription with three tiers:

| Tier | Price | Target Customer | Activation Limit |
|------|-------|-----------------|------------------|
| **Individual** | $29/year | Solo developers & freelancers | 3 machines |
| **Team** | $99/year | Agencies & small teams | 10 machines |
| **Enterprise** | $249/year | Large organisations & high-volume shops | 50 machines |

All tiers include every core Pro feature (parallel processing, HTML/JSON/Markdown build reports, asset budget enforcement, build-over-build history). The Team tier adds CI/CD integration and critical CSS extraction. Enterprise adds dead code detection and Liquid template optimisation.

A free, open-source version of the tool ([shopify-compressor on npm](https://www.npmjs.com/package/shopify-compressor) / [GitHub](https://github.com/bentoms-dev/shopify-compressor)) is already published and available. The Pro version extends it with advanced features gated by a license key.

---

## 2. Demo Video

I'm preparing a short demo video and will share the link shortly. [See the separate script outline and record accordingly.]

---

## 3. Social Media / KYB-KYC

- **LinkedIn:** https://www.linkedin.com/in/bentoms
- **GitHub:** https://github.com/bentoms-dev
- **npm (published package):** https://www.npmjs.com/package/shopify-compressor

---

## 4. Product Details

**What is it?**
Shopify Compressor Pro is a Node.js CLI tool and JavaScript library that optimises Shopify theme assets — images, JavaScript, CSS/SCSS, SVGs, and Liquid templates. It reduces asset sizes to improve Shopify storefront performance (page load times, Core Web Vitals).

**How is it made?**
It's written in TypeScript and distributed as an npm package. It builds on popular open-source libraries (sharp for images, esbuild for JS, LightningCSS for CSS, SVGO for SVGs). The free base version is MIT-licensed and open source. The Pro version is a separate npm package (`shopify-compressor-pro`) with a proprietary commercial license.

**How is it licensed?**
Customers purchase an annual subscription through the Lemon Squeezy checkout. They receive a license key which they activate via the CLI (`scomp-pro activate <key>`). The license is validated against the Lemon Squeezy License API (activate/validate/deactivate endpoints). Each license has an activation limit (number of machines), and keys are tied to a machine fingerprint. There is a 24-hour online revalidation interval with a 7-day offline grace period.

**Who is it for?**
Shopify theme developers, Shopify agencies, and e-commerce teams who want to automate and optimise their theme assets as part of their build pipeline. These are professional developers working with Shopify's theme architecture.

**How are they sold?**
Annual subscriptions only (no one-time purchases at this stage). Customers pay yearly to retain access to Pro features and receive updates. If a subscription expires, the license key status changes to "expired" and Pro features are disabled — the free base features continue to work.

---

Let me know if you need any additional information.

Best regards,
Ben Toms
