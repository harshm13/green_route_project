/**
 * GreenRoute - Unified Resilient Data Service & Smart Engine
 * Automatically connects to the FastAPI backend if active,
 * or runs the high-fidelity GreenRoute Simulation Engine locally.
 */

const GreenRouteData = (function () {
    const API_BASE = "http://127.0.0.1:8000";
    let isLiveBackend = false;

    // --- DEFAULT CAMPUS BINS WITH SMART SENSORS & ZONES ---
    const DEFAULT_BINS = [
        {
            id: 1,
            name: "Campus Central Cafeteria",
            zone: "cafeteria",
            priority_zone: true,
            lat: 23.0825,
            lng: 72.5455,
            fill_level: 92,
            is_full: true,
            capacity: 240,
            last_emptied: "2026-09-13 09:15"
        },
        {
            id: 2,
            name: "Student Health Center (Clinic)",
            zone: "hospital",
            priority_zone: true,
            lat: 23.0812,
            lng: 72.5438,
            fill_level: 68,
            is_full: true, // full because priority zone >= 60%
            capacity: 120,
            last_emptied: "2026-09-13 07:30"
        },
        {
            id: 3,
            name: "Central Library Hub",
            zone: "academic",
            priority_zone: false,
            lat: 23.0838,
            lng: 72.5468,
            fill_level: 35,
            is_full: false,
            capacity: 180,
            last_emptied: "2026-09-13 14:00"
        },
        {
            id: 4,
            name: "Engineering Block C",
            zone: "academic",
            priority_zone: false,
            lat: 23.0855,
            lng: 72.5478,
            fill_level: 86,
            is_full: true,
            capacity: 240,
            last_emptied: "2026-09-13 08:45"
        },
        {
            id: 5,
            name: "Innovation & Tech Park",
            zone: "tech_park",
            priority_zone: false,
            lat: 23.0845,
            lng: 72.5420,
            fill_level: 78,
            is_full: false,
            capacity: 200,
            last_emptied: "2026-09-13 11:20"
        },
        {
            id: 6,
            name: "Hostel Quad North",
            zone: "residential",
            priority_zone: false,
            lat: 23.0870,
            lng: 72.5445,
            fill_level: 95,
            is_full: true,
            capacity: 360,
            last_emptied: "2026-09-13 06:10"
        },
        {
            id: 7,
            name: "Sports Complex & Gym",
            zone: "academic",
            priority_zone: false,
            lat: 23.0798,
            lng: 72.5485,
            fill_level: 22,
            is_full: false,
            capacity: 150,
            last_emptied: "2026-09-13 15:30"
        },
        {
            id: 8,
            name: "Food Court East Plaza",
            zone: "cafeteria",
            priority_zone: true,
            lat: 23.0805,
            lng: 72.5462,
            fill_level: 84,
            is_full: true,
            capacity: 240,
            last_emptied: "2026-09-13 10:40"
        }
    ];

    // --- RANK TIERS ---
    const RANK_TIERS = [
        { title: "Novice Sprout", icon: "🌱", req: 0 },
        { title: "Eco Ranger", icon: "🌿", req: 500 },
        { title: "Nature Knight", icon: "⚔️", req: 1000 },
        { title: "Planet Guardian", icon: "🛡️", req: 1500 },
        { title: "Gaia Master", icon: "🌍", req: 2000 }
    ];

    // --- DAILY QUESTS ---
    const DEFAULT_QUESTS = [
        { id: 1, icon: "⚡", title: "Morning Speedrun", desc: "Scan 1 smart bin on campus", reward: 75, progress: 0, target: 1, completed: false },
        { id: 2, icon: "📦", title: "Combo Recycler", desc: "Log 3 items segregated today", reward: 150, progress: 0, target: 3, completed: false },
        { id: 3, icon: "🔋", title: "E-Waste Crusader", desc: "Log batteries or electronics", reward: 200, progress: 0, target: 1, completed: false }
    ];

    // --- REWARDS CATALOG ---
    const DEFAULT_REWARDS = [
        { id: "reward-500", icon: "🌱", title: "Eco Seedling Kit", cost: 500, claimed: false },
        { id: "reward-1000", icon: "☕", title: "Free Campus Coffee", cost: 1000, claimed: false },
        { id: "reward-1500", icon: "👕", title: "SOU Eco T-Shirt", cost: 1500, claimed: false },
        { id: "reward-2000", icon: "🚲", title: "Campus Bike Pass (1 Mo)", cost: 2000, claimed: false }
    ];

    // --- INITIALIZE STORAGE ---
    function initStorage() {
        if (!localStorage.getItem('gr_bins')) {
            localStorage.setItem('gr_bins', JSON.stringify(DEFAULT_BINS));
        }
        if (!localStorage.getItem('gr_quests')) {
            localStorage.setItem('gr_quests', JSON.stringify(DEFAULT_QUESTS));
        }
        if (!localStorage.getItem('gr_rewards')) {
            localStorage.setItem('gr_rewards', JSON.stringify(DEFAULT_REWARDS));
        }
        if (!localStorage.getItem('gr_approvals')) {
            const initialApprovals = [
                { id: 1, name: "Aarav Patel", emp_id: "ADM-102", email: "aarav.p@eco.gov", department: "Sanitation Logistics", date: "2026-09-13" },
                { id: 2, name: "Priya Sharma", emp_id: "ADM-105", email: "priya.s@eco.gov", department: "Fleet Operations", date: "2026-09-13" }
            ];
            localStorage.setItem('gr_approvals', JSON.stringify(initialApprovals));
        }
        if (!localStorage.getItem('gr_audit_log')) {
            localStorage.setItem('gr_audit_log', JSON.stringify([]));
        }
    }

    initStorage();

    // Probe backend availability
    async function checkBackend() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 1500);
            const res = await fetch(`${API_BASE}/api/health`, { signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) {
                const data = await res.json();
                if (data.status === "healthy" || res.status === 200) {
                    isLiveBackend = true;
                    notifyBackendStatus(true);
                    syncAllFromBackend();
                    return true;
                }
            }
        } catch (e) {
            // Offline or backend unreachable
        }
        isLiveBackend = false;
        notifyBackendStatus(false);
        return false;
    }

    function notifyBackendStatus(active) {
        window.dispatchEvent(new CustomEvent('greenroute:backend-status', { detail: { active } }));
        const statusEl = document.getElementById('backend-status-text');
        if (statusEl) {
            statusEl.innerText = active ? "FastAPI Hub 🟢" : "Smart Engine 🟡";
            if (statusEl.parentElement) {
                statusEl.parentElement.style.background = active ? "rgba(16, 185, 129, 0.25)" : "rgba(245, 158, 11, 0.15)";
            }
        }
    }

    async function syncAllFromBackend() {
        try {
            // 1. Sync Bins
            const binsRes = await fetch(`${API_BASE}/bins/`);
            if (binsRes.ok) {
                const bins = await binsRes.json();
                if (Array.isArray(bins) && bins.length > 0) {
                    saveBins(bins);
                }
            }
            // 2. Sync Approvals
            const appRes = await fetch(`${API_BASE}/admin/approvals`);
            if (appRes.ok) {
                const apps = await appRes.json();
                localStorage.setItem('gr_approvals', JSON.stringify(apps));
            }
            // 3. Sync Audit Log
            const auditRes = await fetch(`${API_BASE}/admin/audit-log`);
            if (auditRes.ok) {
                const audit = await auditRes.json();
                localStorage.setItem('gr_audit_log', JSON.stringify(audit));
            }
        } catch (e) {
            console.warn("Background sync failed:", e);
        }
    }

    // --- BIN MANAGEMENT ---
    async function getBins() {
        if (isLiveBackend) {
            try {
                const res = await fetch(`${API_BASE}/bins/`);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        saveBins(data);
                        return data;
                    }
                }
            } catch (e) {
                console.warn("Backend request failed, falling back to local engine.");
            }
        }
        return JSON.parse(localStorage.getItem('gr_bins') || JSON.stringify(DEFAULT_BINS));
    }

    function saveBins(bins) {
        localStorage.setItem('gr_bins', JSON.stringify(bins));
    }

    async function toggleBinStatus(binId, forceStatus) {
        const bins = await getBins();
        const bin = bins.find(b => b.id === Number(binId));
        if (bin) {
            bin.is_full = forceStatus !== undefined ? forceStatus : !bin.is_full;
            bin.fill_level = bin.is_full ? Math.max(85, bin.fill_level) : Math.min(15, bin.fill_level);
            bin.last_emptied = bin.is_full ? bin.last_emptied : new Date().toISOString().replace('T', ' ').substring(0, 16);
            saveBins(bins);

            if (isLiveBackend) {
                try {
                    await fetch(`${API_BASE}/bins/${binId}/status?is_full=${bin.is_full}`, { method: 'PUT' });
                } catch (e) {}
            }
        }
        return bin;
    }

    async function updateBinFillLevel(binId, newFillLevel) {
        const bins = await getBins();
        const bin = bins.find(b => b.id === Number(binId));
        if (bin) {
            bin.fill_level = Number(newFillLevel);
            // Critical if >= 80% or priority zone >= 60%
            const isPriorityCritical = bin.priority_zone && bin.fill_level >= 60;
            bin.is_full = bin.fill_level >= 80 || isPriorityCritical;
            saveBins(bins);

            if (isLiveBackend) {
                try {
                    await fetch(`${API_BASE}/bins/${binId}/fill-level?fill_level=${bin.fill_level}`, { method: 'PUT' });
                } catch (e) {}
            }
        }
        return bin;
    }

    // --- DISTANCE CALCULATION HELPER ---
    function getDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // --- DYNAMIC PRIORITY ROUTING ALGORITHM ---
    async function calculateOptimalRoute(filterMode = "priority") {
        if (isLiveBackend) {
            try {
                const res = await fetch(`${API_BASE}/route/optimized?filter_mode=${filterMode}`);
                if (res.ok) {
                    const data = await res.json();
                    return data;
                }
            } catch (e) {
                console.warn("Backend routing request failed, falling back to local TSP:", e);
            }
        }

        const bins = await getBins();
        
        // Filter bins that require collection
        let targetBins = [];
        if (filterMode === "critical") {
            targetBins = bins.filter(b => b.fill_level >= 80);
        } else if (filterMode === "priority_zones") {

            targetBins = bins.filter(b => b.priority_zone && b.fill_level >= 60);
        } else if (filterMode === "all_full") {
            targetBins = bins.filter(b => b.is_full);
        } else {
            // Default Smart Priority Rule:
            // Critical bins (>= 80%) OR Priority Zones (hospitals/cafeterias >= 60%)
            targetBins = bins.filter(b => b.fill_level >= 80 || (b.priority_zone && b.fill_level >= 60));
        }

        if (targetBins.length === 0) {
            return {
                stops: [],
                totalDistanceKm: 0,
                metrics: { fuelSavedL: 0, co2PreventedKg: 0, laborHoursSaved: 0, efficiencyGainPercent: 0 },
                message: "All clear! No bins currently meet the priority threshold. 🌿"
            };
        }

        // Campus Depot starting location
        const DEPOT = { name: "Facilities Central Depot", lat: 23.0822, lng: 72.5460 };

        // Nearest Neighbor TSP heuristic
        let unvisited = [...targetBins];
        let currentLocation = DEPOT;
        let orderedRoute = [];
        let totalDistanceKm = 0;

        while (unvisited.length > 0) {
            let nearestIdx = 0;
            let minDistance = Infinity;

            for (let i = 0; i < unvisited.length; i++) {
                const dist = getDistanceKm(currentLocation.lat, currentLocation.lng, unvisited[i].lat, unvisited[i].lng);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestIdx = i;
                }
            }

            const nextStop = unvisited.splice(nearestIdx, 1)[0];
            totalDistanceKm += minDistance;
            orderedRoute.push({
                step: orderedRoute.length + 1,
                bin: nextStop,
                distanceFromPrevKm: Number(minDistance.toFixed(2))
            });
            currentLocation = nextStop;
        }

        // Return to depot distance
        const returnDist = getDistanceKm(currentLocation.lat, currentLocation.lng, DEPOT.lat, DEPOT.lng);
        totalDistanceKm += returnDist;

        // Baseline traditional static route (visiting all 8 bins regardless of fill)
        const baselineDistanceKm = 14.8;
        const distanceSavedKm = Math.max(0, baselineDistanceKm - totalDistanceKm);
        
        // Sustainability formula:
        // Fuel economy: 0.32 L per km (commercial diesel collection truck)
        // Carbon emissions: 2.68 kg CO2 per liter diesel
        const fuelSavedL = Number((distanceSavedKm * 0.32).toFixed(1));
        const co2PreventedKg = Number((fuelSavedL * 2.68).toFixed(1));
        const laborHoursSaved = Number((distanceSavedKm * 0.08).toFixed(1));
        const efficiencyGainPercent = Math.min(85, Math.round((distanceSavedKm / baselineDistanceKm) * 100));

        return {
            depot: DEPOT,
            stops: orderedRoute,
            totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
            returnDistanceKm: Number(returnDist.toFixed(2)),
            metrics: {
                fuelSavedL,
                co2PreventedKg,
                laborHoursSaved,
                efficiencyGainPercent
            },
            message: `Optimal route generated: ${orderedRoute.length} priority stops • ${efficiencyGainPercent}% fuel efficiency gain.`
        };
    }

    // --- CITIZEN DATA & GAMIFICATION ---
    function getCitizenData() {
        const defaultCitizen = {
            name: localStorage.getItem('registered_name') || "Kushal Bhatt",
            email: localStorage.getItem('registered_email') || "kushal@sou.edu.in",
            campus: "Silver Oak University",
            points: Number(localStorage.getItem('gr_points')) || 500,
            streak: Number(localStorage.getItem('gr_streak')) || 3,
            totalScans: Number(localStorage.getItem('gr_total_scans')) || 7
        };
        return defaultCitizen;
    }

    function saveCitizenData(citizen) {
        localStorage.setItem('registered_name', citizen.name);
        localStorage.setItem('gr_points', citizen.points);
        localStorage.setItem('gr_streak', citizen.streak);
        localStorage.setItem('gr_total_scans', citizen.totalScans);
    }

    function calculateRank(points) {
        let currentRank = RANK_TIERS[0];
        for (const tier of RANK_TIERS) {
            if (points >= tier.req) currentRank = tier;
        }
        return currentRank;
    }

    // Segregated scan logic with waste type multipliers
    async function processCitizenScan(wasteType = "general", binId = null) {
        const citizen = getCitizenData();
        const previousPoints = citizen.points;

        let earnedPoints = 0;
        let multiplier = 1.0;
        let newStreak = citizen.streak;

        // Try backend scan first if active
        if (isLiveBackend) {
            try {
                const userId = localStorage.getItem('user_id') || 1;
                const scanUrl = `${API_BASE}/users/${userId}/scan?waste_type=${encodeURIComponent(wasteType)}${binId ? `&bin_id=${binId}` : ''}`;
                const res = await fetch(scanUrl, { method: 'POST' });
                if (res.ok) {
                    const data = await res.json();
                    earnedPoints = data.earned_points;
                    multiplier = data.multiplier;
                    newStreak = data.current_streak;
                    citizen.points = data.new_total_points;
                    citizen.streak = newStreak;
                    if (data.user && data.user.total_scans !== undefined) {
                        citizen.totalScans = data.user.total_scans;
                    }
                }
            } catch (e) {
                console.warn("Backend scan failed, computing locally:", e);
            }
        }

        // Local calculation fallback
        if (earnedPoints === 0) {
            let basePoints = 50;
            if (citizen.streak >= 7) {
                multiplier += 0.5;
            } else if (citizen.streak >= 3) {
                multiplier += 0.2;
            }

            if (wasteType === "e-waste") multiplier += 0.5;
            else if (wasteType === "plastic") multiplier += 0.1;
            else if (wasteType === "organic") multiplier += 0.15;

            earnedPoints = Math.round(basePoints * multiplier);
            citizen.points += earnedPoints;
            citizen.totalScans += 1;
        }

        // Update Daily Quests
        const quests = JSON.parse(localStorage.getItem('gr_quests') || JSON.stringify(DEFAULT_QUESTS));
        let questCompletedReward = 0;

        quests.forEach(q => {
            if (!q.completed) {
                if (q.id === 1) {
                    q.progress = Math.min(q.target, q.progress + 1);
                    if (q.progress >= q.target) {
                        q.completed = true;
                        questCompletedReward += q.reward;
                    }
                } else if (q.id === 2) {
                    q.progress = Math.min(q.target, q.progress + 1);
                    if (q.progress >= q.target) {
                        q.completed = true;
                        questCompletedReward += q.reward;
                    }
                } else if (q.id === 3 && wasteType === "e-waste") {
                    q.progress = Math.min(q.target, q.progress + 1);
                    if (q.progress >= q.target) {
                        q.completed = true;
                        questCompletedReward += q.reward;
                    }
                }
            }
        });

        citizen.points += questCompletedReward;
        localStorage.setItem('gr_quests', JSON.stringify(quests));
        saveCitizenData(citizen);

        return {
            earnedPoints,
            questCompletedReward,
            totalEarned: earnedPoints + questCompletedReward,
            newPoints: citizen.points,
            previousPoints,
            multiplier,
            wasteType,
            newRank: calculateRank(citizen.points),
            streak: citizen.streak
        };
    }

    // --- LEADERBOARD LOGIC ---
    async function getLeaderboard() {
        const citizen = getCitizenData();

        if (isLiveBackend) {
            try {
                const res = await fetch(`${API_BASE}/users/leaderboard?limit=10`);
                if (res.ok) {
                    const users = await res.json();
                    if (Array.isArray(users) && users.length > 0) {
                        const formatted = users.map((u, idx) => {
                            const isMe = (u.email && u.email.toLowerCase() === citizen.email.toLowerCase()) || u.name === citizen.name;
                            return {
                                name: isMe ? `${u.name} (You)` : u.name,
                                points: u.points,
                                avatar: idx === 0 ? "🏆" : (idx === 1 ? "🛡️" : (idx === 2 ? "⚔️" : "🌱")),
                                badge: u.rank,
                                isMe: isMe
                            };
                        });
                        localStorage.setItem('gr_leaderboard', JSON.stringify(formatted));
                        return formatted;
                    }
                }
            } catch (e) {
                console.warn("Backend leaderboard failed, using cached:", e);
            }
        }

        const cached = localStorage.getItem('gr_leaderboard');
        if (cached) {
            try { return JSON.parse(cached); } catch(e) {}
        }

        const baseLeaderboard = [
            { name: "Rahul D.", points: 2850, avatar: "🏆", badge: "Gaia Master", isMe: false },
            { name: "Sneha P.", points: 1920, avatar: "🛡️", badge: "Planet Guardian", isMe: false },
            { name: "Amit K.", points: 1410, avatar: "⚔️", badge: "Nature Knight", isMe: false },
            { name: `${citizen.name} (You)`, points: citizen.points, avatar: "🌱", badge: calculateRank(citizen.points).title, isMe: true },
            { name: "Tanvi S.", points: 420, avatar: "🌿", badge: "Eco Ranger", isMe: false }
        ];

        baseLeaderboard.sort((a, b) => b.points - a.points);
        return baseLeaderboard;
    }

    // --- APPROVALS MANAGEMENT ---
    function getPendingApprovals() {
        if (isLiveBackend) {
            fetch(`${API_BASE}/admin/approvals`)
                .then(res => res.json())
                .then(apps => {
                    if (Array.isArray(apps)) localStorage.setItem('gr_approvals', JSON.stringify(apps));
                })
                .catch(() => {});
        }
        return JSON.parse(localStorage.getItem('gr_approvals') || "[]");
    }

    function getAuditLog() {
        if (isLiveBackend) {
            fetch(`${API_BASE}/admin/audit-log`)
                .then(res => res.json())
                .then(audit => {
                    if (Array.isArray(audit)) localStorage.setItem('gr_audit_log', JSON.stringify(audit));
                })
                .catch(() => {});
        }
        return JSON.parse(localStorage.getItem('gr_audit_log') || "[]");
    }

    async function approveAdmin(id) {
        const approvals = JSON.parse(localStorage.getItem('gr_approvals') || "[]");
        const auditLog = JSON.parse(localStorage.getItem('gr_audit_log') || "[]");
        const target = approvals.find(a => a.id === Number(id));

        if (target) {
            const updatedApprovals = approvals.filter(a => a.id !== Number(id));
            localStorage.setItem('gr_approvals', JSON.stringify(updatedApprovals));

            auditLog.unshift({
                ...target,
                action: "APPROVED",
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
            });
            localStorage.setItem('gr_audit_log', JSON.stringify(auditLog));

            // If it matches registered user in localStorage, grant access
            if (localStorage.getItem('registered_email') === target.email || target.isLocal) {
                localStorage.setItem('is_approved', 'true');
            }

            if (isLiveBackend) {
                try {
                    await fetch(`${API_BASE}/admin/approvals/${id}/approve`, { method: 'POST' });
                } catch (e) {}
            }
            return true;
        }
        return false;
    }

    async function rejectAdmin(id) {
        const approvals = JSON.parse(localStorage.getItem('gr_approvals') || "[]");
        const auditLog = JSON.parse(localStorage.getItem('gr_audit_log') || "[]");
        const target = approvals.find(a => a.id === Number(id));

        if (target) {
            const updatedApprovals = approvals.filter(a => a.id !== Number(id));
            localStorage.setItem('gr_approvals', JSON.stringify(updatedApprovals));

            auditLog.unshift({
                ...target,
                action: "REJECTED",
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
            });
            localStorage.setItem('gr_audit_log', JSON.stringify(auditLog));

            if (localStorage.getItem('registered_email') === target.email || target.isLocal) {
                localStorage.setItem('is_approved', 'rejected');
            }

            if (isLiveBackend) {
                try {
                    await fetch(`${API_BASE}/admin/approvals/${id}/reject`, { method: 'POST' });
                } catch (e) {}
            }
            return true;
        }
        return false;
    }

    // --- AI OPERATIONS ASSISTANT CLIENT ---
    async function askAi(query) {
        if (isLiveBackend) {
            try {
                const res = await fetch(`${API_BASE}/ai/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: query })
                });
                if (res.ok) {
                    const data = await res.json();
                    return data.response;
                }
            } catch (e) {
                console.warn("Backend AI chat error, using local reply:", e);
            }
        }
        return null;
    }

    // Auto-probe backend immediately
    checkBackend();

    return {
        API_BASE,
        isBackendActive: () => isLiveBackend,
        checkBackend,
        getBins,
        toggleBinStatus,
        updateBinFillLevel,
        calculateOptimalRoute,
        getCitizenData,
        saveCitizenData,
        calculateRank,
        processCitizenScan,
        getLeaderboard,
        getRankTiers: () => RANK_TIERS,
        getQuests: () => JSON.parse(localStorage.getItem('gr_quests') || JSON.stringify(DEFAULT_QUESTS)),
        getRewards: () => JSON.parse(localStorage.getItem('gr_rewards') || JSON.stringify(DEFAULT_REWARDS)),
        getPendingApprovals,
        getAuditLog,
        approveAdmin,
        rejectAdmin,
        askAi
    };
})();

// Attach to window
window.GreenRouteData = GreenRouteData;
