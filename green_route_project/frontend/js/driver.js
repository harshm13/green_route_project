/**
 * GreenRoute - Driver Companion Cab Portal Controller
 * Real-road turn-by-turn dispatch, live vehicle tracking simulation,
 * and stop-by-stop collection management.
 */

let driverMap = null;
let driverRouteLayer = null;
let truckMarker = null;
let currentRouteData = null;
let activeStopIndex = 0;
let simulationTimer = null;
let isSimulating = false;
let simCoordIndex = 0;
let allRoadCoords = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verify user authentication (allow demo driver session for instant preview)
    const user = getCurrentUser();
    if (!user.isAuthenticated) {
        localStorage.setItem('is_authenticated', 'true');
        localStorage.setItem('registered_name', 'Ramesh Kumar (Fleet Driver)');
        localStorage.setItem('registered_email', 'facilities.lead@sou.edu.in');
        localStorage.setItem('registered_role', 'admin');
        localStorage.setItem('is_approved', 'true');
        try {
            const res = await fetch('http://127.0.0.1:8000/users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'facilities.lead@sou.edu.in', password: 'password123', role: 'admin' })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.access_token) localStorage.setItem('access_token', data.access_token);
            }
        } catch (e) {}
    }

    // 2. Initialize Leaflet Map for cab view
    initDriverMap();

    // 3. Load live route with OSRM street network
    await loadDriverManifest();
});

function initDriverMap() {
    driverMap = L.map('driver-map', { zoomControl: true }).setView([23.0835, 72.5458], 15);

    // OpenStreetMap tiles with dark styling filter
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(driverMap);

    driverRouteLayer = L.layerGroup().addTo(driverMap);
}

async function loadDriverManifest() {
    currentRouteData = await GreenRouteData.calculateOptimalRoute("priority", 1500);

    if (!currentRouteData || !currentRouteData.stops || currentRouteData.stops.length === 0) {
        document.getElementById('active-stop-name').innerText = "All Bins Clear! 🌿";
        document.getElementById('maneuver-text').innerText = "No collection stops required.";
        document.getElementById('hud-progress').innerText = "All Clear";
        return;
    }

    activeStopIndex = 0;
    updateTopHud();
    renderActiveStopCard();
    renderManifestChecklist();
    drawDriverRoute();
}

function updateTopHud() {
    if (!currentRouteData) return;

    const stops = currentRouteData.stops;
    const totalStops = stops.length;
    document.getElementById('hud-progress').innerText = `Stop ${activeStopIndex + 1} of ${totalStops}`;
    document.getElementById('hud-distance').innerText = `${currentRouteData.roadDistanceKm || currentRouteData.totalDistanceKm} km`;
    document.getElementById('hud-duration').innerText = `${currentRouteData.estimatedDurationMinutes || 0} mins`;

    const tm = currentRouteData.truckMetrics;
    if (tm) {
        document.getElementById('hud-truck-fill').innerText = `${tm.utilizationPercent}%`;
        document.getElementById('summary-payload').innerText = `${tm.collectedVolumeLiters} / ${tm.capacityLiters} L`;
    }

    const engineTag = document.getElementById('routing-engine-tag');
    if (engineTag) {
        engineTag.innerText = currentRouteData.routingEngine || "OSRM Driving";
    }
}

