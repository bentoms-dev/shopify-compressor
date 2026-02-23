import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LicenseManager, ProLicenseError } from '../license/manager.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// -----------------------------------------------
// Helpers to build a realistic LemonSqueezy response
// -----------------------------------------------

function lsActivateResponse(
  overrides: {
    activated?: boolean;
    error?: string | null;
    variantName?: string;
    variantId?: number;
    email?: string;
    name?: string;
    expiresAt?: string | null;
    status?: string;
    activationLimit?: number;
    activationUsage?: number;
  } = {}
) {
  const activated = overrides.activated ?? true;
  return {
    activated,
    error: overrides.error ?? (activated ? null : 'Error'),
    license_key: {
      id: 1,
      status: overrides.status ?? (activated ? 'active' : 'inactive'),
      key: '38b1460a-5104-4067-a91d-77b872934d51',
      activation_limit: overrides.activationLimit ?? 5,
      activation_usage: overrides.activationUsage ?? 1,
      created_at: '2025-01-01T00:00:00.000000Z',
      expires_at: overrides.expiresAt ?? null,
    },
    instance: {
      id: 'f90ec370-fd83-46a5-8bbd-44a241e78665',
      name: 'scomp-pro-test',
      created_at: '2025-01-01T00:00:00.000000Z',
    },
    meta: {
      store_id: 1,
      order_id: 2,
      order_item_id: 3,
      product_id: 4,
      product_name: 'Shopify Compressor Pro',
      variant_id: overrides.variantId ?? 10,
      variant_name: overrides.variantName ?? 'Individual',
      customer_id: 6,
      customer_name: overrides.name ?? 'Test User',
      customer_email: overrides.email ?? 'test@example.com',
    },
  };
}

function mockSuccessfulActivation(variantName = 'Individual', opts = {}) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => lsActivateResponse({ variantName, ...opts }),
  });
}

// -----------------------------------------------
// Tests
// -----------------------------------------------

