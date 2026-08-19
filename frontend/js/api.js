/**
 * Utility functions to fetch data from the local JSON mock files.
 */

// Base path for data files
const DATA_PATH = './data/';

/**
 * Fetches the list of waste bins.
 * @returns {Promise<Array>} Array of bin objects.
 */
export async function fetchBins() {
    try {
        const response = await fetch(`${DATA_PATH}mock_bins.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch bins:", error);
        return [];
    }
}

/**
 * Fetches the list of users for the leaderboard.
 * @returns {Promise<Array>} Array of user objects.
 */
export async function fetchUsers() {
    try {
        const response = await fetch(`${DATA_PATH}mock_users.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return [];
    }
}
