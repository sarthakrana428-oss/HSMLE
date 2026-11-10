/**
 * HSMLE India Corporation - Quotation (RFQ) Management
 * Manages B2B quotation submissions, product line items, status transitions,
 * and printable official quotation sheets.
 */

const QuotationManager = {
  state: {
    page: 1,
    limit: 15,
    search: '',
    status_filter: '',
    total: 0,
    totalPages: 1,
    currentRfqId: null,
    currentRfqData: null,
  },

  async init() {
    this.parseUrlParams();
    this.setupListeners();
    await this.fetchQuotations();
    const params = new URLSearchParams(window.location.search);
    if (params.get('open')) {
      await this.openDetailModal(parseInt(params.get('open'), 10));
      if (params.get('print_inline') === '1') {
        this.printQuotationSheet(true);
      }
    }
  },

  parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      this.state.search = searchParam;
      const input = document.getElementById('rfq-search');
      if (input) input.value = searchParam;
    }
  },

  setupListeners() {
    const searchInput = document.getElementById('rfq-search');
    if (searchInput) {
      let timer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this.state.search = e.target.value.trim();
          this.state.page = 1;
          this.fetchQuotations();
        }, 300);
      });
    }

    const statusSel = document.getElementById('filter-rfq-status');
    if (statusSel) {
      statusSel.addEventListener('change', (e) => {
        this.state.status_filter = e.target.value;
        this.state.page = 1;
        this.fetchQuotations();
      });
    }
  },

  async fetchQuotations() {
    const tbody = document.getElementById('rfq-tbody');
    const countDisplay = document.getElementById('rfq-count-display');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-xs text-slate-400">Loading quotations...</td></tr>`;

    try {
      const data = await window.AdminAPI.getQuotations({
        search: this.state.search,
        status_filter: this.state.status_filter,
        page: this.state.page,
        limit: this.state.limit,
      });

      this.state.total = data.total;
      this.state.totalPages = data.total_pages;

      if (countDisplay) {
        countDisplay.textContent = `Showing ${data.items.length} of ${data.total} quotations`;
      }

      this.renderTable(data.items);
      this.renderPagination();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-xs text-red-600">Failed to load quotations: ${err.message}</td></tr>`;
    }
  },

  renderTable(items) {
    const tbody = document.getElementById('rfq-tbody');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-xs text-slate-400">No quotation requests found.</td></tr>`;
      return;
    }

    tbody.innerHTML = items
      .map((r) => {
        const s = r.status.toLowerCase();
        const statusClass =
          s === 'pending' || s === 'new'
            ? 'bg-amber-100 text-amber-800'
            : s === 'reviewing'
            ? 'bg-blue-100 text-blue-800'
            : s === 'quoted'
            ? 'bg-purple-100 text-purple-800'
            : s === 'approved'
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-red-100 text-red-800';

        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
          <td class="p-3 font-mono font-bold text-blue-600 whitespace-nowrap">${r.rfq_number}</td>
          <td class="p-3">
            <div class="font-bold text-slate-900">${r.contact_person}</div>
            <div class="text-[11px] text-slate-500">${r.company_name}</div>
          </td>
          <td class="p-3">
            <a href="mailto:${r.email}" class="text-blue-600 hover:underline block">${r.email}</a>
            <span class="text-slate-500 font-mono text-[11px]">${r.phone}</span>
          </td>
          <td class="p-3">
            <span class="font-semibold text-slate-800">${r.items_count} Instruments</span>
            <span class="text-[10px] text-slate-400 block">${r.delivery_city || 'India'}</span>
          </td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusClass}">${r.status}</span>
          </td>
          <td class="p-3 text-slate-500 text-[11px] whitespace-nowrap">${r.created_at}</td>
          <td class="p-3 text-right">
            <button 
              onclick="QuotationManager.openDetailModal(${r.id})" 
              class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-xs transition shadow-sm"
            >
              Open RFQ
            </button>
          </td>
        </tr>
      `;
      })
      .join('');
  },

  renderPagination() {
    const container = document.getElementById('rfq-pagination');
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
            onclick="QuotationManager.changePage(${this.state.page - 1})" 
            ${this.state.page <= 1 ? 'disabled class="px-2.5 py-1 rounded border border-slate-200 opacity-40 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"'}
          >
            Prev
          </button>
          <span class="px-2 font-mono font-bold text-slate-700">${this.state.page}</span>
          <button 
            onclick="QuotationManager.changePage(${this.state.page + 1})" 
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
    this.fetchQuotations();
  },

  async openDetailModal(rfqId) {
    this.state.currentRfqId = rfqId;
    try {
      const r = await window.AdminAPI.getQuotation(rfqId);
      this.state.currentRfqData = r;

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '—';
      };

      setVal('modal-rfq-number', r.rfq_number);
      setVal('modal-rfq-company', r.company_name);
      setVal('modal-rfq-contact', r.contact_person);
      setVal('modal-rfq-email', r.email);
      setVal('modal-rfq-phone', r.phone);
      setVal('modal-rfq-location', `${r.delivery_city || '—'}, ${r.delivery_state || ''}`);
      setVal('modal-rfq-gst', r.gst_number || 'Not Provided');
      setVal('modal-rfq-sector', r.industry_sector || 'Industrial Manufacturing');
      setVal('modal-rfq-date', r.created_at);
      setVal('modal-rfq-target-date', r.target_delivery_date || 'Standard Commercial');
      setVal('modal-rfq-notes', r.requirements_notes || 'None specified');

      const statusSelect = document.getElementById('modal-rfq-status');
      if (statusSelect) statusSelect.value = r.status;

      const adminNotes = document.getElementById('modal-rfq-admin-notes');
      if (adminNotes) adminNotes.value = r.admin_notes || '';

      // Items table
      const itemsContainer = document.getElementById('modal-rfq-items');
      if (itemsContainer) {
        itemsContainer.innerHTML = r.items
          .map(
            (item, idx) => `
          <tr class="border-b border-slate-200 text-xs">
            <td class="p-2 font-mono text-slate-400">${idx + 1}</td>
            <td class="p-2">
              <div class="font-bold text-slate-900">${item.product_name}</div>
              <div class="text-[11px] font-mono text-blue-600">${item.model_number || 'Standard'}</div>
              ${item.customization_notes ? `<div class="text-[10px] text-slate-500 italic mt-0.5">Note: ${item.customization_notes}</div>` : ''}
            </td>
            <td class="p-2 text-center font-bold text-slate-900 font-mono">${item.quantity}</td>
          </tr>
        `
          )
          .join('');
      }

      document.getElementById('rfq-detail-modal').classList.remove('hidden');
    } catch (err) {
      if (window.showAdminToast) {
        window.showAdminToast(`Failed to load RFQ: ${err.message}`, 'error');
      }
    }
  },

  closeDetailModal() {
    document.getElementById('rfq-detail-modal').classList.add('hidden');
  },

  async handleStatusUpdate(e) {
    e.preventDefault();
    const status = document.getElementById('modal-rfq-status').value;
    const notes = document.getElementById('modal-rfq-admin-notes').value.trim();

    try {
      await window.AdminAPI.updateQuotation(this.state.currentRfqId, status, notes);
      if (window.showAdminToast) {
        window.showAdminToast('Quotation status and notes updated', 'success');
      }
      this.closeDetailModal();
      this.fetchQuotations();
    } catch (err) {
      if (window.showAdminToast) {
        window.showAdminToast(`Update failed: ${err.message}`, 'error');
      }
    }
  },

  printQuotationSheet(inline = false) {
    const r = this.state.currentRfqData;
    if (!r) return;

    const printWin = inline ? window : window.open('', '_blank');
    const itemsHtml = r.items
      .map(
        (i, idx) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">
          <strong>${i.product_name}</strong><br>
          <span style="font-family: monospace; font-size: 11px; color: #2563eb;">Model: ${i.model_number || 'Standard'}</span>
          ${i.customization_notes ? `<br><small style="color: #64748b;">${i.customization_notes}</small>` : ''}
        </td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">${i.quantity}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right; color: #64748b;">As per Techno-Commercial Offer</td>
      </tr>
    `
      )
      .join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>HSMLE Quotation - ${r.rfq_number}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #0f172a; padding: 40px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 25px; }
          .title { font-size: 20px; font-weight: bold; color: #0f172a; }
          .badge { display: inline-block; background: #eff6ff; color: #1d4ed8; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #0f172a; color: white; padding: 10px 8px; border: 1px solid #0f172a; font-size: 12px; }
          .footer { margin-top: 50px; display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 20px; font-size: 11px; color: #64748b; }
          @media print { button { display: none; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <div style="text-align: right; margin-bottom: 15px;">
          <button onclick="window.print()" style="padding: 6px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Print / Save as PDF</button>
        </div>
        <div class="header">
          <div>
            <div class="title">HSMLE INDIA CORPORATION</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">ISO 9001:2015 Certified Manufacturer & Supplier</div>
            <div style="font-size: 11px; color: #64748b;">UGF-12, Ansal Plaza-1, Chiranjeev Vihar, Ghaziabad - 201002, UP</div>
            <div style="font-size: 11px; color: #64748b;">Tel: 0120-4017357 | Email: info@hsmleindia.com</div>
          </div>
          <div style="text-align: right;">
            <div class="badge">OFFICIAL QUOTATION ENQUIRY</div>
            <div style="font-size: 16px; font-weight: bold; font-family: monospace; margin-top: 8px;">${r.rfq_number}</div>
            <div style="font-size: 11px; color: #64748b;">Date: ${r.created_at}</div>
          </div>
        </div>

        <div class="grid">
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px;">
            <strong style="display: block; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 8px; font-size: 11px; text-transform: uppercase; color: #64748b;">Client Details</strong>
            <div><strong>Company:</strong> ${r.company_name}</div>
            <div><strong>Contact Person:</strong> ${r.contact_person}</div>
            <div><strong>Email:</strong> ${r.email}</div>
            <div><strong>Phone:</strong> ${r.phone}</div>
            <div><strong>GSTIN:</strong> ${r.gst_number || 'N/A'}</div>
          </div>

          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px;">
            <strong style="display: block; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 8px; font-size: 11px; text-transform: uppercase; color: #64748b;">Delivery & Terms</strong>
            <div><strong>Destination:</strong> ${r.delivery_city || '—'}, ${r.delivery_state || ''}</div>
            <div><strong>Sector:</strong> ${r.industry_sector || 'Industrial'}</div>
            <div><strong>Target Date:</strong> ${r.target_delivery_date || 'Standard'}</div>
            <div><strong>Status:</strong> ${r.status}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px;">Item</th>
              <th style="text-align: left;">Testing Machine Description & Model</th>
              <th style="width: 80px;">Qty</th>
              <th style="width: 200px; text-align: right;">Commercial Terms</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        ${
          r.requirements_notes
            ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 25px;">
                <strong>Client Technical Specifications & Customization Notes:</strong>
                <p style="margin: 5px 0 0 0; color: #475569;">${r.requirements_notes}</p>
              </div>`
            : ''
        }

        <div class="footer">
          <div>
            <strong>HSMLE Works Facility:</strong> Khasra No. 1250, Near Morta Bijlighar, Pillar No. 663, Meerut Road, Ghaziabad-201003, Uttar Pradesh<br>
            All machines subject to HSMLE standard 12-month industrial warranty and FAT protocol.
          </div>
          <div style="text-align: right; width: 200px;">
            <div style="height: 40px;"></div>
            <div style="border-top: 1px solid #0f172a; padding-top: 5px; font-weight: bold;">Authorized Signatory</div>
            <div style="font-size: 10px;">HSMLE India Corporation</div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
  },
};

window.QuotationManager = QuotationManager;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('rfq-tbody')) {
    QuotationManager.init();
  }
});
