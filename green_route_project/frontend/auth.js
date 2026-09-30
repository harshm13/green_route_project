/**
 * GreenRoute - Authentication & Session Security Helper
 * Manages JWT tokens, role validation, and route access guards.
 */

function getAuthToken() {
    return localStorage.getItem('access_token') || '';
}

function getAuthHeaders() {
    const token = getAuthToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function getCurrentUser() {
    const isAuth = localStorage.getItem('is_authenticated') === 'true';
    const role = localStorage.getItem('registered_role') || 'citizen';
    const name = localStorage.getItem('registered_name') || (role === 'admin' ? 'Admin Officer' : 'Kushal Bhatt');
    const email = localStorage.getItem('registered_email') || (role === 'admin' ? 'facilities.lead@sou.edu.in' : 'kushal@sou.edu.in');
    const isApproved = localStorage.getItem('is_approved') !== 'false';
    const token = getAuthToken();

    return {
        isAuthenticated: isAuth,
        role: role,
        name: name,
        email: email,
        isApproved: isApproved,
        token: token
    };
}

function requireAuth(allowedRoles = ['citizen', 'admin']) {
    const user = getCurrentUser();
    
    if (!user.isAuthenticated) {
        window.location.href = `login.html?action=login&role=${allowedRoles[0]}`;
        return false;
    }

    if (!allowedRoles.includes(user.role)) {
        window.location.href = user.role === 'admin' ? 'admin.html' : 'citizen.html';
        return false;
    }

    if (user.role === 'admin' && !user.isApproved) {
        alert('Your administrator account is pending Head Authority approval.');
        window.location.href = 'login.html?action=login&role=admin';
        return false;
    }

    return true;
}

function logoutUser(event) {
    if (event) event.preventDefault();
    
    // Clear credentials and active JWT token
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_type');
    localStorage.removeItem('active_session_token');
    
    window.location.href = 'index.html';
}

async function seedDemoAccount(role = 'citizen') {
    const creds = {
        citizen: { name: 'Kushal Bhatt', email: 'kushal@sou.edu.in', dest: 'citizen.html' },
        admin: { name: 'Vikram Mehta', admin_id: 'ADM-2026-X1', email: 'facilities.lead@sou.edu.in', dest: 'admin.html' },
        head_admin: { name: 'Director Sharma', admin_id: 'HEAD-AUTH-01', email: 'head.authority@sou.edu.in', dest: 'approvals.html' }
    }[role] || { name: 'Kushal Bhatt', email: 'kushal@sou.edu.in', dest: 'citizen.html' };

    localStorage.setItem('is_authenticated', 'true');
    localStorage.setItem('registered_name', creds.name);
    localStorage.setItem('registered_email', creds.email);
    localStorage.setItem('registered_role', role);
    localStorage.setItem('is_approved', 'true');
    if (creds.admin_id) localStorage.setItem('admin_id', creds.admin_id);

    try {
        const res = await fetch('http://127.0.0.1:8000/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: creds.email, password: 'password123', role: role })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.access_token) {
                localStorage.setItem('access_token', data.access_token);
            }
        }
    } catch (e) {
        // Backend offline fallback
    }

    window.location.href = creds.dest;
}

window.getAuthToken = getAuthToken;
window.getAuthHeaders = getAuthHeaders;
window.getCurrentUser = getCurrentUser;
window.requireAuth = requireAuth;
window.logoutUser = logoutUser;
window.seedDemoAccount = seedDemoAccount;