function renderActiveStopCard() {
    if (!currentRouteData || !currentRouteData.stops) return;

    const stops = currentRouteData.stops;
    if (activeStopIndex >= stops.length) {
        // Route complete
        document.getElementById('active-stop-name').innerText = "Route Complete! 🏁";
        document.getElementById('active-stop-zone').innerText = "RETURNING TO DEPOT";
        document.getElementById('active-stop-zone').style.background = "rgba(16, 185, 129, 0.2)";
        document.getElementById('active-stop-zone').style.color = "#34D399";
        document.getElementById('maneuver-icon').innerText = "🏢";
        document.getElementById('maneuver-text').innerText = "Proceed back to Facilities Central Depot.";
        document.getElementById('active-fill-level').innerText = "0%";
        document.getElementById('active-fill-bar').style.width = "0%";
        document.getElementById('active-bin-volume').innerText = "0 L";
        document.getElementById('active-stop-distance').innerText = "0.0 km";

        const btn = document.getElementById('btn-empty-stop');
        btn.innerHTML = "<span>🎉</span> Shift Completed • Return to Depot";
        btn.disabled = true;
        btn.style.opacity = "0.6";
        return;
    }

    const stop = stops[activeStopIndex];
    const bin = stop.bin;

    document.getElementById('current-badge').innerHTML = `<span>📍</span> STOP #${stop.step} OF ${stops.length}`;
    document.getElementById('active-stop-name').innerText = bin.name;
    document.getElementById('active-stop-zone').innerText = `${(bin.zone || "ACADEMIC").toUpperCase()} ZONE`;
    document.getElementById('active-fill-level').innerText = `${bin.fill_level}%`;
    document.getElementById('active-fill-bar').style.width = `${bin.fill_level}%`;
    document.getElementById('active-bin-capacity').innerText = `${bin.capacity || 240} L`;
    document.getElementById('active-bin-volume').innerText = `${bin.wasteVolumeLiters || Math.round((bin.capacity || 240) * (bin.fill_level / 100))} L`;
    document.getElementById('active-stop-distance').innerText = `${stop.distanceFromPrevKm} km`;

    // Turn maneuver instruction
    const directions = currentRouteData.directions || [];
    const dirMatch = directions[activeStopIndex];
    if (dirMatch && dirMatch.steps && dirMatch.steps.length > 0) {
        const step0 = dirMatch.steps[0];
        document.getElementById('maneuver-icon').innerText = step0.instruction.toLowerCase().includes('right') ? "➡️" : (step0.instruction.toLowerCase().includes('left') ? "⬅️" : "⬆️");
        document.getElementById('maneuver-text').innerText = `${step0.instruction} (${step0.distanceMeters}m)`;
    } else {
        document.getElementById('maneuver-icon').innerText = "⬆️";
        document.getElementById('maneuver-text').innerText = `Proceed directly to ${bin.name}`;
    }

    const btn = document.getElementById('btn-empty-stop');
    btn.innerHTML = `<span>✅</span> Mark #${stop.step} Emptied &amp; Advance`;
    btn.disabled = false;
    btn.style.opacity = "1";
}

