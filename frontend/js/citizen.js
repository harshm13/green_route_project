// --- STARTING AT 0 POINTS ---
let currentPoints = 0; 
let currentRankTitle = "Novice Sprout"; 

const pointsDisplay = document.getElementById('points-display');
const rewardsCard = document.getElementById('rewards-card');
const leaderboardList = document.getElementById('leaderboard-list');
const progressBar = document.getElementById('progress-bar');
const nextMilestoneText = document.getElementById('next-milestone-text');

// --- MULTIPLE ACTIVE DAILY QUESTS ---
const dailyQuests = [
    { id: 1, icon: "⚡", title: "Morning Speedrun", desc: "Scan 1 item today", reward: 75, completed: false },
    { id: 2, icon: "📦", title: "Combo Chain", desc: "Scan 3 items total", reward: 150, progress: 0, target: 3, completed: false },
    { id: 3, icon: "🔋", title: "E-Waste Hunter", desc: "Log hardware parts", reward: 100, completed: false }
];

// RPG-Style Rank Tiers
const rankTiers = [
    { title: "Novice Sprout", icon: "🌱", req: 0 },
    { title: "Eco Ranger", icon: "🌿", req: 500 },
    { title: "Nature Knight", icon: "⚔️", req: 1000 },
    { title: "Planet Guardian", icon: "🛡️", req: 1500 },
    { title: "Gaia Master", icon: "🌍", req: 2000 }
];

const ecoPhrases = ["Super Recycler! 🦸‍♂️", "Planet Hero! 🌍", "Eco Warrior! ⚔️", "Trash Terminator! 🤖", "Awesome! Going Green! ♻️"];

// Leaderboard Data
const mockUsers = [
    { name: "Rahul D.", points: 2850, isMe: false },
    { name: "Sneha P.", points: 1920, isMe: false },
    { name: "Amit K.", points: 1410, isMe: false },
    { name: "Kushal Bhatt (You)", points: 0, isMe: true } 
];

// --- QUEST BOARD RENDERING ---
function renderQuests() {
    const questList = document.getElementById('quest-list');
    if (!questList) return;
    questList.innerHTML = "";

    dailyQuests.forEach(quest => {
        const li = document.createElement('li');
        li.className = `reward-item ${quest.completed ? 'unlocked' : ''}`;
        
        let progressText = quest.target ? ` (${quest.progress}/${quest.target})` : "";
        
        li.innerHTML = `
            <span class="reward-icon">${quest.icon}</span>
            <div class="reward-details">
                <h4>${quest.title}${progressText}</h4>
                <p>${quest.desc} • +${quest.reward} pts</p>
            </div>
            <span class="status-badge" style="background: ${quest.completed ? '#27ae60' : 'rgba(0,0,0,0.1)'}; color: ${quest.completed ? '#fff' : '#333'};">
                ${quest.completed ? 'Done' : 'Active'}
            </span>
        `;
        questList.appendChild(li);
    });
}

// --- SMART BIN MAP LOGIC ---
function initMap() {
    const mapDiv = document.getElementById('campus-map');
    if (!mapDiv || typeof L === 'undefined') return; // Prevent crash if map isn't ready
    
    const map = L.map('campus-map').setView([23.0822, 72.5460], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    const greenIcon = L.icon({ 
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', 
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] 
    });
    
    const redIcon = L.icon({ 
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', 
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34] 
    });

    L.marker([23.0825, 72.5465], {icon: greenIcon}).addTo(map)
        .bindPopup("<b>Block C Bin</b><br>Status: Ready to use! 🌿");
        
    L.marker([23.0815, 72.5455], {icon: redIcon}).addTo(map)
        .bindPopup("<b>Library Bin</b><br>Status: Currently Full ⚠️");
}

// --- RANK SYSTEM LOGIC ---
function getRankDetails(points) {
    let currentRank = rankTiers[0];
    for (let rank of rankTiers) {
        if (points >= rank.req) {
            currentRank = rank;
        }
    }
    return currentRank;
}

