/**
 * GreenRoute - Citizen Dashboard Controller
 */

let citizenMap = null;
let selectedWasteType = "plastic";
let currentPoints = 0;
let currentRankTitle = "Novice Sprout";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Auth (Use real registered user, or initialize clean guest citizen)
    const user = getCurrentUser();
    if (!user.isAuthenticated) {
        if (localStorage.getItem('registered_name')) {
            localStorage.setItem('is_authenticated', 'true');
        } else {
            localStorage.setItem('registered_name', 'Citizen User');
            localStorage.setItem('registered_email', 'citizen@greenroute.org');
            localStorage.setItem('registered_role', 'citizen');
            localStorage.setItem('is_authenticated', 'true');
            localStorage.setItem('gr_points', '0');
            localStorage.setItem('gr_streak', '0');
            localStorage.setItem('gr_total_scans', '0');
        }
    }

    // 2. Initialize UI & Data
    await loadCitizenProfile();
    await initCitizenMap();
    renderQuests();
    renderRewards();
    await updateLeaderboard();
    updateVoucherButtonBadge();

    // 3. Check for Real Physical QR Code in URL (?bin_id=X)
    handleUrlQrDeepLink();
});

// --- LOAD CITIZEN PROFILE ---
async function loadCitizenProfile() {
    let citizen = GreenRouteData.getCitizenData();

    // If backend is active and a registered user_id exists in session, sync live stats
    if (GreenRouteData.isBackendActive()) {
        const userId = localStorage.getItem('user_id');
        if (userId) {
            try {
                const res = await fetch(`${GreenRouteData.API_BASE}/users/${userId}`);
                if (res.ok) {
                    const liveUser = await res.json();
                    citizen.points = liveUser.points;
                    citizen.streak = liveUser.streak;
                    citizen.name = liveUser.name;
                    citizen.email = liveUser.email;
                    if (liveUser.total_scans !== undefined) citizen.totalScans = liveUser.total_scans;
                    GreenRouteData.saveCitizenData(citizen);
                }
            } catch (e) {
                console.warn("Backend citizen profile refresh skipped:", e);
            }
        }
    }

    currentPoints = citizen.points;

    // Header & Profile Card
    document.getElementById('header-user-name').innerText = citizen.name;
    document.getElementById('profile-name').innerText = citizen.name;
    document.getElementById('header-user-streak').innerText = `🔥 ${citizen.streak}-Day Streak`;

    const rankInfo = GreenRouteData.calculateRank(citizen.points);
    currentRankTitle = rankInfo.title;

    document.getElementById('rank-icon').innerText = rankInfo.icon;
    document.getElementById('header-avatar').innerText = rankInfo.icon;
    document.getElementById('user-rank').innerHTML = `${rankInfo.title} <span class="info-btn" title="View Rank System">ℹ️</span>`;

    updatePointsDisplay(citizen.points, citizen.points);
}

// --- POINTS & PROGRESS DISPLAY ---
function updatePointsDisplay(prevPoints, newPoints) {
    const pointsDisplay = document.getElementById('points-display');
    const progressBar = document.getElementById('progress-bar');
    const nextMilestoneText = document.getElementById('next-milestone-text');

    if (prevPoints !== newPoints) {
        animateValue(pointsDisplay, prevPoints, newPoints, 800);
    } else {
        pointsDisplay.innerText = newPoints;
    }

    // Milestone calculation
    const rankTiers = GreenRouteData.getRankTiers();
    let nextMilestone = 1000;
    let prevMilestone = 0;

    for (let i = 0; i < rankTiers.length; i++) {
        if (newPoints < rankTiers[i].req) {
            nextMilestone = rankTiers[i].req;
            prevMilestone = rankTiers[i - 1] ? rankTiers[i - 1].req : 0;
            break;
        }
    }

    if (newPoints >= 2000) {
        nextMilestone = 2500;
        prevMilestone = 2000;
    }

    nextMilestoneText.innerText = nextMilestone;
    const progressPercent = Math.min(100, Math.max(5, ((newPoints - prevMilestone) / (nextMilestone - prevMilestone)) * 100));
    progressBar.style.width = `${progressPercent}%`;

    renderRewards();
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

// --- SMART BIN MAP ---
let citizenMarkers = [];

async function initCitizenMap(forceReload = false) {
    if (citizenMap && !forceReload) return;

    if (!citizenMap) {
        // Center around Silver Oak University campus coordinates
        citizenMap = L.map('campus-map').setView([23.0835, 72.5458], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(citizenMap);
    } else {
        citizenMarkers.forEach(m => {
            try { citizenMap.removeLayer(m); } catch (e) {}
        });
        citizenMarkers = [];
    }

    const greenIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
    });

    const goldIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
    });

    const redIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
    });

    const bins = await GreenRouteData.getBins();

    bins.forEach(bin => {
        let iconToUse = greenIcon;
        let statusBadge = '<span style="color: #059669; font-weight: 700;">Ready to Use 🌿</span>';

        if (bin.fill_level >= 80 || (bin.priority_zone && bin.fill_level >= 60)) {
            iconToUse = redIcon;
            statusBadge = '<span style="color: #DC2626; font-weight: 700;">Full / Priority ⚠️</span>';
        } else if (bin.fill_level >= 50) {
            iconToUse = goldIcon;
            statusBadge = '<span style="color: #D97706; font-weight: 700;">Moderate Fill</span>';
        }

        const isScanned = window.GreenRouteQRSecurity ? GreenRouteQRSecurity.isBinAlreadyScanned(bin.id) : false;
        const marker = L.marker([bin.lat, bin.lng], { icon: iconToUse }).addTo(citizenMap);
        citizenMarkers.push(marker);
        
        marker.bindPopup(`
            <div style="font-family: 'Outfit', sans-serif; min-width: 180px;">
                <h4 style="margin: 0 0 4px; font-size: 0.95rem; color: #1F2937;">${bin.name}</h4>
                <div style="font-size: 0.8rem; margin-bottom: 6px;">${isScanned ? '<span style="color: #6B7280; font-weight: 700;">🔒 Already Claimed</span>' : statusBadge}</div>
                <div style="background: #E5E7EB; height: 6px; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
                    <div style="background: ${bin.fill_level >= 80 ? '#EF4444' : '#10B981'}; width: ${bin.fill_level}%; height: 100%;"></div>
                </div>
                <div style="font-size: 0.78rem; color: #6B7280; margin-bottom: 8px;">Fill Level: <strong>${bin.fill_level}%</strong> (${bin.capacity}L)</div>
                ${isScanned ? `
                    <button onclick="showAlreadyScannedModal(${bin.id})" style="width: 100%; background: #94A3B8; color: white; border: none; padding: 6px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.82rem;">
                        🔒 Scanned on this Device
                    </button>
                ` : `
                    <button onclick="openScannerForBin(${bin.id})" style="width: 100%; background: #10B981; color: white; border: none; padding: 6px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.82rem;">
                        📲 Scan Here
                    </button>
                `}
            </div>
        `);
    });
}

