// script.js - The Frontend Logic

// !!! IMPORTANT: PASTE YOUR GOOGLE APPS SCRIPT URL HERE !!!
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbydoSdVI0sk1WOCmCltnUnlgp0ZrgmaztRNjODTfLdRDlWmv13h7j9NXmHGkDOUxZpBhA/exec'; 

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    const loggedInUser = getLoggedInUser();
    if (loggedInUser) {
        showDashboard(loggedInUser);
    } else {
        showView('login-view');
    }

    // Event Listeners
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('search-btn').addEventListener('click', handleSearch);
    document.getElementById('search-input').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
});

let currentView = 'domains'; // 'domains' or 'users' for admin
let allData = []; // To store all data for searching

// --- VIEW MANAGEMENT ---
function showView(viewId) {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'none';
    
    if (viewId) {
        document.getElementById(viewId).style.display = 'block';
    }
}

function showDashboard(user) {
    document.getElementById('user-welcome').textContent = `Welcome, ${user.fullName || user.username}!`;
    document.getElementById('user-welcome').style.display = 'block';
    document.getElementById('logout-btn').style.display = 'block';
    
    showView('dashboard-view');

    if (user.role === 'admin') {
        setupAdminDashboard();
    } else {
        setupUserDashboard(user);
    }
}


// --- API CALLS ---
async function apiCall(action, data = {}, method = 'GET') {
    const url = new URL(SCRIPT_URL);
    url.searchParams.append('action', action);

    let options = {
        method: 'POST', // Use POST for all for simplicity with Apps Script
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-s' } // Required header for Apps Script
    };

    if (method === 'POST_JSON') {
        options.body = JSON.stringify(data);
    } else {
        const formData = new FormData();
        for (const key in data) {
            formData.append(key, data[key]);
        }
        // For GET parameters in POST body
        url.search = new URLSearchParams(data).toString();
        url.searchParams.append('action', action);

    }

    try {
        const response = await fetch(url, options);
        const result = await response.json();
        if (result.status === 'error') {
            alert(`Error: ${result.message}`);
            return null;
        }
        return result;
    } catch (error) {
        console.error('API Call Failed:', error);
        alert('An error occurred. Please check the console.');
        return null;
    }
}

// --- AUTHENTICATION ---
function saveLoggedInUser(user) {
    localStorage.setItem('loggedInUser', JSON.stringify(user));
}

function getLoggedInUser() {
    return JSON.parse(localStorage.getItem('loggedInUser'));
}

function clearLoggedInUser() {
    localStorage.removeItem('loggedInUser');
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    document.getElementById('login-error').textContent = '';

    const result = await apiCall('login', { username, password });
    if (result && result.status === 'success') {
        saveLoggedInUser(result.data);
        showDashboard(result.data);
    } else {
        document.getElementById('login-error').textContent = result ? result.message : 'Login failed.';
    }
}

function handleLogout() {
    clearLoggedInUser();
    showView('login-view');
    document.getElementById('user-welcome').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
}


// --- DASHBOARD SETUP ---
function setupAdminDashboard() {
    // Admin can see both users and domains
    const nav = document.createElement('ul');
    nav.className = 'nav nav-tabs mb-3';
    nav.innerHTML = `
        <li class="nav-item">
            <a class="nav-link active" href="#" data-view="domains">Domains</a>
        </li>
        <li class="nav-item">
            <a class="nav-link" href="#" data-view="users">Users</a>
        </li>
    `;
    nav.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            nav.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
            e.target.classList.add('active');
            currentView = e.target.dataset.view;
            loadDataForView();
        }
    });

    const dashboard = document.getElementById('dashboard-view');
    // Remove old nav if exists
    const oldNav = dashboard.querySelector('.nav-tabs');
    if (oldNav) oldNav.remove();
    dashboard.insertBefore(nav, dashboard.children[1]);

    loadDataForView();
}

