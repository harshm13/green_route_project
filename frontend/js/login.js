document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action') || 'login'; // login or register
    const role = urlParams.get('role') || 'citizen';   // citizen or admin

    const titleEl = document.getElementById('dynamic-title');
    const subtitleEl = document.getElementById('dynamic-subtitle');
    const alertContainer = document.getElementById('alert-container');

    const citizenRegForm = document.getElementById('citizen-register-form');
    const adminRegForm = document.getElementById('admin-register-form');
    const loginForm = document.getElementById('login-form');

    // UI Setup based on URL Params
    function setupUI() {
        // Hide all forms initially
        citizenRegForm.classList.remove('active');
        adminRegForm.classList.remove('active');
        loginForm.classList.remove('active');

        if (action === 'register') {
            if (role === 'citizen') {
                titleEl.textContent = 'Create Citizen Account 🏡';
                subtitleEl.textContent = 'Join your local green community today.';
                citizenRegForm.classList.add('active');
            } else if (role === 'admin') {
                titleEl.textContent = 'Admin Registration 🏢';
                subtitleEl.textContent = 'Apply for administrative dashboard access.';
                adminRegForm.classList.add('active');
            }
        } else if (action === 'login') {
            if (role === 'citizen') {
                titleEl.textContent = 'Citizen Sign In 🏡';
                subtitleEl.textContent = 'Welcome back to your green dashboard.';
            } else if (role === 'admin') {
                titleEl.textContent = 'Admin Portal Login 🏢';
                subtitleEl.textContent = 'Access your municipal management dashboard.';
            } else {
                titleEl.textContent = 'Welcome Back 🌱';
                subtitleEl.textContent = 'Please sign in to continue.';
            }
            loginForm.classList.add('active');
        }
    }

    setupUI();

    // Alert helper
    function showAlert(message, type = 'success') {
        let icon = type === 'success' ? '✅' : '⚠️';
        if (type === 'info') icon = 'ℹ️';
        
        alertContainer.innerHTML = `
            <div class="eco-alert ${type}" style="${type === 'info' ? 'background-color: #FEF3C7; color: #92400E; border: 1px solid #FCD34D;' : ''}">
                ${icon} ${message}
            </div>
        `;
    }

    // Citizen Registration
    if (citizenRegForm) {
        citizenRegForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('cit-name').value.trim();
            const email = document.getElementById('cit-email').value.trim();
            const password = document.getElementById('cit-password').value;

            localStorage.setItem('registered_name', name);
            localStorage.setItem('registered_email', email);
            localStorage.setItem('registered_password', password);
            localStorage.setItem('registered_role', 'citizen');

            showAlert('Account created successfully! Redirecting to sign in...', 'success');
            citizenRegForm.reset();

            setTimeout(() => {
                window.location.href = 'login.html?action=login&role=citizen';
            }, 1500);
        });
    }

    // Admin Registration
    if (adminRegForm) {
        adminRegForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('adm-name').value.trim();
            const adminId = document.getElementById('adm-id').value.trim();
            const email = document.getElementById('adm-email').value.trim();
            const password = document.getElementById('adm-password').value;

            localStorage.setItem('registered_name', name);
            localStorage.setItem('admin_id', adminId);
            localStorage.setItem('registered_email', email);
            localStorage.setItem('registered_password', password);
            localStorage.setItem('registered_role', 'admin');
            
            // Critical: Set approval to false
            localStorage.setItem('is_approved', 'false');

            // Show persistent pending warning
            showAlert('Registration Successful. However, Admin access requires approval from the Head Authority. You will be notified once approved.', 'info');
            
            // Disable form inputs to show "Pending" state
            const inputs = adminRegForm.querySelectorAll('input, button');
            inputs.forEach(input => input.disabled = true);
            
            // Do NOT redirect
        });
    }

    // Login Logic
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            const savedEmail = localStorage.getItem('registered_email');
            const savedPassword = localStorage.getItem('registered_password');
            const savedRole = localStorage.getItem('registered_role');
            const isApproved = localStorage.getItem('is_approved'); // For admins

            if (!savedEmail || email !== savedEmail || password !== savedPassword) {
                showAlert('Account not found or incorrect credentials. Please register first!', 'error');
                return;
            }

            // Check Admin Approval
            if (savedRole === 'admin' && isApproved === 'false') {
                showAlert('Access Denied: Your admin account is still pending Head Authority approval.', 'error');
                return;
            }

            // Success
            showAlert('Sign in successful! Redirecting...', 'success');
            
            setTimeout(() => {
                if (savedRole === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'citizen.html';
                }
            }, 1000);
        });
    }
});