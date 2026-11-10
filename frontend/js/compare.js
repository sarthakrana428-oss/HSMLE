/**
 * HSMLE India Corporation - Product Comparison Module
 * Supports comparing up to 4 machines side-by-side with aligned specification matrices,
 * difference highlighting, and quick RFQ actions.
 */

const COMPARE_STORAGE_KEY = 'hsmle_compare_ids_v1';
const MAX_COMPARE_LIMIT = 4;

const CompareManager = {
  getIds() {
    try {
      const data = localStorage.getItem(COMPARE_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse compare list:', e);
      return [];
    }
  },

  saveIds(ids) {
    try {
      localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(ids));
      this.updateTray();
    } catch (e) {
      console.error('Failed to save compare list:', e);
    }
  },

  toggle(productId, productName = '') {
    const id = parseInt(productId, 10);
    const ids = this.getIds();
    const index = ids.indexOf(id);

    if (index > -1) {
      ids.splice(index, 1);
      this.saveIds(ids);
      if (window.showToast) {
        window.showToast(`Removed from comparison`, 'info');
      }
    } else {
      if (ids.length >= MAX_COMPARE_LIMIT) {
        if (window.showToast) {
          window.showToast(`You can compare a maximum of ${MAX_COMPARE_LIMIT} products simultaneously`, 'warning');
        }
        return false;
      }
      ids.push(id);
      this.saveIds(ids);
      if (window.showToast) {
        window.showToast(`Added to comparison (${ids.length}/${MAX_COMPARE_LIMIT})`, 'success');
      }
    }

    this.updateCompareCheckboxes();
    return true;
  },

  remove(productId) {
    const id = parseInt(productId, 10);
    let ids = this.getIds();
    ids = ids.filter((i) => i !== id);
    this.saveIds(ids);
    this.updateCompareCheckboxes();
    // If on compare.html, re-render page
    if (window.location.pathname.includes('compare.html')) {
      this.renderComparePage();
    }
  },

  clear() {
    this.saveIds([]);
    this.updateCompareCheckboxes();
    if (window.location.pathname.includes('compare.html')) {
      this.renderComparePage();
    }
  },

  updateCompareCheckboxes() {
    document.querySelectorAll('.compare-toggle-btn, button[onclick*="CompareManager"]').forEach((btn) => {
      btn.remove();
    });
  },

  updateTray()updateTray() {
    const tray = document.getElementById('compare-tray');
    const trayCount = document.getElementById('compare-tray-count');
    if (!tray) return;

    const ids = this.getIds();
    if (ids.length > 0 && !window.location.pathname.includes('compare.html')) {
      tray.classList.add('active');
      if (trayCount) trayCount.textContent = ids.length;
    } else {
      tray.classList.remove('active');
    }
  },

  async renderComparePage() {
    const container = document.getElementById('compare-matrix-container');
    const emptyState = document.getElementById('compare-empty-state');
    const contentState = document.getElementById('compare-content-state');
    if (!container) return;

    // Check if IDs are in URL or LocalStorage
    const urlParams = new URLSearchParams(window.location.search);
    let idsParam = urlParams.get('ids');
    let ids = [];

    if (idsParam) {
      ids = idsParam
        .split(',')
        .map((i) => parseInt(i.trim(), 10))
        .filter((i) => !isNaN(i));
      this.saveIds(ids);
    } else {
      ids = this.getIds();
    }

    if (ids.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (contentState) contentState.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (contentState) contentState.classList.remove('hidden');

    container.innerHTML = `
      <div class="flex items-center justify-center py-20 text-slate-500">
        <svg class="animate-spin h-8 w-8 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Loading comparison specifications...
      </div>
    `;

    try {
      const data = await window.API.compareProducts(ids);
      const products = data.products || [];
      const specKeys = data.spec_keys || [];

      if (products.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        if (contentState) contentState.classList.add('hidden');
        return;
      }

      // Render Matrix Table
      let html = `
        <div class="overflow-x-auto  rounded-none border border-slate-200 bg-white">
          <table class="w-full border-collapse text-left">
            <thead>
              <tr class="bg-slate-900 text-white divide-x divide-slate-800">
                <th class="p-4 w-64 text-sm font-semibold sticky left-0 bg-slate-900 z-10">Specification Parameter</th>
                ${products
                  .map(
                    (p) => `
                  <th class="p-4 min-w-[240px] max-w-[280px] align-top bg-slate-900">
                    <div class="relative">
                      <button 
                        onclick="CompareManager.remove(${p.id})" 
                        class="absolute -top-1 -right-1 text-slate-400 hover:text-red-400 p-1"
                        title="Remove from comparison"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                      </button>
                      <div class="w-full h-44 bg-white rounded-none p-2 mb-3 flex items-center justify-center overflow-hidden -inner">
                        <img 
                          src="${window.API.resolveImageUrl(p.image_url)}" 
                          alt="${p.product_name}" 
                          class="w-full h-full object-contain"
                          onerror="this.onerror=null;this.src='/assets/images/product-placeholder.svg'"
                        >
                      </div>
                      <h3 class="text-sm font-bold text-white leading-tight mb-1 line-clamp-2">${p.product_name}</h3>
                      <p class="text-xs font-mono text-blue-400 mb-2">Model: ${p.model_number || 'Standard'}</p>
                      <span class="inline-block text-[11px] bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-none mb-3 truncate max-w-full">
                        ${p.category_name}
                      </span>
                      <div class="flex flex-col gap-1.5 mt-2">
                        <a 
                          href="product-detail.html?id=${p.id}" 
                          class="w-full text-center px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-none transition"
                        >
                          View Details
                        </a>
                        <button 
                          onclick="RFQ.addItem({id: ${p.id}, product_name: '${p.product_name.replace(/'/g, "\\'")}', model_number: '${(p.model_number || '').replace(/'/g, "\\'")}', image_url: '${p.image_url}'})" 
                          class="w-full text-center px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-none transition "
                        >
                          Request Quote
                        </button>
                      </div>
                    </div>
                  </th>
                `
                  )
                  .join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-sm text-slate-700">
              <!-- General Info Rows -->
              <tr class="bg-slate-50 font-semibold text-slate-900 divide-x divide-slate-200">
                <td class="p-3 sticky left-0 bg-slate-50 z-10">Division / Category</td>
                ${products.map((p) => `<td class="p-3">${p.category_name}</td>`).join('')}
              </tr>
              <tr class="divide-x divide-slate-200">
                <td class="p-3 font-medium text-slate-900 sticky left-0 bg-white z-10">Subcategory</td>
                ${products.map((p) => `<td class="p-3 text-slate-600">${p.subcategory_name || 'Standard'}</td>`).join('')}
              </tr>
              <tr class="divide-x divide-slate-200">
                <td class="p-3 font-medium text-slate-900 sticky left-0 bg-white z-10">Official Catalogue</td>
                ${products
                  .map(
                    (p) => `
                  <td class="p-3">
                    <a 
                      href="${window.API.resolvePdfDownloadUrl(p.id)}" 
                      target="_blank" 
                      class="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      <svg class="w-4 h-4 mr-1 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path>
                      </svg>
                      Download PDF
                    </a>
                  </td>
                `
                  )
                  .join('')}
              </tr>
              <tr class="divide-x divide-slate-200">
                <td class="p-3 font-medium text-slate-900 sticky left-0 bg-white z-10">Key Features Summary</td>
                ${products
                  .map(
                    (p) => `
                  <td class="p-3 text-xs text-slate-600">
                    ${
                      p.features && p.features.length > 0
                        ? `<ul class="list-disc pl-4 space-y-1">
                            ${p.features
                              .slice(0, 3)
                              .map((f) => `<li>${f.feature_text}</li>`)
                              .join('')}
                          </ul>`
                        : '<span class="text-slate-400">Standard features</span>'
                    }
                  </td>
                `
                  )
                  .join('')}
              </tr>
      `;

      // Technical Specifications Section
      if (specKeys.length > 0) {
        html += `
          <tr class="bg-blue-50 text-blue-900 font-bold uppercase text-xs tracking-wider">
            <td colspan="${products.length + 1}" class="p-3">Technical Specifications Matrix</td>
          </tr>
        `;

        specKeys.forEach((key, idx) => {
          const values = products.map((p) => p.aligned_specs[key] || '—');
          // Check if values differ across machines
          const uniqueValues = new Set(values.filter((v) => v !== '—'));
          const hasDiff = uniqueValues.size > 1;

          html += `
            <tr class="divide-x divide-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} spec-row" data-has-diff="${hasDiff}">
              <td class="p-3 font-medium text-slate-800 sticky left-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} z-10">
                ${key}
              </td>
              ${products
                .map((p) => {
                  const val = p.aligned_specs[key] || '—';
                  return `
                    <td class="p-3 text-slate-700 ${hasDiff ? 'diff-cell' : ''}">
                      ${val !== '—' ? val : '<span class="text-slate-300">—</span>'}
                    </td>
                  `;
                })
                .join('')}
            </tr>
          `;
        });
      } else {
        html += `
          <tr>
            <td colspan="${products.length + 1}" class="p-4 text-center text-slate-400">
              No detailed numerical specifications recorded for these specific models. Please refer to the official catalogues above.
            </td>
          </tr>
        `;
      }

      html += `
            </tbody>
          </table>
        </div>
      `;

      container.innerHTML = html;
      this.applyDifferenceHighlight();
    } catch (err) {
      container.innerHTML = `
        <div class="p-6 bg-red-50 text-red-700 rounded-none border border-red-200 text-center">
          <p class="font-bold">Error loading comparison data</p>
          <p class="text-sm mt-1">${err.message}</p>
          <button onclick="CompareManager.renderComparePage()" class="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-none text-xs font-semibold">Try Again</button>
        </div>
      `;
    }
  },

  applyDifferenceHighlight() {
    const highlightToggle = document.getElementById('toggle-differences');
    if (!highlightToggle) return;

    const showDiffs = highlightToggle.checked;
    document.querySelectorAll('.diff-cell').forEach((cell) => {
      if (showDiffs) {
        cell.classList.add('diff-highlight');
      } else {
        cell.classList.remove('diff-highlight');
      }
    });
  },
};

window.CompareManager = CompareManager;
document.addEventListener('DOMContentLoaded', () => {
  CompareManager.updateTray();
  CompareManager.updateCompareCheckboxes();

  const diffToggle = document.getElementById('toggle-differences');
  if (diffToggle) {
    diffToggle.addEventListener('change', () => {
      CompareManager.applyDifferenceHighlight();
    });
  }
});
