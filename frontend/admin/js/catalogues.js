/**
 * HSMLE India Corporation - Machine Catalogue Manager
 * In-Portal Search, Live PDF Preview, Quick Replacement & Audit.
 */

const CatalogueManager = {
  state: {
    page: 1,
    limit: 24,
    search: '',
    category_id: '',
    pages_filter: '',
    status: 'active',
    viewMode: 'grid',
    total: 0,
    totalPages: 1,
    cachedItems: [],
    categories: []
  },

  async init() {
    // 1. Authenticate
    if (window.AdminAPI && window.AdminAPI.checkAuth) {
      const user = window.AdminAPI.checkAuth();
      if (!user) return;
    }

    // 2. Setup Listeners
    this.setupListeners();

    // 3. Load Categories
    await this.loadCategories();

    // 4. Initial Fetch
    await this.fetchCatalogues();
  },

  setupListeners() {
    // Search input with debounce
    const searchInput = document.getElementById('catalogue-search');
    if (searchInput) {
      let timer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          this.state.search = e.target.value.trim();
          this.state.page = 1;
          this.fetchCatalogues();
        }, 300);
      });
    }

    // Category filter
    const catFilter = document.getElementById('filter-category');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        this.state.category_id = e.target.value;
        this.state.page = 1;
        this.fetchCatalogues();
      });
    }

    // Pages filter
    const pagesFilter = document.getElementById('filter-pages');
    if (pagesFilter) {
      pagesFilter.addEventListener('change', (e) => {
        this.state.pages_filter = e.target.value;
        this.state.page = 1;
        this.fetchCatalogues();
      });
    }

    // Status filter
    const statusFilter = document.getElementById('filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.state.status = e.target.value;
        this.state.page = 1;
        this.fetchCatalogues();
      });
    }
  },

  async loadCategories() {
    try {
      const res = await window.AdminAPI.getCategories();
      this.state.categories = Array.isArray(res) ? res : (res.items || []);
      const select = document.getElementById('filter-category');
      if (!select) return;

      select.innerHTML = '<option value="">All Divisions & Categories</option>' +
        this.state.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    } catch (err) {
      console.warn('Failed to load categories:', err);
    }
  },

  setViewMode(mode) {
    this.state.viewMode = mode;
    this.state.limit = mode === 'grid' ? 24 : 50;

    const btnGrid = document.getElementById('btn-view-grid');
    const btnTable = document.getElementById('btn-view-table');
    const gridContainer = document.getElementById('catalogues-grid-container');
    const tableContainer = document.getElementById('catalogues-table-container');

    if (mode === 'grid') {
      btnGrid.className = 'p-1.5 rounded-lg text-slate-700 transition cursor-pointer bg-white shadow-xs font-bold text-xs flex items-center gap-1.5 px-3';
      btnTable.className = 'p-1.5 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer font-bold text-xs flex items-center gap-1.5 px-3';
      gridContainer.classList.remove('hidden');
      tableContainer.classList.add('hidden');
    } else {
      btnTable.className = 'p-1.5 rounded-lg text-slate-700 transition cursor-pointer bg-white shadow-xs font-bold text-xs flex items-center gap-1.5 px-3';
      btnGrid.className = 'p-1.5 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer font-bold text-xs flex items-center gap-1.5 px-3';
      tableContainer.classList.remove('hidden');
      gridContainer.classList.add('hidden');
    }

    this.render(this.state.cachedItems);
  },

  async refreshData() {
    if (window.showAdminToast) window.showAdminToast('Refreshing catalogues...', 'info');
    await this.fetchCatalogues();
  },

  async fetchCatalogues() {
    const gridContainer = document.getElementById('catalogues-grid-container');
    const tableBody = document.getElementById('catalogues-tbody');

    if (this.state.viewMode === 'grid' && gridContainer) {
      gridContainer.innerHTML = '<div class="col-span-full py-16 text-center text-xs font-bold text-slate-400">Loading verified machine catalogues...</div>';
    } else if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-xs text-slate-400">Loading verified machine catalogues...</td></tr>';
    }

    try {
      const params = {
        page: this.state.page,
        limit: this.state.limit
      };

      if (this.state.search) params.search = this.state.search;
      if (this.state.category_id) params.category_id = this.state.category_id;
      if (this.state.status === 'active') params.is_active = true;
      if (this.state.status === 'inactive') params.is_active = false;

      const data = await window.AdminAPI.getProducts(params);
      let items = data.items || [];

      // Optional client-side filter by exact page count
      if (this.state.pages_filter) {
        const pNum = parseInt(this.state.pages_filter, 10);
        items = items.filter(p => (p.catalogue_pages || 2) === pNum);
      }

      this.state.total = data.total || items.length;
      this.state.totalPages = data.total_pages || Math.ceil(this.state.total / this.state.limit) || 1;
      this.state.cachedItems = items;

      // Update Header total badge
      const headerBadge = document.getElementById('header-total-badge');
      if (headerBadge) headerBadge.textContent = `${this.state.total} Catalogues`;

      this.render(items);
      this.renderPagination();
    } catch (err) {
      console.error('Failed to fetch catalogues:', err);
      if (gridContainer) {
        gridContainer.innerHTML = `<div class="col-span-full py-12 text-center text-xs text-red-500 font-bold">Failed to load catalogues: ${err.message}</div>`;
      }
    }
  },

  render(items) {
    if (this.state.viewMode === 'grid') {
      this.renderGrid(items);
    } else {
      this.renderTable(items);
    }
  },

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '350 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },

  renderGrid(items) {
    const container = document.getElementById('catalogues-grid-container');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-sm font-bold text-slate-600">No factory catalogues match your search or filter.</p>
          <p class="text-xs text-slate-400 mt-1">Try clearing filters or search keywords.</p>
        </div>`;
      return;
    }

    const baseUrl = window.AdminAPI.getBaseUrl();

    container.innerHTML = items
      .map((p) => {
        const imgUrl = (p.image_url && p.image_url.startsWith('http')) 
          ? p.image_url 
          : `${baseUrl}${p.image_url || '/assets/images/product-placeholder.svg'}`;
        const catUrl = (p.catalogue_path && p.catalogue_path.startsWith('http')) 
          ? p.catalogue_path 
          : `${baseUrl}${p.catalogue_path || '#'}`;
        const pages = p.catalogue_pages || 2;
        const sizeStr = this.formatBytes(p.catalogue_size_bytes);
        const fileName = (p.catalogue_path || '').split('/').pop() || 'official-catalogue.pdf';
        const isActive = p.is_active !== false;

        return `
        <div class="bg-white border border-slate-200 hover:border-slate-400 rounded-2xl p-4 shadow-xs hover:shadow-md transition flex flex-col justify-between group">
          <div>
            <!-- Top Badges: Category & Status -->
            <div class="flex items-center justify-between gap-1 mb-2.5">
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded truncate max-w-[170px]" title="${p.category_name || 'Metrology Instrument'}">
                ${p.category_name || 'Industrial Metrology'}
              </span>
              <span class="text-[9px] font-bold px-2 py-0.5 rounded ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
                ${isActive ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>

            <!-- Square Image Container with Watermark & Machine ID -->
            <div class="relative w-full aspect-square bg-slate-50 border border-slate-200 rounded-xl overflow-hidden mb-3 flex items-center justify-center p-2 group-hover:bg-slate-100/50 transition">
              <!-- Watermark -->
              <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div class="border border-amber-500/60 p-2 rotate-[-15deg] flex items-center gap-1 bg-white/40 backdrop-blur-xs">
                  <span class="text-[10px] font-black text-amber-600 tracking-wider">HSMLE</span>
                </div>
              </div>

              <!-- Product Image -->
              <img 
                src="${imgUrl}" 
                alt="${p.product_name}" 
                class="w-full h-full object-contain relative z-10 transition duration-300 group-hover:scale-105"
                loading="lazy"
                onerror="this.src='${baseUrl}/static/images/products/product_1.jpg'"
              >

              <!-- Official Machine ID Badge (Matching User Portal) -->
              <div class="absolute bottom-2 right-2 bg-slate-900/90 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded shadow-sm z-20">
                ID #${p.id}
              </div>

              <!-- Page Count Ribbon -->
              <div class="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm z-20 flex items-center gap-1">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
                <span>${pages}P PDF</span>
              </div>
            </div>

            <!-- Product Title & Model -->
            <h4 class="font-bold text-xs text-slate-900 line-clamp-2 leading-snug mb-1 group-hover:text-blue-600 transition" title="${p.product_name}">
              ${p.product_name}
            </h4>
            <div class="text-[11px] font-mono text-slate-500 mb-2 truncate">
              MODEL: <span class="font-bold text-slate-800">${p.model_number || 'N/A'}</span>
            </div>

            <!-- PDF Metadata Box -->
            <div class="p-2 bg-slate-50 border border-slate-200 rounded-lg mb-3">
              <div class="flex items-center justify-between text-[11px] mb-1">
                <div class="flex items-center gap-1.5 text-red-600 font-bold truncate">
                  <svg class="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
                  <span class="truncate font-mono text-[10px] text-slate-700" title="${fileName}">${fileName}</span>
                </div>
              </div>
              <div class="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                <span>Verified PDF Binary</span>
                <span class="font-mono">${sizeStr}</span>
              </div>
            </div>
          </div>

          <!-- Direct In-Portal Action Buttons -->
          <div class="pt-3 border-t border-slate-100 flex items-center gap-1.5">
            <button 
              onclick="CatalogueManager.openPreview(${p.id})" 
              class="flex-1 py-2 px-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition text-center shadow-xs cursor-pointer flex items-center justify-center gap-1"
              title="Preview official PDF catalogue inside portal"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              <span>Preview PDF</span>
            </button>
            <button 
              onclick="CatalogueManager.openUploadModal(${p.id})" 
              class="p-2 bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-300 rounded-xl transition text-center shadow-xs cursor-pointer flex items-center justify-center shrink-0"
              title="Upload replacement PDF catalogue"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            </button>
            <a 
              href="products.html?edit=${p.id}" 
              class="p-2 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-xl transition text-center shadow-xs cursor-pointer flex items-center justify-center shrink-0"
              title="Edit machine specs in inventory"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </a>
          </div>
        </div>
      `;
      })
      .join('');
  },

  renderTable(items) {
    const tbody = document.getElementById('catalogues-tbody');
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="p-8 text-center text-xs text-slate-400">No factory catalogues match your search or filter.</td></tr>';
      return;
    }

    const baseUrl = window.AdminAPI.getBaseUrl();

    tbody.innerHTML = items
      .map((p) => {
        const imgUrl = (p.image_url && p.image_url.startsWith('http')) 
          ? p.image_url 
          : `${baseUrl}${p.image_url || '/assets/images/product-placeholder.svg'}`;
        const pages = p.catalogue_pages || 2;
        const sizeStr = this.formatBytes(p.catalogue_size_bytes);
        const fileName = (p.catalogue_path || '').split('/').pop() || 'official-catalogue.pdf';
        const isActive = p.is_active !== false;

        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition text-xs">
          <td class="p-3 w-16 text-center font-mono font-bold text-slate-700">
            #${p.id}
          </td>
          <td class="p-3 w-20">
            <div class="w-12 h-12 bg-white rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center p-1">
              <img src="${imgUrl}" alt="${p.product_name}" class="w-full h-full object-contain" loading="lazy">
            </div>
          </td>
          <td class="p-3">
            <div class="font-bold text-slate-900">${p.product_name}</div>
            <div class="font-mono text-[11px] text-slate-500 mt-0.5">MODEL: <span class="font-bold text-slate-800">${p.model_number || 'N/A'}</span></div>
          </td>
          <td class="p-3">
            <span class="px-2 py-0.5 bg-slate-100 text-slate-700 font-semibold text-[10px] rounded">
              ${p.category_name || 'Industrial Metrology'}
            </span>
          </td>
          <td class="p-3">
            <div class="flex items-center gap-1.5 text-red-600 font-bold">
              <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
              <span class="font-mono text-[11px] text-slate-800 truncate max-w-xs" title="${fileName}">${fileName}</span>
            </div>
            <div class="flex items-center gap-2 text-[10px] text-slate-400 mt-1 font-semibold">
              <span class="px-1.5 py-0.2 bg-red-100 text-red-800 rounded font-bold">${pages} Pages</span>
              <span>•</span>
              <span class="font-mono">${sizeStr}</span>
            </div>
          </td>
          <td class="p-3 text-center">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
              ${isActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </td>
          <td class="p-3 text-right whitespace-nowrap space-x-1.5">
            <button 
              onclick="CatalogueManager.openPreview(${p.id})" 
              class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
              title="Preview PDF inside portal"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              <span>Preview</span>
            </button>
            <button 
              onclick="CatalogueManager.openUploadModal(${p.id})" 
              class="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-300 font-bold text-xs rounded-lg transition inline-flex items-center gap-1 cursor-pointer shadow-xs"
              title="Upload replacement PDF"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              <span>Replace</span>
            </button>
          </td>
        </tr>
        `;
      })
      .join('');
  },

  renderPagination() {
    const container = document.getElementById('catalogues-pagination');
    if (!container) return;

    if (this.state.totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="flex items-center justify-between text-xs text-slate-500 py-3">
        <div>Page ${this.state.page} of ${this.state.totalPages} (${this.state.total} total instruments)</div>
        <div class="flex items-center gap-1">
          <button 
            onclick="CatalogueManager.changePage(${this.state.page - 1})" 
            class="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition"
            ${this.state.page <= 1 ? 'disabled' : ''}
          >
            ← Previous
          </button>
          <span class="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800">
            ${this.state.page}
          </span>
          <button 
            onclick="CatalogueManager.changePage(${this.state.page + 1})" 
            class="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition"
            ${this.state.page >= this.state.totalPages ? 'disabled' : ''}
          >
            Next →
          </button>
        </div>
      </div>
    `;
  },

  changePage(newPage) {
    if (newPage < 1 || newPage > this.state.totalPages) return;
    this.state.page = newPage;
    this.fetchCatalogues();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // ----------------------------------------------------
  // In-Portal Live PDF Preview Modal
  // ----------------------------------------------------
  openPreview(productId) {
    const p = this.state.cachedItems.find(item => item.id === productId);
    if (!p) return;

    const baseUrl = window.AdminAPI.getBaseUrl();
    const pdfUrl = (p.catalogue_path && p.catalogue_path.startsWith('http')) 
      ? p.catalogue_path 
      : `${baseUrl}${p.catalogue_path}`;

    document.getElementById('pdf-modal-title').textContent = p.product_name;
    document.getElementById('pdf-modal-id-badge').textContent = `ID #${p.id}`;
    document.getElementById('pdf-modal-pages-badge').textContent = `${p.catalogue_pages || 2} Pages`;
    
    const fileName = (p.catalogue_path || '').split('/').pop() || 'catalogue.pdf';
    document.getElementById('pdf-modal-filename').textContent = `File: ${fileName} • Model: ${p.model_number || 'N/A'}`;

    // Setup iframe src
    const iframe = document.getElementById('pdf-preview-iframe');
    if (iframe) iframe.src = pdfUrl;

    // Setup Download & Replace buttons
    const downloadBtn = document.getElementById('pdf-modal-download-btn');
    if (downloadBtn) {
      downloadBtn.href = pdfUrl;
    }

    const replaceBtn = document.getElementById('pdf-modal-replace-btn');
    if (replaceBtn) {
      replaceBtn.onclick = () => {
        this.closePreviewModal();
        this.openUploadModal(p.id);
      };
    }

    document.getElementById('pdf-preview-modal').classList.remove('hidden');
  },

  closePreviewModal() {
    const modal = document.getElementById('pdf-preview-modal');
    if (modal) modal.classList.add('hidden');
    const iframe = document.getElementById('pdf-preview-iframe');
    if (iframe) iframe.src = 'about:blank';
  },

  // ----------------------------------------------------
  // Quick Upload / Replace Catalogue PDF Modal
  // ----------------------------------------------------
  openUploadModal(productId) {
    const p = this.state.cachedItems.find(item => item.id === productId);
    if (!p) return;

    document.getElementById('upload-target-id').value = p.id;
    document.getElementById('upload-modal-machine-name').textContent = `Machine #${p.id}: ${p.product_name} (${p.model_number || 'N/A'})`;

    const fileName = (p.catalogue_path || '').split('/').pop() || 'official-catalogue.pdf';
    document.getElementById('upload-modal-current-file').textContent = fileName;
    document.getElementById('upload-modal-current-pages').textContent = `${p.catalogue_pages || 2} Pages`;

    // Reset form
    const fileInput = document.getElementById('upload-pdf-file-input');
    if (fileInput) fileInput.value = '';
    const badge = document.getElementById('upload-selected-file-badge');
    if (badge) badge.classList.add('hidden');
    const submitBtn = document.getElementById('btn-upload-submit');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Upload & Publish PDF</span>';
    }

    document.getElementById('upload-pdf-modal').classList.remove('hidden');
  },

  closeUploadModal() {
    const modal = document.getElementById('upload-pdf-modal');
    if (modal) modal.classList.add('hidden');
  },

  onFileSelected(e) {
    const file = e.target.files[0];
    const badge = document.getElementById('upload-selected-file-badge');
    const nameEl = document.getElementById('upload-selected-filename');
    const submitBtn = document.getElementById('btn-upload-submit');

    if (!file) {
      if (badge) badge.classList.add('hidden');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      alert('Security Policy: Only genuine factory PDF documents (.pdf) are allowed.');
      e.target.value = '';
      if (badge) badge.classList.add('hidden');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert('File too large: Maximum allowed catalogue size is 25MB.');
      e.target.value = '';
      if (badge) badge.classList.add('hidden');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    if (nameEl) nameEl.textContent = `Selected: ${file.name} (${this.formatBytes(file.size)})`;
    if (badge) badge.classList.remove('hidden');
    if (submitBtn) submitBtn.disabled = false;
  },

  async handleUploadSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('upload-target-id').value;
    const fileInput = document.getElementById('upload-pdf-file-input');
    const file = fileInput ? fileInput.files[0] : null;

    if (!id || !file) {
      alert('Please select a valid PDF file.');
      return;
    }

    const btn = document.getElementById('btn-upload-submit');
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      <span>Uploading PDF...</span>
    `;

    try {
      await window.AdminAPI.uploadProductCatalogue(id, file);
      if (window.showAdminToast) {
        window.showAdminToast(`Catalogue for Machine #${id} uploaded & published successfully!`, 'success');
      }
      this.closeUploadModal();
      await this.fetchCatalogues();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
      btn.disabled = false;
      btn.innerHTML = '<span>Upload & Publish PDF</span>';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  CatalogueManager.init();
});
