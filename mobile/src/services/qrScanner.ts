/**
 * GreenRoute Mobile - QR Code Parser & Deep Link Resolver
 * Decodes camera QR barcodes into valid registered smart bin identifiers.
 */

export interface ParsedBinQr {
  isValid: boolean;
  binId: number | null;
  tenantId: string | null;
  rawPayload: string;
}

export function parseSmartBinQr(data: string): ParsedBinQr {
  if (!data || typeof data !== "string") {
    return { isValid: false, binId: null, tenantId: null, rawPayload: data };
  }

  const trimmed = data.trim();

  // Pattern 1: Canonical URL: https://greenroute.app/citizen.html?bin_id=3&tenant=sou
  if (trimmed.includes("bin_id=")) {
    try {
      const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const binIdStr = url.searchParams.get("bin_id") || url.searchParams.get("scan_bin");
      const tenant = url.searchParams.get("tenant") || "sou";
      if (binIdStr && !isNaN(Number(binIdStr))) {
        return {
          isValid: true,
          binId: parseInt(binIdStr, 10),
          tenantId: tenant,
          rawPayload: trimmed,
        };
      }
    } catch {
      // Regex fallback if URL parsing fails
      const match = trimmed.match(/bin_id=([0-9]+)/i);
      if (match) {
        return {
          isValid: true,
          binId: parseInt(match[1], 10),
          tenantId: "sou",
          rawPayload: trimmed,
        };
      }
    }
  }

  // Pattern 2: Deep Link Schema: greenroute://bin?id=3&tenant=sou
  if (trimmed.startsWith("greenroute://")) {
    const match = trimmed.match(/[?&]id=([0-9]+)/i);
    if (match) {
      return {
        isValid: true,
        binId: parseInt(match[1], 10),
        tenantId: "sou",
        rawPayload: trimmed,
      };
    }
  }

  // Pattern 3: Cryptographic Tag UID: GR-SOU-0003-8F4A2C
  const tagMatch = trimmed.match(/GR-([A-Z0-9]+)-([0-9]+)-/i);
  if (tagMatch) {
    return {
      isValid: true,
      binId: parseInt(tagMatch[2], 10),
      tenantId: tagMatch[1].toLowerCase(),
      rawPayload: trimmed,
    };
  }

  // Pattern 4: Pure numeric string "3"
  if (/^[0-9]+$/.test(trimmed)) {
    return {
      isValid: true,
      binId: parseInt(trimmed, 10),
      tenantId: "sou",
      rawPayload: trimmed,
    };
  }

  return { isValid: false, binId: null, tenantId: null, rawPayload: trimmed };
}
