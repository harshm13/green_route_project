/**
 * GreenRoute - Admin Fleet Logistics Command Center Controller
 */

let adminMap = null;
let routeLayerGroup = null;
let heatLayer = null;
let allBinsMarkerGroup = null;

let currentMapMode = "route"; // 'route' | 'heat'
let currentRouteFilter = "priority"; // 'priority' | 'critical' | 'priority_zones' | 'all_full'
let currentRouteData = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verify authorization
    const user = getCurrentUser();
    if (!user.isAuthenticated || user.role !== 'admin') {
        // Automatically seed demo admin if accessed directly for review
        seedDemoAccount('admin');
        return;
    }

    // 2. Initialize Map & Services
    initMap();
    updatePendingBadge();
    await calculateAndDisplayRoute();
    await renderBinTable();

    // 3. Backend status detection
    const updateBackendUi = (isLive) => {
        const statusText = document.getElementById('backend-status-text');
        if (statusText) {
            statusText.innerText = isLive ? "FastAPI Hub 🟢" : "Smart Engine 🟡";
            if (statusText.parentElement) {
                statusText.parentElement.style.background = isLive ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.15)";
            }
        }
    };

    updateBackendUi(GreenRouteData.isBackendActive());
    window.addEventListener('greenroute:backend-status', (e) => updateBackendUi(e.detail.active));
});

