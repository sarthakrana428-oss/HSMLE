/**
 * HSMLE India Corporation - Enquiry Lead Management
 * Displays client enquiries, status transitions, and internal notes.
 */

const EnquiryManager = {
  state: {
    page: 1,
    limit: 15,
    search: '',
    status_filter: '',
    total: 0,
    totalPages: 1,
    currentEnquiryId: null,
  },

  async init() {
    this.parseUrlParams();
    this.setupListeners();
    await this.fetchEnquiries();
    const params = new URLSearchParams(window.location.search);
    if (params.get('open')) {
      await this.openDetailModal(parseInt(params.get('open'), 10));
    }
  },

  parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      this.state.search = searchParam;
      const input = document.getElementById('enquiry-search');
      if (input) input.value = searchParam;
    }
  },

  setupListeners() {
    const searchInput = document.getElementById('enquiry-search');
    if (searchInput) {
      let timer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this.state.search = e.target.value.trim();
          this.state.page = 1;
          this.fetchEnquiries();
        }, 300);
      });
    }

    const statusSel = document.getElementById('filter-enquiry-status');
    if (statusSel) {
      statusSel.addEventListener('change', (e) => {
        this.state.status_filter = e.target.value;
        this.state.page = 1;
        this.fetchEnquiries();
      });
    }
  },

  async fetchEnquiries() {
    const tbody = document.getElementById('enquiries-tbody');
    const countDisplay = document.getElementById('enquiries-count-display');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-xs text-slate-400">Loading enquiries...</td></tr>`;

    try {
      const data = await window.AdminAPI.getEnquiries({
        search: this.state.search,
        status_filter: this.state.status_filter,
        page: this.state.page,
        limit: this.state.limit,
      });

      this.state.total = data.total;
      this.state.totalPages = data.total_pages;

      if (countDisplay) {
        countDisplay.textContent = `Showing ${data.items.length} of ${data.total} enquiries`;
      }

      this.renderTable(data.items);
      this.renderPagination();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-xs text-red-600">Failed to load enquiries: ${err.message}</td></tr>`;
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('enquiries-tbody');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-xs text-slate-400">No enquiries found.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map((e) => {
        const statusClass =
          e.status.toLowerCase() === 'new'
            ? 'bg-amber-100 text-amber-800'
            : e.status.toLowerCase() === 'contacted'
            ? 'bg-blue-100 text-blue-800'
            : e.status.toLowerCase() === 'in progress'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-emerald-100 text-emerald-800';

        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
          <td class="p-3 font-mono font-bold text-blue-600 whitespace-nowrap">${e.enquiry_number}</td>
          <td class="p-3">
            <div class="font-bold text-slate-900">${e.full_name}</div>
            <div class="text-[11px] text-slate-500">${e.company_name}</div>
          </td>
          <td class="p-3">
            <a href="mailto:${e.email}" class="text-blue-600 hover:underline block">${e.email}</a>
            <span class="text-slate-500 font-mono text-[11px]">${e.phone}</span>
          </td>
          <td class="p-3">
            <span class="font-medium text-slate-800 truncate block max-w-[180px]">${e.product_name || 'General'}</span>
            ${e.model_number ? `<span class="text-[10px] font-mono text-slate-400 block">${e.model_number}</span>` : ''}
          </td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusClass}">${e.status}</span>
          </td>
          <td class="p-3 text-slate-500 text-[11px] whitespace-nowrap">${e.created_at}</td>
          <td class="p-3 text-right">
            <button 
              onclick="EnquiryManager.openDetailModal(${e.id})" 
              class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-xs transition shadow-sm"
            >
              Open
            </button>
          </td>
        </tr>
      `;
      })
      .join('');
  },

  renderPagination() {
    const container = document.getElementById('enquiries-pagination');
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
            onclick="EnquiryManager.changePage(${this.state.page - 1})" 
            ${this.state.page <= 1 ? 'disabled class="px-2.5 py-1 rounded border border-slate-200 opacity-40 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"'}
          >
            Prev
          </button>
          <span class="px-2 font-mono font-bold text-slate-700">${this.state.page}</span>
          <button 
            onclick="EnquiryManager.changePage(${this.state.page + 1})" 
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
    this.fetchEnquiries();
  },

  async openDetailModal(enquiryId) {
    this.state.currentEnquiryId = enquiryId;
    try {
      const e = await window.AdminAPI.getEnquiry(enquiryId);
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '—';
      };

      setVal('modal-enq-number', e.enquiry_number);
      setVal('modal-enq-name', e.full_name);
      setVal('modal-enq-company', e.company_name);
      setVal('modal-enq-email', e.email);
      setVal('modal-enq-phone', e.phone);
      setVal('modal-enq-location', `${e.city || ''}, ${e.country || 'India'}`);
      setVal('modal-enq-subject', e.subject);
      setVal('modal-enq-product', `${e.product_name || 'General Enquiry'} ${e.model_number ? `(${e.model_number})` : ''}`);
      setVal('modal-enq-message', e.message);
      setVal('modal-enq-date', e.created_at);

      const statusSelect = document.getElementById('modal-enq-status');
      if (statusSelect) statusSelect.value = e.status;

      const notesInput = document.getElementById('modal-enq-notes');
      if (notesInput) notesInput.value = e.admin_notes || '';

      document.getElementById('enquiry-detail-modal').classList.remove('hidden');
    } catch (err) {
      if (window.showAdminToast) {
        window.showAdminToast(`Failed to load enquiry: ${err.message}`, 'error');
      }
    }
  },

  closeDetailModal() {
    document.getElementById('enquiry-detail-modal').classList.add('hidden');
  },

  async handleStatusUpdate(e) {
    e.preventDefault();
    const status = document.getElementById('modal-enq-status').value;
    const notes = document.getElementById('modal-enq-notes').value.trim();

    try {
      await window.AdminAPI.updateEnquiry(this.state.currentEnquiryId, status, notes);
      if (window.showAdminToast) {
        window.showAdminToast('Enquiry status and notes updated', 'success');
      }
      this.closeDetailModal();
      this.fetchEnquiries();
    } catch (err) {
      if (window.showAdminToast) {
        window.showAdminToast(`Update failed: ${err.message}`, 'error');
      }
    }
  },
};

window.EnquiryManager = EnquiryManager;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('enquiries-tbody')) {
    EnquiryManager.init();
  }
});
