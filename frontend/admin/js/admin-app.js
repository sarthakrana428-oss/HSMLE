/**
 * HSMLE India Corporation - Admin Global Application Script
 * Dynamic Role-Aware Sidebar Navigation, Auth Guard, Toast Notifications, Confirmation Modals.
 */

// Immediate session self-healing for Director profile
try {
  const rawUser = localStorage.getItem('hsmle_admin_user');
  if (rawUser) {
    const u = JSON.parse(rawUser);
    if (u && (u.role === 'super_admin' || u.username === 'admin')) {
      u.username = 'Azad Sirohi';
      u.full_name = 'Azad Sirohi';
      localStorage.setItem('hsmle_admin_user', JSON.stringify(u));
    }
  }
} catch (_) {}

window.showAdminToast = function (message, type = 'info') {
  let container = document.getElementById('admin-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'admin-toast-container';
    container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bg =
    type === 'success'
      ? 'bg-emerald-600'
      : type === 'error'
      ? 'bg-red-600'
      : type === 'warning'
      ? 'bg-amber-600'
      : 'bg-blue-600';
  toast.className = `${bg} text-white px-4 py-2.5 shadow-xl text-xs font-semibold flex items-center gap-2 transform transition-all duration-300 pointer-events-auto max-w-sm border border-white/20`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" class="text-white/80 hover:text-white ml-auto font-bold pl-2 cursor-pointer">✕</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

window.confirmAdminAction = function (message, onConfirm) {
  let modal = document.getElementById('admin-confirm-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'admin-confirm-modal';
    modal.className = 'fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="bg-white max-w-sm w-full p-6 shadow-2xl border-2 border-slate-900">
        <h3 class="text-base font-bold text-slate-900 mb-2">Confirm Action</h3>
        <p id="admin-confirm-msg" class="text-xs text-slate-600 mb-6 leading-relaxed"></p>
        <div class="flex items-center justify-end gap-2">
          <button id="admin-confirm-cancel" class="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300">Cancel</button>
          <button id="admin-confirm-ok" class="px-4 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-sm border border-red-700">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('admin-confirm-msg').textContent = message;
  modal.classList.remove('hidden');

  const cancelBtn = document.getElementById('admin-confirm-cancel');
  const okBtn = document.getElementById('admin-confirm-ok');

  cancelBtn.onclick = () => modal.classList.add('hidden');
  okBtn.onclick = () => {
    modal.classList.add('hidden');
    if (onConfirm) onConfirm();
  };
};

function renderUnifiedSidebar(user, currentPath) {
  const sidebar = document.getElementById('admin-sidebar');
  if (!sidebar) return;

  const isDirector = user && (user.role === 'super_admin' || user.username === 'admin' || user.username === 'Azad Sirohi');

  // Prepare navigation items based on role
  let navItems = [];
  if (isDirector) {
    navItems = [
      {
        path: 'dashboard.html',
        label: 'Executive Overview',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>'
      },
      {
        path: 'quotations.html',
        label: 'Quotation Pipeline (RFQ)',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>'
      },
      {
        path: 'enquiries.html',
        label: 'Customer Enquiries',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>'
      },
      {
        path: 'products.html',
        label: 'All Machines',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>'
      },
      {
        path: '../catalogue.html',
        label: 'Catalogue Section',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>'
      },
      {
        path: '../catalogue.html',
        label: 'Catalogue Section',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>'
      },
      {
        path: 'categories.html',
        label: 'Divisions & Categories',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>'
      },
      {
        path: 'editor.html',
        label: 'Staff Editor Workspace',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>'
      },
      {
        path: 'audit-logs.html',
        label: 'Staff Audit Activity',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>'
      }
    ];
  } else {
    // Staff Editor Navigation
    navItems = [
      {
        path: 'editor.html',
        label: 'Editor Workspace',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>'
      },
      {
        path: 'quotations.html',
        label: 'Quotation Requests (RFQ)',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>'
      },
      {
        path: 'enquiries.html',
        label: 'Customer Enquiries',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>'
      },
      {
        path: 'products.html',
        label: 'All Machines',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>'
      },
      {
        path: '../catalogue.html',
        label: 'Catalogue Section',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>'
      },
      {
        path: 'categories.html',
        label: 'Categories & Divisions',
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>'
      }
    ];
  }

  const headerHtml = isDirector
    ? `
    <div class="p-5 border-b border-slate-900 flex items-center justify-between">
      <div>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-amber-500 rounded-none inline-block"></span>
          <span class="text-xs font-black tracking-widest text-white uppercase">DIRECTOR ADMIN</span>
        </div>
        <p class="text-[10px] text-amber-400 font-bold uppercase mt-1 tracking-wider">Executive Management</p>
      </div>
      <span class="px-2 py-0.5 text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">DIRECTOR</span>
    </div>
    `
    : `
    <div class="p-5 border-b border-slate-900 flex items-center justify-between">
      <div>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 bg-blue-500 rounded-none inline-block"></span>
          <span class="text-xs font-black tracking-widest text-white uppercase">STAFF EDITOR</span>
        </div>
        <p class="text-[10px] text-blue-400 font-bold uppercase mt-1 tracking-wider">Catalog & Content Operations</p>
      </div>
      <span class="px-2 py-0.5 text-[9px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40">EDITOR</span>
    </div>
    `;

  const profileHtml = isDirector
    ? `
    <div class="p-4 mx-3 my-4 bg-slate-900 border border-slate-800">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-black text-sm" id="admin-user-avatar">AS</div>
        <div class="flex-1 min-w-0">
          <h4 class="text-xs font-bold text-white truncate" id="admin-user-name">Azad Sirohi</h4>
          <span class="text-[10px] font-bold uppercase tracking-wider text-amber-400" id="admin-user-role">Director / Super Admin</span>
        </div>
      </div>
    </div>
    `
    : `
    <div class="p-4 mx-3 my-4 bg-slate-900 border border-slate-800">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center font-black text-sm" id="admin-user-avatar">SE</div>
        <div class="flex-1 min-w-0">
          <h4 class="text-xs font-bold text-white truncate" id="admin-user-name">${(user && (user.full_name || user.username)) || 'Staff Editor'}</h4>
          <span class="text-[10px] font-bold uppercase tracking-wider text-blue-400" id="admin-user-role">Catalog & RFQ Operations</span>
        </div>
      </div>
    </div>
    `;

  const navLinksHtml = navItems
    .map(item => {
      const isActive = currentPath === item.path || (currentPath === '' && item.path === (isDirector ? 'dashboard.html' : 'editor.html'));
      const activeClass = isActive
        ? 'bg-blue-600 text-white font-bold shadow-sm'
        : 'text-slate-300 hover:bg-slate-900 hover:text-white font-semibold';
      const iconColor = isActive ? 'text-white' : 'text-slate-400';

      return `
      <a href="${item.path}" class="admin-nav-link flex items-center gap-3 px-3 py-2.5 text-xs transition ${activeClass}">
        <svg class="w-4 h-4 ${iconColor} shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          ${item.icon}
        </svg>
        <span>${item.label}</span>
      </a>
      `;
    })
    .join('');

  sidebar.innerHTML = `
    <div>
      ${headerHtml}
      ${profileHtml}
      <nav class="px-3 space-y-1">
        ${navLinksHtml}
      </nav>
    </div>

    <div class="p-4 border-t border-slate-900 space-y-2">
      <a href="../index.html" class="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition py-1">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
        <span>View Public Website</span>
      </a>
      <button id="admin-logout-btn" class="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-900 hover:bg-red-950 hover:text-red-300 border border-slate-800 text-xs font-bold text-slate-300 transition cursor-pointer">
        <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        <span>Sign Out</span>
      </button>
    </div>
  `;
}

function initAdminNav() {
  if (window.location.pathname.includes('login.html')) {
    return;
  }

  const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';

  // Check general authentication
  if (!window.AdminAPI.isAuthenticated()) {
    const isDirectorTarget = ['dashboard.html', 'audit-logs.html'].includes(currentPath);
    const targetPortal = isDirectorTarget ? 'director' : 'editor';
    window.location.href = `login.html?portal=${targetPortal}&alert=` + encodeURIComponent('Authentication required. Please enter your credentials.');
    return;
  }

  const user = window.AdminAPI.getUser();
  const isDirector = user && (user.role === 'super_admin' || user.username === 'admin' || user.username === 'Azad Sirohi');

  // ONLY dashboard and audit-logs are restricted strictly to Director.
  // RFQs/Quotations, Enquiries, Products, and Categories are open to both!
  const isDirectorOnlyPage = ['dashboard.html', 'audit-logs.html'].includes(currentPath);

  if (isDirectorOnlyPage && !isDirector) {
    // Gracefully redirect staff editor to their editor workspace without wiping their session!
    window.location.href = 'editor.html';
    return;
  }

  // Render unified role-aware sidebar
  renderUnifiedSidebar(user, currentPath);

  // Logout button handler
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.confirmAdminAction('Are you sure you want to log out of HSMLE Portal?', () => {
        window.AdminAPI.logout();
      });
    });
  }

  // Mobile sidebar toggle handler
  const toggleBtn = document.getElementById('admin-mobile-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('admin-sidebar-backdrop');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
      if (backdrop) backdrop.classList.toggle('hidden');
    });
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
        backdrop.classList.add('hidden');
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', initAdminNav);
