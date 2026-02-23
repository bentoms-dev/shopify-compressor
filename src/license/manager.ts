/**
 * Shopify Compressor Pro - License Manager
 *
 * Validates license keys via the LemonSqueezy License API.
 * License keys are stored locally in ~/.shopify-compressor-pro/license.json
 *
 * LemonSqueezy License API reference:
 *   - POST /v1/licenses/activate   (license_key, instance_name)
 *   - POST /v1/licenses/validate   (license_key, instance_id)
 *   - POST /v1/licenses/deactivate (license_key, instance_id)
 *
 * Content-Type: application/x-www-form-urlencoded
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';

// ============================================
// Types
// ============================================

export interface LicenseInfo {
  /** The license key (masked) */
  key: string;
  /** Whether the license is currently valid */
  valid: boolean;
  /** License holder email */
  email?: string;
  /** License holder name */
  name?: string;
  /** License tier: 'individual' | 'team' | 'enterprise' */
  tier: LicenseTier;
  /** Maximum activations allowed */
  activationLimit?: number;
  /** Current activation count */
  activationUsage?: number;
  /** Product name from LemonSqueezy */
  productName?: string;
  /** Variant name from LemonSqueezy */
  variantName?: string;
  /** Expiration date (ISO string), null for lifetime */
  expiresAt: string | null;
  /** Last successful validation timestamp */
  lastValidated: number;
  /** Machine fingerprint */
  machineId: string;
}

export type LicenseTier = 'individual' | 'team' | 'enterprise';

interface StoredLicense {
  key: string;
  /** Instance ID returned by LemonSqueezy on activation */
  instanceId: string;
  /** Instance name we sent on activation */
  instanceName: string;
  tier: LicenseTier;
  email?: string;
  name?: string;
  activationLimit?: number;
  activationUsage?: number;
  productName?: string;
  variantId?: number;
  variantName?: string;
  expiresAt: string | null;
  lastValidated: number;
  machineId: string;
  checksum: string;
}

// -----------------------------------------------
// LemonSqueezy License API response types
// -----------------------------------------------

interface LsLicenseKey {
  id: number;
  status: 'inactive' | 'active' | 'expired' | 'disabled';
  key: string;
  activation_limit: number;
  activation_usage: number;
  created_at: string;
  expires_at: string | null;
}

interface LsInstance {
  id: string;
  name: string;
  created_at: string;
}

interface LsMeta {
  store_id: number;
  order_id: number;
  order_item_id: number;
  product_id: number;
  product_name: string;
  variant_id: number;
  variant_name: string;
  customer_id: number;
  customer_name: string;
  customer_email: string;
}

interface LsActivateResponse {
  activated: boolean;
  error: string | null;
  license_key: LsLicenseKey;
  instance: LsInstance;
  meta: LsMeta;
}

interface LsValidateResponse {
  valid: boolean;
  error: string | null;
  license_key: LsLicenseKey;
  instance: LsInstance | null;
  meta: LsMeta;
}

// LsDeactivateResponse is not parsed in code since we fire-and-forget,
// but documented here for reference:
// { deactivated: boolean, error: string | null, license_key: LsLicenseKey, meta: LsMeta }

// ============================================
// Constants
// ============================================

const LICENSE_DIR = join(homedir(), '.shopify-compressor-pro');
const LICENSE_FILE = join(LICENSE_DIR, 'license.json');

/** How often to re-validate online (24 hours) */
const VALIDATION_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Offline grace period (7 days) */
const OFFLINE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/** LemonSqueezy License API base URL */
const API_BASE = 'https://api.lemonsqueezy.com/v1';

/**
 * Map LemonSqueezy variant names → license tiers.
 *
 * When you create your product in LemonSqueezy, name the variants
 * exactly as listed here (case-insensitive), or set the env var
 * SCOMP_PRO_VARIANT_MAP to override.
 *
 * Example env override:
 *   SCOMP_PRO_VARIANT_MAP='{"123":"individual","456":"team","789":"enterprise"}'
 *   (maps variant IDs instead of names)
 */
const DEFAULT_VARIANT_MAP: Record<string, LicenseTier> = {
  individual: 'individual',
  solo: 'individual',
  personal: 'individual',
  default: 'individual',
  team: 'team',
  business: 'team',
  enterprise: 'enterprise',
  unlimited: 'enterprise',
};

// ============================================
// License Manager
// ============================================

export class LicenseManager {
  private license: StoredLicense | null = null;
  private validated = false;
  private variantIdMap: Record<string, LicenseTier> | null = null;

  constructor() {
    // Check for variant ID mapping from env
    const envMap = process.env.SCOMP_PRO_VARIANT_MAP;
    if (envMap) {
      try {
        this.variantIdMap = JSON.parse(envMap);
      } catch {
        logger.debug('Could not parse SCOMP_PRO_VARIANT_MAP env var');
      }
    }
  }

  // ==========================================
  // Public API
  // ==========================================

