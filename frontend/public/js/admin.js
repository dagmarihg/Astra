// Admin Dashboard JavaScript

const API_BASE = 'http://localhost:3000/api';
let adminToken = localStorage.getItem('adminToken');

// Redirect to login if no token
if (!adminToken) {
  window.location.href = 'index.html';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeAdmin();
  setupEventListeners();
  loadDashboard();
  setupRealtime();
});

function setupRealtime() {
  try {
    const socket = io();
    socket.on('connect', () => {
      // Join admins room and provide admin token for server-side verification
      socket.emit('join_admin', { token: adminToken });
    });

    socket.on('payment:approved', (data) => {
      showNotification(`Payment ${data.payment_id} approved; server ${data.server_id} activated.`);
      loadPayments();
      loadServers();
    });

    socket.on('payment:rejected', (data) => {
      showNotification(`Payment ${data.payment_id} rejected: ${data.reason || 'no reason'}`);
      loadPayments();
    });

    socket.on('servers:expired', (data) => {
      showNotification(`Servers expired: ${data.count}`);
      loadServers();
    });
  } catch (err) {
    console.warn('Realtime not available:', err.message);
  }
}

function showNotification(msg) {
  const el = document.createElement('div');
  el.className = 'realtime-notice';
  el.textContent = msg;
  el.style.position = 'fixed';
  el.style.right = '1rem';
  el.style.bottom = '1rem';
  el.style.background = '#111';
  el.style.color = '#fff';
  el.style.padding = '0.75rem 1rem';
  el.style.borderRadius = '6px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 8000);
}

function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.getAttribute('data-section');
      switchSection(section);
    });
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('adminToken');
    window.location.href = 'index.html';
  });

  // Modals
  setupModals();
}

function switchSection(section) {
  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  
  // Show selected section
  document.getElementById(`${section}-section`).classList.add('active');
  
  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-section') === section) {
      item.classList.add('active');
    }
  });

  // Load section data
  if (section === 'payments') {
    loadPayments();
  } else if (section === 'servers') {
    loadServers();
  } else if (section === 'plans') {
    loadPlans();
  } else if (section === 'customers') {
    loadCustomers();
  }
}

async function initializeAdmin() {
  try {
    const response = await fetch(`${API_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await response.json();
    document.getElementById('adminName').textContent = data.user.username;
  } catch (err) {
    console.error('Error loading admin info:', err);
  }
}

async function loadDashboard() {
  try {
    const response = await fetch(`${API_BASE}/dashboard/admin`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await response.json();

    document.getElementById('totalCustomers').textContent = data.stats.total_customers;
    document.getElementById('totalServers').textContent = data.stats.active_servers;
    document.getElementById('totalRevenue').textContent = `$${parseFloat(data.stats.total_revenue).toFixed(2)}`;
    document.getElementById('pendingPayments').textContent = data.stats.pending_payments;
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

async function loadPayments() {
  try {
    const response = await fetch(`${API_BASE}/admin/payments`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await response.json();

    const tbody = document.getElementById('paymentsBody');
    tbody.innerHTML = '';

    if (!data.payments || data.payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">No pending payments</td></tr>';
      return;
    }

    data.payments.forEach(payment => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>#${payment.id}</td>
        <td>${payment.username} (${payment.email})</td>
        <td>$${parseFloat(payment.amount).toFixed(2)}</td>
        <td>${payment.server_name}</td>
        <td><span class="status-badge pending">${payment.status}</span></td>
        <td>${new Date(payment.created_at).toLocaleDateString()}</td>
        <td>
          <button class="btn btn-primary" onclick="openApprovalModal(${payment.id}, ${payment.amount}, '${payment.server_name}')">Approve</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading payments:', err);
  }
}

function openApprovalModal(paymentId, amount, serverName) {
  const modal = document.getElementById('approvalModal');
  const details = document.getElementById('modalDetails');
  
  details.innerHTML = `
    <p><strong>Payment ID:</strong> #${paymentId}</p>
    <p><strong>Amount:</strong> $${parseFloat(amount).toFixed(2)}</p>
    <p><strong>Server:</strong> ${serverName}</p>
  `;
  
  document.getElementById('paymentIdInput').value = paymentId;
  modal.classList.add('active');

  // Reject button handler
  document.getElementById('rejectBtn').onclick = () => rejectPayment(paymentId);
}

async function approvePayment(e) {
  e.preventDefault();
  
  const paymentId = document.getElementById('paymentIdInput').value;
  const utr = document.getElementById('utrInput').value;
  const nodeId = document.getElementById('nodeInput').value;

  try {
    const response = await fetch(`${API_BASE}/admin/payments/${paymentId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ utr, pterodactyl_node_id: nodeId })
    });

    if (response.ok) {
      closeModal('approvalModal');
      alert('Payment approved successfully!');
      loadPayments();
      loadDashboard();
    } else {
      const error = await response.json();
      alert(`Error: ${error.error}`);
    }
  } catch (err) {
    alert('Error approving payment: ' + err.message);
  }
}

