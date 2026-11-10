/**
 * HSMLE India Corporation - Security Audit Trail
 * Fetches and displays administrative audit logs with filtering and pagination.
 */

const AuditLogManager = {
  state: {
    page: 1,
    limit: 25,
    action: '',
    total: 0,
    totalPages: 1
  },

  async init() {
    this.setupListeners();
    await this.fetchLogs();
  },

  setupListeners() {
    const actionFilter = document.getElementById('filter-audit-action');
    if (actionFilter) {
      actionFilter.addEventListener('change', (e) => {
        this.state.action = e.target.value;
        this.state.page = 1;
        this.fetchLogs();
      });
    }
  },

  async fetchLogs() {
    const tbody = document.getElementById('audit-tbody');
    const countDisplay = document.getElementById('audit-count-display');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-xs text-slate-400">Loading audit trail records...</td></tr>`;

    try {
      const data = await window.AdminAPI.getAuditLogs(this.state.page, this.state.limit, this.state.action);

      this.state.total = data.total;
      this.state.totalPages = data.total_pages;

      if (countDisplay) {
        countDisplay.textContent = `Showing ${data.items.length} of ${data.total} audit events`;
      }

      this.renderTable(data.items);
      this.renderPagination();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-xs text-red-600">Failed to load audit logs: ${err.message}</td></tr>`;
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-xs text-slate-400">No audit events match the selected criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map((log) => {
        const isAuth = log.action.includes('LOGIN');
        const isCreate = log.action.includes('CREATE');
        const isUpdate = log.action.includes('UPDATE') || log.action.includes('STATUS');
        const isUpload = log.action.includes('UPLOAD');

        const badgeClass = isAuth
          ? 'bg-blue-100 text-blue-800'
          : isCreate
          ? 'bg-emerald-100 text-emerald-800'
          : isUpload
          ? 'bg-purple-100 text-purple-800'
          : 'bg-amber-100 text-amber-800';

        const dateStr = log.created_at ? new Date(log.created_at).toLocaleString() : '—';

        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
          <td class="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">${dateStr}</td>
          <td class="p-3">
            <span class="font-bold text-slate-900">${log.admin_username || 'System'}</span>
            <span class="text-[10px] text-slate-400 block font-mono">ID: ${log.admin_id || '—'}</span>
          </td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${badgeClass}">
              ${log.action}
            </span>
          </td>
          <td class="p-3">
            <span class="text-slate-700 font-medium">${log.target_type || '—'}</span>
            ${log.target_id ? `<span class="text-[10px] font-mono text-slate-400 block">ID: ${log.target_id}</span>` : ''}
          </td>
          <td class="p-3 text-slate-600 max-w-xs break-words">
            ${log.details || '—'}
          </td>
          <td class="p-3 font-mono text-[11px] text-slate-400">
            ${log.ip_address || '127.0.0.1'}
          </td>
        </tr>
      `;
      })
      .join('');
  },

  renderPagination() {
    const container = document.getElementById('audit-pagination');
    if (!container) return;

    if (this.state.totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="flex items-center justify-between text-xs text-slate-500 py-3">
        <div>Page ${this.state.page} of ${this.state.totalPages}</div>
        <div class="flex items-center gap-1">
          <button 
            onclick="AuditLogManager.changePage(${this.state.page - 1})" 
            ${this.state.page <= 1 ? 'disabled class="px-2.5 py-1 rounded border border-slate-200 opacity-40 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"'}
          >
            Prev
          </button>
          <span class="px-2 font-mono font-bold text-slate-700">${this.state.page}</span>
          <button 
            onclick="AuditLogManager.changePage(${this.state.page + 1})" 
            ${this.state.page >= this.state.totalPages ? 'disabled class="px-2.5 py-1 rounded border border-slate-200 opacity-40 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"'}
          >
            Next
          </button>
        </div>
      </div>
    `;
  },

  changePage(newPage) {
    if (newPage < 1 || newPage > this.state.totalPages) return;
    this.state.page = newPage;
    this.fetchLogs();
  }
};

window.AuditLogManager = AuditLogManager;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('audit-tbody')) {
    AuditLogManager.init();
  }
});