// --- DAILY QUESTS RENDERING ---
function renderQuests() {
    const questList = document.getElementById('quest-list');
    if (!questList) return;

    const quests = GreenRouteData.getQuests();
    questList.innerHTML = "";

    quests.forEach(quest => {
        const li = document.createElement('li');
        li.className = `reward-item ${quest.completed ? 'unlocked' : ''}`;
        
        const progressText = `(${quest.progress}/${quest.target})`;
        li.innerHTML = `
            <span class="reward-icon">${quest.icon}</span>
            <div class="reward-details">
                <h4 style="font-weight: 700;">${quest.title} <span style="font-size: 0.8rem; color: #6B7280;">${progressText}</span></h4>
                <p>${quest.desc} • <strong style="color: #10B981;">+${quest.reward} pts</strong></p>
            </div>
            <span class="status-badge" style="background: ${quest.completed ? '#10B981' : '#F3F4F6'}; color: ${quest.completed ? '#fff' : '#4B5563'};">
                ${quest.completed ? 'Done ✅' : 'Active'}
            </span>
        `;
        questList.appendChild(li);
    });
}

// --- REWARDS CATALOG RENDERING ---
function renderRewards() {
    const rewardsList = document.getElementById('rewards-list');
    if (!rewardsList) return;

    const rewards = GreenRouteData.getRewards();
    const citizen = GreenRouteData.getCitizenData();
    rewardsList.innerHTML = "";

    rewards.forEach(reward => {
        const canAfford = citizen.points >= reward.cost;
        const isClaimed = reward.claimed;

        const li = document.createElement('li');
        li.className = `reward-item ${isClaimed ? 'unlocked' : (canAfford ? 'unlocked' : 'locked')}`;

        let actionBtnHtml = '';
        if (isClaimed) {
            actionBtnHtml = `<span class="status-badge" style="background: #064E3B; color: #fff;">Claimed ✅</span>`;
        } else if (canAfford) {
            actionBtnHtml = `
                <button class="btn btn-primary btn-sm" onclick="claimPerk('${reward.id}')" style="padding: 4px 12px; font-size: 0.8rem;">
                    Claim Perk
                </button>
            `;
        } else {
            actionBtnHtml = `<span class="status-badge">Locked (${reward.cost} pts)</span>`;
        }

        li.innerHTML = `
            <span class="reward-icon">${reward.icon}</span>
            <div class="reward-details">
                <h4 style="font-weight: 700;">${reward.title}</h4>
                <p>${reward.cost} Green Points</p>
            </div>
            ${actionBtnHtml}
        `;
        rewardsList.appendChild(li);
    });
}

