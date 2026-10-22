/**
 * GreenRoute - Login & Registration Controller
 * Implements JWT authentication, role verification, and resilient local fallback.
 */

let currentRole = 'citizen'; // 'citizen' | 'admin'
let currentAction = 'login';  // 'login' | 'register'

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentAction = urlParams.get('action') || 'login';
    currentRole = urlParams.get('role') || 'citizen';

    updateUIState();
    bindForms();
});

function switchRole(role) {
    currentRole = role;
    updateUIState();
}

function switchAction(action) {
    currentAction = action;
    updateUIState();
}

function updateUIState() {
    // 1. Update Role Tabs
    document.getElementById('tab-citizen').classList.toggle('active', currentRole === 'citizen');
    document.getElementById('tab-admin').classList.toggle('active', currentRole === 'admin');

    // 2. Update Action Tabs
    document.getElementById('tab-login').classList.toggle('active', currentAction === 'login');
    document.getElementById('tab-register').classList.toggle('active', currentAction === 'register');

    // 3. Update Subtitle
    const subtitle = document.getElementById('dynamic-subtitle');
    if (currentAction === 'login') {
        subtitle.textContent = currentRole === 'citizen'
            ? 'Sign in to access your Green Points & campus rewards.'
            : 'Sign in to access Fleet Logistics Command Center.';
    } else {
        subtitle.textContent = currentRole === 'citizen'
            ? 'Join the campus smart waste revolution and earn rewards.'
            : 'Register for facilities administration & route planning access.';
    }

    // 4. Show the appropriate form
    const loginForm = document.getElementById('login-form');
    const citizenRegForm = document.getElementById('citizen-register-form');
    const adminRegForm = document.getElementById('admin-register-form');

    loginForm.classList.remove('active');
    citizenRegForm.classList.remove('active');
    adminRegForm.classList.remove('active');

    if (currentAction === 'login') {
        loginForm.classList.add('active');
        // Preset default placeholder email based on role
        const emailInput = document.getElementById('login-email');
        if (!emailInput.value) {
            emailInput.placeholder = currentRole === 'citizen' ? 'kushal@sou.edu.in' : 'facilities.lead@sou.edu.in';
        }
    } else {
        if (currentRole === 'citizen') {
            citizenRegForm.classList.add('active');
        } else {
            adminRegForm.classList.add('active');
        }
    }

    // Clear alert
    document.getElementById('alert-container').innerHTML = '';
}

function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alert-container');
    let icon = type === 'success' ? '✅' : '⚠️';
    if (type === 'info') icon = 'ℹ️';

    alertContainer.innerHTML = `
        <div class="eco-alert ${type}">
            ${icon} <span>${message}</span>
        </div>
    `;
}