// --- PENDING APPROVALS BADGE ---
function updatePendingBadge() {
    const badge = document.getElementById('admin-pending-badge');
    if (badge) {
        const count = GreenRouteData.getPendingApprovals().length;
        badge.innerText = count;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
}

// --- MAP INITIALIZATION ---
function initMap() {
    adminMap = L.map('map', { zoomControl: true }).setView([23.0835, 72.5458], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(adminMap);

    routeLayerGroup = L.layerGroup().addTo(adminMap);
    allBinsMarkerGroup = L.layerGroup().addTo(adminMap);
}

// --- MODE SWITCHER (ROUTE vs HEATMAP) ---
function setMapMode(mode) {
    currentMapMode = mode;
    document.getElementById('btn-mode-route').classList.toggle('active', mode === 'route');
    document.getElementById('btn-mode-heat').classList.toggle('active', mode === 'heat');

    const statusMsg = document.getElementById('route-status-msg');
    const dot = document.getElementById('route-indicator-dot');

    if (mode === 'heat') {
        dot.style.background = '#EF4444';
        statusMsg.innerText = "Predictive Fill-Rate Spatial Heatmap Active (Hotspots Overlay)";
        renderHeatmap();
    } else {
        dot.style.background = '#10B981';
        if (currentRouteData) {
            statusMsg.innerText = currentRouteData.message;
        }
        removeHeatmap();
        if (currentRouteData) {
            drawRoute(currentRouteData);
        }
    }
}

// --- HEATMAP OVERLAY USING LEAFLET.HEAT ---
async function renderHeatmap() {
    routeLayerGroup.clearLayers();
    allBinsMarkerGroup.clearLayers();

    if (heatLayer) {
        adminMap.removeLayer(heatLayer);
    }

    const bins = await GreenRouteData.getBins();
    const heatPoints = bins.map(b => [b.lat, b.lng, (b.fill_level / 100) * 1.5]);

    if (typeof L.heatLayer === 'function') {
        heatLayer = L.heatLayer(heatPoints, {
            radius: 45,
            blur: 25,
            maxZoom: 17,
            gradient: {
                0.2: '#34D399',
                0.5: '#FBBF24',
                0.75: '#F97316',
                1.0: '#EF4444'
            }
        }).addTo(adminMap);
    }

    // Add small subtle reference circles
    bins.forEach(b => {
        L.circleMarker([b.lat, b.lng], {
            radius: 8,
            fillColor: b.fill_level >= 80 ? '#EF4444' : '#FBBF24',
            color: '#FFFFFF',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).bindPopup(`<b>${b.name}</b><br>Fill Rate: ${b.fill_level}% (${b.zone})`).addTo(allBinsMarkerGroup);
    });
}

function removeHeatmap() {
    if (heatLayer) {
        adminMap.removeLayer(heatLayer);
        heatLayer = null;
    }
}

// --- FILTER SWITCHER ---
function setRouteFilter(filter, buttonElement) {
    currentRouteFilter = filter;
    document.querySelectorAll('.filter-pill-btn').forEach(btn => btn.classList.remove('active'));
    if (buttonElement) buttonElement.classList.add('active');

    calculateAndDisplayRoute();
}

// --- ROUTE ENGINE CALCULATION & DRAWING ---
async function calculateAndDisplayRoute() {
    currentRouteData = await GreenRouteData.calculateOptimalRoute(currentRouteFilter);

    // 1. Update Sustainability Ticker
    const m = currentRouteData.metrics;
    document.getElementById('stat-fuel').innerText = `${m.fuelSavedL} L`;
    document.getElementById('stat-co2').innerText = `${m.co2PreventedKg} kg`;
    document.getElementById('stat-time').innerText = `${m.laborHoursSaved} hr`;
    document.getElementById('stat-gain').innerText = `+${m.efficiencyGainPercent}%`;

    // 2. Update Status Message & Counts
    document.getElementById('route-status-msg').innerText = currentRouteData.message;
    document.getElementById('manifest-count').innerText = currentRouteData.stops.length;

    // 3. Draw on map if in route mode
    if (currentMapMode === 'route') {
        drawRoute(currentRouteData);
    } else {
        renderHeatmap();
    }

    // 4. Refresh Bin Table
    await renderBinTable();
}

function drawRoute(routeData) {
    routeLayerGroup.clearLayers();
    allBinsMarkerGroup.clearLayers();
    removeHeatmap();

    const depot = routeData.depot;
    const stops = routeData.stops;

    // 1. Draw Depot Marker
    const depotIcon = L.divIcon({
        className: 'custom-depot-pin',
        html: `<div style="background: #064E3B; color: #fff; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">🏢</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });

    L.marker([depot.lat, depot.lng], { icon: depotIcon })
        .bindPopup(`<b>${depot.name}</b><br>Starting Fleet Depot`)
        .addTo(routeLayerGroup);

    if (stops.length === 0) return;

    // 2. Draw Polyline sequence
    const latlngs = [[depot.lat, depot.lng]];

    stops.forEach(stop => {
        const bin = stop.bin;
        latlngs.push([bin.lat, bin.lng]);

        // Stop Number Badge
        const stopIcon = L.divIcon({
            className: 'custom-stop-pin',
            html: `<div style="background: ${bin.fill_level >= 80 ? '#DC2626' : '#EA580C'}; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; border: 2px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.25);">
                #${stop.step}
            </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        L.marker([bin.lat, bin.lng], { icon: stopIcon })
            .bindPopup(`
                <div style="font-family: 'Outfit', sans-serif;">
                    <div style="font-weight: 800; font-size: 0.95rem; color: #1F2937;">Stop #${stop.step}: ${bin.name}</div>
                    <div style="color: #6B7280; font-size: 0.8rem; margin: 4px 0;">Zone: <strong>${bin.zone.toUpperCase()}</strong></div>
                    <div style="background: #E5E7EB; height: 6px; border-radius: 4px; overflow: hidden; margin-bottom: 6px;">
                        <div style="background: ${bin.fill_level >= 80 ? '#EF4444' : '#F59E0B'}; width: ${bin.fill_level}%; height: 100%;"></div>
                    </div>
                    <div style="font-size: 0.8rem;">Fill Level: <strong>${bin.fill_level}%</strong> (${bin.capacity}L)</div>
                    <button onclick="toggleBinStatus(${bin.id})" style="margin-top: 8px; width: 100%; background: #10B981; color: white; border: none; padding: 5px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 0.8rem;">
                        Mark Emptied ✅
                    </button>
                </div>
            `)
            .addTo(routeLayerGroup);
    });

    // Return to depot leg
    latlngs.push([depot.lat, depot.lng]);

    // Draw high-visibility dashed route line
    const polyline = L.polyline(latlngs, {
        color: '#10B981',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.9
    }).addTo(routeLayerGroup);

    adminMap.fitBounds(polyline.getBounds(), { padding: [40, 40] });
}

// --- FLEET MANIFEST & CONTROLS TABLE ---
async function renderBinTable() {
    const tableBody = document.getElementById('bin-table-body');
    if (!tableBody) return;

    const bins = await GreenRouteData.getBins();
    const routeStops = currentRouteData ? currentRouteData.stops : [];
    tableBody.innerHTML = "";

    bins.forEach(bin => {
        const stopMatch = routeStops.find(s => s.bin.id === bin.id);
        const stopNumber = stopMatch ? `#${stopMatch.step}` : '—';
        const isCritical = bin.fill_level >= 80 || (bin.priority_zone && bin.fill_level >= 60);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 800; color: ${stopMatch ? '#047857' : '#9CA3AF'};">${stopNumber}</td>
            <td style="font-weight: 600;">${bin.name}</td>
            <td>
                <span class="status-badge" style="background: ${bin.priority_zone ? '#FEE2E2' : '#F3F4F6'}; color: ${bin.priority_zone ? '#B91C1C' : '#374151'};">
                    ${bin.zone.toUpperCase()}
                </span>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="background: #E5E7EB; width: 60px; height: 6px; border-radius: 4px; overflow: hidden;">
                        <div style="background: ${isCritical ? '#EF4444' : '#10B981'}; width: ${bin.fill_level}%; height: 100%;"></div>
                    </div>
                    <strong>${bin.fill_level}%</strong>
                </div>
            </td>
            <td>
                <span class="status-badge" style="background: ${isCritical ? '#DC2626' : '#10B981'}; color: #fff;">
                    ${isCritical ? 'NEEDS PICKUP ⚠️' : 'NORMAL 🌿'}
                </span>
            </td>
            <td>
                <input type="range" min="10" max="100" value="${bin.fill_level}" style="width: 80px; accent-color: #10B981; cursor: pointer;"
                       oninput="adjustFillLevel(${bin.id}, this.value)">
            </td>
            <td>
                <button class="btn btn-outline btn-sm" style="padding: 3px 10px; font-size: 0.78rem;" onclick="toggleBinStatus(${bin.id})">
                    ${bin.is_full ? 'Mark Empty' : 'Mark Full'}
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// --- BIN STATUS TOGGLE ---
async function toggleBinStatus(binId) {
    await GreenRouteData.toggleBinStatus(binId);
    await calculateAndDisplayRoute();
}

async function adjustFillLevel(binId, val) {
    await GreenRouteData.updateBinFillLevel(binId, val);
    await calculateAndDisplayRoute();
}

function toggleManifestDrawer() {
    const drawer = document.getElementById('manifest-drawer');
    drawer.classList.toggle('hidden');
    drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
}

// --- AI OPERATIONS ASSISTANT LOGIC ---
function askAiPrompt(prompt) {
    const input = document.getElementById('ai-user-input');
    input.value = prompt;
    submitAiMessage();
}

async function submitAiMessage() {
    const input = document.getElementById('ai-user-input');
    const query = input.value.trim();
    if (!query) return;

    input.value = "";
    appendAiMessage(query, 'user');

    // Simulate AI thinking and generate context-aware answer
    setTimeout(async () => {
        const reply = await generateAiResponse(query);
        appendAiMessage(reply, 'bot');
    }, 450);
}

function appendAiMessage(text, role) {
    const chatWindow = document.getElementById('ai-chat-window');
    const bubble = document.createElement('div');
    bubble.className = `ai-bubble ${role}`;
    bubble.innerHTML = text;
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function generateAiResponse(query) {
    // Try backend AI Assistant endpoint first
    try {
        const backendReply = await GreenRouteData.askAi(query);
        if (backendReply) return backendReply;
    } catch (e) {
        console.warn("Backend AI chat fallback triggered.");
    }

    const q = query.toLowerCase();
    const bins = await GreenRouteData.getBins();

    const criticalBins = bins.filter(b => b.fill_level >= 80);
    const clinicBin = bins.find(b => b.zone === 'hospital');
    const cafes = bins.filter(b => b.zone === 'cafeteria');

    if (q.includes('critical') || q.includes('overflow') || q.includes('immediate') || q.includes('pickup')) {
        if (criticalBins.length === 0) {
            return `No bins are currently above the 80% critical threshold. Campus facilities are operating smoothly!`;
        }
        const names = criticalBins.map(b => `• <strong>${b.name}</strong> (${b.fill_level}%)`).join('<br>');
        return `Found <strong>${criticalBins.length} critical bins</strong> requiring immediate pickup:<br>${names}<br>The dynamic TSP algorithm has already updated your collection sequence.`;
    }

    if (q.includes('fuel') || q.includes('saving') || q.includes('sustainability') || q.includes('co2')) {
        const m = currentRouteData ? currentRouteData.metrics : { fuelSavedL: 4.8, co2PreventedKg: 12.8, efficiencyGainPercent: 62 };
        return `Current route optimization achieves a <strong>${m.efficiencyGainPercent}% efficiency gain</strong>, preventing <strong>${m.co2PreventedKg} kg CO₂</strong> and saving approximately <strong>${m.fuelSavedL} liters</strong> of diesel compared to a static route.`;
    }

    if (q.includes('clinic') || q.includes('hospital') || q.includes('health')) {
        if (!clinicBin) return "No clinic bins registered.";
        const status = clinicBin.fill_level >= 60 ? "PRIORITY PICKUP REQUIRED 🚨" : "NORMAL 🌿";
        return `<strong>${clinicBin.name}</strong> is at <strong>${clinicBin.fill_level}%</strong> capacity. Policy status: <strong>${status}</strong> (Threshold: ≥60%).`;
    }

    if (q.includes('order') || q.includes('manifest') || q.includes('sequence') || q.includes('route')) {
        if (!currentRouteData || currentRouteData.stops.length === 0) {
            return "No active stops in the current manifest. All campus bins are within normal thresholds.";
        }
        const stopsList = currentRouteData.stops.map(s => `<strong>#${s.step}</strong>: ${s.bin.name} (${s.bin.fill_level}%)`).join('<br>➡️ ');
        return `Optimized Fleet Dispatch Sequence:<br>➡️ Starting at <strong>Central Depot</strong><br>➡️ ${stopsList}<br>➡️ Return to Depot.`;
    }

    return `Telemetry summary: Monitoring <strong>${bins.length} campus smart bins</strong> across Academic, Cafeteria, and Clinic zones. ${criticalBins.length} bins require priority servicing.`;
}

window.setMapMode = setMapMode;
window.setRouteFilter = setRouteFilter;
window.calculateAndDisplayRoute = calculateAndDisplayRoute;
window.toggleBinStatus = toggleBinStatus;
window.adjustFillLevel = adjustFillLevel;
window.toggleManifestDrawer = toggleManifestDrawer;
window.askAiPrompt = askAiPrompt;
window.submitAiMessage = submitAiMessage;