// --- CLAIM REWARD PERK ---
function claimPerk(rewardId) {
    const rewards = GreenRouteData.getRewards();
    const target = rewards.find(r => r.id === rewardId);
    if (!target) return;

    target.claimed = true;
    localStorage.setItem('gr_rewards', JSON.stringify(rewards));

    const code = `GR-${target.title.split(' ')[0].toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    document.getElementById('claim-title').innerText = `${target.title} Claimed!`;
    document.getElementById('voucher-code-display').innerText = code;
    document.getElementById('claim-modal').classList.remove('hidden');

    confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 } });
    if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();
    renderRewards();
}

function closeClaimModal() {
    document.getElementById('claim-modal').classList.add('hidden');
}

let activeWebcamStream = null;
let currentVisionClassification = null;
let currentBase64Image = null;

// --- INTERACTIVE AI VISION SCANNER MODAL ---
function updateScannerDemoUI() {
    const badge = document.getElementById('scanner-demo-counter-badge');
    const textSpan = document.getElementById('demo-scans-left-text');
    if (!badge || !textSpan || !window.GreenRouteQRSecurity) return;

    const stats = GreenRouteQRSecurity.getDemoStats();
    if (stats.isDemo) {
        badge.classList.remove('hidden');
        textSpan.innerText = `${stats.remaining} of ${stats.max} demo scans left`;
    } else {
        badge.classList.add('hidden');
    }
}

function handleScanValidationError(validation, binId) {
    if (validation.reason === 'ALREADY_SCANNED') {
        showAlreadyScannedModal(binId || validation.binId);
    } else if (validation.reason === 'DEMO_LIMIT_EXCEEDED') {
        showDemoLimitModal(validation.scansUsed, validation.maxScans);
    } else {
        alert(validation.message || "Scan attempt not allowed.");
    }
}

async function openScannerModal() {
    // Check Demo Mode limit
    if (window.GreenRouteQRSecurity) {
        const stats = GreenRouteQRSecurity.getDemoStats();
        if (stats.isDemo && stats.remaining <= 0) {
            showDemoLimitModal(stats.used, stats.max);
            return;
        }
    }

    updateScannerDemoUI();

    const select = document.getElementById('scan-bin-select');
    const bins = await GreenRouteData.getBins();

    select.innerHTML = '';
    let firstSelectableId = null;
    bins.forEach(b => {
        const isScanned = window.GreenRouteQRSecurity ? GreenRouteQRSecurity.isBinAlreadyScanned(b.id) : false;
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.text = `${b.name} (${b.zone.toUpperCase()} • ${b.fill_level}% full)${isScanned ? ' 🔒 [ALREADY CLAIMED]' : ''}`;
        if (isScanned) {
            opt.disabled = true;
            opt.style.color = '#94A3B8';
        } else if (!firstSelectableId) {
            firstSelectableId = b.id;
        }
        select.appendChild(opt);
    });

    if (firstSelectableId) {
        select.value = firstSelectableId;
    }

    document.getElementById('interactive-scan-modal').classList.remove('hidden');
    if (window.GreenRouteSFX) GreenRouteSFX.playScan();

    // Initialize with default sample if not already set
    if (!currentVisionClassification) {
        testVisionSample('plastic');
    }
}

function openScannerForBin(binId) {
    const parsedId = parseInt(binId, 10);
    if (window.GreenRouteQRSecurity) {
        const validation = GreenRouteQRSecurity.validateScanAttempt(parsedId);
        if (!validation.allowed) {
            handleScanValidationError(validation, parsedId);
            return;
        }
    }
    openScannerModal();
    setTimeout(() => {
        const select = document.getElementById('scan-bin-select');
        if (select) select.value = parsedId;
    }, 100);
}

let currentScannerMode = 'waste'; // 'waste' | 'qr'
let qrScanInterval = null;

// Handle physical QR codes scanned by mobile camera (?bin_id=X)
function handleUrlQrDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const binId = params.get('bin_id') || params.get('scan_bin');
    if (binId) {
        console.log(`[GreenRoute QR] Direct physical QR deep-link detected: Bin #${binId}`);
        const parsedId = parseInt(binId, 10);

        // Anti-Fraud & Single-Use Check
        if (window.GreenRouteQRSecurity) {
            const validation = GreenRouteQRSecurity.validateScanAttempt(parsedId);
            if (!validation.allowed) {
                setTimeout(() => {
                    handleScanValidationError(validation, parsedId);
                }, 400);
                return;
            }
        }

        setTimeout(() => {
            openScannerForBin(parsedId);
            if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();
            // Show alert feedback banner
            const modalTitle = document.querySelector('#interactive-scan-modal h3');
            if (modalTitle) {
                modalTitle.innerHTML = `📷 AI Waste Scanner <span style="font-size: 0.72rem; background: #ECFDF5; color: #047857; padding: 2px 8px; border-radius: 12px; border: 1px solid #10B981;">📍 Physical QR #${parsedId} Locked</span>`;
            }
        }, 600);
    }
}

function setScannerMode(mode) {
    currentScannerMode = mode;
    const tabWaste = document.getElementById('tab-scan-waste');
    const tabQr = document.getElementById('tab-scan-qr');
    const qrOverlay = document.getElementById('qr-reticle-overlay');
    const placeholderIcon = document.getElementById('placeholder-icon');
    const placeholderTitle = document.getElementById('placeholder-title');
    const placeholderSubtitle = document.getElementById('placeholder-subtitle');
    const sampleChipsLabel = document.getElementById('sample-chips-label');
    const wasteChips = document.getElementById('waste-sample-chips-row');
    const qrChips = document.getElementById('qr-sample-chips-row');

    if (mode === 'qr') {
        if (tabQr) {
            tabQr.style.background = '#FFFFFF';
            tabQr.style.color = '#0F172A';
            tabQr.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        }
        if (tabWaste) {
            tabWaste.style.background = 'transparent';
            tabWaste.style.color = '#64748B';
            tabWaste.style.boxShadow = 'none';
        }
        if (qrOverlay) {
            qrOverlay.classList.remove('hidden');
            qrOverlay.style.display = 'block';
        }
        if (placeholderIcon) placeholderIcon.innerText = '🏁📱';
        if (placeholderTitle) placeholderTitle.innerText = 'Real Smart Bin QR Reader Active';
        if (placeholderSubtitle) placeholderSubtitle.innerText = 'Aim camera at physical QR, upload QR image, or tap a sample bin below';
        if (sampleChipsLabel) sampleChipsLabel.innerText = 'Or Test 1-Click Smart Bin QR (Physical / Simulated):';
        if (wasteChips) wasteChips.style.display = 'none';
        if (qrChips) qrChips.style.display = 'flex';

        // Auto-start camera if not already active for smooth user experience
        if (!activeWebcamStream && typeof toggleWebcam === 'function') {
            toggleWebcam().catch(() => {});
        }

        startQrDetectionLoop();
    } else {
        if (tabWaste) {
            tabWaste.style.background = '#FFFFFF';
            tabWaste.style.color = '#0F172A';
            tabWaste.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        }
        if (tabQr) {
            tabQr.style.background = 'transparent';
            tabQr.style.color = '#64748B';
            tabQr.style.boxShadow = 'none';
        }
        if (qrOverlay) {
            qrOverlay.classList.add('hidden');
            qrOverlay.style.display = 'none';
        }
        if (placeholderIcon) placeholderIcon.innerText = '🤖📸';
        if (placeholderTitle) placeholderTitle.innerText = 'AI Vision Scanner Ready';
        if (placeholderSubtitle) placeholderSubtitle.innerText = 'Snap a camera photo, upload, or click a preset sample below';
        if (sampleChipsLabel) sampleChipsLabel.innerText = 'Or Test 1-Click Preset Waste Sample:';
        if (wasteChips) wasteChips.style.display = 'flex';
        if (qrChips) qrChips.style.display = 'none';

        stopQrDetectionLoop();
    }
}