async function rejectPayment(paymentId) {
  const reason = prompt('Reason for rejection:');
  if (!reason) return;

  try {
    const response = await fetch(`${API_BASE}/admin/payments/${paymentId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });

    if (response.ok) {
      closeModal('approvalModal');
      alert('Payment rejected successfully!');
      loadPayments();
      loadDashboard();
    } else {
      alert('Error rejecting payment');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function loadServers() {
  try {
    const response = await fetch(`${API_BASE}/servers/admin/all`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await response.json();

    const tbody = document.getElementById('serversBody');
    tbody.innerHTML = '';

    if (!data.servers || data.servers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">No servers</td></tr>';
      return;
    }

    data.servers.forEach(server => {
      const row = document.createElement('tr');
      const expiresDate = new Date(server.expires_at);
      const today = new Date();
      const daysLeft = Math.ceil((expiresDate - today) / (1000 * 60 * 60 * 24));

      row.innerHTML = `
        <td>#${server.id}</td>
        <td>${server.username}</td>
        <td>${server.server_name}</td>
        <td>${server.plan_name}</td>
        <td><span class="status-badge ${server.status}">${server.status}</span></td>
        <td>${expiresDate.toLocaleDateString()} (${daysLeft > 0 ? daysLeft + ' days' : 'Expired'})</td>
        <td><button class="btn btn-secondary">Details</button></td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading servers:', err);
  }
}

async function loadPlans() {
  try {
    const response = await fetch(`${API_BASE}/plans`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await response.json();

    const grid = document.getElementById('plansGrid');
    grid.innerHTML = '';

    if (!data.plans || data.plans.length === 0) {
      grid.innerHTML = '<p>No plans created yet.</p>';
      return;
    }

    data.plans.forEach(plan => {
      const card = document.createElement('div');
      card.className = 'plan-card';
      card.innerHTML = `
        <h3>${plan.name}</h3>
        <div class="plan-price">$${parseFloat(plan.price).toFixed(2)}</div>
        <ul class="plan-specs">
          <li>${plan.cpu_cores} CPU Cores</li>
          <li>${plan.ram_gb} GB RAM</li>
          <li>${plan.storage_gb} GB Storage</li>
          <li>${plan.max_players} Max Players</li>
        </ul>
        <button class="btn btn-primary" onclick="editPlan(${plan.id})">Edit</button>
        <button class="btn btn-danger" onclick="deletePlan(${plan.id})">Delete</button>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading plans:', err);
  }
}

// Edit plan: populate modal with existing plan data
async function editPlan(planId) {
  try {
    const resp = await fetch(`${API_BASE}/plans/${planId}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (!resp.ok) {
      alert('Could not load plan');
      return;
    }
    const data = await resp.json();
    const plan = data.plan;

    document.getElementById('planModalTitle').textContent = 'Edit Plan';
    document.getElementById('planIdInput').value = plan.id;
    document.getElementById('planName').value = plan.name || '';
    document.getElementById('planPrice').value = plan.price || 0;
    document.getElementById('planCPU').value = plan.cpu_cores || '';
    document.getElementById('planRAM').value = plan.ram_gb || '';
    document.getElementById('planStorage').value = plan.storage_gb || '';
    document.getElementById('planPlayers').value = plan.max_players || '';

    openModal('planModal');
  } catch (err) {
    alert('Error loading plan: ' + err.message);
  }
}

async function deletePlan(planId) {
  if (!confirm('Delete this plan? This will mark it inactive.')) return;
  try {
    const resp = await fetch(`${API_BASE}/plans/${planId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (resp.ok) {
      alert('Plan deleted');
      loadPlans();
    } else {
      const err = await resp.json();
      alert('Error deleting plan: ' + (err.error || JSON.stringify(err)));
    }
  } catch (err) {
    alert('Error deleting plan: ' + err.message);
  }
}

async function loadCustomers() {
  try {
    // Using dashboard endpoint to get customer count
    const response = await fetch(`${API_BASE}/dashboard/admin`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await response.json();
    // Use admin users endpoint to populate users list
    const usersResp = await fetch(`${API_BASE}/admin/users?page=1&limit=100`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const usersData = await usersResp.json();

    const tbody = document.getElementById('customersBody');
    tbody.innerHTML = '';

    if (!usersData.users || usersData.users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center">No users</td></tr>';
      return;
    }

    usersData.users.forEach(user => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>#${user.id}</td>
        <td>${user.username}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>${new Date(user.created_at).toLocaleString()}</td>
        <td>${user.is_active ? 'Active' : 'Inactive'}</td>
        <td>
          <button class="btn btn-secondary" onclick="openEditUser(${user.id})">Edit</button>
          <button class="btn btn-danger" onclick="toggleUserActive(${user.id}, ${user.is_active})">${user.is_active ? 'Deactivate' : 'Activate'}</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading customers:', err);
  }
}

// Open edit user modal (simple prompt-based edit for now)
function openEditUser(userId) {
  const newRole = prompt('Enter role for user (admin/customer):');
  if (!newRole) return;
  updateUserRole(userId, newRole);
}

async function updateUserRole(userId, role) {
  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role })
    });

    if (response.ok) {
      alert('User role updated');
      loadCustomers();
    } else {
      const err = await response.json();
      alert('Error: ' + (err.error || 'unknown'));
    }
  } catch (err) {
    alert('Error updating user: ' + err.message);
  }
}

async function toggleUserActive(userId, currentlyActive) {
  const confirmMsg = currentlyActive ? 'Deactivate this user?' : 'Activate this user?';
  if (!confirm(confirmMsg)) return;

  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_active: !currentlyActive })
    });

    if (response.ok) {
      alert('User status updated');
      loadCustomers();
    } else {
      const err = await response.json();
      alert('Error: ' + (err.error || 'unknown'));
    }
  } catch (err) {
    alert('Error updating user: ' + err.message);
  }
}

function setupModals() {
  // Approval form
  document.getElementById('approvalForm').addEventListener('submit', approvePayment);

  // Plan form
  document.getElementById('planForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const planId = document.getElementById('planIdInput').value;
    const name = document.getElementById('planName').value.trim();
    const price = parseFloat(document.getElementById('planPrice').value) || 0;
    const cpu_cores = parseInt(document.getElementById('planCPU').value, 10) || null;
    const ram_gb = parseFloat(document.getElementById('planRAM').value) || null;
    const storage_gb = parseInt(document.getElementById('planStorage').value, 10) || null;
    const max_players = parseInt(document.getElementById('planPlayers').value, 10) || null;

    const payload = { name, price, cpu_cores, ram_gb, storage_gb, max_players };

    try {
      let resp;
      if (!planId) {
        resp = await fetch(`${API_BASE}/plans`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } else {
        resp = await fetch(`${API_BASE}/plans/${planId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      }

      if (resp.ok) {
        closeModal('planModal');
        loadPlans();
        alert(planId ? 'Plan updated' : 'Plan created');
      } else {
        const err = await resp.json();
        alert('Error saving plan: ' + (err.error || JSON.stringify(err)));
      }
    } catch (err) {
      alert('Error saving plan: ' + err.message);
    }
  });

  // New plan button
  document.getElementById('newPlanBtn').addEventListener('click', () => {
    document.getElementById('planModalTitle').textContent = 'New Plan'
    document.getElementById('planForm').reset();
    document.getElementById('planIdInput').value = '';
    openModal('planModal');
  });

  // Close buttons
  document.querySelectorAll('.close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.modal').classList.remove('active');
    });
  });

  // Close on background click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}

function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// Add status badge styles
const style = document.createElement('style');
style.textContent = `
  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
  }
  
  .status-badge.pending {
    background: #fef3c7;
    color: #92400e;
  }
  
  .status-badge.active {
    background: #d1fae5;
    color: #065f46;
  }
  
  .status-badge.expired {
    background: #fee2e2;
    color: #7f1d1d;
  }
`;
document.head.appendChild(style);