  /**
   * Load stored license from disk
   */
  async load(): Promise<boolean> {
    try {
      if (!existsSync(LICENSE_FILE)) {
        return false;
      }

      const content = await readFile(LICENSE_FILE, 'utf-8');
      const stored: StoredLicense = JSON.parse(content);

      // Verify checksum
      const { checksum, ...data } = stored;
      const expectedChecksum = this.computeChecksum(data);
      if (checksum !== expectedChecksum) {
        logger.warn('License file appears to be tampered with');
        return false;
      }

      // Verify machine
      if (stored.machineId !== this.getMachineId()) {
        logger.warn('License is registered to a different machine');
        return false;
      }

      this.license = stored;
      return true;
    } catch {
      logger.debug('Could not load license file');
      return false;
    }
  }

  /**
   * Activate a license key via LemonSqueezy
   */
  async activate(licenseKey: string): Promise<LicenseInfo> {
    const machineId = this.getMachineId();
    const instanceName = `scomp-pro-${machineId}`;

    // POST /v1/licenses/activate
    const response = await fetch(`${API_BASE}/licenses/activate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        license_key: licenseKey,
        instance_name: instanceName,
      }),
    });

    const data = (await response.json()) as LsActivateResponse;

    if (!data.activated) {
      throw new ProLicenseError(
        data.error || 'License activation failed. Please check your key and try again.'
      );
    }

    // Resolve tier from variant
    const tier = this.resolveTier(data.meta.variant_id, data.meta.variant_name);

    const stored: Omit<StoredLicense, 'checksum'> = {
      key: licenseKey,
      instanceId: data.instance.id,
      instanceName,
      tier,
      email: data.meta.customer_email,
      name: data.meta.customer_name,
      activationLimit: data.license_key.activation_limit,
      activationUsage: data.license_key.activation_usage,
      productName: data.meta.product_name,
      variantId: data.meta.variant_id,
      variantName: data.meta.variant_name,
      expiresAt: data.license_key.expires_at,
      lastValidated: Date.now(),
      machineId,
    };

    this.license = {
      ...stored,
      checksum: this.computeChecksum(stored),
    };

    this.validated = true;
    await this.save();

    return this.getLicenseInfo()!;
  }

  /**
   * Deactivate the current license via LemonSqueezy
   */
  async deactivate(): Promise<void> {
    if (this.license) {
      try {
        await fetch(`${API_BASE}/licenses/deactivate`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            license_key: this.license.key,
            instance_id: this.license.instanceId,
          }),
        });
      } catch {
        logger.debug('Could not notify LemonSqueezy deactivation API');
      }
    }

    this.license = null;
    this.validated = false;

    try {
      const { unlink } = await import('fs/promises');
      if (existsSync(LICENSE_FILE)) {
        await unlink(LICENSE_FILE);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Validate the current license (online check with offline grace period)
   */
  async validate(): Promise<boolean> {
    if (!this.license) {
      return false;
    }

    // Check expiration date
    if (this.license.expiresAt) {
      const expiry = new Date(this.license.expiresAt).getTime();
      if (Date.now() > expiry) {
        logger.warn('License has expired');
        return false;
      }
    }

    const timeSinceValidation = Date.now() - this.license.lastValidated;

    // If recently validated, skip online check
    if (timeSinceValidation < VALIDATION_INTERVAL_MS) {
      this.validated = true;
      return true;
    }

    // Try online validation via LemonSqueezy
    try {
      const body: Record<string, string> = {
        license_key: this.license.key,
      };
      // Include instance_id if we have one
      if (this.license.instanceId) {
        body.instance_id = this.license.instanceId;
      }

      const response = await fetch(`${API_BASE}/licenses/validate`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(body),
      });

      const data = (await response.json()) as LsValidateResponse;

      if (data.valid) {
        // Update stored license with fresh data
        const { checksum: _, ...stored } = this.license;
        stored.lastValidated = Date.now();
        stored.activationUsage = data.license_key.activation_usage;
        stored.expiresAt = data.license_key.expires_at;

        // Re-resolve tier in case variant changed
        stored.tier = this.resolveTier(data.meta.variant_id, data.meta.variant_name);

        this.license = { ...stored, checksum: this.computeChecksum(stored) };
        await this.save();
        this.validated = true;
        return true;
      } else {
        // License no longer valid (disabled, expired, etc.)
        const status = data.license_key?.status;
        logger.warn(
          `License validation failed: ${data.error || 'Invalid'} (status: ${status || 'unknown'})`
        );
        this.validated = false;
        return false;
      }
    } catch {
      // Network error — check offline grace period
      if (timeSinceValidation < OFFLINE_GRACE_PERIOD_MS) {
        logger.debug('Offline validation: within 7-day grace period');
        this.validated = true;
        return true;
      }

      logger.warn(
        'License could not be validated online and has exceeded the 7-day offline grace period'
      );
      this.validated = false;
      return false;
    }
  }

  /**
   * Check if a Pro feature is available on the current tier
   */
  isFeatureAvailable(feature: ProFeature): boolean {
    if (!this.validated || !this.license) return false;

    const tierFeatures: Record<LicenseTier, ProFeature[]> = {
      individual: [
        'parallel-processing',
        'html-reports',
        'asset-budgets',
        'json-reports',
        'advanced-image-pipeline',
      ],
      team: [
        'parallel-processing',
        'html-reports',
        'asset-budgets',
        'json-reports',
        'advanced-image-pipeline',
        'ci-integration',
        'critical-css',
      ],
      enterprise: [
        'parallel-processing',
        'html-reports',
        'asset-budgets',
        'json-reports',
        'advanced-image-pipeline',
        'ci-integration',
        'critical-css',
        'dead-code-detection',
        'liquid-optimization',
        'dependency-graph',
      ],
    };

    return tierFeatures[this.license.tier]?.includes(feature) ?? false;
  }

  /**
   * Require a feature to be available, throw if not
   */
  requireFeature(feature: ProFeature): void {
    if (!this.validated || !this.license) {
      throw new ProLicenseError(
        'No active Pro license. Run `scomp-pro activate <key>` to activate.'
      );
    }
    if (!this.isFeatureAvailable(feature)) {
      throw new ProLicenseError(
        `Feature "${feature}" is not available on the "${this.license.tier}" tier. ` +
          'Upgrade your license at https://bentoms.lemonsqueezy.com/checkout/buy/783054c3-a94d-4260-bd7e-129b20e18e3e'
      );
    }
  }

  /**
   * Get license info (public-facing, key is masked)
   */
  getLicenseInfo(): LicenseInfo | null {
    if (!this.license) return null;

    return {
      key: this.maskKey(this.license.key),
      valid: this.validated,
      email: this.license.email,
      name: this.license.name,
      tier: this.license.tier,
      activationLimit: this.license.activationLimit,
      activationUsage: this.license.activationUsage,
      productName: this.license.productName,
      variantName: this.license.variantName,
      expiresAt: this.license.expiresAt,
      lastValidated: this.license.lastValidated,
      machineId: this.license.machineId,
    };
  }

  /**
   * Check if there's an active license
   */
  isActive(): boolean {
    return this.validated && this.license !== null;
  }

  /**
   * Get the license tier
   */
  getTier(): LicenseTier | null {
    return this.license?.tier ?? null;
  }

  // ==========================================
  // Private helpers
  // ==========================================

  /**
   * Generate a machine-specific fingerprint
   */
  private getMachineId(): string {
    const data = [homedir(), process.arch, process.platform].join('|');
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Compute a checksum over the license data to detect tampering
   */
  private computeChecksum(data: Omit<StoredLicense, 'checksum'>): string {
    const payload = JSON.stringify({
      key: data.key,
      instanceId: data.instanceId,
      tier: data.tier,
      machineId: data.machineId,
      expiresAt: data.expiresAt,
    });
    return createHash('sha256')
      .update(payload)
      .update('scomp-pro-salt-2026')
      .digest('hex');
  }

  /**
   * Save license to disk
   */
  private async save(): Promise<void> {
    if (!this.license) return;
    await mkdir(LICENSE_DIR, { recursive: true });
    await writeFile(LICENSE_FILE, JSON.stringify(this.license, null, 2));
  }

  /**
   * Mask a license key for display
   */
  private maskKey(key: string): string {
    if (key.length <= 8) return '****';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
  }

  /**
   * Resolve a LicenseTier from a LemonSqueezy variant.
   *
   * Priority:
   *  1. Variant ID map from SCOMP_PRO_VARIANT_MAP env var
   *  2. Variant name matched against DEFAULT_VARIANT_MAP
   *  3. Falls back to 'individual'
   */
  private resolveTier(variantId: number, variantName: string): LicenseTier {
    // 1. Check env-provided variant ID map
    if (this.variantIdMap) {
      const idKey = String(variantId);
      if (idKey in this.variantIdMap) {
        return this.variantIdMap[idKey];
      }
    }

    // 2. Match variant name (case-insensitive)
    const normalized = variantName.toLowerCase().trim();
    for (const [pattern, tier] of Object.entries(DEFAULT_VARIANT_MAP)) {
      if (normalized === pattern || normalized.includes(pattern)) {
        return tier;
      }
    }

    // 3. Default
    return 'individual';
  }
}

// ============================================
// Pro Feature List
// ============================================

export type ProFeature =
  | 'parallel-processing'
  | 'html-reports'
  | 'json-reports'
  | 'asset-budgets'
  | 'advanced-image-pipeline'
  | 'ci-integration'
  | 'critical-css'
  | 'dead-code-detection'
  | 'liquid-optimization'
  | 'dependency-graph';

// ============================================
// Errors
// ============================================

export class ProLicenseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProLicenseError';
  }
}

export default LicenseManager;