async function startQrDetectionLoop() {
    stopQrDetectionLoop();

    const video = document.getElementById('webcam-feed');
    let barcodeDetector = null;
    if (window.BarcodeDetector) {
        try {
            barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } catch (e) {
            barcodeDetector = null;
        }
    }

    const offscreenCanvas = document.createElement('canvas');
    const offscreenCtx = offscreenCanvas.getContext('2d');

    qrScanInterval = setInterval(async () => {
        if (!activeWebcamStream || !video || video.readyState < 2 || currentScannerMode !== 'qr') return;

        // Strategy A: Native BarcodeDetector (Chrome/Android with flags)
        if (barcodeDetector) {
            try {
                const barcodes = await barcodeDetector.detect(video);
                if (barcodes && barcodes.length > 0) {
                    const rawVal = barcodes[0].rawValue;
                    console.log("[GreenRoute QR] Live QR Decoded (Native):", rawVal);
                    parseAndApplyScannedQr(rawVal);
                    return;
                }
            } catch (err) {
                // Transient frame drop
            }
        }

        // Strategy B: Universal jsQR detector (Brave, Chrome Desktop, Firefox, Safari)
        if (window.jsQR) {
            try {
                offscreenCanvas.width = video.videoWidth || 320;
                offscreenCanvas.height = video.videoHeight || 240;
                offscreenCtx.drawImage(video, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
                const imgData = offscreenCtx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
                const code = window.jsQR(imgData.data, imgData.width, imgData.height, {
                    inversionAttempts: "dontInvert"
                });
                if (code && code.data) {
                    console.log("[GreenRoute QR] Live QR Decoded (jsQR):", code.data);
                    parseAndApplyScannedQr(code.data);
                }
            } catch (err) {
                // Ignore transient frame canvas errors
            }
        }
    }, 350);
}

function stopQrDetectionLoop() {
    if (qrScanInterval) {
        clearInterval(qrScanInterval);
        qrScanInterval = null;
    }
}

function parseAndApplyScannedQr(rawValue) {
    let binId = null;
    try {
        if (rawValue.includes('bin_id=')) {
            const url = new URL(rawValue, window.location.origin);
            binId = url.searchParams.get('bin_id');
        } else if (rawValue.startsWith('{')) {
            const parsed = JSON.parse(rawValue);
            binId = parsed.bin_id || parsed.id;
        } else if (/^\d+$/.test(rawValue.trim())) {
            binId = rawValue.trim();
        }
    } catch (e) {
        const match = rawValue.match(/bin_id=([0-9]+)/i);
        if (match) binId = match[1];
    }

    if (binId) {
        const parsedId = parseInt(binId, 10);
        
        // Single-Use & Demo Limit Enforcement
        if (window.GreenRouteQRSecurity) {
            const validation = GreenRouteQRSecurity.validateScanAttempt(parsedId);
            if (!validation.allowed) {
                closeScannerModal();
                handleScanValidationError(validation, parsedId);
                return;
            }
        }

        const select = document.getElementById('scan-bin-select');
        if (select) {
            select.value = parsedId;
        }
        if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();
        alert(`🎯 Verified Physical Smart Bin #${parsedId} Detected! Switching to Waste Classification...`);
        setScannerMode('waste');
    }
}

function closeScannerModal() {
    const modal = document.getElementById('interactive-scan-modal');
    if (modal) modal.classList.add('hidden');
    stopQrDetectionLoop();
    if (activeWebcamStream) {
        activeWebcamStream.getTracks().forEach(track => track.stop());
        activeWebcamStream = null;
    }
    const video = document.getElementById('webcam-feed');
    if (video) {
        video.srcObject = null;
        video.classList.add('hidden');
    }
    const btnText = document.getElementById('webcam-btn-text');
    if (btnText) btnText.innerText = "📷 Use Camera";
}

async function toggleWebcam() {
    const video = document.getElementById('webcam-feed');
    const placeholder = document.getElementById('vision-placeholder');
    const imgPreview = document.getElementById('scanned-photo-preview');
    const btnText = document.getElementById('webcam-btn-text');

    if (activeWebcamStream) {
        activeWebcamStream.getTracks().forEach(track => track.stop());
        activeWebcamStream = null;
        if (video) {
            video.srcObject = null;
            video.classList.add('hidden');
        }
        if (placeholder) placeholder.classList.remove('hidden');
        if (btnText) btnText.innerText = "📷 Use Camera";
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        activeWebcamStream = stream;
        video.srcObject = stream;
        video.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');
        if (imgPreview) {
            imgPreview.removeAttribute('src');
            imgPreview.classList.add('hidden');
        }
        if (btnText) btnText.innerText = "⏹️ Stop Camera";

        setTimeout(() => {
            captureWebcamFrame();
        }, 1500);
    } catch (err) {
        console.warn("Camera not accessible:", err);
        alert("Camera permission not available. You can upload a photo or click any of the preset sample items below!");
    }
}

function captureWebcamFrame() {
    const video = document.getElementById('webcam-feed');
    if (!video || !activeWebcamStream) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg');
    currentBase64Image = dataUrl;

    classifyAndDisplay(dataUrl, null);
}

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        currentBase64Image = dataUrl;

        const imgPreview = document.getElementById('scanned-photo-preview');
        const placeholder = document.getElementById('vision-placeholder');
        const video = document.getElementById('webcam-feed');

        if (activeWebcamStream) {
            activeWebcamStream.getTracks().forEach(track => track.stop());
            activeWebcamStream = null;
            document.getElementById('webcam-btn-text').innerText = "📷 Use Camera";
        }
        if (video) video.classList.add('hidden');
        if (placeholder) placeholder.classList.add('hidden');
        if (imgPreview) {
            imgPreview.src = dataUrl;
            imgPreview.classList.remove('hidden');
        }

        // Check if the uploaded image contains a Smart Bin QR code
        const testImg = new Image();
        testImg.onload = function() {
            let qrFound = false;
            if (window.jsQR) {
                try {
                    const offCanvas = document.createElement('canvas');
                    offCanvas.width = testImg.width;
                    offCanvas.height = testImg.height;
                    const offCtx = offCanvas.getContext('2d');
                    offCtx.drawImage(testImg, 0, 0);
                    const imgData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
                    const code = window.jsQR(imgData.data, offCanvas.width, offCanvas.height);
                    if (code && code.data) {
                        qrFound = true;
                        console.log("[GreenRoute QR] Uploaded QR Decoded:", code.data);
                        parseAndApplyScannedQr(code.data);
                    }
                } catch (err) {
                    console.warn("[GreenRoute QR] Error decoding uploaded QR:", err);
                }
            }
            if (!qrFound) {
                // If no QR found or normal waste item, run multimodal classification
                classifyAndDisplay(dataUrl, null);
            }
        };
        testImg.src = dataUrl;
    };
    reader.readAsDataURL(file);
}

