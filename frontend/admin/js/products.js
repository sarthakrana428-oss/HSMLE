/**
 * HSMLE India Corporation - All Machines Management
 * Handles listing, live search, division filters, pagination, creation,
 * editing, image/PDF uploads, and active state toggling.
 */

const ProductManager = {
  state: {
    page: 1,
    limit: 16,
    search: '',
    category_id: '',
    is_active: '',
    total: 0,
    totalPages: 1,
    categories: [],
    editingProductId: null,
    viewMode: 'grid', // 'grid' (square boxes) or 'table'
    cachedItems: [],
  },

  setViewMode(mode) {
    this.state.viewMode = mode;
    const btnGrid = document.getElementById('btn-view-grid');
    const btnTable = document.getElementById('btn-view-table');
    const gridContainer = document.getElementById('products-grid-container');
    const tableContainer = document.getElementById('products-table-container');

    if (mode === 'grid') {
      if (btnGrid) {
        btnGrid.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-blue-600 text-white shadow-xs';
      }
      if (btnTable) {
        btnTable.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900';
      }
      if (gridContainer) gridContainer.classList.remove('hidden');
      if (tableContainer) tableContainer.classList.add('hidden');
    } else {
      if (btnGrid) {
        btnGrid.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-slate-600 hover:text-slate-900';
      }
      if (btnTable) {
        btnTable.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-blue-600 text-white shadow-xs';
      }
      if (gridContainer) gridContainer.classList.add('hidden');
      if (tableContainer) tableContainer.classList.remove('hidden');
    }

    if (this.state.cachedItems && this.state.cachedItems.length > 0) {
      this.render(this.state.cachedItems);
    }
  },

  async init() {
    await this.loadCategoriesFilter();
    await this.fetchProducts();
    this.setupListeners();
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit')) {
      await this.openEditModal(parseInt(params.get('edit'), 10));
    } else if (params.get('add') === '1') {
      this.openAddModal();
    }
  },

  setupListeners() {
    const searchInput = document.getElementById('product-search');
    if (searchInput) {
      let timer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this.state.search = e.target.value.trim();
          this.state.page = 1;
          this.fetchProducts();
        }, 300);
      });
    }

    const catSelect = document.getElementById('filter-category');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.state.category_id = e.target.value;
        this.state.page = 1;
        this.fetchProducts();
      });
    }

    const statusSelect = document.getElementById('filter-status');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.state.is_active = e.target.value;
        this.state.page = 1;
        this.fetchProducts();
      });
    }
  },

  async loadCategoriesFilter() {
    try {
      this.state.categories = await window.AdminAPI.getCategories();
      const sel = document.getElementById('filter-category');
      const modalCat = document.getElementById('product-modal-category');

      const optionsHtml = this.state.categories
        .map((c) => `<option value="${c.id}">${c.name}</option>`)
        .join('');

      if (sel) {
        sel.innerHTML = '<option value="">All Divisions</option>' + optionsHtml;
      }
      if (modalCat) {
        modalCat.innerHTML = '<option value="">Select Division *</option>' + optionsHtml;
        modalCat.addEventListener('change', () => this.updateSubcategoryDropdown());
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  },

  updateSubcategoryDropdown(selectedSubId = null) {
    const catId = parseInt(document.getElementById('product-modal-category').value, 10);
    const subSel = document.getElementById('product-modal-subcategory');
    if (!subSel) return;

    const cat = this.state.categories.find((c) => c.id === catId);
    if (!cat || !cat.subcategories || cat.subcategories.length === 0) {
      subSel.innerHTML = '<option value="">Standard Subcategory</option>';
      return;
    }

    subSel.innerHTML = cat.subcategories
      .map(
        (s) => `<option value="${s.id}" ${s.id === selectedSubId ? 'selected' : ''}>${s.name}</option>`
      )
      .join('');
  },

  async fetchProducts() {
    const tbody = document.getElementById('products-tbody');
    const gridContainer = document.getElementById('products-grid-container');
    const countDisplay = document.getElementById('products-total-count');

    if (gridContainer && this.state.viewMode === 'grid') {
      gridContainer.innerHTML = `<div class="col-span-full p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">Loading machines...</div>`;
    }
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-xs text-slate-400">Loading machines...</td></tr>`;
    }

    try {
      const data = await window.AdminAPI.getProducts({
        search: this.state.search,
        category_id: this.state.category_id,
        is_active: this.state.is_active,
        page: this.state.page,
        limit: this.state.limit,
      });

      this.state.total = data.total;
      this.state.totalPages = data.total_pages;

      if (countDisplay) {
        countDisplay.textContent = `Showing ${data.items.length} of ${data.total} machines`;
      }

      this.render(data.items);
      this.renderPagination();
    } catch (err) {
      if (gridContainer) gridContainer.innerHTML = `<div class="col-span-full p-8 text-center text-xs text-red-600 bg-white rounded-2xl border border-red-200">Failed to load machines: ${err.message}</div>`;
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-xs text-red-600">Failed to load machines: ${err.message}</td></tr>`;
    }
  },

  render(items) {
    this.state.cachedItems = items || [];
    if (this.state.viewMode === 'grid') {
      this.renderGrid(items);
    } else {
      this.renderTable(items);
    }
  },

  renderGrid(items) {
    const container = document.getElementById('products-grid-container');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-sm font-bold text-slate-600">No testing machines match your search or filter.</p>
          <p class="text-xs text-slate-400 mt-1">Try clearing filters or search keywords.</p>
        </div>`;
      return;
    }

    const baseUrl = window.AdminAPI.getBaseUrl();

    container.innerHTML = items
      .map((p) => {
        const imgUrl = (p.image_url && p.image_url.startsWith('http')) ? p.image_url : `${baseUrl}${p.image_url || '/static/images/products/placeholder.jpg'}`;
        const isActive = p.is_active !== false;

        return `
        <div class="bg-white border-2 border-slate-200 hover:border-blue-600 rounded-2xl p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-xl group relative">
          <!-- Top Bar: Division Badge & Status Toggle -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 truncate max-w-[150px]" title="${p.category_name}">
              ${p.category_name}
            </span>
            <button 
              onclick="ProductManager.toggleStatus(${p.id})" 
              class="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider transition cursor-pointer ${
                isActive ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }"
              title="Click to toggle active status on public website"
            >
              ${isActive ? '● ACTIVE' : '○ INACTIVE'}
            </button>
          </div>

          <!-- Square Photo Box (Prominent & High Quality) -->
          <div class="w-full aspect-square bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-center relative overflow-hidden group-hover:bg-blue-50/20 transition mb-3">
            ${p.is_featured ? '<span class="absolute top-2 left-2 z-10 px-2 py-0.5 rounded text-[9px] font-black bg-amber-400 text-amber-950 shadow-xs">★ FEATURED</span>' : ''}
            <img 
              src="${imgUrl}" 
              alt="${p.product_name}" 
              class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
              onerror="this.onerror=null;this.src='/assets/images/product-placeholder.svg'"
            >
            <div class="absolute bottom-2 right-2 px-2 py-0.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono font-bold rounded">
              ID #${p.id}
            </div>
          </div>

          <!-- Machine Name & Model -->
          <div class="flex-1 flex flex-col justify-between mb-3">
            <div>
              <h3 class="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-blue-600 transition" title="${p.product_name}">
                ${p.product_name}
              </h3>
              <div class="flex items-center gap-1.5 mt-2">
                <span class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Model:</span>
                <span class="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 truncate max-w-[180px]">
                  ${p.model_number || 'Standard'}
                </span>
              </div>
            </div>
          </div>

          <!-- Bottom Action Buttons: Edit Machine & Catalogue Section & Small Delete Button -->
          <div class="pt-3 border-t border-slate-100 flex items-center gap-1.5">
            <button 
              onclick="ProductManager.openEditModal(${p.id})" 
              class="flex-1 py-2 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition text-center shadow-xs cursor-pointer flex items-center justify-center gap-1"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              <span>Edit Machine</span>
            </button>
            <a 
              href="${baseUrl}${p.catalogue_path}" 
              target="_blank" 
              class="flex-1 py-2 px-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition text-center shadow-xs cursor-pointer flex items-center justify-center gap-1"
              title="Open Official PDF Catalogue"
            >
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
              <span>Catalogue (${p.catalogue_pages || 2}p)</span>
            </a>
            <button 
              onclick="ProductManager.deleteProduct(${p.id}, '${(p.product_name || '').replace(/'/g, "\\'")}')" 
              class="p-2 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-300 rounded-xl transition text-center shadow-xs cursor-pointer flex items-center justify-center shrink-0"
              title="Delete Machine #${p.id}"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      `;
      })
      .join('');
  },

  renderTable(items) {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;

    if (items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-xs text-slate-400">No products match your search or filter.</td></tr>`;
      return;
    }

    const baseUrl = window.AdminAPI.getBaseUrl();

    tbody.innerHTML = items
      .map((p) => {
        const imgUrl = p.image_url.startsWith('http') ? p.image_url : `${baseUrl}${p.image_url}`;
        const isActive = p.is_active !== false;

        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
          <td class="p-3 w-16 text-center font-mono font-bold text-slate-700 text-xs">
            #${p.id}
          </td>
          <td class="p-3 w-16">
            <img 
              src="${imgUrl}" 
              alt="${p.product_name}" 
              class="w-12 h-12 object-contain bg-slate-50 rounded border border-slate-200 p-1"
              onerror="this.onerror=null;this.src='/assets/images/product-placeholder.svg'"
            >
          </td>
          <td class="p-3">
            <div class="font-bold text-slate-900 leading-snug">${p.product_name}</div>
            <div class="text-[11px] font-mono text-blue-600 mt-0.5">Model: ${p.model_number || 'Standard'}</div>
          </td>
          <td class="p-3">
            <span class="inline-block text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded ">
              ${p.category_name}
            </span>
          </td>
          <td class="p-3 text-center">
            ${
              p.is_featured
                ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">FEATURED</span>'
                : '<span class="text-slate-300 text-[11px]">—</span>'
            }
          </td>
          <td class="p-3 text-center">
            <button 
              onclick="ProductManager.toggleStatus(${p.id})" 
              class="px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                isActive ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }"
            >
              ${isActive ? 'ACTIVE' : 'INACTIVE'}
            </button>
          </td>
          <td class="p-3">
            <a 
              href="${baseUrl}${p.catalogue_path}" 
              target="_blank" 
              class="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-800 font-semibold"
            >
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path></svg>
              PDF (${p.catalogue_pages || 1}p)
            </a>
          </td>
          <td class="p-3 text-right whitespace-nowrap space-x-1.5">
            <button 
              onclick="ProductManager.openEditModal(${p.id})" 
              class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs"
            >
              Edit Machine
            </button>
            <a 
              href="${baseUrl}${p.catalogue_path}" 
              target="_blank" 
              class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Open Official Factory PDF Catalogue (${p.catalogue_pages || 2} pages)"
            >
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
              <span>Catalogue (${p.catalogue_pages || 2}p)</span>
            </a>
            <button 
              onclick="ProductManager.deleteProduct(${p.id}, '${(p.product_name || '').replace(/'/g, "\\'")}')" 
              class="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 hover:border-red-300 rounded-lg transition cursor-pointer shadow-xs inline-flex items-center justify-center align-middle"
              title="Delete Machine #${p.id}"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </td>
        </tr>
      `;
      })
      .join('');
  },

  renderPagination() {
    const container = document.getElementById('products-pagination');
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
            onclick="ProductManager.changePage(${this.state.page - 1})" 
            ${this.state.page <= 1 ? 'disabled class="px-2.5 py-1 rounded border border-slate-200 opacity-40 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold"'}
          >
            Prev
          </button>
          <span class="px-2 font-mono font-bold text-slate-700">${this.state.page}</span>
          <button 
            onclick="ProductManager.changePage(${this.state.page + 1})" 
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
    this.fetchProducts();
  },

  async toggleStatus(productId) {
    try {
      const res = await window.AdminAPI.toggleProductStatus(productId);
      if (window.showAdminToast) {
        window.showAdminToast(res.message, 'success');
      }
      this.fetchProducts();
    } catch (err) {
      if (window.showAdminToast) {
        window.showAdminToast(`Failed to toggle status: ${err.message}`, 'error');
      }
    }
  },

  async deleteProduct(productId, productName) {
    const nameStr = productName ? `"${productName}" (ID #${productId})` : `Machine #${productId}`;
    if (!confirm(`Are you sure you want to permanently delete ${nameStr}?\n\nThis will remove the machine, specifications, and catalogue association. This action cannot be undone.`)) {
      return;
    }

    try {
      await window.AdminAPI.deleteProduct(productId);
      if (window.showAdminToast) {
        window.showAdminToast(`Machine #${productId} deleted successfully`, 'success');
      }
      await this.fetchProducts();
    } catch (err) {
      if (window.showAdminToast) {
        window.showAdminToast(`Delete failed: ${err.message}`, 'error');
      } else {
        alert(`Delete failed: ${err.message}`);
      }
    }
  },

  async deleteCurrentModalProduct() {
    if (!this.state.editingProductId) return;
    const form = document.getElementById('product-form');
    const name = form ? (form.product_name ? form.product_name.value : '') : '';
    const id = this.state.editingProductId;
    this.closeModal();
    await this.deleteProduct(id, name);
  },

  // Simplified, Intuitive Add / Edit Modal with Image & Catalogue Upload
  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  handleImageFileChange(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('product-img-preview');
    const badge = document.getElementById('product-img-badge');
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (preview) preview.src = evt.target.result;
        if (badge) badge.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  },

  handleCatalogueFileChange(e) {
    const file = e.target.files[0];
    const badge = document.getElementById('product-catalogue-badge');
    const quickBtn = document.getElementById('btn-quick-upload-cat-products');
    if (file) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        alert('Please select a valid PDF file (.pdf)');
        e.target.value = '';
        if (badge) badge.textContent = '';
        if (quickBtn) quickBtn.classList.add('hidden');
        return;
      }
      if (badge) badge.textContent = `Ready: ${file.name} (${this.formatBytes(file.size)})`;
      if (quickBtn && this.state.editingProductId) quickBtn.classList.remove('hidden');
    } else {
      if (badge) badge.textContent = '';
      if (quickBtn) quickBtn.classList.add('hidden');
    }
  },

  async quickUploadCatalogue() {
    const id = this.state.editingProductId;
    const catInput = document.getElementById('product-catalogue-input');
    const file = catInput ? catInput.files[0] : null;
    if (!id || !file) return;

    const btn = document.getElementById('btn-quick-upload-cat-products');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    try {
      await window.AdminAPI.uploadProductCatalogue(id, file);
      if (window.showAdminToast) {
        window.showAdminToast('Catalogue PDF uploaded successfully!', 'success');
      }

      // Refresh product details
      const updated = await window.AdminAPI.getProduct(id);
      document.getElementById('product-catalogue-filename').textContent = updated.original_filename || updated.catalogue_path.split('/').pop();
      document.getElementById('product-catalogue-pages').textContent = `${updated.catalogue_pages || 2} Pages`;
      document.getElementById('product-catalogue-size').textContent = this.formatBytes(updated.catalogue_size_bytes);
      
      const catViewBtn = document.getElementById('product-catalogue-view-btn');
      if (catViewBtn && updated.catalogue_path) {
        const baseUrl = window.AdminAPI.getBaseUrl();
        catViewBtn.href = updated.catalogue_path.startsWith('http') ? updated.catalogue_path : baseUrl + updated.catalogue_path;
        catViewBtn.classList.remove('opacity-50', 'pointer-events-none');
      }

      catInput.value = '';
      document.getElementById('product-catalogue-badge').textContent = '✓ Successfully uploaded!';
      btn.classList.add('hidden');
      this.fetchProducts();
    } catch (err) {
      alert('Failed to upload catalogue: ' + (err.message || err));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Upload PDF Now';
    }
  },

  toggleAdvancedOptions() {
    const panel = document.getElementById('advanced-options-panel');
    const arrow = document.getElementById('adv-arrow-text');
    if (panel) {
      panel.classList.toggle('hidden');
      if (arrow) arrow.textContent = panel.classList.contains('hidden') ? '▶' : '▼';
    }
  },

  openAddModal() {
    this.state.editingProductId = null;
    document.getElementById('product-modal-title').textContent = 'Add New Testing Instrument';
    const form = document.getElementById('product-form');
    if (form) form.reset();

    // Reset image preview
    const preview = document.getElementById('product-img-preview');
    const badge = document.getElementById('product-img-badge');
    const fileInput = document.getElementById('product-img-input');
    if (preview) preview.src = '/assets/images/product-placeholder.svg';
    if (badge) badge.classList.add('hidden');
    if (fileInput) fileInput.value = '';

    // Reset catalogue
    const catInput = document.getElementById('product-catalogue-input');
    const catBadge = document.getElementById('product-catalogue-badge');
    const catName = document.getElementById('product-catalogue-filename');
    const catPages = document.getElementById('product-catalogue-pages');
    const catSize = document.getElementById('product-catalogue-size');
    const catViewBtn = document.getElementById('product-catalogue-view-btn');
    const catQuickBtn = document.getElementById('btn-quick-upload-cat-products');
    if (catInput) catInput.value = '';
    if (catBadge) catBadge.textContent = '';
    if (catName) catName.textContent = 'None attached';
    if (catPages) catPages.textContent = '0 Pages';
    if (catSize) catSize.textContent = '0 KB';
    if (catViewBtn) catViewBtn.classList.add('opacity-50', 'pointer-events-none');
    if (catQuickBtn) catQuickBtn.classList.add('hidden');

    // Reset features and specs
    const featText = document.getElementById('product-features-text');
    if (featText) featText.value = '';
    const specsContainer = document.getElementById('specs-container');
    if (specsContainer) {
      specsContainer.innerHTML = '';
      this.addSpecRow();
    }

    // Collapse advanced panel by default
    const advPanel = document.getElementById('advanced-options-panel');
    const advArrow = document.getElementById('adv-arrow-text');
    if (advPanel) advPanel.classList.add('hidden');
    if (advArrow) advArrow.textContent = '▶';

    // Hide modal delete button for add mode
    const btnDel = document.getElementById('btn-delete-product-modal');
    if (btnDel) btnDel.classList.add('hidden');

    document.getElementById('product-modal').classList.remove('hidden');
  },

  async openEditModal(productId) {
    this.state.editingProductId = productId;

    // Show modal delete button for edit mode
    const btnDel = document.getElementById('btn-delete-product-modal');
    if (btnDel) btnDel.classList.remove('hidden');

    try {
      const p = await window.AdminAPI.getProduct(productId);
      document.getElementById('product-modal-title').textContent = `Edit Instrument: ${p.product_name}`;
      const form = document.getElementById('product-form');

      form.product_name.value = p.product_name || '';
      form.model_number.value = p.model_number || '';
      if (form.all_detected_models) form.all_detected_models.value = p.all_detected_models || '';
      form.category_id.value = p.category_id || '';
      this.updateSubcategoryDropdown(p.subcategory_id);
      form.description.value = p.description || '';
      form.is_featured.checked = !!p.is_featured;
      form.is_active.checked = p.is_active !== false;
      if (form.meta_title) form.meta_title.value = p.meta_title || '';
      if (form.meta_description) form.meta_description.value = p.meta_description || '';

      // Set photo preview to existing machine photo
      const preview = document.getElementById('product-img-preview');
      const badge = document.getElementById('product-img-badge');
      const fileInput = document.getElementById('product-img-input');
      if (fileInput) fileInput.value = '';
      if (badge) badge.classList.add('hidden');

      if (preview) {
        const baseUrl = window.AdminAPI.getBaseUrl();
        const imgUrl = (p.image_url && p.image_url.startsWith('http')) 
          ? p.image_url 
          : `${baseUrl}${p.image_url || '/assets/images/product-placeholder.svg'}`;
        preview.src = imgUrl;
      }

      // Populate catalogue status
      const catInput = document.getElementById('product-catalogue-input');
      const catBadge = document.getElementById('product-catalogue-badge');
      const catName = document.getElementById('product-catalogue-filename');
      const catPages = document.getElementById('product-catalogue-pages');
      const catSize = document.getElementById('product-catalogue-size');
      const catViewBtn = document.getElementById('product-catalogue-view-btn');
      const catQuickBtn = document.getElementById('btn-quick-upload-cat-products');

      if (catInput) catInput.value = '';
      if (catBadge) catBadge.textContent = '';
      if (catQuickBtn) catQuickBtn.classList.add('hidden');

      if (catName) {
        catName.textContent = p.original_filename || (p.catalogue_path ? p.catalogue_path.split('/').pop() : 'Standard Catalogue PDF');
      }
      if (catPages) {
        catPages.textContent = `${p.catalogue_pages || 2} Pages`;
      }
      if (catSize) {
        catSize.textContent = this.formatBytes(p.catalogue_size_bytes);
      }
      if (catViewBtn) {
        const baseUrl = window.AdminAPI.getBaseUrl();
        if (p.catalogue_path) {
          catViewBtn.href = p.catalogue_path.startsWith('http') ? p.catalogue_path : baseUrl + p.catalogue_path;
          catViewBtn.classList.remove('opacity-50', 'pointer-events-none');
        } else {
          catViewBtn.href = '#';
          catViewBtn.classList.add('opacity-50', 'pointer-events-none');
        }
      }

      // Populate features textarea
      const featText = document.getElementById('product-features-text');
      if (featText) {
        if (p.features && p.features.length > 0) {
          featText.value = p.features.map(f => (typeof f === 'string' ? f : f.feature_text)).join('\n');
        } else {
          featText.value = '';
        }
      }

      // Populate specs
      const specsContainer = document.getElementById('specs-container');
      if (specsContainer) {
        specsContainer.innerHTML = '';
        if (p.specifications && p.specifications.length > 0) {
          p.specifications.forEach((s) => this.addSpecRow(s.spec_key, s.spec_value));
        } else {
          this.addSpecRow();
        }
      }

      // Keep advanced collapsed by default
      const advPanel = document.getElementById('advanced-options-panel');
      const advArrow = document.getElementById('adv-arrow-text');
      if (advPanel) advPanel.classList.add('hidden');
      if (advArrow) advArrow.textContent = '▶';

      document.getElementById('product-modal').classList.remove('hidden');
    } catch (err) {
      if (window.showAdminToast) {
        window.showAdminToast(`Failed to load product details: ${err.message}`, 'error');
      }
    }
  },

  closeModal() {
    document.getElementById('product-modal').classList.add('hidden');
  },

  addSpecRow(key = '', val = '') {
    const container = document.getElementById('specs-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 spec-row mb-1.5';
    row.innerHTML = `
      <input type="text" placeholder="Parameter (e.g. Test Load)" value="${key.replace(/"/g, '&quot;')}" class="spec-key w-1/2 px-2.5 py-1.5 text-xs border border-slate-300 focus:outline-none focus:border-blue-600 bg-white">
      <input type="text" placeholder="Value (e.g. 60, 100, 150 kgf)" value="${val.replace(/"/g, '&quot;')}" class="spec-val w-1/2 px-2.5 py-1.5 text-xs border border-slate-300 focus:outline-none focus:border-blue-600 bg-white">
      <button type="button" onclick="this.parentElement.remove()" class="text-slate-400 hover:text-red-500 p-1 font-bold">✕</button>
    `;
    container.appendChild(row);
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = document.getElementById('btn-save-product') || form.querySelector('button[type="submit"]');

    // Collect specs
    const specs = [];
    document.querySelectorAll('.spec-row').forEach((row) => {
      const k = row.querySelector('.spec-key').value.trim();
      const v = row.querySelector('.spec-val').value.trim();
      if (k && v) specs.push({ spec_key: k, spec_value: v });
    });

    // Collect features from multi-line box
    const featRaw = document.getElementById('product-features-text') ? document.getElementById('product-features-text').value : '';
    const features = featRaw.split('\n').map(s => s.trim()).filter(Boolean);

    const payload = {
      product_name: form.product_name.value.trim(),
      model_number: form.model_number.value.trim(),
      all_detected_models: (form.all_detected_models && form.all_detected_models.value.trim()) || null,
      category_id: parseInt(form.category_id.value, 10),
      subcategory_id: parseInt(form.subcategory_id.value, 10) || 1,
      description: form.description.value.trim() || null,
      is_featured: form.is_featured.checked,
      is_active: form.is_active.checked,
      meta_title: (form.meta_title && form.meta_title.value.trim()) || null,
      meta_description: (form.meta_description && form.meta_description.value.trim()) || null,
      specifications: specs,
      features: features,
    };

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving Instrument...';

      let targetId = this.state.editingProductId;
      if (targetId) {
        await window.AdminAPI.updateProduct(targetId, payload);
      } else {
        const created = await window.AdminAPI.createProduct(payload);
        targetId = created.id;
      }

      // If a new image file was chosen, upload it now
      const fileInput = document.getElementById('product-img-input');
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        submitBtn.textContent = 'Uploading Photo...';
        await window.AdminAPI.uploadProductImage(targetId, fileInput.files[0]);
      }

      // If a new catalogue PDF was chosen, upload it now
      const catInput = document.getElementById('product-catalogue-input');
      if (catInput && catInput.files && catInput.files.length > 0) {
        submitBtn.textContent = 'Uploading Catalogue PDF...';
        await window.AdminAPI.uploadProductCatalogue(targetId, catInput.files[0]);
      }

      if (window.showAdminToast) {
        window.showAdminToast('Instrument, Photo & Catalogue saved successfully!', 'success');
      }

      this.closeModal();
      this.fetchProducts();
    } catch (err) {
      if (window.showAdminToast) window.showAdminToast(`Error: ${err.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Instrument';
    }
  },

  // Upload Photo Modal
  openUploadImageModal(productId, productName) {
    this.state.uploadTargetId = productId;
    document.getElementById('upload-img-product-name').textContent = productName;
    document.getElementById('upload-img-file').value = '';
    document.getElementById('upload-img-modal').classList.remove('hidden');
  },

  closeUploadImageModal() {
    document.getElementById('upload-img-modal').classList.add('hidden');
  },

  async handleImageUpload(e) {
    e.preventDefault();
    const fileInput = document.getElementById('upload-img-file');
    const file = fileInput.files[0];
    if (!file) return;

    const btn = e.target.querySelector('button[type="submit"]');
    try {
      btn.disabled = true;
      btn.textContent = 'Uploading...';
      const res = await window.AdminAPI.uploadProductImage(this.state.uploadTargetId, file);
      if (window.showAdminToast) window.showAdminToast('Machine photo updated successfully', 'success');
      this.closeUploadImageModal();
      this.fetchProducts();
    } catch (err) {
      if (window.showAdminToast) window.showAdminToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Upload Image';
    }
  },

  // Upload Catalogue Modal
  openUploadCatalogueModal(productId, productName) {
    this.state.uploadTargetId = productId;
    document.getElementById('upload-pdf-product-name').textContent = productName;
    document.getElementById('upload-pdf-file').value = '';
    document.getElementById('upload-pdf-modal').classList.remove('hidden');
  },

  closeUploadCatalogueModal() {
    document.getElementById('upload-pdf-modal').classList.add('hidden');
  },

  async handleCatalogueUpload(e) {
    e.preventDefault();
    const fileInput = document.getElementById('upload-pdf-file');
    const file = fileInput.files[0];
    if (!file) return;

    const btn = e.target.querySelector('button[type="submit"]');
    try {
      btn.disabled = true;
      btn.textContent = 'Uploading PDF...';
      const res = await window.AdminAPI.uploadProductCatalogue(this.state.uploadTargetId, file);
      if (window.showAdminToast) window.showAdminToast('Catalogue PDF updated successfully', 'success');
      this.closeUploadCatalogueModal();
      this.fetchProducts();
    } catch (err) {
      if (window.showAdminToast) window.showAdminToast(`Upload failed: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Upload PDF';
    }
  },

  // 30-Second Product Video Controls
  async openVideoModal(productId, productName) {
    this.state.currentVideoId = productId;
    const nameEl = document.getElementById('video-modal-product-name');
    const badgeEl = document.getElementById('video-modal-status-badge');
    const playerEl = document.getElementById('video-player-el');
    const emptyState = document.getElementById('video-empty-state');
    const spinner = document.getElementById('video-render-spinner');
    const genBtn = document.getElementById('video-generate-btn');
    const delBtn = document.getElementById('video-delete-btn');

    if (nameEl) nameEl.textContent = productName;
    if (badgeEl) {
      badgeEl.textContent = 'Checking...';
      badgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 font-mono';
    }
    if (playerEl) {
      playerEl.pause();
      playerEl.src = '';
      playerEl.classList.add('hidden');
    }
    if (emptyState) emptyState.classList.remove('hidden');
    if (spinner) spinner.classList.add('hidden');
    if (delBtn) delBtn.classList.add('hidden');

    document.getElementById('product-video-modal').classList.remove('hidden');

    try {
      const data = await window.AdminAPI.getVideoStatus(productId);
      if (data.has_video && data.video_url) {
        if (badgeEl) {
          badgeEl.textContent = `1080p HD • ${data.file_size_mb} MB`;
          badgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono';
        }
        if (emptyState) emptyState.classList.add('hidden');
        if (playerEl) {
          playerEl.src = `${window.AdminAPI.getBaseUrl()}${data.video_url}?t=${Date.now()}`;
          playerEl.classList.remove('hidden');
        }
        if (genBtn) genBtn.innerHTML = '<span>Regenerate Video</span>';
        if (delBtn) delBtn.classList.remove('hidden');
      } else {
        if (badgeEl) {
          badgeEl.textContent = 'Not Generated';
          badgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 font-mono';
        }
        if (genBtn) genBtn.innerHTML = '<span>Generate 30s HD Video</span>';
      }
    } catch (e) {
      if (badgeEl) badgeEl.textContent = 'Check Failed';
    }
  },

  closeVideoModal() {
    const playerEl = document.getElementById('video-player-el');
    if (playerEl) {
      playerEl.pause();
      playerEl.src = '';
    }
    document.getElementById('product-video-modal').classList.add('hidden');
  },

  async generateCurrentVideo() {
    const pid = this.state.currentVideoId;
    if (!pid) return;

    const spinner = document.getElementById('video-render-spinner');
    const genBtn = document.getElementById('video-generate-btn');
    const delBtn = document.getElementById('video-delete-btn');

    try {
      if (spinner) spinner.classList.remove('hidden');
      if (genBtn) genBtn.disabled = true;
      if (delBtn) delBtn.disabled = true;

      const res = await window.AdminAPI.generateProductVideo(pid, true);
      if (window.showAdminToast) window.showAdminToast('30-second broadcast video generated successfully!', 'success');
      
      this.openVideoModal(pid, document.getElementById('video-modal-product-name').textContent);
      this.fetchProducts();
    } catch (err) {
      if (window.showAdminToast) window.showAdminToast(`Generation error: ${err.message}`, 'error');
    } finally {
      if (spinner) spinner.classList.add('hidden');
      if (genBtn) genBtn.disabled = false;
      if (delBtn) delBtn.disabled = false;
    }
  },

  async deleteCurrentVideo() {
    const pid = this.state.currentVideoId;
    if (!pid || !confirm('Are you sure you want to delete this generated product video?')) return;

    try {
      await window.AdminAPI.deleteProductVideo(pid);
      if (window.showAdminToast) window.showAdminToast('Video successfully deleted.', 'info');
      this.closeVideoModal();
      this.fetchProducts();
    } catch (err) {
      if (window.showAdminToast) window.showAdminToast(`Delete error: ${err.message}`, 'error');
    }
  },

  // Batch Video Generator Controls
  openBatchVideoModal() {
    document.getElementById('batch-video-modal').classList.remove('hidden');
    this.pollBatchStatus();
  },

  closeBatchVideoModal() {
    document.getElementById('batch-video-modal').classList.add('hidden');
    if (this._batchTimer) {
      clearInterval(this._batchTimer);
      this._batchTimer = null;
    }
  },

  async startBatchGeneration() {
    const startBtn = document.getElementById('batch-start-btn');
    try {
      if (startBtn) startBtn.disabled = true;
      const res = await window.AdminAPI.startBatchVideoGeneration();
      if (window.showAdminToast) window.showAdminToast(res.message || 'Batch video generation started.', 'info');
      this.pollBatchStatus();
    } catch (err) {
      if (window.showAdminToast) window.showAdminToast(`Error: ${err.message}`, 'error');
      if (startBtn) startBtn.disabled = false;
    }
  },

  async pollBatchStatus() {
    if (this._batchTimer) clearInterval(this._batchTimer);

    const updateUI = async () => {
      try {
        const s = await window.AdminAPI.getBatchVideoStatus();
        const statusEl = document.getElementById('batch-status-text');
        const progressEl = document.getElementById('batch-progress-text');
        const barEl = document.getElementById('batch-progress-bar');
        const machineEl = document.getElementById('batch-current-machine');
        const startBtn = document.getElementById('batch-start-btn');

        if (statusEl) {
          statusEl.textContent = s.is_running ? 'Generating in Background...' : (s.completed > 0 ? 'Completed' : 'Idle');
          statusEl.className = `font-bold font-mono ${s.is_running ? 'text-blue-600' : (s.completed > 0 ? 'text-emerald-600' : 'text-slate-800')}`;
        }
        if (progressEl) {
          progressEl.textContent = `${s.completed + s.failed} / ${s.total} (${s.progress_percent || 0}%)`;
        }
        if (barEl) {
          barEl.style.width = `${s.progress_percent || 0}%`;
        }
        if (machineEl) {
          machineEl.textContent = s.is_running ? `Currently processing: ${s.current_name || 'Machine #' + s.current_id}` : (s.completed > 0 ? `Done: ${s.completed} videos rendered (${s.failed} failed)` : 'Ready to start batch generation');
        }
        if (startBtn) {
          startBtn.disabled = s.is_running;
          startBtn.textContent = s.is_running ? 'Processing Queue...' : 'Start Batch Generation';
        }

        if (!s.is_running && this._batchTimer) {
          clearInterval(this._batchTimer);
          this._batchTimer = null;
          this.fetchProducts();
        }
      } catch (e) {
        console.warn('Batch status polling error:', e);
      }
    };

    await updateUI();
    this._batchTimer = setInterval(updateUI, 2500);
  }
};

window.ProductManager = ProductManager;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('products-tbody')) {
    ProductManager.init();
  }
});
