/**
 * GreenRoute - Admin Fleet Logistics Command Center Controller
 */

let adminMap = null;
let routeLayerGroup = null;
let heatLayer = null;
let allBinsMarkerGroup = null;

let currentMapMode = "route"; // 'route' | 'heat'
let currentRouteFilter = "priority"; // 'priority' | 'critical' | 'priority_zones' | 'all_full'
let currentTruckCapacity = 1500;
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

    // Initialize Campus Tenant Selector
    const activeTenant = GreenRouteData.getActiveTenant();
    const tenantSelect = document.getElementById('tenant-select');
    if (tenantSelect) {
        tenantSelect.value = activeTenant;
    }
    const campusCoords = CAMPUS_COORDINATES[activeTenant] || CAMPUS_COORDINATES["sou"];
    if (adminMap) {
        adminMap.setView(campusCoords, 15);
    }

    await calculateAndDisplayRoute();
    await renderBinTable();
    await renderPredictiveForecast();

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

    // 4. WebSocket Telemetry event listeners
    window.addEventListener('greenroute:telemetry-status', (e) => {
        const pill = document.getElementById('telemetry-status-pill');
        const text = document.getElementById('telemetry-status-text');
        if (text && pill) {
            if (e.detail.connected) {
                text.innerText = "IoT Stream 🟢";
                pill.style.background = "rgba(16, 185, 129, 0.18)";
                pill.style.color = "#059669";
            } else {
                text.innerText = "IoT Hub 📡";
                pill.style.background = "rgba(59, 130, 246, 0.12)";
                pill.style.color = "#2563EB";
            }
        }
    });

    window.addEventListener('greenroute:telemetry-event', async (e) => {
        const packet = e.detail;
        if (!packet) return;
        if (packet.type === 'SENSOR_UPDATE' || packet.type === 'CRITICAL_OVERFLOW') {
            await renderBinTable();
            if (packet.payload && packet.payload.fill_level >= 80 && window.GreenRouteSFX) {
                GreenRouteSFX.playAlert();
            }
        }
    });
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

const CAMPUS_COORDINATES = {
    "sou": [23.0835, 72.5458],
    "tech_hub": [23.0415, 72.5075],
    "metro_med": [23.0532, 72.5938]
};

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

function changeFleetVehicle(capacity) {
    currentTruckCapacity = Number(capacity);
    calculateAndDisplayRoute();
}

function exportManifestCsv() {
    if (currentRouteData) {
        GreenRouteData.exportCsvManifest(currentRouteData);
        if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();
    }
}