async function testVisionSample(sampleType, btnElement) {
    document.querySelectorAll('.sample-chip').forEach(c => c.classList.remove('active'));
    if (btnElement) {
        btnElement.classList.add('active');
    } else {
        const targetBtn = document.getElementById(`sample-chip-${sampleType.replace('-', '')}`);
        if (targetBtn) targetBtn.classList.add('active');
    }

    const placeholder = document.getElementById('vision-placeholder');
    const imgPreview = document.getElementById('scanned-photo-preview');
    const video = document.getElementById('webcam-feed');

    if (activeWebcamStream) {
        activeWebcamStream.getTracks().forEach(track => track.stop());
        activeWebcamStream = null;
        document.getElementById('webcam-btn-text').innerText = "📷 Use Camera";
    }
    if (video) {
        video.srcObject = null;
        video.classList.add('hidden');
    }
    if (placeholder) placeholder.classList.remove('hidden');
    if (imgPreview) {
        imgPreview.removeAttribute('src');
        imgPreview.classList.add('hidden');
    }

    const icons = {
        plastic: "🧴",
        metal: "🥫",
        organic: "🍏",
        "e-waste": "🔋",
        paper: "📦"
    };

    placeholder.innerHTML = `
        <div style="font-size: 3.2rem; margin-bottom: 6px;">${icons[sampleType] || "♻️"}</div>
        <div style="font-size: 0.88rem; font-weight: 700; color: #38BDF8;">AI Vision Scanner Active</div>
        <div style="font-size: 0.72rem; color: #94A3B8;">Classifying ${sampleType.toUpperCase()} sample object</div>
    `;

    if (window.GreenRouteSFX) GreenRouteSFX.playScan();

    const classification = await GreenRouteData.classifyWaste(null, sampleType);
    renderVisionResult(classification);
}

async function classifyAndDisplay(imageData, sampleHint) {
    if (window.GreenRouteSFX) GreenRouteSFX.playScan();
    const classification = await GreenRouteData.classifyWaste(imageData, sampleHint);
    renderVisionResult(classification);
}

function renderVisionResult(res) {
    currentVisionClassification = res;
    selectedWasteType = res.waste_type;

    const card = document.getElementById('ai-detection-card');
    card.classList.add('detected');

    document.getElementById('ai-confidence-badge').innerText = `✨ ${Math.round(res.confidence * 100)}% Confidence (${res.vision_engine.split(' ')[0]})`;
    document.getElementById('ai-detected-title').innerText = res.item_name;
    document.getElementById('ai-material-grade').innerText = `${res.material_grade} • ${res.waste_type.toUpperCase()}`;
    document.getElementById('ai-points-preview').innerText = `+${Math.round(res.green_points * res.multiplier)} pts`;
    document.getElementById('ai-co2-preview').innerText = `🌱 ${res.co2_prevented_grams}g CO₂ saved`;
    document.getElementById('ai-recommended-bin').innerText = res.recommended_bin;
    document.getElementById('ai-recommended-bin').style.color = res.bin_color || '#2563EB';
    document.getElementById('ai-disposal-tip').innerText = `💡 ${res.disposal_instructions}`;

    // Auto-select corresponding bin if matching zone found
    const select = document.getElementById('scan-bin-select');
    if (select && res.bin_zone) {
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].text.toLowerCase().includes(res.bin_zone.toLowerCase())) {
                select.selectedIndex = i;
                break;
            }
        }
    }
}

function selectWasteType(type, element) {
    testVisionSample(type, element);
}