describe('LicenseManager', () => {
  let manager: LicenseManager;

  beforeEach(() => {
    manager = new LicenseManager();
    mockFetch.mockReset();
  });

  // ==========================================
  // Feature gating without a license
  // ==========================================

  describe('isFeatureAvailable (no license)', () => {
    it('should return false when not validated', () => {
      expect(manager.isFeatureAvailable('parallel-processing')).toBe(false);
      expect(manager.isFeatureAvailable('html-reports')).toBe(false);
    });

    it('should return null for getLicenseInfo', () => {
      expect(manager.getLicenseInfo()).toBeNull();
    });
  });

  describe('requireFeature (no license)', () => {
    it('should throw ProLicenseError', () => {
      expect(() => manager.requireFeature('parallel-processing')).toThrow(ProLicenseError);
    });

    it('should include helpful activation instructions', () => {
      expect(() => manager.requireFeature('parallel-processing')).toThrow(
        'scomp-pro activate'
      );
    });
  });

  // ==========================================
  // Activation
  // ==========================================

  describe('activate', () => {
    it('should fail when LemonSqueezy returns activated=false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () =>
          lsActivateResponse({ activated: false, error: 'Invalid license key' }),
      });

      await expect(manager.activate('bad-key')).rejects.toThrow('Invalid license key');
    });

    it('should fail on activation limit reached', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () =>
          lsActivateResponse({
            activated: false,
            error: 'This license key has reached the activation limit.',
          }),
      });

      await expect(manager.activate('used-key')).rejects.toThrow('activation limit');
    });

    it('should succeed and parse LemonSqueezy response', async () => {
      mockSuccessfulActivation('Individual', {
        email: 'dev@shopify.com',
        name: 'Jane Dev',
      });

      const info = await manager.activate('valid-key');
      expect(info.valid).toBe(true);
      expect(info.tier).toBe('individual');
      expect(info.email).toBe('dev@shopify.com');
      expect(info.name).toBe('Jane Dev');
      expect(info.productName).toBe('Shopify Compressor Pro');
      expect(info.variantName).toBe('Individual');
    });

    it('should store the instance ID from activation', async () => {
      mockSuccessfulActivation();

      await manager.activate('valid-key');
      const info = manager.getLicenseInfo();
      expect(info).not.toBeNull();
      // Instance should be tracked (we can't access it directly, but deactivation should work)
      expect(info!.valid).toBe(true);
    });

    it('should send form-urlencoded body', async () => {
      mockSuccessfulActivation();

      await manager.activate('my-key');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/activate');
      expect(opts.method).toBe('POST');
      expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(opts.body).toBeInstanceOf(URLSearchParams);
      expect(opts.body.get('license_key')).toBe('my-key');
      expect(opts.body.get('instance_name')).toMatch(/^scomp-pro-/);
    });
  });

  // ==========================================
  // Variant → Tier mapping
  // ==========================================

  describe('variant-to-tier mapping', () => {
    it('should map "Individual" variant to individual tier', async () => {
      mockSuccessfulActivation('Individual');
      await manager.activate('key');
      expect(manager.getTier()).toBe('individual');
    });

    it('should map "Solo" variant to individual tier', async () => {
      mockSuccessfulActivation('Solo');
      await manager.activate('key');
      expect(manager.getTier()).toBe('individual');
    });

    it('should map "Team" variant to team tier', async () => {
      mockSuccessfulActivation('Team');
      await manager.activate('key');
      expect(manager.getTier()).toBe('team');
    });

    it('should map "Business" variant to team tier', async () => {
      mockSuccessfulActivation('Business');
      await manager.activate('key');
      expect(manager.getTier()).toBe('team');
    });

    it('should map "Enterprise" variant to enterprise tier', async () => {
      mockSuccessfulActivation('Enterprise');
      await manager.activate('key');
      expect(manager.getTier()).toBe('enterprise');
    });

    it('should map "Unlimited" variant to enterprise tier', async () => {
      mockSuccessfulActivation('Unlimited');
      await manager.activate('key');
      expect(manager.getTier()).toBe('enterprise');
    });

    it('should be case-insensitive', async () => {
      mockSuccessfulActivation('ENTERPRISE');
      await manager.activate('key');
      expect(manager.getTier()).toBe('enterprise');
    });

    it('should default unknown variants to individual', async () => {
      mockSuccessfulActivation('Custom Plan');
      await manager.activate('key');
      expect(manager.getTier()).toBe('individual');
    });

    it('should match partial names (e.g. "Team Plan")', async () => {
      mockSuccessfulActivation('Team Plan');
      await manager.activate('key');
      expect(manager.getTier()).toBe('team');
    });
  });

  // ==========================================
  // Feature gating by tier
  // ==========================================

  describe('feature gating after activation', () => {
    it('individual: core features only', async () => {
      mockSuccessfulActivation('Individual');
      await manager.activate('key');

      expect(manager.isFeatureAvailable('parallel-processing')).toBe(true);
      expect(manager.isFeatureAvailable('html-reports')).toBe(true);
      expect(manager.isFeatureAvailable('asset-budgets')).toBe(true);
      expect(manager.isFeatureAvailable('ci-integration')).toBe(false);
      expect(manager.isFeatureAvailable('dead-code-detection')).toBe(false);
    });

    it('team: includes CI integration', async () => {
      mockSuccessfulActivation('Team');
      await manager.activate('key');

      expect(manager.isFeatureAvailable('parallel-processing')).toBe(true);
      expect(manager.isFeatureAvailable('ci-integration')).toBe(true);
      expect(manager.isFeatureAvailable('critical-css')).toBe(true);
      expect(manager.isFeatureAvailable('dead-code-detection')).toBe(false);
    });

    it('enterprise: all features', async () => {
      mockSuccessfulActivation('Enterprise');
      await manager.activate('key');

      expect(manager.isFeatureAvailable('parallel-processing')).toBe(true);
      expect(manager.isFeatureAvailable('ci-integration')).toBe(true);
      expect(manager.isFeatureAvailable('dead-code-detection')).toBe(true);
      expect(manager.isFeatureAvailable('liquid-optimization')).toBe(true);
      expect(manager.isFeatureAvailable('dependency-graph')).toBe(true);
    });

    it('requireFeature should throw on tier-restricted feature', async () => {
      mockSuccessfulActivation('Individual');
      await manager.activate('key');

      expect(() => manager.requireFeature('ci-integration')).toThrow(
        'not available on the "individual" tier'
      );
    });

    it('requireFeature should not throw for allowed feature', async () => {
      mockSuccessfulActivation('Individual');
      await manager.activate('key');

      expect(() => manager.requireFeature('parallel-processing')).not.toThrow();
    });
  });

  // ==========================================
  // Deactivation
  // ==========================================

  describe('deactivate', () => {
    it('should clear license state', async () => {
      mockSuccessfulActivation();
      await manager.activate('key');
      expect(manager.isActive()).toBe(true);

      // Deactivation API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deactivated: true, error: null }),
      });
      await manager.deactivate();

      expect(manager.getLicenseInfo()).toBeNull();
      expect(manager.isActive()).toBe(false);
    });

    it('should send instance_id to LemonSqueezy', async () => {
      mockSuccessfulActivation();
      await manager.activate('my-key');

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await manager.deactivate();

      // Second fetch call is the deactivation
      const [url, opts] = mockFetch.mock.calls[1];
      expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/deactivate');
      expect(opts.body.get('license_key')).toBe('my-key');
      expect(opts.body.get('instance_id')).toBe('f90ec370-fd83-46a5-8bbd-44a241e78665');
    });

    it('should still clear state if deactivation API fails', async () => {
      mockSuccessfulActivation();
      await manager.activate('key');

      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      await manager.deactivate();

      expect(manager.isActive()).toBe(false);
    });
  });

  // ==========================================
  // getLicenseInfo
  // ==========================================

  describe('getLicenseInfo', () => {
    it('should mask the license key', async () => {
      mockSuccessfulActivation();
      await manager.activate('ABCD-1234-EFGH-5678');

      const info = manager.getLicenseInfo();
      expect(info?.key).toBe('ABCD****5678');
    });

    it('should include activation limits', async () => {
      mockSuccessfulActivation('Individual', {
        activationLimit: 3,
        activationUsage: 1,
      });
      await manager.activate('key');

      const info = manager.getLicenseInfo();
      expect(info?.activationLimit).toBe(3);
      expect(info?.activationUsage).toBe(1);
    });

    it('should include expiration date', async () => {
      mockSuccessfulActivation('Individual', {
        expiresAt: '2027-01-01T00:00:00.000000Z',
      });
      await manager.activate('key');

      const info = manager.getLicenseInfo();
      expect(info?.expiresAt).toBe('2027-01-01T00:00:00.000000Z');
    });
  });

  // ==========================================
  // getTier
  // ==========================================

  describe('getTier', () => {
    it('should return null when no license', () => {
      expect(manager.getTier()).toBeNull();
    });

    it('should return tier after activation', async () => {
      mockSuccessfulActivation('Team');
      await manager.activate('key');
      expect(manager.getTier()).toBe('team');
    });
  });
});
