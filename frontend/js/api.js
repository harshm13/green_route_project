/**
 * Utility functions to fetch data from FastAPI backend or local JSON mock files.
 */

const API_BASE = "http://127.0.0.1:8000";
const DATA_PATH = './data/';

/**
 * Fetches the list of waste bins.
 * @returns {Promise<Array>} Array of bin objects.
 */
export async function fetchBins() {
    try {
        const response = await fetch(`${API_BASE}/bins/`);
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.warn("Backend /bins/ unavailable, falling back to mock file.");
    }

    try {
        const fallback = await fetch(`${DATA_PATH}mock_bins.json`);
        if (fallback.ok) return await fallback.json();
    } catch (error) {
        console.error("Failed to fetch bins:", error);
    }
    return [];
}

/**
 * Fetches the list of users for the leaderboard.
 * @returns {Promise<Array>} Array of user objects.
 */
export async function fetchUsers() {
    try {
        const response = await fetch(`${API_BASE}/users/leaderboard`);
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.warn("Backend /users/leaderboard unavailable, falling back to mock file.");
    }

    try {
        const fallback = await fetch(`${DATA_PATH}mock_users.json`);
        if (fallback.ok) return await fallback.json();
    } catch (error) {
        console.error("Failed to fetch users:", error);
    }
    return [];
}

