// Customer Dashboard JavaScript

const API_BASE = 'http://localhost:3000/api';
let customerToken = localStorage.getItem('customerToken');
let currentServerDetailId = null;

// Redirect to login if no token
if (!customerToken) {
  window.location.href = 'index.html';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeCustomer();
  setupEventListeners();
  loadOverview();
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
    localStorage.removeItem('customerToken');
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
  if (section === 'servers') {
    loadMyServers();
  } else if (section === 'purchase') {
    loadPlansForPurchase();
  } else if (section === 'billing') {
    loadBilling();
  } else if (section === 'settings') {
    loadSettings();
  }
}

async function initializeCustomer() {
  try {
    const response = await fetch(`${API_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const data = await response.json();
    document.getElementById('userName').textContent = data.user.username;
  } catch (err) {
    console.error('Error loading user info:', err);
  }
}

async function loadOverview() {
  try {
    const response = await fetch(`${API_BASE}/dashboard`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const data = await response.json();

    document.getElementById('activeServers').textContent = data.stats.active_servers;
    document.getElementById('expiredServers').textContent = data.stats.expired_servers;
    document.getElementById('pendingPayments').textContent = data.stats.pending_payments;

    // Total spent (sum of approved payments)
    const totalSpent = data.active_servers.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
    document.getElementById('totalSpent').textContent = `$${totalSpent.toFixed(2)}`;

    // Load alerts
    loadAlerts(data);
  } catch (err) {
    console.error('Error loading overview:', err);
  }
}

function loadAlerts(data) {
  const alertsContainer = document.getElementById('alertsContainer');
  alertsContainer.innerHTML = '';

  // Check for expiring servers
  const expiringSoon = data.active_servers.filter(s => {
    const expiresDate = new Date(s.expires_at);
    const today = new Date();
    const daysLeft = Math.ceil((expiresDate - today) / (1000 * 60 * 60 * 24));
    return daysLeft <= 7 && daysLeft > 0;
  });

  if (expiringSoon.length > 0) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-warning';
    alert.innerHTML = `
      <span class="alert-icon">⏰</span>
      <div>
        <strong>${expiringSoon.length} server(s)</strong> expiring within 7 days. 
        <a href="#" onclick="switchSection('servers')">Renew now</a>
      </div>
    `;
    alertsContainer.appendChild(alert);
  }

  // Pending payments
  if (data.pending_payments.length > 0) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-info';
    alert.innerHTML = `
      <span class="alert-icon">⏳</span>
      <div>
        <strong>${data.pending_payments.length} payment(s)</strong> awaiting admin approval. 
        You'll be notified via email once approved.
      </div>
    `;
    alertsContainer.appendChild(alert);
  }

  if (expiringSoon.length === 0 && data.pending_payments.length === 0) {
    alertsContainer.innerHTML = '<p style="color: #6b7280;">No alerts</p>';
  }
}

async function loadMyServers() {
  try {
    const response = await fetch(`${API_BASE}/servers`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const data = await response.json();

    const container = document.getElementById('serversContainer');
    const noServers = document.getElementById('noServers');

    if (!data.servers || data.servers.length === 0) {
      container.innerHTML = '';
      noServers.style.display = 'block';
      return;
    }

    noServers.style.display = 'none';
    container.innerHTML = '';

    data.servers.forEach(server => {
      const expiresDate = new Date(server.expires_at);
      const today = new Date();
      const daysLeft = Math.ceil((expiresDate - today) / (1000 * 60 * 60 * 24));

      const card = document.createElement('div');
      card.className = 'server-card';
      
      let statusClass = 'status-active';
      if (server.subscription_status === 'expired') statusClass = 'status-expired';
      if (server.status === 'pending') statusClass = 'status-pending';

      card.innerHTML = `
        <div class="server-card-header">
          <div class="server-name">${server.server_name}</div>
          <span class="server-status ${statusClass}">${server.status}</span>
        </div>
        <div class="server-info">
          <div class="info-row">
            <span class="info-label">Plan:</span>
            <span class="info-value">${server.plan_name}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Price:</span>
            <span class="info-value">$${parseFloat(server.price).toFixed(2)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Expires:</span>
            <span class="info-value">${expiresDate.toLocaleDateString()}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Days Left:</span>
            <span class="info-value" style="color: ${daysLeft > 7 ? '#10b981' : '#f59e0b'}">${daysLeft > 0 ? daysLeft : 'Expired'}</span>
          </div>
        </div>
        <div class="server-actions">
          <button class="btn btn-primary" onclick="openServerDetail(${server.id})">Details</button>
          <button class="btn btn-secondary" onclick="renewServer(${server.id})">Renew</button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading servers:', err);
  }
}

async function openServerDetail(serverId) {
  try {
    const response = await fetch(`${API_BASE}/servers/${serverId}`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const data = await response.json();
    const server = data.server;

    currentServerDetailId = serverId;

    document.getElementById('serverTitle').textContent = server.server_name;
    document.getElementById('detailStatus').textContent = server.status.toUpperCase();
    document.getElementById('detailExpires').textContent = new Date(server.expires_at).toLocaleDateString();
    
    const expiresDate = new Date(server.expires_at);
    const today = new Date();
    const daysLeft = Math.ceil((expiresDate - today) / (1000 * 60 * 60 * 24));
    document.getElementById('detailDays').textContent = daysLeft > 0 ? `${daysLeft} days` : 'Expired';
    document.getElementById('detailPlan').textContent = server.plan_name;

    // Load credentials if active
    if (server.status === 'active') {
      const credsResponse = await fetch(`${API_BASE}/servers/${serverId}/credentials`, {
        headers: { 'Authorization': `Bearer ${customerToken}` }
      });
      const credsData = await credsResponse.json();
      const creds = credsData.credentials;

      document.getElementById('credHost').textContent = creds.host;
      document.getElementById('credUsername').textContent = creds.username;
      document.getElementById('credPassword').textContent = creds.password;
      document.getElementById('credPort').textContent = creds.port;

      document.getElementById('credPassword').style.display = 'none';
      document.getElementById('showPasswordBtn').style.display = 'block';
      document.querySelector('[data-copy="credPassword"]').style.display = 'none';

      document.getElementById('credPassword').parentElement.querySelector('.btn-show').onclick = () => {
        const isVisible = document.getElementById('credPassword').style.display !== 'none';
        if (isVisible) {
          document.getElementById('credPassword').style.display = 'none';
          document.getElementById('showPasswordBtn').style.display = 'block';
          document.querySelector('[data-copy="credPassword"]').style.display = 'none';
        } else {
          document.getElementById('credPassword').style.display = 'block';
          document.getElementById('showPasswordBtn').style.display = 'none';
          document.querySelector('[data-copy="credPassword"]').style.display = 'block';
        }
      };

      document.getElementById('credentialsSection').style.display = 'block';
    } else {
      document.getElementById('credentialsSection').style.display = 'none';
    }

    openModal('serverDetailModal');
  } catch (err) {
    alert('Error loading server details: ' + err.message);
  }
}

async function renewServer(serverId) {
  if (!confirm('Renew this server subscription for 30 more days?')) return;

  try {
    const response = await fetch(`${API_BASE}/servers/${serverId}/renew`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });

    if (response.ok) {
      alert('Renewal initiated! A new payment is pending admin approval.');
      loadMyServers();
      loadOverview();
    } else {
      alert('Error renewing server');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function loadPlansForPurchase() {
  try {
    const response = await fetch(`${API_BASE}/plans`);
    const data = await response.json();

    const container = document.getElementById('plansContainer');
    container.innerHTML = '';

    if (!data.plans || data.plans.length === 0) {
      container.innerHTML = '<p>No plans available</p>';
      return;
    }

    data.plans.forEach((plan, index) => {
      const card = document.createElement('div');
      card.className = 'plan-card';
      if (index === 1) card.classList.add('featured'); // Highlight recommended plan

      card.innerHTML = `
        <div class="plan-name">${plan.name}</div>
        <div class="plan-price">$${parseFloat(plan.price).toFixed(2)}</div>
        <div class="plan-price-note">per month</div>
        <ul class="plan-specs">
          <li><strong>${plan.cpu_cores}</strong> CPU Cores</li>
          <li><strong>${plan.ram_gb}</strong> GB RAM</li>
          <li><strong>${plan.storage_gb}</strong> GB Storage</li>
          <li><strong>${plan.max_players}</strong> Max Players</li>
        </ul>
        <button class="btn btn-primary plan-action" onclick="openPurchaseModal(${plan.id}, '${plan.name}', ${plan.price})">Choose Plan</button>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading plans:', err);
  }
}

function openPurchaseModal(planId, planName, planPrice) {
  document.getElementById('planIdInput').value = planId;
  document.getElementById('planDetails').innerHTML = `
    <div class="plan-details-grid">
      <div class="plan-detail-item">
        <div class="plan-detail-label">Plan</div>
        <div class="plan-detail-value">${planName}</div>
      </div>
      <div class="plan-detail-item">
        <div class="plan-detail-label">Monthly Price</div>
        <div class="plan-detail-value">$${planPrice.toFixed(2)}</div>
      </div>
    </div>
  `;

  // Update total price based on duration
  const durationSelect = document.getElementById('durationSelect');
  const updateTotal = () => {
    const months = parseInt(durationSelect.value) / 30;
    const total = planPrice * months;
    document.getElementById('totalPrice').value = `$${total.toFixed(2)}`;
  };
  durationSelect.onchange = updateTotal;
  updateTotal();

  openModal('purchaseModal');
}

document.getElementById('purchaseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const planId = document.getElementById('planIdInput').value;
  const serverName = document.getElementById('serverName').value;

  try {
    const response = await fetch(`${API_BASE}/servers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${customerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ plan_id: parseInt(planId), server_name: serverName })
    });

    if (response.ok) {
      closeModal('purchaseModal');
      alert('Server purchase initiated! Please wait for admin approval. You will receive your credentials via email.');
      switchSection('billing');
      loadBilling();
    } else {
      const error = await response.json();
      alert(`Error: ${error.error}`);
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

async function loadBilling() {
  try {
    const response = await fetch(`${API_BASE}/dashboard`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const data = await response.json();

    // Billing table
    const billingBody = document.getElementById('billingBody');
    billingBody.innerHTML = '';

    // Show approved payments
    const billingBody2 = billingBody;
    billingBody2.innerHTML = '<tr><td colspan="5" style="text-align:center">No transaction history yet</td></tr>';

    // Pending payments
    const pendingContainer = document.getElementById('pendingPaymentsContainer');
    pendingContainer.innerHTML = '';

    if (data.pending_payments.length === 0) {
      pendingContainer.innerHTML = '<p style="color: #6b7280;">No pending payments</p>';
    } else {
      data.pending_payments.forEach(payment => {
        const div = document.createElement('div');
        div.style.cssText = 'background: var(--light); padding: 1rem; border-radius: 0.5rem; margin-bottom: 0.5rem;';
        div.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div><strong>${payment.server_name}</strong></div>
              <div style="color: #6b7280; font-size: 0.9rem;">${payment.plan_name} - $${parseFloat(payment.amount).toFixed(2)}</div>
              <div style="color: #6b7280; font-size: 0.85rem;">${new Date(payment.created_at).toLocaleDateString()}</div>
            </div>
            <span class="status-badge pending">${payment.status}</span>
          </div>
        `;
        pendingContainer.appendChild(div);
      });
    }
  } catch (err) {
    console.error('Error loading billing:', err);
  }
}

async function loadSettings() {
  try {
    const response = await fetch(`${API_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const data = await response.json();

    document.getElementById('settingsUsername').value = data.user.username;
    document.getElementById('settingsEmail').value = data.user.email;
    document.getElementById('settingsJoined').value = 'Registered user';
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

function setupModals() {
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

  // Copy buttons
  document.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = btn.getAttribute('data-copy');
      const text = document.getElementById(targetId).textContent;
      navigator.clipboard.writeText(text).then(() => {
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
      });
    });
  });

  // Delete server button
  document.getElementById('deleteServerBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to delete this server?')) {
      closeModal('serverDetailModal');
    }
  });

  // Renew server button in modal
  document.getElementById('renewServerBtn').addEventListener('click', () => {
    closeModal('serverDetailModal');
    renewServer(currentServerDetailId);
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
