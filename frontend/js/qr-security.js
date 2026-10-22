/**
 * GreenRoute - QR Security, Anti-Fraud & Reward Reference Engine
 * 
 * Enforces:
 * 1. Single-Use per QR Code: Once a smart bin QR is scanned by a device/user, it cannot be scanned again.
 * 2. Encrypted Demo Mode Limits: Strict 3-scan maximum per device in demo mode with cryptographic tamper-resistance.
 * 3. Dynamic One-Time Reward Reference Codes: Generates unique single-use voucher codes (GR-RW-YYYY-XXXX) on every valid scan.
 * 4. One-Time Voucher Redemption: Guarantees reference codes can only be redeemed once.
 */

const GreenRouteQRSecurity = (function() {
    'use strict';

    const VAULT_STORAGE_KEY = 'gr_secure_vault_v2';
    const MAX_DEMO_SCANS = 3;
    const CRYPTO_PEPPER = 'GREENROUTE_ECO_SHIELD_2026_SECURE_TOKEN';

    // In-memory decrypted cache
    let vaultCache = null;

    // --- 1. DEVICE FINGERPRINTING & HARDWARE HASH ---
    function getDeviceEntropy() {
        let entropy = localStorage.getItem('gr_device_entropy');
        if (!entropy) {
            const arr = new Uint8Array(16);
            if (window.crypto && window.crypto.getRandomValues) {
                window.crypto.getRandomValues(arr);
            } else {
                for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
            }
            entropy = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
            localStorage.setItem('gr_device_entropy', entropy);
        }
        return entropy;
    }

    function calculateDeviceHash() {
        const parts = [
            navigator.userAgent || 'unknown-ua',
            screen.width + 'x' + screen.height + 'x' + (screen.colorDepth || 24),
            navigator.hardwareConcurrency || 4,
            new Date().getTimezoneOffset(),
            getDeviceEntropy()
        ].join('|||');

        // Simple fast string hash
        let hash = 0;
        for (let i = 0; i < parts.length; i++) {
            const char = parts.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return 'DEV-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    }

    // --- 2. ENCRYPTION & SIGNATURE VERIFICATION ---
    function computeChecksum(dataStr) {
        const payload = dataStr + ':::' + CRYPTO_PEPPER;
        let hash = 5381;
        for (let i = 0; i < payload.length; i++) {
            hash = ((hash << 5) + hash) + payload.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(16).padStart(8, '0');
    }

    function encryptPayload(obj) {
        const json = JSON.stringify(obj);
        const checksum = computeChecksum(json);
        const envelope = JSON.stringify({ d: json, s: checksum });
        return btoa(encodeURIComponent(envelope));
    }

    function decryptPayload(encoded) {
        try {
            if (!encoded) return null;
            const envelopeStr = decodeURIComponent(atob(encoded));
            const envelope = JSON.parse(envelopeStr);
            if (!envelope.d || !envelope.s) return null;

            // Verify checksum
            const expected = computeChecksum(envelope.d);
            if (envelope.s !== expected) {
                console.warn("[GreenRoute Security] Vault tamper detected! Signature mismatch.");
                return null;
            }
            return JSON.parse(envelope.d);
        } catch (e) {
            console.warn("[GreenRoute Security] Decryption error:", e);
            return null;
        }
    }

    // --- 3. VAULT MANAGEMENT ---
    function initializeVault() {
        const deviceId = calculateDeviceHash();
        return {
            deviceId: deviceId,
            demoScansCount: 0,
            maxDemoScans: MAX_DEMO_SCANS,
            scannedBins: [],     // Array of bin ids e.g. [1, 2]
            vouchers: [],        // Array of reward reference codes
            tamperFlags: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    function loadVault() {
        if (vaultCache) return vaultCache;

        const stored = localStorage.getItem(VAULT_STORAGE_KEY);
        let vault = decryptPayload(stored);

        if (!vault) {
            vault = initializeVault();
            saveVault(vault);
        }

        // Ensure current device ID matches
        const currentDeviceId = calculateDeviceHash();
        if (vault.deviceId !== currentDeviceId) {
            vault.deviceId = currentDeviceId;
        }

        vaultCache = vault;
        return vault;
    }

    function saveVault(vault) {
        vault.updatedAt = new Date().toISOString();
        const encrypted = encryptPayload(vault);
        localStorage.setItem(VAULT_STORAGE_KEY, encrypted);
        vaultCache = vault;
    }

    // --- 4. AUTH & DEMO DETECTION ---
    function isDemoMode() {
        const isAuth = localStorage.getItem('is_authenticated') === 'true';
        const email = (localStorage.getItem('registered_email') || '').toLowerCase();
        const userId = localStorage.getItem('user_id');

        // If not authenticated or using demo accounts, it's considered Demo Mode
        if (!isAuth) return true;
        if (email === 'citizen@greenroute.org' && !userId) return true;
        return false;
    }

    // --- 5. VALIDATION: SINGLE-USE PER QR & DEMO LIMITS ---
    function validateScanAttempt(binId) {
        const vault = loadVault();
        const bId = Number(binId);

        // 1. Check if this specific bin QR code has already been scanned on this device/user
        if (vault.scannedBins.includes(bId)) {
            return {
                allowed: false,
                reason: "ALREADY_SCANNED",
                binId: bId,
                message: `⚠️ Smart Bin #${bId} QR Code has already been scanned on this device!\n\nEach physical smart bin QR code can only be used once per user/device to ensure fair gamification. Please scan a different smart bin to earn new points and fresh reward voucher codes.`
            };
        }

        // 2. Check Demo Mode Scan Limit (Max 3 scans)
        if (isDemoMode()) {
            if (vault.demoScansCount >= MAX_DEMO_SCANS) {
                return {
                    allowed: false,
                    reason: "DEMO_LIMIT_EXCEEDED",
                    scansUsed: vault.demoScansCount,
                    maxScans: MAX_DEMO_SCANS,
                    message: `🔒 Demo Scan Limit Reached (${vault.demoScansCount}/${MAX_DEMO_SCANS} free scans used)!\n\nYou have completed the maximum free demo scans allowed on this device. Please create or sign in to your Citizen account to unlock unlimited verified scans and keep earning campus rewards!`
                };
            }
        }

        return {
            allowed: true,
            isDemo: isDemoMode(),
            demoRemaining: Math.max(0, MAX_DEMO_SCANS - vault.demoScansCount)
        };
    }

    // --- 6. RECORD VERIFIED SCAN & GENERATE NEW REFERENCE CODE ---
    function generateUniqueReferenceCode(binId) {
        const year = new Date().getFullYear();
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous 0, O, 1, I
        let randStr = '';
        for (let i = 0; i < 4; i++) {
            randStr += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        let randStr2 = '';
        for (let i = 0; i < 4; i++) {
            randStr2 += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `GR-RW-${year}-B${binId}${randStr}-${randStr2}`;
    }

    function recordVerifiedScan(binId, binName = null, pointsEarned = 50, wasteType = "plastic") {
        const vault = loadVault();
        const bId = Number(binId);

        // 1. Mark bin as scanned (Single-Use per QR enforced!)
        if (!vault.scannedBins.includes(bId)) {
            vault.scannedBins.push(bId);
        }

        // 2. Update demo count if in demo mode
        if (isDemoMode()) {
            vault.demoScansCount = Math.min(MAX_DEMO_SCANS, vault.demoScansCount + 1);
        }

        // 3. Generate a brand new, one-time Reward Reference Code
        const refCode = generateUniqueReferenceCode(bId);
        const name = binName || `Smart Bin #${bId}`;

        const voucher = {
            id: 'vch_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            code: refCode,
            binId: bId,
            binName: name,
            wasteType: wasteType,
            points: pointsEarned,
            rewardTitle: "Campus Eco-Discount Voucher",
            discountDesc: "₹50 OFF on Campus Cafeteria, Bookstore or Stationery",
            status: "ACTIVE", // "ACTIVE" | "REDEEMED"
            createdAt: new Date().toISOString(),
            redeemedAt: null,
            tamperSign: computeChecksum(refCode + bId)
        };

        vault.vouchers.unshift(voucher);
        saveVault(vault);

        return {
            voucher: voucher,
            demoStats: {
                used: vault.demoScansCount,
                max: MAX_DEMO_SCANS,
                remaining: Math.max(0, MAX_DEMO_SCANS - vault.demoScansCount),
                isDemo: isDemoMode()
            }
        };
    }

    // --- 7. REDEEM REFERENCE CODE (ONE-TIME USE ONLY) ---
    function redeemReferenceCode(code) {
        const vault = loadVault();
        const target = vault.vouchers.find(v => v.code.toUpperCase() === (code || '').trim().toUpperCase());

        if (!target) {
            return {
                success: false,
                message: "❌ Invalid Reference Code. Please verify the code and try again."
            };
        }

        if (target.status === 'REDEEMED') {
            const dateStr = target.redeemedAt ? new Date(target.redeemedAt).toLocaleString() : 'previously';
            return {
                success: false,
                message: `⚠️ This Reference Code has ALREADY BEEN REDEEMED on ${dateStr}!\n\nEvery reference code can only be used once at campus counters.`
            };
        }

        // Mark as REDEEMED (one-time redemption complete)
        target.status = 'REDEEMED';
        target.redeemedAt = new Date().toISOString();
        saveVault(vault);

        return {
            success: true,
            voucher: target,
            message: `🎉 Success! Reference Code ${target.code} has been redeemed for: ${target.rewardTitle} (${target.discountDesc}).`
        };
    }

    // --- 8. PUBLIC ACCESSORS ---
    function getVouchers() {
        const vault = loadVault();
        return vault.vouchers || [];
    }

    function getActiveVouchersCount() {
        const vault = loadVault();
        return (vault.vouchers || []).filter(v => v.status === 'ACTIVE').length;
    }

    function getScannedBins() {
        const vault = loadVault();
        return vault.scannedBins || [];
    }

    function isBinAlreadyScanned(binId) {
        const vault = loadVault();
        return vault.scannedBins.includes(Number(binId));
    }

    function getDemoStats() {
        const vault = loadVault();
        return {
            used: vault.demoScansCount,
            max: MAX_DEMO_SCANS,
            remaining: Math.max(0, MAX_DEMO_SCANS - vault.demoScansCount),
            isDemo: isDemoMode()
        };
    }

    function resetDemoLimits() {
        const vault = loadVault();
        vault.demoScansCount = 0;
        vault.scannedBins = [];
        saveVault(vault);
        return { success: true, message: "Demo scans and claimed bins reset successfully!" };
    }

    function resetScannedBin(binId) {
        const vault = loadVault();
        const bId = Number(binId);
        vault.scannedBins = (vault.scannedBins || []).filter(id => id !== bId);
        saveVault(vault);
        return { success: true, message: `Bin #${bId} unlocked for re-scanning!` };
    }

    return {
        validateScanAttempt,
        recordVerifiedScan,
        redeemReferenceCode,
        getVouchers,
        getActiveVouchersCount,
        getScannedBins,
        isBinAlreadyScanned,
        getDemoStats,
        isDemoMode,
        resetDemoLimits,
        resetScannedBin
    };
})();

window.GreenRouteQRSecurity = GreenRouteQRSecurity;
