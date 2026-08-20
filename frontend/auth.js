// Global Auth Functions
function logoutUser(event) {
    if (event) event.preventDefault();
    localStorage.clear();
    window.location.href = 'index.html';
}