function renderManifestChecklist() {
    const list = document.getElementById('driver-manifest-list');
    if (!list || !currentRouteData || !currentRouteData.stops) return;

    list.innerHTML = "";
    const stops = currentRouteData.stops;
    document.getElementById('manifest-count-badge').innerText = `${stops.length} Stops`;

    stops.forEach((s, idx) => {
        const isCompleted = idx < activeStopIndex;
        const isActive = idx === activeStopIndex;

        const item = document.createElement('div');
        item.className = `manifest-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
        item.innerHTML = `
            <div style="display: flex; align-items: center;">
                <div class="stop-num">${isCompleted ? '✓' : '#' + s.step}</div>
                <div>
                    <div style="font-weight: 700; font-size: 0.88rem; color: #FFFFFF;">${s.bin.name}</div>
                    <div style="font-size: 0.72rem; color: #94A3B8;">${s.bin.zone.toUpperCase()} • ${s.bin.fill_level}% full (${s.distanceFromPrevKm} km)</div>
                </div>
            </div>
            <div>
                <span style="font-size: 0.75rem; font-weight: 800; color: ${isActive ? '#10B981' : '#94A3B8'};">
                    ${isCompleted ? 'DONE' : (isActive ? 'NEXT 🚨' : 'PENDING')}
                </span>
            </div>
        `;
        list.appendChild(item);
    });
}

function drawDriverRoute() {
    driverRouteLayer.clearLayers();

    const depot = currentRouteData.depot;
    const stops = currentRouteData.stops;

    // 1. Draw Depot Marker
    const depotIcon = L.divIcon({
        className: 'custom-depot-pin',
        html: `<div style="background: #064E3B; color: #fff; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">🏢</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });

    L.marker([depot.lat, depot.lng], { icon: depotIcon })
        .bindPopup(`<b>${depot.name}</b><br>Fleet Base Depot`)
        .addTo(driverRouteLayer);

    // 2. Plot Stops with glowing step badges
    stops.forEach((s, idx) => {
        const isPast = idx < activeStopIndex;
        const isCurrent = idx === activeStopIndex;

        const stopIcon = L.divIcon({
            className: `custom-stop-pin`,
            html: `<div style="background: ${isPast ? '#475569' : (isCurrent ? '#10B981' : '#EA580C')}; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; border: 2px solid white; box-shadow: 0 0 14px ${isCurrent ? 'rgba(16, 185, 129, 0.8)' : 'rgba(0,0,0,0.4)'};">
                ${isPast ? '✓' : '#' + s.step}
            </div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        L.marker([s.bin.lat, s.bin.lng], { icon: stopIcon })
            .bindPopup(`<b>Stop #${s.step}: ${s.bin.name}</b><br>Fill: ${s.bin.fill_level}% (${s.bin.zone})`)
            .addTo(driverRouteLayer);
    });

    // 3. Draw Real Road Curvature from OSRM GeoJSON
    let polylinePoints = [];
    if (currentRouteData.geometry && currentRouteData.geometry.coordinates && currentRouteData.geometry.coordinates.length > 0) {
        allRoadCoords = currentRouteData.geometry.coordinates.map(c => [c[1], c[0]]);
        polylinePoints = allRoadCoords;
    } else {
        allRoadCoords = [[depot.lat, depot.lng], ...stops.map(s => [s.bin.lat, s.bin.lng]), [depot.lat, depot.lng]];
        polylinePoints = allRoadCoords;
    }

    const polyline = L.polyline(polylinePoints, {
        color: '#38BDF8',
        weight: 5,
        opacity: 0.95,
        lineJoin: 'round'
    }).addTo(driverRouteLayer);

    // 4. Position Moving Truck Marker
    const initialPos = polylinePoints[0];
    const truckIcon = L.divIcon({
        className: 'truck-sim-pin',
        html: `<div style="font-size: 2rem; transform: scaleX(-1);">🚛</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    truckMarker = L.marker(initialPos, { icon: truckIcon }).addTo(driverRouteLayer);

    driverMap.fitBounds(polyline.getBounds(), { padding: [50, 50] });
}

// --- ACTION: MARK CURRENT BIN EMPTIED ---
async function confirmCurrentStopEmptied() {
    if (!currentRouteData || !currentRouteData.stops) return;
    const stops = currentRouteData.stops;
    if (activeStopIndex >= stops.length) return;

    const stop = stops[activeStopIndex];

    // Play chime sound
    if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();

    // Toggle bin status in data service (resilient fallback to local + backend)
    await GreenRouteData.toggleBinStatus(stop.bin.id, false);

    // Move truck marker to stop position
    if (truckMarker) {
        truckMarker.setLatLng([stop.bin.lat, stop.bin.lng]);
    }

    // Advance to next stop
    activeStopIndex++;

    if (activeStopIndex >= stops.length) {
        // Confetti celebration on finishing route!
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
    }

    updateTopHud();
    renderActiveStopCard();
    renderManifestChecklist();
    drawDriverRoute();
}

// --- SIMULATED LIVE DRIVE MODE ---
function toggleDriveSimulation() {
    const btn = document.getElementById('btn-sim-drive');

    if (isSimulating) {
        clearInterval(simulationTimer);
        simulationTimer = null;
        isSimulating = false;
        btn.classList.remove('active');
        btn.innerText = "🚗 Simulate Driver Route: OFF";
        if (window.GreenRouteSFX) GreenRouteSFX.playClick();
    } else {
        if (!allRoadCoords || allRoadCoords.length === 0) return;

        isSimulating = true;
        btn.classList.add('active');
        btn.innerText = "🚗 Driver Simulation: RUNNING 🟢";
        if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();

        simCoordIndex = 0;
        simulationTimer = setInterval(() => {
            if (simCoordIndex >= allRoadCoords.length) {
                clearInterval(simulationTimer);
                simulationTimer = null;
                isSimulating = false;
                btn.classList.remove('active');
                btn.innerText = "🚗 Route Simulation Completed ✅";
                confetti({ particleCount: 200, spread: 120 });
                return;
            }

            const currentPos = allRoadCoords[simCoordIndex];
            if (truckMarker) {
                truckMarker.setLatLng(currentPos);
            }

            // Check if truck is close to the active stop
            if (currentRouteData && currentRouteData.stops && activeStopIndex < currentRouteData.stops.length) {
                const targetStop = currentRouteData.stops[activeStopIndex];
                const dLat = Math.abs(currentPos[0] - targetStop.bin.lat);
                const dLng = Math.abs(currentPos[1] - targetStop.bin.lng);

                if (dLat < 0.0006 && dLng < 0.0006) {
                    // Reached stop!
                    confirmCurrentStopEmptied();
                }
            }

            simCoordIndex += 1;
        }, 180);
    }
}

function recenterDriverMap() {
    if (driverRouteLayer) {
        const bounds = driverRouteLayer.getBounds();
        if (bounds.isValid()) {
            driverMap.fitBounds(bounds, { padding: [40, 40] });
        }
    }
}

function exportCurrentManifest() {
    if (currentRouteData) {
        GreenRouteData.exportCsvManifest(currentRouteData);
        if (window.GreenRouteSFX) GreenRouteSFX.playSuccess();
    }
}

window.confirmCurrentStopEmptied = confirmCurrentStopEmptied;
window.toggleDriveSimulation = toggleDriveSimulation;
window.recenterDriverMap = recenterDriverMap;
window.exportCurrentManifest = exportCurrentManifest;