// --- ROUTE ENGINE CALCULATION & DRAWING (OSRM & CVRP) ---
async function calculateAndDisplayRoute() {
    currentRouteData = await GreenRouteData.calculateOptimalRoute(currentRouteFilter, currentTruckCapacity);

    // 1. Update Sustainability Ticker & Duration
    const m = currentRouteData.metrics;
    document.getElementById('stat-fuel').innerText = `${m.fuelSavedL} L`;
    document.getElementById('stat-co2').innerText = `${m.co2PreventedKg} kg`;
    document.getElementById('stat-time').innerText = `${m.laborHoursSaved} hr`;
    document.getElementById('stat-gain').innerText = `+${m.efficiencyGainPercent}%`;

    const durationEl = document.getElementById('stat-duration');
    if (durationEl) {
        durationEl.innerText = `${currentRouteData.estimatedDurationMinutes || 0} mins`;
    }

    // Update Truck Payload Gauge
    if (currentRouteData.truckMetrics) {
        const tm = currentRouteData.truckMetrics;
        const payloadText = document.getElementById('truck-payload-text');
        const payloadBar = document.getElementById('truck-payload-bar');
        if (payloadText) {
            payloadText.innerText = `${tm.collectedVolumeLiters} / ${tm.capacityLiters} L (${tm.utilizationPercent}%)`;
        }
        if (payloadBar) {
            payloadBar.style.width = `${tm.utilizationPercent}%`;
            payloadBar.style.background = tm.isOverCapacity ? '#DC2626' : (tm.utilizationPercent >= 80 ? '#F59E0B' : '#10B981');
        }
    }

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

    // 2. Plot Bin Stops
    stops.forEach(stop => {
        const bin = stop.bin;

        // Stop Number Badge with Radar Ping on Critical Stops
        const isCriticalStop = bin.fill_level >= 80;
        const stopIcon = L.divIcon({
            className: `custom-stop-pin ${isCriticalStop ? 'radar-ping' : ''}`,
            html: `<div style="background: ${isCriticalStop ? '#DC2626' : '#EA580C'}; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; border: 2.5px solid white; box-shadow: 0 0 16px ${isCriticalStop ? 'rgba(239, 68, 68, 0.7)' : 'rgba(234, 88, 12, 0.4)'};">
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

    // 3. Draw Real Road Curvature using OSRM Street Coordinates
    let polylinePoints = [];
    if (routeData.geometry && routeData.geometry.coordinates && routeData.geometry.coordinates.length > 0) {
        // GeoJSON coordinates are [lng, lat] -> convert to Leaflet [lat, lng]
        polylinePoints = routeData.geometry.coordinates.map(c => [c[1], c[0]]);
    } else {
        polylinePoints = [[depot.lat, depot.lng], ...stops.map(s => [s.bin.lat, s.bin.lng]), [depot.lat, depot.lng]];
    }

    const polyline = L.polyline(polylinePoints, {
        color: '#10B981',
        weight: 5,
        opacity: 0.95,
        lineJoin: 'round'
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

// --- PREDICTIVE OVERFLOW FORECASTING ---
async function renderPredictiveForecast() {
    const listEl = document.getElementById('forecast-list');
    const badgeEl = document.getElementById('forecast-badge');
    const summaryEl = document.getElementById('forecast-summary-text');
    if (!listEl) return;

    try {
        const forecastData = await GreenRouteData.getOverflowForecast(4);
        if (!forecastData || !forecastData.forecasts) return;

        listEl.innerHTML = "";
        const imminent = forecastData.imminent_overflow_count;
        const highRisk = forecastData.high_risk_count;

        if (badgeEl) {
            badgeEl.innerText = imminent > 0 ? `${imminent} Imminent ⚠️` : (highRisk > 0 ? `${highRisk} High Risk` : `All Stable 🌿`);
            badgeEl.style.background = imminent > 0 ? "#FEE2E2" : (highRisk > 0 ? "#FEF3C7" : "#D1FAE5");
            badgeEl.style.color = imminent > 0 ? "#DC2626" : (highRisk > 0 ? "#B45309" : "#065F46");
        }

        if (summaryEl) {
            summaryEl.innerHTML = imminent > 0 
                ? `🚨 <strong>${imminent} bins</strong> will overflow within ~60 mins. Preemptive pickup recommended.`
                : `Active zones stable. Monitoring timetable surge dynamics across campus.`;
        }

        forecastData.forecasts.slice(0, 5).forEach(f => {
            const row = document.createElement('div');
            row.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.03); padding: 5px 8px; border-radius: 8px; font-size: 0.76rem;";
            
            const isImminent = f.time_to_overflow_minutes <= 60;
            const ttoText = f.time_to_overflow_minutes === 0 ? "FULL NOW 🚨" : `~${f.time_to_overflow_minutes}m left`;

            row.innerHTML = `
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;">
                    <strong style="color: #1F2937;">${f.name}</strong>
                    <div style="font-size: 0.7rem; color: #6B7280;">${f.zone.toUpperCase()} • ${f.current_fill}% fill (+${f.rate_per_hour}%/h)</div>
                </div>
                <span style="font-weight: 700; color: ${isImminent ? '#DC2626' : (f.risk_level === 'HIGH_RISK' ? '#D97706' : '#059669')}; font-size: 0.72rem; padding: 2px 6px; background: rgba(255,255,255,0.7); border-radius: 6px;">
                    ${ttoText}
                </span>
            `;
            listEl.appendChild(row);
        });
    } catch (e) {
        console.warn("Error rendering predictive forecast:", e);
    }
}

async function triggerPreemptiveDispatch() {
    currentFilterMode = "priority";
    document.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.toggle('active', c.innerText.toLowerCase().includes('priority'));
    });

    const notif = document.getElementById('route-status-msg');
    if (notif) notif.innerText = "🔮 Preemptive Dispatch Active: Including imminent overflow bins.";

    appendAiMessage("⚡ Preemptive Dispatch generated! Routed fleet to collect all bins approaching overflow.", 'bot');
    if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();

    await calculateAndDisplayRoute();
    await renderPredictiveForecast();
}

// --- AI COPILOT WITH AUTOMATED MAP ACTIONS ---
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

    setTimeout(async () => {
        const replyObj = await generateAiResponse(query);
        appendAiMessage(replyObj.text, 'bot');

        if (replyObj.action) {
            executeCopilotAction(replyObj.action);
        }
    }, 350);
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
    // Try backend AI Assistant endpoint with action support
    try {
        const backendReply = await GreenRouteData.askAi(query);
        if (backendReply && backendReply.response) {
            return {
                text: backendReply.response,
                action: backendReply.action
            };
        }
    } catch (e) {
        console.warn("Backend AI copilot fallback triggered.");
    }

    const q = query.toLowerCase();
    const bins = await GreenRouteData.getBins();
    const criticalBins = bins.filter(b => b.fill_level >= 80);
    const clinicBin = bins.find(b => b.zone === 'hospital');

    if (q.includes('preemptive') || q.includes('proactive') || q.includes('overflowing soon')) {
        return {
            text: "🔮 <strong>AI Proactive Dispatch:</strong> Identified impending overflows. Generated preemptive collection manifest.",
            action: { type: "TRIGGER_PREEMPTIVE_DISPATCH" }
        };
    }

    if (q.includes('cafeteria')) {
        return {
            text: "🍽️ <strong>Cafeteria Hub:</strong> Panning map to cafeteria collection points. Lunch and dinner spikes monitored.",
            action: { type: "FOCUS_ZONE", target: "cafeteria" }
        };
    }

    if (q.includes('clinic') || q.includes('hospital')) {
        return {
            text: `🏥 <strong>Clinic Zone:</strong> ${clinicBin ? clinicBin.name + ' (' + clinicBin.fill_level + '%)' : 'No clinic'}. Strict safety threshold applied.`,
            action: { type: "FOCUS_ZONE", target: "hospital" }
        };
    }

    if (q.includes('critical') || q.includes('overflow') || q.includes('immediate')) {
        return {
            text: `Found <strong>${criticalBins.length} critical bins</strong> requiring immediate servicing. Panning to critical locations.`,
            action: { type: "HIGHLIGHT_CRITICAL" }
        };
    }

    if (q.includes('fuel') || q.includes('saving') || q.includes('carbon') || q.includes('co2')) {
        const m = currentRouteData ? currentRouteData.metrics : { fuelSavedL: 4.8, co2PreventedKg: 12.8, efficiencyGainPercent: 62 };
        return {
            text: `🌱 <strong>Sustainability Audit:</strong> ${m.efficiencyGainPercent}% efficiency gain, preventing <strong>${m.co2PreventedKg} kg CO₂</strong> and saving ~<strong>${m.fuelSavedL} L</strong> diesel.`,
            action: null
        };
    }

    return {
        text: `Live Telemetry: Monitoring <strong>${bins.length} campus bins</strong>. ${criticalBins.length} critical. Ask me to 'Focus on cafeteria' or 'Run preemptive route' to execute actions!`,
        action: null
    };
}

async function executeCopilotAction(action) {
    if (!action || !action.type) return;

    if (action.type === 'FOCUS_ZONE' && action.target) {
        const bins = await GreenRouteData.getBins();
        const zoneBins = bins.filter(b => b.zone === action.target);
        if (zoneBins.length > 0 && adminMap) {
            const bounds = L.latLngBounds(zoneBins.map(b => [b.lat, b.lng]));
            adminMap.flyToBounds(bounds, { padding: [60, 60], duration: 1.2 });
            if (window.GreenRouteSFX) GreenRouteSFX.playScan();
        }
    } else if (action.type === 'TRIGGER_PREEMPTIVE_DISPATCH') {
        await triggerPreemptiveDispatch();
    } else if (action.type === 'HIGHLIGHT_CRITICAL') {
        const bins = await GreenRouteData.getBins();
        const crit = bins.filter(b => b.fill_level >= 80);
        if (crit.length > 0 && adminMap) {
            const bounds = L.latLngBounds(crit.map(b => [b.lat, b.lng]));
            adminMap.flyToBounds(bounds, { padding: [50, 50], duration: 1.0 });
        }
    } else if (action.type === 'REFRESH_ROUTE' || action.type === 'WEATHER_EMERGENCY') {
        await calculateAndDisplayRoute();
    } else if (action.type === 'OPEN_ESG_REPORT') {
        openEsgModal();
    }
}

let simulationInterval = null;

async function toggleSimulationMode() {
    const btn = document.getElementById('sim-toggle-btn');
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
        if (btn) {
            btn.classList.remove('active');
            btn.innerHTML = '<span>📡</span> Live Telemetry Simulator: OFF';
        }
        if (window.GreenRouteSFX) GreenRouteSFX.playClick();
    } else {
        if (btn) {
            btn.classList.add('active');
            btn.innerHTML = '<span>📡</span> Live Telemetry Stream: ACTIVE 🟢';
        }
        if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();

        simulationInterval = setInterval(async () => {
            const bins = await GreenRouteData.getBins();
            if (!bins || bins.length === 0) return;

            const randomBin = bins[Math.floor(Math.random() * bins.length)];
            const delta = Math.floor(Math.random() * 35) - 10;
            const newLevel = Math.min(98, Math.max(15, randomBin.fill_level + delta));

            await GreenRouteData.updateBinFillLevel(randomBin.id, newLevel);
            await calculateAndDisplayRoute();

            if (newLevel >= 80 && window.GreenRouteSFX) {
                GreenRouteSFX.playAlert();
            } else if (window.GreenRouteSFX) {
                GreenRouteSFX.playScan();
            }
        }, 4000);
    }
}

// --- MULTI-TENANT SWITCHER & ESG MODAL CONTROLLERS ---
async function onTenantChange(tenantId) {
    GreenRouteData.setActiveTenant(tenantId);
    const coords = CAMPUS_COORDINATES[tenantId] || CAMPUS_COORDINATES["sou"];
    if (adminMap) {
        adminMap.flyTo(coords, 15, { duration: 1.2 });
    }
    await calculateAndDisplayRoute();
    await renderBinTable();
    await renderPredictiveForecast();
    if (window.GreenRouteSFX) GreenRouteSFX.playClick();
}

async function openEsgModal() {
    const modal = document.getElementById('esg-modal');
    if (!modal) return;
    const activeTenant = GreenRouteData.getActiveTenant();
    const report = await GreenRouteData.getEsgReport(activeTenant);
    
    if (report && report.carbon_accounting) {
        const tname = report.tenant ? report.tenant.name : activeTenant.toUpperCase();
        const tnameEl = document.getElementById('esg-tenant-name');
        if (tnameEl) tnameEl.innerText = tname;
        const auditEl = document.getElementById('esg-audit-id');
        if (auditEl) auditEl.innerText = report.audit_id || `ESG-${activeTenant.toUpperCase()}-2026-09`;

        const s1 = report.carbon_accounting.scope_1 || {};
        const s3 = report.carbon_accounting.scope_3 || {};
        const agg = report.carbon_accounting.aggregate_totals || {};
        const circ = report.circular_metrics || {};
        const roi = report.financial_roi || {};

        document.getElementById('esg-scope1-kg').innerText = `${s1.emissions_avoided_kg_co2e || 206.4} kg`;
        document.getElementById('esg-diesel-saved').innerText = `${s1.diesel_saved_liters || 77.0} L diesel saved`;

        document.getElementById('esg-scope3-kg').innerText = `${s3.emissions_avoided_kg_co2e || 8850.0} kg`;
        document.getElementById('esg-diverted-mass').innerText = `${s3.total_diverted_mass_kg || 5240.0} kg diverted`;

        document.getElementById('esg-purity-score').innerText = `${circ.circular_purity_score || 86.8}%`;
        document.getElementById('esg-diversion-rate').innerText = `${circ.landfill_diversion_rate_pct || 72.4}% landfill diversion`;

        document.getElementById('esg-net-roi').innerText = `+${roi.roi_percentage || 1285.7}%`;
        document.getElementById('esg-net-savings').innerText = `₹${(roi.net_savings_inr || 45000).toLocaleString()} net savings`;

        document.getElementById('esg-trees').innerText = agg.equivalent_trees_seedlings || 416;
        document.getElementById('esg-car-km').innerText = `${(agg.equivalent_passenger_vehicle_km || 47168).toLocaleString()} km`;
        document.getElementById('esg-fleet-reduction').innerText = `${s1.reduction_percent || 77.7}%`;

        document.getElementById('esg-tb-baseline').innerText = `${s1.baseline_distance_km || 325.6} km`;
        document.getElementById('esg-tb-optimized').innerText = `${s1.optimized_distance_km || 72.6} km`;
        document.getElementById('esg-tb-total-co2').innerText = `${agg.total_ghg_avoided_metric_tons || 9.06} MT CO2e`;

        const bk = roi.breakdown || {};
        document.getElementById('esg-roi-fuel').innerText = `+₹${(bk.diesel_fuel_savings_inr || 6968).toLocaleString()}`;
        document.getElementById('esg-roi-tipping').innerText = `+₹${(bk.tipping_fees_avoided_inr || 13100).toLocaleString()}`;
        document.getElementById('esg-roi-scrap').innerText = `+₹${(bk.recycling_scrap_revenue_inr || 25152).toLocaleString()}`;
        document.getElementById('esg-roi-saas').innerText = `-₹${(bk.platform_saas_fee_inr || 3500).toLocaleString()}`;
        document.getElementById('esg-roi-net').innerText = `+₹${(roi.net_savings_inr || 41720).toLocaleString()}`;
    }

    modal.style.display = 'flex';
    if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();
}

function closeEsgModal() {
    const modal = document.getElementById('esg-modal');
    if (modal) modal.style.display = 'none';
}

window.onTenantChange = onTenantChange;
window.openEsgModal = openEsgModal;
window.closeEsgModal = closeEsgModal;

window.toggleSimulationMode = toggleSimulationMode;
window.setMapMode = setMapMode;
window.setRouteFilter = setRouteFilter;
window.calculateAndDisplayRoute = calculateAndDisplayRoute;
window.toggleBinStatus = toggleBinStatus;
window.adjustFillLevel = adjustFillLevel;
window.toggleManifestDrawer = toggleManifestDrawer;
window.askAiPrompt = askAiPrompt;
window.submitAiMessage = submitAiMessage;
window.changeFleetVehicle = changeFleetVehicle;
window.exportManifestCsv = exportManifestCsv;
window.triggerPreemptiveDispatch = triggerPreemptiveDispatch;
window.renderPredictiveForecast = renderPredictiveForecast;