function setupUserDashboard(user) {
    // User can only see their domains
    const dashboard = document.getElementById('dashboard-view');
    const oldNav = dashboard.querySelector('.nav-tabs');
    if (oldNav) oldNav.remove(); // Remove admin nav if it exists

    document.getElementById('dashboard-title').textContent = "My Domains";
    currentView = 'domains';
    document.getElementById('add-new-btn').style.display = 'none'; // Users can't add domains directly, only admin
    loadUserDomains(user.userId);
}


// --- DATA LOADING & RENDERING ---
async function loadDataForView() {
    if (currentView === 'domains') {
        document.getElementById('dashboard-title').textContent = "All Domains";
        document.getElementById('add-new-btn').textContent = "Add New Domain";
        const result = await apiCall('getAllDomains');
        if (result) {
            allData = result.data;
            renderTable(allData, 'domains');
        }
    } else if (currentView === 'users') {
        document.getElementById('dashboard-title').textContent = "All Users";
        document.getElementById('add-new-btn').textContent = "Add New User";
        const result = await apiCall('getAllUsers');
        if (result) {
            allData = result.data;
            renderTable(allData, 'users');
        }
    }
}

async function loadUserDomains(userId) {
     const result = await apiCall('getUserDomains', { userId });
     if (result) {
        allData = result.data;
        renderTable(allData, 'domains');
     }
}

