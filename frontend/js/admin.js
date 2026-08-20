import { fetchBins } from "./api.js";

let map;
let markers = [];
let routePolyline = null;
let heatmapLayer = null;
let allBins = [];
let isHeatmapVisible = false;

// Mock Admin Leaderboard Data
const mockAdmins = [
  { name: "Kushal (You)", efficiency: 98, routes: 45 },
  { name: "Aarav P.", efficiency: 92, routes: 38 },
  { name: "Priya S.", efficiency: 85, routes: 30 }
];

/**
 * Initializes the Leaflet map centered on Ahmedabad.
 */
function initMap() {
  map = L.map("map").setView([23.035, 72.55], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);
}

/**
 * Creates custom markers based on fill level and priority
 */
function getMarkerIcon(bin) {
  // Dynamic Priority Routing thresholds:
  // High Priority: include if fill_level >= 60
  // Normal Priority: include if fill_level >= 80
  const needsCollection =
    (bin.priority_level === "High" && bin.fill_level >= 60) ||
    (bin.priority_level === "Normal" && bin.fill_level >= 80);

  const color = needsCollection ? "#E53935" : "#4CAF50";
  const strokeColor = bin.priority_level === "High" ? "#FFC107" : "#FFFFFF";

  // Create an SVG icon (red if needs collection, green otherwise. Gold border if High priority)
  const svgIcon = encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="${strokeColor}" stroke-width="1.5" width="32px" height="32px">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
    `);

  return L.icon({
    iconUrl: `data:image/svg+xml;charset=utf-8,${svgIcon}`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

/**
 * Loads bins from the API and plots them on the map.
 */
async function loadAndPlotBins() {
  allBins = await fetchBins();

  filterBins('all'); // Plot initially

  // Initialize Heatmap layer (hidden by default)
  // Map bin data to [lat, lng, intensity] array for leaflet.heat
  const heatData = allBins.map((bin) => [
    bin.lat,
    bin.lng,
    bin.historical_fill_rate,
  ]);
  heatmapLayer = L.heatLayer(heatData, {
    radius: 25,
    blur: 15,
    maxZoom: 14,
    gradient: { 0.4: "blue", 0.6: "lime", 0.8: "yellow", 1.0: "red" },
  });
}

/**
 * Filters and re-draws markers based on filter type
 */
function filterBins(type) {
  // Clear existing markers
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];

  let filteredBins = [];
  if (type === 'all') {
    filteredBins = allBins;
  } else if (type === 'critical') {
    filteredBins = allBins.filter(bin => bin.fill_level >= 80);
  } else if (type === 'eco') {
    filteredBins = allBins.filter(bin => bin.waste_type === 'Recyclable');
  }

  // Plot markers
  filteredBins.forEach((bin) => {
    const icon = getMarkerIcon(bin);
    const marker = L.marker([bin.lat, bin.lng], { icon: icon }).addTo(map);

    // Add popup with new fields
    marker.bindPopup(`
            <strong>${bin.location_name}</strong><br>
            Fill Level: <b>${bin.fill_level}%</b><br>
            Priority: <b>${bin.priority_level}</b><br>
            Waste Type: ${bin.waste_type}<br>
            Bin ID: #${bin.id}
        `);

    markers.push(marker);
  });
}

/**
 * Toggles the predictive heatmap overlay.
 */
function toggleHeatmap() {
  const btn = document.getElementById("toggle-heatmap-btn");
  if (isHeatmapVisible) {
    map.removeLayer(heatmapLayer);
    btn.textContent = "Show Predictive Heatmap";
    btn.classList.remove("active");
  } else {
    heatmapLayer.addTo(map);
    btn.textContent = "Hide Predictive Heatmap";
    btn.classList.add("active");
  }
  isHeatmapVisible = !isHeatmapVisible;
}

/**
 * Dynamic Priority Routing: Draws a route connecting prioritized bins.
 */
function drawPriorityRoute() {
  if (routePolyline) {
    map.removeLayer(routePolyline);
  }

  // Filter bins based on the new logic
  const priorityBins = allBins.filter((bin) => {
    if (bin.priority_level === "High" && bin.fill_level >= 60) return true;
    if (bin.priority_level === "Normal" && bin.fill_level >= 80) return true;
    return false;
  });

  if (priorityBins.length < 2) {
    alert("Not enough critical bins to form an optimized route.");
    return;
  }

  const latlngs = priorityBins.map((bin) => [bin.lat, bin.lng]);

  // Draw bold polyline
  routePolyline = L.polyline(latlngs, {
    color: "#2E7D32",
    weight: 6,
    opacity: 0.8,
    dashArray: "10, 10",
    lineJoin: "round",
  }).addTo(map);

  map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });

  // Update Sustainability Ticker with mocked calculations
  updateSustainabilityTicker(priorityBins.length, allBins.length);

  // Show dispatch fleet button
  document.getElementById('dispatch-fleet-btn').style.display = 'block';
}

/**
 * Calculates and updates the Sustainability & Cost Impact metrics.
 * Compares an "Optimized Route" vs "Fixed 100% Route".
 */
function updateSustainabilityTicker(optimizedCount, totalCount) {
  // Simple mock calculation based on bins skipped
  const skippedBins = totalCount - optimizedCount;

  // Assume 1.5L fuel, 3.5kg CO2, and 0.4 hours saved per bin skipped
  const fuelSaved = (skippedBins * 1.5).toFixed(1);
  const co2Saved = (skippedBins * 3.5).toFixed(1);
  const laborSaved = (skippedBins * 0.4).toFixed(1);

  document.getElementById("stat-fuel").textContent = `${fuelSaved}L`;
  document.getElementById("stat-co2").textContent = `${co2Saved}kg`;
  document.getElementById("stat-labor").textContent = `${laborSaved}h`;
}

/**
 * Resets the map state.
 */
function resetMap() {
  if (routePolyline) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }
  document.getElementById("stat-fuel").textContent = "0L";
  document.getElementById("stat-co2").textContent = "0kg";
  document.getElementById("stat-labor").textContent = "0h";
  document.getElementById('dispatch-fleet-btn').style.display = 'none';
  map.setView([23.035, 72.55], 12);
}

/**
 * Handles the AI Operations Assistant Chat.
 */
function handleChatInput(e) {
  if (e.key === "Enter" || e.type === "click") {
    const inputField = document.getElementById("chat-input");
    const message = inputField.value.trim();

    if (message) {
      appendChatMessage(message, "user");
      inputField.value = "";

      // Mocked AI Response after 1 second delay
      setTimeout(() => {
        appendChatMessage(
          "Based on the latest data, the SG Highway zone requires immediate truck dispatch due to high-priority organic waste alerts.",
          "bot",
        );
      }, 1000);
    }
  }
}

/**
 * Appends a message to the chat window.
 * @param {string} text - The message text
 * @param {string} sender - 'user' or 'bot'
 */
function appendChatMessage(text, sender) {
  const chatWindow = document.getElementById("chat-window");
  const msgDiv = document.createElement("div");
  msgDiv.className = `chat-message ${sender}`;
  msgDiv.textContent = text;

  chatWindow.appendChild(msgDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight; // Auto-scroll to bottom
}

/**
 * Renders the Admin Leaderboard
 */
function renderAdminLeaderboard() {
  const container = document.getElementById("admin-leaderboard");
  if (!container) return;

  // Sort by efficiency (highest first)
  const sortedAdmins = [...mockAdmins].sort((a, b) => b.efficiency - a.efficiency);

  container.innerHTML = "";
  sortedAdmins.forEach((admin, index) => {
    const li = document.createElement("li");
    li.className = "admin-lb-item";
    
    li.innerHTML = `
      <div class="admin-lb-item-left">
        <span class="admin-rank-badge">${index + 1}</span>
        <span class="admin-name">${admin.name}</span>
      </div>
      <span class="admin-stat">${admin.efficiency}% Eff</span>
    `;
    
    container.appendChild(li);
  });
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadAndPlotBins();
  renderAdminLeaderboard();

  // Event listeners
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      // Toggle active class
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      
      // Filter bins
      const filterType = e.target.getAttribute('data-filter');
      filterBins(filterType);
    });
  });

  document
    .getElementById("dispatch-fleet-btn")
    .addEventListener("click", () => {
      Swal.fire({
        icon: 'success',
        title: 'Fleet Dispatched!',
        text: 'The optimized route has been sent to the drivers\' mobile devices.',
        confirmButtonColor: '#10b981'
      }).then(() => {
        resetMap();
      });
    });

  document
    .getElementById("toggle-heatmap-btn")
    .addEventListener("click", toggleHeatmap);
  document
    .getElementById("draw-route-btn")
    .addEventListener("click", drawPriorityRoute);
  document
    .getElementById("reset-route-btn")
    .addEventListener("click", resetMap);

  // Chat widget listeners
  document
    .getElementById("chat-input")
    .addEventListener("keypress", handleChatInput);
  document
    .getElementById("chat-send-btn")
    .addEventListener("click", handleChatInput);
});
