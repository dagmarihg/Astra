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
});

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

async function loadCustomers() {
  try {
    // Using dashboard endpoint to get customer count
    const response = await fetch(`${API_BASE}/dashboard/admin`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await response.json();
    // In a real app, would have a separate endpoint for customer list
    document.getElementById('customersBody').innerHTML = '<tr><td colspan="6" style="text-align:center">Customer list endpoint needed</td></tr>';
  } catch (err) {
    console.error('Error loading customers:', err);
  }
}

function setupModals() {
  // Approval form
  document.getElementById('approvalForm').addEventListener('submit', approvePayment);

  // Plan form
  document.getElementById('planForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    // Save plan logic
    closeModal('planModal');
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
