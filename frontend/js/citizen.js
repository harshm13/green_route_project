/**
 * GreenRoute - Citizen Dashboard Controller
 */

let citizenMap = null;
let selectedWasteType = "plastic";
let currentPoints = 0;
let currentRankTitle = "Novice Sprout";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check Auth (Allow demo fallback)
    const user = getCurrentUser();
    if (!user.isAuthenticated) {
        // Automatically seed demo citizen if accessing directly
        seedDemoAccount('citizen');
        return;
    }

    // 2. Initialize UI & Data
    await loadCitizenProfile();
    await initCitizenMap();
    renderQuests();
    renderRewards();
    await updateLeaderboard();
});

// --- LOAD CITIZEN PROFILE ---
async function loadCitizenProfile() {
    let citizen = GreenRouteData.getCitizenData();

    // If backend is active, fetch latest live stats from SQLite
    if (GreenRouteData.isBackendActive()) {
        try {
            const userId = localStorage.getItem('user_id') || 1;
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
    renderRewards();
}

function closeClaimModal() {
    document.getElementById('claim-modal').classList.add('hidden');
}

// --- INTERACTIVE QR SCANNER MODAL ---
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
}

function openScannerForBin(binId) {
    openScannerModal();
    setTimeout(() => {
        const select = document.getElementById('scan-bin-select');
        select.value = binId;
    }, 100);
}

function closeScannerModal() {
    document.getElementById('interactive-scan-modal').classList.add('hidden');
}

function selectWasteType(type, element) {
    selectedWasteType = type;
    document.querySelectorAll('.waste-chip').forEach(chip => chip.classList.remove('selected'));
    element.classList.add('selected');
}

async function confirmScanRecycle() {
    const select = document.getElementById('scan-bin-select');
    const binId = select.value;

    closeScannerModal();

    const result = await GreenRouteData.processCitizenScan(selectedWasteType, binId);
    
    // Celebration confetti
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });

    // Update UI
    updatePointsDisplay(result.previousPoints, result.newPoints);
    renderQuests();
    await updateLeaderboard();

    // Check if Rank Tier Increased
    if (result.newRank.title !== currentRankTitle) {
        currentRankTitle = result.newRank.title;
        showRankUpModal(result.newRank);
    }
}

// --- RANK UP MODAL ---
function showRankUpModal(rankInfo) {
    document.getElementById('rank-up-text').innerText = rankInfo.title;
    document.getElementById('rank-up-icon').innerText = rankInfo.icon;
    document.getElementById('rank-up-modal').classList.remove('hidden');
    confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 } });
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