async function confirmVisionScanAndDeposit() {
    const select = document.getElementById('scan-bin-select');
    const binId = select ? parseInt(select.value, 10) : 1;

    // 1. Enforce Anti-Fraud & Single-Use QR & Demo limits
    if (window.GreenRouteQRSecurity) {
        const validation = GreenRouteQRSecurity.validateScanAttempt(binId);
        if (!validation.allowed) {
            closeScannerModal();
            handleScanValidationError(validation, binId);
            return;
        }
    }

    closeScannerModal();

    const userId = localStorage.getItem('user_id') || 1;
    const wType = currentVisionClassification ? currentVisionClassification.waste_type : selectedWasteType;
    const binName = select && select.options[select.selectedIndex] ? 
        select.options[select.selectedIndex].text.split('(')[0].trim() : `Smart Bin #${binId}`;

    const result = await GreenRouteData.verifyAndScanWaste(userId, binId, currentBase64Image, wType);

    confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 } });
    if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();

    const oldPoints = parseInt(document.getElementById('points-display').innerText) || 0;
    updatePointsDisplay(oldPoints, result.new_total_points);
    renderQuests();
    await updateLeaderboard();

    // 2. Record Verified Scan in Encrypted Vault & Generate Fresh One-Time Reference Code
    let voucherRecord = null;
    if (window.GreenRouteQRSecurity) {
        const earnedPoints = result.earned_points || (currentVisionClassification ? Math.round(currentVisionClassification.green_points * currentVisionClassification.multiplier) : 50);
        voucherRecord = GreenRouteQRSecurity.recordVerifiedScan(binId, binName, earnedPoints, wType);
        updateVoucherButtonBadge();
    }

    // Refresh map markers to show locked state for this bin
    if (citizenMap) {
        citizenMap.remove();
        citizenMap = null;
        await initCitizenMap();
    }

    // 3. Immediately Pop Reward Reference Code Modal for Citizen
    if (voucherRecord && voucherRecord.voucher) {
        showRewardReferenceModal(voucherRecord.voucher, voucherRecord.voucher.points, result);
    }

    if (result.rank && result.rank !== currentRankTitle) {
        currentRankTitle = result.rank;
        setTimeout(() => {
            showRankUpModal({ title: result.rank, icon: "⚔️" });
        }, 1200);
    }
}

async function confirmScanRecycle() {
    return confirmVisionScanAndDeposit();
}

// --- RANK UP MODAL ---
function showRankUpModal(rankInfo) {
    document.getElementById('rank-up-text').innerText = rankInfo.title;
    document.getElementById('rank-up-icon').innerText = rankInfo.icon;
    document.getElementById('rank-up-modal').classList.remove('hidden');
    confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 } });
    if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();
}

function closeRankModal() {
    document.getElementById('rank-up-modal').classList.add('hidden');
    loadCitizenProfile();
}

// --- RANK TIERS PROGRESS MODAL ---
function openRankProgress() {
    const list = document.getElementById('rank-progress-list');
    list.innerHTML = "";
    const tiers = GreenRouteData.getRankTiers();
    const citizen = GreenRouteData.getCitizenData();

    tiers.forEach(tier => {
        const isCurrent = currentRankTitle === tier.title;
        const isUnlocked = citizen.points >= tier.req;

        const li = document.createElement('li');
        li.className = `reward-item ${isUnlocked ? 'unlocked' : 'locked'}`;
        if (isCurrent) {
            li.style.border = "2px solid #10B981";
            li.style.background = "#D1FAE5";
        }

        li.innerHTML = `
            <span class="reward-icon">${tier.icon}</span>
            <div class="reward-details">
                <h4 style="font-weight: 700;">${tier.title}</h4>
                <p>${tier.req} pts required</p>
            </div>
            <span class="status-badge" style="background: ${isCurrent ? '#047857' : (isUnlocked ? '#10B981' : '#E5E7EB')}; color: ${isUnlocked ? '#fff' : '#4B5563'};">
                ${isCurrent ? 'Current ⭐' : (isUnlocked ? 'Achieved' : 'Locked')}
            </span>
        `;
        list.appendChild(li);
    });

    document.getElementById('rank-progress-modal').classList.remove('hidden');
}

function closeRankProgress() {
    document.getElementById('rank-progress-modal').classList.add('hidden');
}

