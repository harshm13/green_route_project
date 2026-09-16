/**
 * GreenRoute - Authentication & Session Helper
 */

function getCurrentUser() {
    const isAuth = localStorage.getItem('is_authenticated') === 'true';
    const role = localStorage.getItem('registered_role') || 'citizen';
    const name = localStorage.getItem('registered_name') || (role === 'admin' ? 'Admin Officer' : 'Kushal Bhatt');
    const email = localStorage.getItem('registered_email') || (role === 'admin' ? 'admin@city.gov' : 'kushal@sou.edu.in');
    const isApproved = localStorage.getItem('is_approved') !== 'false';

    return {
        isAuthenticated: isAuth,
        role: role,
        name: name,
        email: email,
        isApproved: isApproved
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
        alert('Your admin account is pending Head Authority approval.');
        window.location.href = 'login.html?action=login&role=admin';
        return false;
    }

    return true;
}

function logoutUser(event) {
    if (event) event.preventDefault();
    
    // Clear session-specific flags without blowing away mock database / bins
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('active_session_token');
    
    window.location.href = 'index.html';
}

function seedDemoAccount(role = 'citizen') {
    if (role === 'citizen') {
        localStorage.setItem('is_authenticated', 'true');
        localStorage.setItem('registered_name', 'Kushal Bhatt');
        localStorage.setItem('registered_email', 'kushal@sou.edu.in');
        localStorage.setItem('registered_role', 'citizen');
        localStorage.setItem('is_approved', 'true');
        window.location.href = 'citizen.html';
    } else if (role === 'admin') {
        localStorage.setItem('is_authenticated', 'true');
        localStorage.setItem('registered_name', 'Vikram Mehta');
        localStorage.setItem('admin_id', 'ADM-2026-X1');
        localStorage.setItem('registered_email', 'facilities.lead@sou.edu.in');
        localStorage.setItem('registered_role', 'admin');
        localStorage.setItem('is_approved', 'true');
        window.location.href = 'admin.html';
    } else if (role === 'head_admin') {
        localStorage.setItem('is_authenticated', 'true');
        localStorage.setItem('registered_name', 'Director Sharma');
        localStorage.setItem('admin_id', 'HEAD-AUTH-01');
        localStorage.setItem('registered_email', 'head.authority@sou.edu.in');
        localStorage.setItem('registered_role', 'admin');
        localStorage.setItem('is_approved', 'true');
        window.location.href = 'approvals.html';
    }
}

window.getCurrentUser = getCurrentUser;
window.requireAuth = requireAuth;
window.logoutUser = logoutUser;
window.seedDemoAccount = seedDemoAccount;
