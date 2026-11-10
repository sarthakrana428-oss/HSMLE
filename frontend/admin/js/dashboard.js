/**
 * HSMLE India Corporation - Admin Dashboard Script
 * Fetches real-time database KPIs, generates charts, and renders recent activity tables.
 */

const Dashboard = {
  async init() {
    try {
      const stats = await window.AdminAPI.getStats();
      this.renderKpis(stats);
      this.renderCharts(stats);
      this.renderRecentTables(stats);
    } catch (err) {
      if (window.showAdminToast) {
        window.showAdminToast(`Failed to load dashboard statistics: ${err.message}`, 'error');
      }
    }
  },

  renderKpis(s) {
    const setElem = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setElem('kpi-total-products', s.total_products);
    setElem('kpi-total-categories', s.total_categories);
    setElem('kpi-total-subcategories', s.total_subcategories);
    setElem('kpi-total-catalogues', s.total_catalogues);
    setElem('kpi-total-enquiries', s.total_enquiries);
    setElem('kpi-new-enquiries', s.new_enquiries);
    setElem('kpi-total-quotations', s.total_quotations);
    setElem('kpi-pending-quotations', s.pending_quotations);
  },

  renderCharts(s) {
    const chartContainer = document.getElementById('chart-category-distribution');
    if (!chartContainer) return;

    const data = s.category_distribution || [];
    if (data.length === 0) {
      chartContainer.innerHTML = '<p class="text-xs text-slate-400 py-4">No category data available</p>';
      return;
    }

    const maxCount = Math.max(...data.map(d => d.product_count), 1);

    chartContainer.innerHTML = data.map(item => {
      const pct = Math.round((item.product_count / maxCount) * 100);
      return `
        <div class="space-y-1">
          <div class="flex justify-between text-xs">
            <span class="font-medium text-slate-700 truncate pr-2">${item.name}</span>
            <span class="font-mono text-slate-900 font-bold">${item.product_count}</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div class="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderRecentTables(s) {
    // Recent Enquiries
    const enqTbody = document.getElementById('recent-enquiries-tbody');
    if (enqTbody) {
      const enqs = s.recent_enquiries || [];
      if (enqs.length === 0) {
        enqTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-xs text-slate-400">No enquiries recorded yet</td></tr>';
      } else {
        enqTbody.innerHTML = enqs.map(e => `
          <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
            <td class="p-3 font-mono font-bold text-blue-600">${e.enquiry_number}</td>
            <td class="p-3 font-semibold text-slate-900">${e.full_name} <span class="text-slate-400 font-normal">(${e.company_name})</span></td>
            <td class="p-3 text-slate-600 truncate max-w-[150px]">${e.product_name}</td>
            <td class="p-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                e.status.toLowerCase() === 'new' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
              }">${e.status}</span>
            </td>
            <td class="p-3 text-right">
              <a href="enquiries.html?search=${encodeURIComponent(e.enquiry_number)}" class="text-blue-600 hover:text-blue-800 font-semibold">View</a>
            </td>
          </tr>
        `).join('');
      }
    }

    // Recent RFQs
    const rfqTbody = document.getElementById('recent-rfqs-tbody');
    if (rfqTbody) {
      const rfqs = s.recent_quotations || [];
      if (rfqs.length === 0) {
        rfqTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-xs text-slate-400">No RFQs recorded yet</td></tr>';
      } else {
        rfqTbody.innerHTML = rfqs.map(r => `
          <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
            <td class="p-3 font-mono font-bold text-blue-600">${r.rfq_number}</td>
            <td class="p-3 font-semibold text-slate-900">${r.contact_person} <span class="text-slate-400 font-normal">(${r.company_name})</span></td>
            <td class="p-3 text-slate-600 font-mono">${r.items_count} Machines</td>
            <td class="p-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                r.status.toLowerCase() === 'pending' || r.status.toLowerCase() === 'new' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }">${r.status}</span>
            </td>
            <td class="p-3 text-right">
              <a href="quotations.html?search=${encodeURIComponent(r.rfq_number)}" class="text-blue-600 hover:text-blue-800 font-semibold">View</a>
            </td>
          </tr>
        `).join('');
      }
    }
  }
};

window.Dashboard = Dashboard;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('kpi-total-products')) {
    Dashboard.init();
  }
});