// --- LEADERBOARD LOGIC ---
async function updateLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;

    const users = await GreenRouteData.getLeaderboard();
    list.innerHTML = "";

    users.forEach((u, idx) => {
        const li = document.createElement('li');
        li.className = `leaderboard-item ${u.isMe ? 'unlocked' : ''}`;
        if (u.isMe) {
            li.style.border = "2px solid #10B981";
            li.style.background = "#F0FDF4";
        }

        li.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="rank-badge" style="background: ${idx === 0 ? '#F59E0B' : (idx === 1 ? '#9CA3AF' : (idx === 2 ? '#B45309' : '#E5E7EB'))}; color: ${idx < 3 ? '#fff' : '#374151'}; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700;">
                    #${idx + 1}
                </div>
                <div>
                    <div style="font-weight: 700; font-size: 0.92rem; color: #1F2937;">${u.name}</div>
                    <div style="font-size: 0.75rem; color: #6B7280;">${u.badge}</div>
                </div>
            </div>
            <div class="lb-points" style="font-weight: 800; font-size: 1rem;">${u.points} pts</div>
        `;
        list.appendChild(li);
    });
}

// --- REWARD VOUCHER MODAL & ANTI-FRAUD LEDGER HANDLERS ---
let currentActiveModalVoucher = null;

function showRewardReferenceModal(voucher, pointsEarned, result) {
    currentActiveModalVoucher = voucher;
    
    const binEl = document.getElementById('ref-modal-bin-name');
    const codeEl = document.getElementById('ref-modal-code');
    const ptsEl = document.getElementById('ref-modal-points');
    const co2El = document.getElementById('ref-modal-co2');
    const perkEl = document.getElementById('ref-modal-perk-desc');
    
    if (binEl) binEl.innerText = voucher.binName || `Smart Bin #${voucher.binId}`;
    if (codeEl) codeEl.innerText = voucher.code;
    if (ptsEl) ptsEl.innerText = `+${pointsEarned} Green Points`;
    
    const co2 = result && result.co2_prevented ? result.co2_prevented : (currentVisionClassification ? currentVisionClassification.co2_prevented_grams : 85);
    if (co2El) co2El.innerText = `🌱 ${co2}g CO₂ saved`;
    if (perkEl) perkEl.innerText = voucher.discountDesc || "₹50 OFF on Campus Cafeteria, Bookstore or Stationery";
    
    const statusPill = document.getElementById('ref-modal-status-pill');
    const redeemBtn = document.getElementById('btn-redeem-modal-code');
    if (voucher.status === 'REDEEMED') {
        if (statusPill) {
            statusPill.className = 'voucher-status-pill used';
            statusPill.innerText = '🔴 REDEEMED • ALREADY USED';
        }
        if (redeemBtn) {
            redeemBtn.disabled = true;
            redeemBtn.innerText = '✅ Code Already Redeemed';
        }
    } else {
        if (statusPill) {
            statusPill.className = 'voucher-status-pill active';
            statusPill.innerText = '🟢 ACTIVE • VALID FOR 1 REDEMPTION';
        }
        if (redeemBtn) {
            redeemBtn.disabled = false;
            redeemBtn.innerText = '🎁 Redeem Voucher Code at Counter';
        }
    }

    const copyBtnText = document.getElementById('copy-btn-text');
    if (copyBtnText) copyBtnText.innerText = '📋 Copy Reference Code';

    const modal = document.getElementById('reward-voucher-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeRewardVoucherModal() {
    const modal = document.getElementById('reward-voucher-modal');
    if (modal) modal.classList.add('hidden');
    currentActiveModalVoucher = null;
}

function copyModalReferenceCode() {
    if (!currentActiveModalVoucher) return;
    navigator.clipboard.writeText(currentActiveModalVoucher.code).then(() => {
        const btnText = document.getElementById('copy-btn-text');
        if (btnText) btnText.innerText = '✅ Copied to Clipboard!';
        if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();
        setTimeout(() => {
            if (btnText) btnText.innerText = '📋 Copy Reference Code';
        }, 2200);
    }).catch(err => {
        console.warn("Clipboard copy failed:", err);
    });
}

function redeemModalReferenceCode() {
    if (!currentActiveModalVoucher) return;
    
    const res = GreenRouteQRSecurity.redeemReferenceCode(currentActiveModalVoucher.code);
    if (res.success) {
        currentActiveModalVoucher.status = 'REDEEMED';
        const statusPill = document.getElementById('ref-modal-status-pill');
        if (statusPill) {
            statusPill.className = 'voucher-status-pill used';
            statusPill.innerText = '🔴 REDEEMED • USED AT COUNTER';
        }
        
        const redeemBtn = document.getElementById('btn-redeem-modal-code');
        if (redeemBtn) {
            redeemBtn.disabled = true;
            redeemBtn.innerText = '✅ Redeemed Successfully!';
        }
        
        if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();
        confetti({ particleCount: 220, spread: 100, origin: { y: 0.5 } });
        updateVoucherButtonBadge();
        alert(res.message);
    } else {
        alert(res.message);
    }
}

function showAlreadyScannedModal(binId) {
    const label = document.getElementById('already-scanned-bin-label');
    if (label) label.innerText = `Smart Bin #${binId}`;
    const modal = document.getElementById('already-scanned-modal');
    if (modal) modal.classList.remove('hidden');
    if (window.GreenRouteSFX) GreenRouteSFX.playWarn();
}

function closeAlreadyScannedModal() {
    const modal = document.getElementById('already-scanned-modal');
    if (modal) modal.classList.add('hidden');
}

function showDemoLimitModal(used, max) {
    const modal = document.getElementById('demo-limit-modal');
    if (modal) modal.classList.remove('hidden');
    if (window.GreenRouteSFX) GreenRouteSFX.playWarn();
}

function closeDemoLimitModal() {
    const modal = document.getElementById('demo-limit-modal');
    if (modal) modal.classList.add('hidden');
}

function openAllVouchersModal() {
    renderAllVouchersList();
    const modal = document.getElementById('all-vouchers-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeAllVouchersModal() {
    const modal = document.getElementById('all-vouchers-modal');
    if (modal) modal.classList.add('hidden');
}

function renderAllVouchersList() {
    const list = document.getElementById('all-vouchers-list');
    const activeCounter = document.getElementById('vouchers-active-counter');
    const totalCounter = document.getElementById('vouchers-total-counter');
    if (!list) return;

    const vouchers = GreenRouteQRSecurity.getVouchers();
    const activeCount = GreenRouteQRSecurity.getActiveVouchersCount();

    if (activeCounter) activeCounter.innerText = activeCount;
    if (totalCounter) totalCounter.innerText = vouchers.length;

    if (vouchers.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 30px 10px; color: #64748B;">
                <div style="font-size: 2.5rem; margin-bottom: 6px;">🎟️</div>
                <div style="font-weight: 700; color: #1E293B;">No Reward Vouchers Yet</div>
                <p style="font-size: 0.8rem; margin: 4px 0 14px 0;">Scan campus smart bins to earn verified single-use discount codes.</p>
                <button class="btn btn-primary btn-sm" onclick="closeAllVouchersModal(); openScannerModal();">Scan Now</button>
            </div>
        `;
        return;
    }

    list.innerHTML = "";
    vouchers.forEach(v => {
        const isRedeemed = v.status === 'REDEEMED';
        const card = document.createElement('div');
        card.className = `single-voucher-card ${isRedeemed ? 'redeemed' : 'active'}`;
        
        const dateStr = new Date(v.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                <div>
                    <span class="voucher-status-pill ${isRedeemed ? 'used' : 'active'}">
                        ${isRedeemed ? '🔴 REDEEMED' : '🟢 ACTIVE'}
                    </span>
                    <strong style="margin-left: 6px; font-size: 0.82rem; color: #1E293B;">${v.binName}</strong>
                </div>
                <span style="font-size: 0.72rem; color: #64748B;">${dateStr}</span>
            </div>
            <div class="voucher-code-text" style="font-family: monospace; font-size: 1.05rem; font-weight: 800; color: ${isRedeemed ? '#64748B' : '#047857'}; letter-spacing: 1px; margin: 6px 0;">
                ${v.code}
            </div>
            <div style="font-size: 0.76rem; color: #475569; margin-bottom: 8px;">
                ${v.discountDesc || 'Campus Discount Voucher'} (+${v.points} pts)
            </div>
            <div style="display: flex; gap: 6px;">
                <button class="btn btn-outline btn-sm" onclick="copyVoucherCode('${v.code}')" style="flex: 1; padding: 4px; font-size: 0.74rem;">
                    📋 Copy Code
                </button>
                ${!isRedeemed ? `
                    <button class="btn btn-primary btn-sm" onclick="redeemVoucherFromList('${v.code}')" style="flex: 1; padding: 4px; font-size: 0.74rem;">
                        🎁 Redeem
                    </button>
                ` : `
                    <button class="btn btn-outline btn-sm" disabled style="flex: 1; padding: 4px; font-size: 0.74rem; opacity: 0.6;">
                        Used at Counter
                    </button>
                `}
            </div>
        `;
        list.appendChild(card);
    });
}

function copyVoucherCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();
        alert(`Copied Reference Code: ${code}`);
    });
}

