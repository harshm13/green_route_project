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
async function initCitizenMap() {
    if (citizenMap) return;

    // Center around Silver Oak University campus coordinates
    citizenMap = L.map('campus-map').setView([23.0835, 72.5458], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(citizenMap);

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

        const marker = L.marker([bin.lat, bin.lng], { icon: iconToUse }).addTo(citizenMap);
        
        marker.bindPopup(`
            <div style="font-family: 'Outfit', sans-serif; min-width: 180px;">
                <h4 style="margin: 0 0 4px; font-size: 0.95rem; color: #1F2937;">${bin.name}</h4>
                <div style="font-size: 0.8rem; margin-bottom: 6px;">${statusBadge}</div>
                <div style="background: #E5E7EB; height: 6px; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
                    <div style="background: ${bin.fill_level >= 80 ? '#EF4444' : '#10B981'}; width: ${bin.fill_level}%; height: 100%;"></div>
                </div>
                <div style="font-size: 0.78rem; color: #6B7280; margin-bottom: 8px;">Fill Level: <strong>${bin.fill_level}%</strong> (${bin.capacity}L)</div>
                <button onclick="openScannerForBin(${bin.id})" style="width: 100%; background: #10B981; color: white; border: none; padding: 6px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.82rem;">
                    📲 Scan Here
                </button>
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
async function openScannerModal() {
    const select = document.getElementById('scan-bin-select');
    const bins = await GreenRouteData.getBins();

    select.innerHTML = '';
    bins.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.text = `${b.name} (${b.zone.toUpperCase()} • ${b.fill_level}% full)`;
        select.appendChild(opt);
    });

    document.getElementById('interactive-scan-modal').classList.remove('hidden');
    if (window.GreenRouteSFX) GreenRouteSFX.playScan();

    // Initialize with default sample if not already set
    if (!currentVisionClassification) {
        testVisionSample('plastic');
    }
}

function openScannerForBin(binId) {
    openScannerModal();
    setTimeout(() => {
        const select = document.getElementById('scan-bin-select');
        if (select) select.value = binId;
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
        setTimeout(() => {
            openScannerForBin(parseInt(binId, 10));
            if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();
            // Show alert feedback banner
            const modalTitle = document.querySelector('#interactive-scan-modal h3');
            if (modalTitle) {
                modalTitle.innerHTML = `📷 AI Waste Scanner <span style="font-size: 0.72rem; background: #ECFDF5; color: #047857; padding: 2px 8px; border-radius: 12px; border: 1px solid #10B981;">📍 Physical QR #${binId} Locked</span>`;
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
        if (placeholderSubtitle) placeholderSubtitle.innerText = 'Point camera at physical sticker on bin to auto-select';

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

        stopQrDetectionLoop();
    }
}

async function startQrDetectionLoop() {
    stopQrDetectionLoop();
    if (!window.BarcodeDetector) {
        console.log("[GreenRoute QR] BarcodeDetector not natively available in this browser. Fallback active.");
        return;
    }

    try {
        const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const video = document.getElementById('webcam-feed');

        qrScanInterval = setInterval(async () => {
            if (!activeWebcamStream || !video || video.readyState < 2 || currentScannerMode !== 'qr') return;
            try {
                const barcodes = await barcodeDetector.detect(video);
                if (barcodes && barcodes.length > 0) {
                    const rawVal = barcodes[0].rawValue;
                    console.log("[GreenRoute QR] Live QR Decoded:", rawVal);
                    parseAndApplyScannedQr(rawVal);
                }
            } catch (err) {
                // Ignore transient frame decode drops
            }
        }, 400);
    } catch (e) {
        console.warn("[GreenRoute QR] BarcodeDetector init failed:", e);
    }
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
        const select = document.getElementById('scan-bin-select');
        if (select) {
            select.value = binId;
        }
        if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();
        alert(`🎯 Verified Physical Smart Bin #${binId} Detected via Camera! Switching to Waste Classification...`);
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
        video.classList.add('hidden');
        placeholder.classList.add('hidden');
        imgPreview.src = dataUrl;
        imgPreview.classList.remove('hidden');

        classifyAndDisplay(dataUrl, null);
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
    const binId = select ? select.value : 1;

    closeScannerModal();

    const userId = localStorage.getItem('user_id') || 1;
    const wType = currentVisionClassification ? currentVisionClassification.waste_type : selectedWasteType;

    const result = await GreenRouteData.verifyAndScanWaste(userId, binId, currentBase64Image, wType);

    confetti({ particleCount: 180, spread: 90, origin: { y: 0.6 } });
    if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();

    const oldPoints = parseInt(document.getElementById('points-display').innerText) || 0;
    updatePointsDisplay(oldPoints, result.new_total_points);
    renderQuests();
    await updateLeaderboard();

    if (result.rank && result.rank !== currentRankTitle) {
        currentRankTitle = result.rank;
        showRankUpModal({ title: result.rank, icon: "⚔️" });
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

function scrollToRewards() {
    const section = document.getElementById('rewards-section');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
        section.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)';
        setTimeout(() => { section.style.boxShadow = ''; }, 1500);
    }
}

window.openScannerModal = openScannerModal;
window.openScannerForBin = openScannerForBin;
window.closeScannerModal = closeScannerModal;
window.selectWasteType = selectWasteType;
window.confirmScanRecycle = confirmScanRecycle;
window.claimPerk = claimPerk;
window.closeClaimModal = closeClaimModal;
window.showRankUpModal = showRankUpModal;
window.closeRankModal = closeRankModal;
window.openRankProgress = openRankProgress;
window.closeRankProgress = closeRankProgress;
window.scrollToRewards = scrollToRewards;