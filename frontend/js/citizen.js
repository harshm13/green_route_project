// --- STARTING AT 0 POINTS ---
let currentPoints = 0; 
let currentRankTitle = "Novice Sprout"; 
let missionCompleted = false; // Tracks if the daily mission is done

const pointsDisplay = document.getElementById('points-display');
const rewardsCard = document.getElementById('rewards-card');
const leaderboardList = document.getElementById('leaderboard-list');
const progressBar = document.getElementById('progress-bar');
const nextMilestoneText = document.getElementById('next-milestone-text');

// RPG-Style Rank Tiers
const rankTiers = [
    { title: "Novice Sprout", icon: "🌱", req: 0 },
    { title: "Eco Ranger", icon: "🌿", req: 500 },
    { title: "Nature Knight", icon: "⚔️", req: 1000 },
    { title: "Planet Guardian", icon: "🛡️", req: 1500 },
    { title: "Gaia Master", icon: "🌍", req: 2000 }
];

const ecoPhrases = ["Super Recycler! 🦸‍♂️", "Planet Hero! 🌍", "Eco Warrior! ⚔️", "Trash Terminator! 🤖", "Awesome! Going Green! ♻️"];

const mockUsers = [
    { name: "Rahul D.", points: 2850, isMe: false },
    { name: "Sneha P.", points: 1920, isMe: false },
    { name: "Amit K.", points: 1410, isMe: false },
    { name: "Kushal (You)", points: 0, isMe: true } 
];

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
    if (previousPoints !== currentPoints) {
        animateValue(pointsDisplay, previousPoints, currentPoints, 800);
    } else {
        pointsDisplay.innerText = currentPoints;
    }

    // 2. Rank Update Logic
    const rankInfo = getRankDetails(currentPoints);
    document.getElementById('user-rank').innerHTML = `${rankInfo.title} ℹ️`;
    document.getElementById('rank-icon').innerText = rankInfo.icon;

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

    nextMilestoneText.innerText = nextMilestone;
    let percentage = ((currentPoints - previousMilestone) / (nextMilestone - previousMilestone)) * 100;
    if(percentage > 100) percentage = 100; 
    progressBar.style.width = percentage + "%";

    // 4. Check Rewards & Leaderboard
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
    list.innerHTML = ""; 
    
    rankTiers.forEach(rank => {
        const isUnlocked = currentPoints >= rank.req;
        const isCurrent = getRankDetails(currentPoints).title === rank.title;
        
        const li = document.createElement('li');
        li.className = `reward-item ${isUnlocked ? 'unlocked' : 'locked'}`;
        
        if (isCurrent) {
            li.style.border = "2px solid #3e4f24";
            li.style.transform = "scale(1.02)";
        }

        li.innerHTML = `
            <span class="reward-icon">${rank.icon}</span>
            <div class="reward-details">
                <h4>${rank.title}</h4>
                <p>${rank.req} pts required</p>
            </div>
            <span class="status-badge" style="background: ${isUnlocked ? '#6b8e23' : 'rgba(0,0,0,0.1)'}; color: ${isUnlocked ? '#fff' : '#3e4f24'};">
                ${isCurrent ? 'Current' : (isUnlocked ? 'Unlocked' : 'Locked')}
            </span>
        `;
        list.appendChild(li);
    });

    document.getElementById('rank-progress-modal').classList.remove('hidden');
}

function closeRankProgress() {
    document.getElementById('rank-progress-modal').classList.add('hidden');
}

// --- SCAN & POP-UP LOGIC ---
function showRankUpModal(rankInfo) {
    setTimeout(() => {
        const modal = document.getElementById('rank-up-modal');
        document.getElementById('rank-up-text').innerText = rankInfo.title;
        document.getElementById('rank-up-icon').innerText = rankInfo.icon;
        
        modal.classList.remove('hidden');
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, colors: ['#ffeb3b', '#6b8e23', '#fffde7'] });
    }, 800); 
}

function closeRankModal() { document.getElementById('rank-up-modal').classList.add('hidden'); }

function unlockReward(id) {
    const rewardElement = document.getElementById(id);
    if (rewardElement && rewardElement.classList.contains('locked')) {
        rewardElement.classList.remove('locked');
        rewardElement.classList.add('unlocked');
        const badge = rewardElement.querySelector('.status-badge');
        badge.innerText = 'Claim';
        badge.onclick = () => claimReward(id, badge);
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#6b8e23', '#9acd32', '#fffde7'] });
    }
}

function claimReward(id, badgeElement) {
    const modal = document.getElementById('claim-modal');
    const modalText = document.getElementById('claim-modal-text');
    modalText.innerText = `You claimed a ${id === 'reward-1000' ? 'Free Campus Coffee ☕' : 'Silver Oak T-Shirt 👕'}!`;
    modal.classList.remove('hidden');
    confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 }, colors: ['#ffeb3b', '#ff9800', '#4CAF50'] });
    
    badgeElement.innerText = "Claimed!";
    badgeElement.style.background = "#3e4f24";
    badgeElement.style.color = "#fff";
    badgeElement.onclick = null; 
}

function closeClaimModal() { document.getElementById('claim-modal').classList.add('hidden'); }

function simulateQRScan() {
    let previousPoints = currentPoints;
    
    // Base points for scanning
    currentPoints += 100; 
    
    // --- DAILY MISSION LOGIC ---
    if (!missionCompleted) {
        currentPoints += 50; // Bonus points!
        missionCompleted = true;
        
        // Update Mission UI
        const missionItem = document.getElementById('mission-1');
        const missionBadge = document.getElementById('mission-1-badge');
        
        if(missionItem && missionBadge) {
            missionItem.classList.remove('locked');
            missionItem.classList.add('unlocked');
            missionBadge.innerText = "Done!";
            missionBadge.style.background = "#6b8e23";
            missionBadge.style.color = "#fffde7";
        }

        // Mini confetti for completing the mission
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 }, colors: ['#ff9800', '#4CAF50'] });
    }
    
    // Button animation
    if (rewardsCard) {
        rewardsCard.style.transform = "scale(0.95)";
        setTimeout(() => { rewardsCard.style.transform = "scale(1)"; }, 150);
    }
    
    // Pop-up logic
    const scanModal = document.getElementById('scan-modal');
    document.getElementById('scan-modal-text').innerText = ecoPhrases[Math.floor(Math.random() * ecoPhrases.length)];
    scanModal.classList.remove('hidden');
    setTimeout(() => { scanModal.classList.add('hidden'); }, 1500);
    
    updateUI(previousPoints);
}

function updateLeaderboardLogic() {
    const me = mockUsers.find(user => user.isMe);
    me.points = currentPoints;
    mockUsers.sort((a, b) => b.points - a.points);
    leaderboardList.innerHTML = ""; 
    
    mockUsers.forEach((user, index) => {
        const listItem = document.createElement("li");
        listItem.className = "leaderboard-item list-move"; 
        listItem.style.animationDelay = `${index * 0.1}s`; 
        
        const pointsHtml = user.isMe 
            ? `<span class="lb-points">${currentPoints} pts</span>`
            : `<span class="lb-points">${user.points} pts</span>`;

        listItem.innerHTML = `
            <div style="display: flex; align-items: center;">
                <div class="rank-badge">#${index + 1}</div>
                <span style="font-weight: ${user.isMe ? '700' : '400'};">${user.name}</span>
            </div>
            ${pointsHtml}
        `;
        leaderboardList.appendChild(listItem);
    });
}

window.onload = function() {
    updateLeaderboardLogic();
    updateUI(currentPoints); 
};