function redeemVoucherFromList(code) {
    if (!confirm(`Redeem code "${code}" at campus counter now?\nNote: Every reference code can only be used once!`)) return;
    const res = GreenRouteQRSecurity.redeemReferenceCode(code);
    alert(res.message);
    if (res.success) {
        if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();
        confetti({ particleCount: 150, spread: 80 });
        renderAllVouchersList();
        updateVoucherButtonBadge();
    }
}

function updateVoucherButtonBadge() {
    if (!window.GreenRouteQRSecurity) return;
    const count = GreenRouteQRSecurity.getActiveVouchersCount();
    const headerBadge = document.getElementById('vouchers-count-badge');
    const bannerBadge = document.getElementById('banner-vouchers-count');
    if (headerBadge) headerBadge.innerText = count;
    if (bannerBadge) bannerBadge.innerText = count;
}

function scrollToMap() {
    const mapCard = document.getElementById('campus-map');
    if (mapCard) {
        mapCard.scrollIntoView({ behavior: 'smooth' });
    }
}

function simulateQrScan(binId) {
    parseAndApplyScannedQr(`https://frontend.vercel.app/citizen.html?bin_id=${binId}&tenant=sou`);
}

function resetDemoScansAndReopen() {
    if (window.GreenRouteQRSecurity) {
        GreenRouteQRSecurity.resetDemoLimits();
    }
    closeDemoLimitModal();
    closeAlreadyScannedModal();
    updateVoucherButtonBadge();
    updateScannerDemoUI();
    if (citizenMap && typeof initCitizenMap === 'function') {
        initCitizenMap(true);
    }
    openScannerModal();
    alert("✨ Demo scans and bin locks have been reset! You can now scan freely.");
}

window.openScannerModal = openScannerModal;
window.openScannerForBin = openScannerForBin;
window.closeScannerModal = closeScannerModal;
window.selectWasteType = selectWasteType;
window.confirmScanRecycle = confirmScanRecycle;
window.confirmVisionScanAndDeposit = confirmVisionScanAndDeposit;
window.claimPerk = claimPerk;
window.closeClaimModal = closeClaimModal;
window.showRankUpModal = showRankUpModal;
window.closeRankModal = closeRankModal;
window.openRankProgress = openRankProgress;
window.closeRankProgress = closeRankProgress;
window.scrollToRewards = scrollToRewards;
window.scrollToMap = scrollToMap;
window.showRewardReferenceModal = showRewardReferenceModal;
window.closeRewardVoucherModal = closeRewardVoucherModal;
window.copyModalReferenceCode = copyModalReferenceCode;
window.redeemModalReferenceCode = redeemModalReferenceCode;
window.showAlreadyScannedModal = showAlreadyScannedModal;
window.closeAlreadyScannedModal = closeAlreadyScannedModal;
window.showDemoLimitModal = showDemoLimitModal;
window.closeDemoLimitModal = closeDemoLimitModal;
window.openAllVouchersModal = openAllVouchersModal;
window.closeAllVouchersModal = closeAllVouchersModal;
window.copyVoucherCode = copyVoucherCode;
window.redeemVoucherFromList = redeemVoucherFromList;
window.updateVoucherButtonBadge = updateVoucherButtonBadge;
window.simulateQrScan = simulateQrScan;
window.resetDemoScansAndReopen = resetDemoScansAndReopen;