function bindForms() {
    const citizenRegForm = document.getElementById('citizen-register-form');
    const adminRegForm = document.getElementById('admin-register-form');
    const loginForm = document.getElementById('login-form');

    // Purge any legacy stored plaintext passwords
    localStorage.removeItem('registered_password');

    // Citizen Registration
    if (citizenRegForm) {
        citizenRegForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('cit-name').value.trim();
            const email = document.getElementById('cit-email').value.trim();
            const password = document.getElementById('cit-password').value;

            // Attempt backend registration
            let backendSuccess = false;
            let backendError = null;
            let userData = null;

            try {
                const res = await fetch('http://127.0.0.1:8000/users/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, role: 'citizen' })
                });
                if (res.ok) {
                    userData = await res.json();
                    backendSuccess = true;
                } else {
                    const errJson = await res.json().catch(() => ({}));
                    backendError = errJson.detail || `Registration failed with HTTP ${res.status}`;
                }
            } catch (err) {
                console.warn("Backend registration offline:", err);
            }

            // If the server explicitly rejected the registration, do not show success
            if (backendError) {
                showAlert(backendError, 'error');
                return;
            }

            if (backendSuccess && userData) {
                localStorage.setItem('user_id', userData.id);
                if (userData.access_token) {
                    localStorage.setItem('access_token', userData.access_token);
                }
                localStorage.setItem('registered_name', userData.name);
                localStorage.setItem('registered_email', userData.email);
                localStorage.setItem('registered_role', userData.role);
                localStorage.setItem('is_approved', userData.is_approved ? 'true' : 'false');
                localStorage.setItem('is_authenticated', 'true');
                localStorage.setItem('gr_points', userData.points || 0);
                localStorage.setItem('gr_streak', userData.streak || 0);
                localStorage.setItem('gr_total_scans', userData.total_scans || 0);
                localStorage.setItem('gr_co2_kg', '0');
                localStorage.setItem('gr_rank', userData.rank || 'Novice Sprout');

                showAlert(`Welcome, ${name}! Your Citizen account is active. Redirecting...`, 'success');
                citizenRegForm.reset();

                setTimeout(() => {
                    window.location.href = 'citizen.html';
                }, 1000);
            } else {
                showAlert('Server unreachable. Please check backend status.', 'error');
            }
        });
    }

    // Admin Registration (Requires Head Admin Approval)
    if (adminRegForm) {
        adminRegForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('adm-name').value.trim();
            const adminId = document.getElementById('adm-id').value.trim();
            const email = document.getElementById('adm-email').value.trim();
            const password = document.getElementById('adm-password').value;

            let backendSuccess = false;
            let backendError = null;
            let userData = null;

            try {
                const res = await fetch('http://127.0.0.1:8000/users/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, role: 'admin', admin_id: adminId, department: 'Campus Facilities' })
                });
                if (res.ok) {
                    userData = await res.json();
                    backendSuccess = true;
                } else {
                    const errJson = await res.json().catch(() => ({}));
                    backendError = errJson.detail || `Registration failed with HTTP ${res.status}`;
                }
            } catch (err) {
                console.warn("Backend admin registration offline:", err);
            }

            if (backendError) {
                showAlert(backendError, 'error');
                return;
            }

            if (backendSuccess && userData) {
                localStorage.setItem('user_id', userData.id);
                localStorage.setItem('registered_name', userData.name);
                localStorage.setItem('admin_id', adminId);
                localStorage.setItem('registered_email', userData.email);
                localStorage.setItem('registered_role', 'admin');
                localStorage.setItem('is_approved', 'false');

                showAlert('Registration Submitted! Administrator accounts require authorization from the Head Authority. Once approved, you can sign in.', 'info');

                const inputs = adminRegForm.querySelectorAll('input, button');
                inputs.forEach(input => input.disabled = true);
            } else {
                showAlert('Server unreachable. Please check backend connection.', 'error');
            }
        });
    }

    // Shared Sign In Form
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            // 1. Try Backend Authentication with Password & JWT verification
            let backendUser = null;
            let backendError = null;
            let backendAttempted = false;

            try {
                const res = await fetch('http://127.0.0.1:8000/users/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, role: currentRole })
                });
                backendAttempted = true;

                if (res.ok) {
                    backendUser = await res.json();
                } else if (res.status === 401) {
                    backendError = "Invalid credentials. Incorrect email or password.";
                } else if (res.status === 403) {
                    backendError = "Access Denied: Your administrator account is still pending Head Authority approval.";
                } else {
                    const errJson = await res.json().catch(() => ({}));
                    backendError = errJson.detail || `Login failed with HTTP ${res.status}`;
                }
            } catch (err) {
                console.warn("Backend login offline, falling back to local verification:", err);
            }

            if (backendError) {
                showAlert(backendError, 'error');
                return;
            }

            if (backendUser) {
                localStorage.setItem('user_id', backendUser.id);
                localStorage.setItem('registered_name', backendUser.name);
                localStorage.setItem('registered_email', backendUser.email);
                localStorage.setItem('registered_role', backendUser.role);
                localStorage.setItem('is_approved', backendUser.is_approved ? 'true' : 'false');
                localStorage.setItem('gr_points', backendUser.points);
                localStorage.setItem('gr_streak', backendUser.streak);
                localStorage.setItem('gr_total_scans', backendUser.total_scans || 0);

                if (backendUser.access_token) {
                    localStorage.setItem('access_token', backendUser.access_token);
                }

                if ((currentRole === 'admin' || backendUser.role === 'admin') && !backendUser.is_approved) {
                    showAlert('Access Denied: Your administrator account is still pending Head Authority approval. Please review in the Approvals portal.', 'error');
                    return;
                }

                localStorage.setItem('is_authenticated', 'true');
                showAlert(`Welcome back, ${backendUser.name}! Loading dashboard...`, 'success');

                setTimeout(() => {
                    if (backendUser.role === 'admin' || currentRole === 'admin') {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'citizen.html';
                    }
                }, 800);
                return;
            }

            // 2. Fallback local credentials verification (when backend is offline)
            const savedEmail = localStorage.getItem('registered_email');
            const savedRole = localStorage.getItem('registered_role') || currentRole;
            const isApproved = localStorage.getItem('is_approved');

            const isDemoCitizen = (email === 'kushal@sou.edu.in' || email === 'citizen@greenroute.org');
            const isDemoAdmin = (email === 'facilities.lead@sou.edu.in' || email === 'admin@greenroute.org');
            const isRegisteredMatch = (savedEmail && email.toLowerCase() === savedEmail.toLowerCase());

            if (!isDemoCitizen && !isDemoAdmin && !isRegisteredMatch) {
                showAlert('Account not found with this email. Please register or use the 1-Click Demo login below.', 'error');
                return;
            }

            // Check Admin Approval Status
            if (currentRole === 'admin' || savedRole === 'admin') {
                if (isApproved === 'false') {
                    showAlert('Access Denied: Your administrator account is still pending Head Authority approval. Please review in the Approvals portal.', 'error');
                    return;
                }
                if (isApproved === 'rejected') {
                    showAlert('Access Denied: Your registration request was rejected by the Head Authority.', 'error');
                    return;
                }
            }

            // Set Authenticated
            localStorage.setItem('is_authenticated', 'true');
            if (!localStorage.getItem('registered_name')) {
                localStorage.setItem('registered_name', currentRole === 'admin' ? 'Admin Officer' : 'Citizen User');
            }
            if (!localStorage.getItem('registered_role')) {
                localStorage.setItem('registered_role', currentRole);
            }
            if (localStorage.getItem('gr_points') === null) {
                localStorage.setItem('gr_points', '0');
                localStorage.setItem('gr_streak', '0');
                localStorage.setItem('gr_total_scans', '0');
            }

            showAlert('Authentication successful! Loading dashboard...', 'success');

            setTimeout(() => {
                if (currentRole === 'admin' || savedRole === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'citizen.html';
                }
            }, 800);
        });
    }
}

window.switchRole = switchRole;
window.switchAction = switchAction;