function renderTable(data, type) {
    const tableHead = document.getElementById('data-table-head');
    const tableBody = document.getElementById('data-table-body');
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="100%" class="text-center">No data found.</td></tr>`;
        return;
    }

    let headers;
    if (type === 'domains') {
        headers = ['Domain Name', 'Registrar', 'Expiry Date', 'Status', 'Actions'];
    } else { // users
        headers = ['Username', 'Full Name', 'Email', 'Role', 'Actions'];
    }

    tableHead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

    data.forEach(item => {
        const row = document.createElement('tr');
        let rowHtml = '';
        if (type === 'domains') {
            row.dataset.id = item.domainId;
            rowHtml = `
                <td>${item.domainName}</td>
                <td>${item.registrar}</td>
                <td>${new Date(item.expiryDate).toLocaleDateString()}</td>
                <td><span class="badge bg-success">${item.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary btn-edit">Edit</button>
                    <button class="btn btn-sm btn-danger btn-delete">Delete</button>
                </td>
            `;
        } else { // users
            row.dataset.id = item.userId;
            rowHtml = `
                <td>${item.username}</td>
                <td>${item.fullName}</td>
                <td>${item.email}</td>
                <td>${item.role}</td>
                 <td>
                    <button class="btn btn-sm btn-primary btn-edit">Edit</button>
                    <button class="btn btn-sm btn-danger btn-delete">Delete</button>
                </td>
            `;
        }
        row.innerHTML = rowHtml;
        tableBody.appendChild(row);
    });

    // Add event listeners for new buttons
    tableBody.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', handleEdit));
    tableBody.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', handleDelete));
}


// --- FORM & MODAL HANDLING (CURD) ---
// ... (Continued in next block)

// script.js (Continued)

const formModal = new bootstrap.Modal(document.getElementById('form-modal'));

// Handle clicking "Add New" button
document.getElementById('add-new-btn').addEventListener('click', () => {
    document.getElementById('data-form').reset();
    document.getElementById('data-form').dataset.id = '';
    if (currentView === 'users') {
        setupUserForm();
    } else {
        setupDomainForm();
    }
    formModal.show();
});

function handleEdit(e) {
    e.stopPropagation();
    const id = e.target.closest('tr').dataset.id;
    const record = allData.find(item => item.userId == id || item.domainId == id);
    
    document.getElementById('data-form').reset();
    document.getElementById('data-form').dataset.id = id;

    if (currentView === 'users') {
        setupUserForm(record);
    } else {
        setupDomainForm(record);
    }
    formModal.show();
}

async function handleDelete(e) {
    e.stopPropagation();
    const id = e.target.closest('tr').dataset.id;
    const action = currentView === 'users' ? 'deleteUser' : 'deleteDomain';
    const params = currentView === 'users' ? { userId: id } : { domainId: id };

    if (confirm('Are you sure you want to delete this record?')) {
        const result = await apiCall(action, params);
        if (result && result.status === 'success') {
            alert(result.message);
            loadDataForView();
        }
    }
}

// Handle Save button in modal
document.getElementById('save-btn').addEventListener('click', async () => {
    const form = document.getElementById('data-form');
    const id = form.dataset.id;
    const formData = new FormData(form);
    let data = Object.fromEntries(formData.entries());

    let action, recordIdKey;
    if (currentView === 'users') {
        action = 'saveUser';
        recordIdKey = 'userId';
    } else {
        action = 'saveDomain';
        recordIdKey = 'domainId';
    }
    
    if (id) {
        data[recordIdKey] = id;
    }

    const result = await apiCall(action, data, 'POST_JSON');

    if (result && result.status === 'success') {
        alert(result.message);
        formModal.hide();
        loadDataForView();
    }
});

function setupUserForm(user = {}) {
    document.getElementById('modal-title').textContent = user.userId ? 'Edit User' : 'Add New User';
    const formContent = `
        <input type="hidden" name="userId" value="${user.userId || ''}">
        <div class="mb-3">
            <label class="form-label">Username</label>
            <input type="text" class="form-control" name="username" value="${user.username || ''}" required>
        </div>
        <div class="mb-3">
            <label class="form-label">Password (leave blank to keep unchanged)</label>
            <input type="password" class="form-control" name="password" placeholder="New password">
        </div>
        <div class="mb-3">
            <label class="form-label">Full Name</label>
            <input type="text" class="form-control" name="fullName" value="${user.fullName || ''}" required>
        </div>
        <div class="mb-3">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" name="email" value="${user.email || ''}" required>
        </div>
        <div class="mb-3">
            <label class="form-label">Role</label>
            <select class="form-select" name="role" required>
                <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
        </div>
    `;
    document.getElementById('data-form').innerHTML = formContent;
}

function setupDomainForm(domain = {}) {
    document.getElementById('modal-title').textContent = domain.domainId ? 'Edit Domain' : 'Add New Domain';
    const formContent = `
        <input type="hidden" name="domainId" value="${domain.domainId || ''}">
        <div class="mb-3">
            <label class="form-label">Domain Name</label>
            <input type="text" class="form-control" name="domainName" value="${domain.domainName || ''}" required>
        </div>
        <div class="mb-3">
            <label class="form-label">Registrar</label>
            <input type="text" class="form-control" name="registrar" value="${domain.registrar || ''}">
        </div>
        <div class="mb-3">
            <label class="form-label">Registration Date</label>
            <input type="date" class="form-control" name="registrationDate" value="${domain.registrationDate ? domain.registrationDate.split('T')[0] : ''}">
        </div>
        <div class="mb-3">
            <label class="form-label">Expiry Date</label>
            <input type="date" class="form-control" name="expiryDate" value="${domain.expiryDate ? domain.expiryDate.split('T')[0] : ''}">
        </div>
        <div class="mb-3">
            <label class="form-label">Owner User ID</label>
            <input type="text" class="form-control" name="ownerUserId" value="${domain.ownerUserId || ''}" placeholder="e.g., user-1700...">
        </div>
        <div class="mb-3">
            <label class="form-label">Status</label>
            <input type="text" class="form-control" name="status" value="${domain.status || ''}">
        </div>
         <div class="mb-3">
            <label class="form-label">Notes</label>
            <textarea class="form-control" name="notes">${domain.notes || ''}</textarea>
        </div>
    `;
    document.getElementById('data-form').innerHTML = formContent;
}

// --- SEARCH ---
function handleSearch() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    if (!searchTerm) {
        renderTable(allData, currentView); // Reset if search is empty
        return;
    }

    const filteredData = allData.filter(item => {
        // Search across all values of the object
        return Object.values(item).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });

    renderTable(filteredData, currentView);
}