function updateUI(previousPoints) {
    // 1. Animate Points
    if (pointsDisplay) {
        if (previousPoints !== currentPoints) {
            animateValue(pointsDisplay, previousPoints, currentPoints, 800);
        } else {
            pointsDisplay.innerText = currentPoints;
        }
    }

    // 2. Rank Update Logic
    const rankInfo = getRankDetails(currentPoints);
    const userRankEl = document.getElementById('user-rank');
    const rankIconEl = document.getElementById('rank-icon');
    
    if (userRankEl) userRankEl.innerHTML = `${rankInfo.title} <span class="info-btn" title="Click to view Rank System">i</span>`;
    if (rankIconEl) rankIconEl.innerText = rankInfo.icon;

    if (rankInfo.title !== currentRankTitle && currentPoints > 0) {
        currentRankTitle = rankInfo.title;
        showRankUpModal(rankInfo);
    }

    // 3. Update Progress Bar
    let nextMilestone = 1000;
    let previousMilestone = 0;

    if (currentPoints >= 1000 && currentPoints < 1500) {
        nextMilestone = 1500; previousMilestone = 1000;
    } else if (currentPoints >= 1500) {
        nextMilestone = 2000; previousMilestone = 1500;
    }

    if (nextMilestoneText) nextMilestoneText.innerText = nextMilestone;
    
    if (progressBar) {
        let percentage = ((currentPoints - previousMilestone) / (nextMilestone - previousMilestone)) * 100;
        if(percentage > 100) percentage = 100; 
        progressBar.style.width = percentage + "%";
    }

    // 4. Check Rewards & Update Leaderboard
    if (currentPoints >= 1000) unlockReward('reward-1000');
    if (currentPoints >= 1500) unlockReward('reward-1500');
    updateLeaderboardLogic();
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

// --- RANK PROGRESS MODAL LOGIC ---
function openRankProgress() {
    const list = document.getElementById('rank-progress-list');
    if (!list) return;
    list.innerHTML = ""; 
    
    rankTiers.forEach(rank => {
        const isUnlocked = currentPoints >= rank.req;
        const isCurrent = getRankDetails(currentPoints).title === rank.title;
        
        const li = document.createElement('li');
        li.className = `reward-item ${isUnlocked ? 'unlocked' : 'locked'}`;
        
        if (isCurrent) {
            li.style.border = "2px solid #27ae60";
            li.style.transform = "scale(1.02)";
        }

        li.innerHTML = `
            <span class="reward-icon">${rank.icon}</span>
            <div class="reward-details">
                <h4>${rank.title}</h4>
                <p>${rank.req} pts required</p>
            </div>
            <span class="status-badge" style="background: ${isUnlocked ? '#27ae60' : 'rgba(0,0,0,0.1)'}; color: ${isUnlocked ? '#fff' : '#333'};">
                ${isCurrent ? 'Current' : (isUnlocked ? 'Unlocked' : 'Locked')}
            </span>
        `;
        list.appendChild(li);
    });

    document.getElementById('rank-progress-modal')?.classList.remove('hidden');
}

function closeRankProgress() {
    document.getElementById('rank-progress-modal')?.classList.add('hidden');
}

// --- SCAN & POP-UP LOGIC ---
function showRankUpModal(rankInfo) {
    setTimeout(() => {
        const modal = document.getElementById('rank-up-modal');
        if (!modal) return;
        
        document.getElementById('rank-up-text').innerText = rankInfo.title;
        document.getElementById('rank-up-icon').innerText = rankInfo.icon;
        
        modal.classList.remove('hidden');
        if (typeof confetti === 'function') {
            confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, colors: ['#ffeb3b', '#27ae60', '#fff'] });
        }
    }, 800); 
}

function closeRankModal() { document.getElementById('rank-up-modal')?.classList.add('hidden'); }

function unlockReward(id) {
    const rewardElement = document.getElementById(id);
    if (rewardElement && rewardElement.classList.contains('locked')) {
        rewardElement.classList.remove('locked');
        rewardElement.classList.add('unlocked');
        const badge = rewardElement.querySelector('.status-badge');
        if (badge) {
            badge.innerText = 'Claim';
            badge.onclick = () => claimReward(id, badge);
        }
        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#27ae60', '#9acd32', '#fff'] });
        }
    }
}

function claimReward(id, badgeElement) {
    const modal = document.getElementById('claim-modal');
    const modalText = document.getElementById('claim-modal-text');
    if (modal && modalText) {
        modalText.innerText = `You claimed a ${id === 'reward-1000' ? 'Free Campus Coffee ☕' : 'Silver Oak T-Shirt 👕'}!`;
        modal.classList.remove('hidden');
        if (typeof confetti === 'function') {
            confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 }, colors: ['#ffeb3b', '#ff9800', '#4CAF50'] });
        }
    }
    
    badgeElement.innerText = "Claimed!";
    badgeElement.style.background = "#333";
    badgeElement.style.color = "#fff";
    badgeElement.onclick = null; 
}

function closeClaimModal() { document.getElementById('claim-modal')?.classList.add('hidden'); }

function simulateQRScan() {
    let previousPoints = currentPoints;
    
    // Base points for scanning
    currentPoints += 100; 
    
    // --- MULTI-QUEST PROGRESS LOGIC ---
    let questCompletedJustNow = false;
    
    dailyQuests.forEach(quest => {
        if (!quest.completed) {
            if (quest.id === 1) {
                quest.completed = true;
                currentPoints += quest.reward;
                questCompletedJustNow = true;
            } else if (quest.id === 2) {
                quest.progress++;
                if (quest.progress >= quest.target) {
                    quest.completed = true;
                    currentPoints += quest.reward;
                    questCompletedJustNow = true;
                }
            } else if (quest.id === 3 && Math.random() > 0.5) {
                quest.completed = true;
                currentPoints += quest.reward;
                questCompletedJustNow = true;
            }
        }
    });

    renderQuests(); 

    if (questCompletedJustNow && typeof confetti === 'function') {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#ff9800', '#4CAF50'] });
    }
    
    // Button animation
    if (rewardsCard) {
        rewardsCard.style.transform = "scale(0.95)";
        setTimeout(() => { rewardsCard.style.transform = "scale(1)"; }, 150);
    }
    
    // Pop-up logic
    const scanModal = document.getElementById('scan-modal');
    if (scanModal) {
        const textEl = document.getElementById('scan-modal-text');
        if (textEl) textEl.innerText = ecoPhrases[Math.floor(Math.random() * ecoPhrases.length)];
        
        scanModal.classList.remove('hidden');
        
        if (typeof confetti === 'function') {
            confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, colors: ['#27ae60', '#f1c40f', '#2ecc71', '#d4fc79'] });
        }

        setTimeout(() => { scanModal.classList.add('hidden'); }, 1500);
    }
    
    updateUI(previousPoints);
}

function updateLeaderboardLogic() {
    const me = mockUsers.find(user => user.isMe);
    if (me) me.points = currentPoints;
    
    mockUsers.sort((a, b) => b.points - a.points);
    
    if (!leaderboardList) return;
    leaderboardList.innerHTML = ""; 
    
    mockUsers.forEach((user, index) => {
        const listItem = document.createElement("li");
        listItem.className = "leaderboard-item list-move"; 
        listItem.style.animationDelay = `${index * 0.1}s`; 
        
        if (user.isMe) {
            listItem.style.background = "rgba(39, 174, 96, 0.15)";
            listItem.style.borderColor = "rgba(39, 174, 96, 0.4)";
        }
        
        const pointsHtml = `<span class="lb-points">${user.points} pts</span>`;

        listItem.innerHTML = `
            <div style="display: flex; align-items: center;">
                <div class="rank-badge">#${index + 1}</div>
                <span style="font-weight: ${user.isMe ? '700' : '500'}; color: #333;">${user.name}</span>
            </div>
            ${pointsHtml}
        `;
        leaderboardList.appendChild(listItem);
    });
}

window.onload = function() {
    updateLeaderboardLogic();
    renderQuests();
    initMap(); 
    updateUI(currentPoints); 
};