/**
 * HSMLE India Corporation - Catalogue & Product Directory
 * Handles live search, category and subcategory filtering, grid vs list view,
 * pagination, sorting, and state synchronization.
 */

const Catalog = {
  state: {
    categorySlug: null,
    subcategorySlug: null,
    search: '',
    page: 1,
    limit: 12,
    viewMode: 'grid', // 'grid' | 'list'
    total: 0,
    totalPages: 1,
    categoriesData: [],
  },

  debounceTimer: null,

  async init() {
    this.parseUrlParams();
    this.setupEventListeners();
    await this.loadCategoriesFilter();
    await this.fetchAndRenderProducts();
  },

  parseUrlParams() {
    const params = new URLSearchParams(window.location.search);
    this.state.categorySlug = params.get('category') || null;
    this.state.subcategorySlug = params.get('subcategory') || null;
    this.state.search = params.get('search') || '';
    this.state.page = parseInt(params.get('page'), 10) || 1;
    this.state.viewMode = params.get('view') || localStorage.getItem('hsmle_view_mode') || 'grid';

    // Populate search input if set
    const searchInput = document.getElementById('catalog-search-input');
    if (searchInput && this.state.search) {
      searchInput.value = this.state.search;
    }
  },

  updateUrlParams() {
    const params = new URLSearchParams();
    if (this.state.categorySlug) params.set('category', this.state.categorySlug);
    if (this.state.subcategorySlug) params.set('subcategory', this.state.subcategorySlug);
    if (this.state.search) params.set('search', this.state.search);
    if (this.state.page > 1) params.set('page', this.state.page);
    if (this.state.viewMode !== 'grid') params.set('view', this.state.viewMode);

    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  },

  setupEventListeners() {
    // Search input with live debouncing
    const searchInput = document.getElementById('catalog-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          const query = e.target.value.trim();
          this.state.search = query;
          this.state.page = 1;

          // When searching for an equipment keyword, automatically search across all divisions
          // so the user is never trapped in an unrelated category with 0 matching machines!
          if (query && (this.state.categorySlug || this.state.subcategorySlug)) {
            this.state.categorySlug = null;
            this.state.subcategorySlug = null;
            this.state.autoExpandedNotice = false;
            this.loadCategoriesFilter();
          }

          this.updateUrlParams();
          this.fetchAndRenderProducts();
        }, 300);
      });

      const clearSearchBtn = document.getElementById('clear-search-btn');
      if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
          searchInput.value = '';
          this.state.search = '';
          this.state.page = 1;
          this.updateUrlParams();
          this.fetchAndRenderProducts();
        });
      }
    }

    // Grid vs List view toggle
    const gridBtn = document.getElementById('view-grid-btn');
    const listBtn = document.getElementById('view-list-btn');

    if (gridBtn && listBtn) {
      gridBtn.addEventListener('click', () => {
        this.setViewMode('grid');
      });
      listBtn.addEventListener('click', () => {
        this.setViewMode('list');
      });
    }

    // Reset Filters button
    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetFilters();
      });
    }
  },

  setViewMode(mode) {
    this.state.viewMode = mode;
    localStorage.setItem('hsmle_view_mode', mode);
    this.updateUrlParams();
    this.updateViewButtons();
    this.renderProductsLayout();
  },

  updateViewButtons() {
    const gridBtn = document.getElementById('view-grid-btn');
    const listBtn = document.getElementById('view-list-btn');
    if (!gridBtn || !listBtn) return;

    if (this.state.viewMode === 'grid') {
      gridBtn.classList.add('bg-blue-600', 'text-white');
      gridBtn.classList.remove('bg-white', 'text-slate-600');
      listBtn.classList.remove('bg-blue-600', 'text-white');
      listBtn.classList.add('bg-white', 'text-slate-600');
    } else {
      listBtn.classList.add('bg-blue-600', 'text-white');
      listBtn.classList.remove('bg-white', 'text-slate-600');
      gridBtn.classList.remove('bg-blue-600', 'text-white');
      gridBtn.classList.add('bg-white', 'text-slate-600');
    }
  },

  resetFilters() {
    this.state.categorySlug = null;
    this.state.subcategorySlug = null;
    this.state.search = '';
    this.state.page = 1;
    this.state.autoExpandedNotice = false;

    const searchInput = document.getElementById('catalog-search-input');
    if (searchInput) searchInput.value = '';

    this.updateUrlParams();
    this.highlightActiveCategory();
    this.fetchAndRenderProducts();
  },

  clearCategoryFilter() {
    this.state.categorySlug = null;
    this.state.subcategorySlug = null;
    this.state.page = 1;
    this.state.autoExpandedNotice = false;
    this.updateUrlParams();
    this.loadCategoriesFilter();
    this.fetchAndRenderProducts();
  },

  clearSubcategoryFilter() {
    this.state.subcategorySlug = null;
    this.state.page = 1;
    this.state.autoExpandedNotice = false;
    this.updateUrlParams();
    this.loadCategoriesFilter();
    this.fetchAndRenderProducts();
  },

  clearSearchFilter() {
    this.state.search = '';
    this.state.page = 1;
    this.state.autoExpandedNotice = false;
    const searchInput = document.getElementById('catalog-search-input');
    if (searchInput) searchInput.value = '';
    this.updateUrlParams();
    this.fetchAndRenderProducts();
  },

  async loadCategoriesFilter() {
    const container = document.getElementById('category-filter-sidebar');
    if (!container) return;

    try {
      this.state.categoriesData = await window.API.getCategories();
      const totalMachines = (this.state.categoriesData || []).reduce(
        (sum, cat) => sum + (cat.total_products || 0),
        0
      );
      const totalDivisions = (this.state.categoriesData || []).length;

      let html = `
        <div class="mb-2">
          <button 
            onclick="Catalog.selectCategory(null)" 
            class="w-full text-left px-3 py-2 rounded-none border border-slate-900 text-xs font-semibold flex items-center justify-between transition ${
              !this.state.categorySlug ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
            }"
            id="cat-btn-all"
          >
            <span>All ${totalDivisions} Divisions</span>
            <span class="text-[11px] px-2 py-0.5 rounded-none ${!this.state.categorySlug ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'} font-mono font-bold">${totalMachines}</span>
          </button>
        </div>
        <div class="space-y-1">
      `;

      this.state.categoriesData.forEach((cat) => {
        const isCatActive = this.state.categorySlug === cat.slug;
        html += `
          <div class="border border-slate-900 rounded-none border border-slate-900 overflow-hidden mb-1">
            <button 
              onclick="Catalog.selectCategory('${cat.slug}')" 
              class="w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between transition ${
                isCatActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }"
            >
              <span class="truncate pr-2">${cat.name}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-none ${isCatActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'} font-mono">${cat.total_products}</span>
            </button>
            ${
              cat.subcategories && cat.subcategories.length > 0
                ? `
              <div class="pl-3 pr-2 py-1 bg-slate-50/50 space-y-0.5 border-t border-slate-900 ${isCatActive ? '' : 'hidden'}" id="subcats-${cat.slug}">
                ${cat.subcategories
                  .map((sub) => {
                    const isSubActive = this.state.subcategorySlug === sub.slug;
                    return `
                    <button 
                      onclick="Catalog.selectSubcategory('${cat.slug}', '${sub.slug}')" 
                      class="w-full text-left px-2 py-1 text-[11px] rounded-none transition flex items-center justify-between ${
                        isSubActive ? 'bg-blue-600 text-white font-semibold' : 'text-slate-600 hover:text-blue-600 hover:bg-white'
                      }"
                    >
                      <span class="truncate pr-1">• ${sub.name}</span>
                      <span class="text-[10px] ${isSubActive ? 'text-blue-100' : 'text-slate-400'} font-mono">${sub.product_count}</span>
                    </button>
                  `;
                  })
                  .join('')}
              </div>
            `
                : ''
            }
          </div>
        `;
      });

      html += `</div>`;
      container.innerHTML = html;
      this.highlightActiveCategory();
    } catch (err) {
      console.error('Failed to load categories filter:', err);
    }
  },

  selectCategory(slug) {
    this.state.categorySlug = slug;
    this.state.subcategorySlug = null;
    this.state.page = 1;
    this.updateUrlParams();
    this.loadCategoriesFilter();
    this.fetchAndRenderProducts();
  },

  selectSubcategory(catSlug, subSlug) {
    this.state.categorySlug = catSlug;
    this.state.subcategorySlug = subSlug;
    this.state.page = 1;
    this.updateUrlParams();
    this.loadCategoriesFilter();
    this.fetchAndRenderProducts();
  },

  highlightActiveCategory() {
    // Also update breadcrumb / active banner
    const banner = document.getElementById('catalog-active-filter-banner');
    if (banner) {
      if (this.state.categorySlug || this.state.subcategorySlug || this.state.search || this.state.autoExpandedNotice) {
        let catName = '';
        if (this.state.categorySlug) {
          const cat = this.state.categoriesData.find((c) => c.slug === this.state.categorySlug);
          catName = cat ? cat.name : this.state.categorySlug;
        }

        let tagsHtml = '';
        if (this.state.categorySlug) {
          tagsHtml += `
            <span class="inline-flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-0.5 text-xs text-slate-800 font-medium">
              <span class="text-slate-500 font-normal">Division:</span> ${catName}
              <button onclick="Catalog.clearCategoryFilter()" class="text-slate-400 hover:text-red-600 font-bold ml-1 transition" title="Remove division filter">✕</button>
            </span>
          `;
        }
        if (this.state.subcategorySlug) {
          tagsHtml += `
            <span class="inline-flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-0.5 text-xs text-slate-800 font-medium">
              <span class="text-slate-500 font-normal">Subcategory:</span> ${this.state.subcategorySlug}
              <button onclick="Catalog.clearSubcategoryFilter()" class="text-slate-400 hover:text-red-600 font-bold ml-1 transition" title="Remove subcategory filter">✕</button>
            </span>
          `;
        }
        if (this.state.search) {
          tagsHtml += `
            <span class="inline-flex items-center gap-1.5 bg-blue-100 border border-blue-300 px-2 py-0.5 text-xs text-blue-900 font-semibold">
              <span class="text-blue-700 font-normal">Search:</span> "${this.state.search}"
              <button onclick="Catalog.clearSearchFilter()" class="text-blue-500 hover:text-red-600 font-bold ml-1 transition" title="Clear search">✕</button>
            </span>
          `;
        }

        let noticeHtml = '';
        if (this.state.autoExpandedNotice) {
          noticeHtml = `
            <div class="w-full text-[11px] text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 flex items-center justify-between">
              <span>Showing matches found across <strong>All 10 Divisions</strong> (none were found in the previously selected division).</span>
              <button onclick="Catalog.state.autoExpandedNotice=false; Catalog.highlightActiveCategory();" class="text-amber-700 font-bold ml-2">✕</button>
            </div>
          `;
        }

        banner.innerHTML = `
          <div class="space-y-1.5">
            ${noticeHtml}
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-none">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-slate-500 font-semibold uppercase tracking-wider text-[11px]">Filtered By:</span>
                ${tagsHtml || '<span class="text-slate-600 font-medium">All 10 Divisions</span>'}
              </div>
              <button onclick="Catalog.resetFilters()" class="text-blue-600 hover:text-blue-800 font-bold text-xs underline whitespace-nowrap">Clear All Filters</button>
            </div>
          </div>
        `;
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }
  },

  async fetchAndRenderProducts() {
    const container = document.getElementById('catalog-products-container');
    const countDisplay = document.getElementById('catalog-results-count');
    if (!container) return;

    // Loading State
    container.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-500">
        <svg class="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-sm font-medium">Fetching verified HSMLE equipment...</p>
      </div>
    `;

    try {
      let data = await window.API.getProducts({
        category_slug: this.state.categorySlug,
        subcategory_slug: this.state.subcategorySlug,
        search: this.state.search,
        page: this.state.page,
        limit: this.state.limit,
      });

      // SMART FALLBACK: If current category has 0 matches for the search query, check if matches exist across other divisions!
      if (data.total === 0 && this.state.search && (this.state.categorySlug || this.state.subcategorySlug)) {
        const globalData = await window.API.getProducts({
          search: this.state.search,
          page: 1,
          limit: this.state.limit,
        });
        if (globalData && globalData.total > 0) {
          data = globalData;
          this.state.categorySlug = null;
          this.state.subcategorySlug = null;
          this.state.autoExpandedNotice = true;
          this.updateUrlParams();
          this.loadCategoriesFilter();
        }
      }

      this.state.products = data.items || [];
      this.state.total = data.total || 0;
      this.state.totalPages = data.total_pages || 1;

      if (countDisplay) {
        countDisplay.textContent = `Showing ${this.state.products.length} of ${this.state.total} certified instruments`;
      }

      this.renderProductsLayout();
      this.renderPagination();
      this.updateViewButtons();

      // Update Floating WhatsApp message based on active category
      if (window.FloatingWhatsApp && window.WHATSAPP_CONFIG) {
        if (this.state.categorySlug) {
          const activeCat = this.state.categoriesData.find((c) => c.slug === this.state.categorySlug);
          if (activeCat && activeCat.name) {
            window.FloatingWhatsApp.updateMessage(window.WHATSAPP_CONFIG.categoryMessage(activeCat.name));
          } else {
            window.FloatingWhatsApp.resetMessage();
          }
        } else {
          window.FloatingWhatsApp.resetMessage();
        }
      }
    } catch (err) {
      container.innerHTML = `
        <div class="col-span-full py-12 px-6 bg-red-50 text-red-700 rounded-none border-2 border-slate-900  border border-red-200 text-center">
          <p class="font-bold text-base">Error Loading Catalogue</p>
          <p class="text-xs mt-1 text-red-600">${err.message}</p>
          <button onclick="Catalog.fetchAndRenderProducts()" class="mt-4 px-4 py-2 bg-red-600 text-white rounded-none border border-slate-900 text-xs font-semibold hover:bg-red-700 transition">
            Retry Connection
          </button>
        </div>
      `;
    }
  },

  renderProductsLayout() {
    const container = document.getElementById('catalog-products-container');
    if (!container) return;

    if (!this.state.products || this.state.products.length === 0) {
      container.className = 'w-full';
      container.innerHTML = `
        <div class="text-center py-16 bg-white rounded-none border-2 border-slate-900  border border-slate-900 p-8 ">
          <div class="w-16 h-16 bg-blue-50 text-blue-500 rounded-none flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <h3 class="text-base font-bold text-slate-800">No Instruments Found</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            We could not find any testing machine matching your filter criteria.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-3 mt-4">
            ${
              this.state.search && (this.state.categorySlug || this.state.subcategorySlug)
                ? `<button 
                    onclick="Catalog.clearCategoryFilter()" 
                    class="px-4 py-2 bg-blue-600 text-white border border-slate-900 text-xs font-semibold hover:bg-blue-700 transition"
                  >
                    Search "${this.state.search}" in All 10 Divisions
                  </button>`
                : ''
            }
            <button 
              onclick="Catalog.resetFilters()" 
              class="px-4 py-2 bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold hover:bg-slate-200 transition"
            >
              Show All Instruments
            </button>
          </div>
        </div>
      `;
      return;
    }

    if (this.state.viewMode === 'grid') {
      container.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6';
      container.innerHTML = this.state.products.map((p) => this.renderGridCard(p)).join('');
    } else {
      container.className = 'space-y-4';
      container.innerHTML = this.state.products.map((p) => this.renderListCard(p)).join('');
    }

    if (window.CompareManager) {
      window.CompareManager.updateCompareCheckboxes();
    }
  },

  renderGridCard(p) {
    const imgUrl = window.API.resolveImageUrl(p.image_url);
    const pdfUrl = window.API.resolveCatalogueUrl(p.catalogue_path);
    const isComparing = window.CompareManager && window.CompareManager.getIds().includes(p.id);

    return `
      <div class="industrial-card bg-white rounded-none border-2 border-slate-900  overflow-hidden flex flex-col group relative border border-slate-900  hover: transition-all">
        ${
          p.is_featured
            ? `
          <div class="absolute top-3 left-3 z-10 bg-amber-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-none  tracking-wide">
            FEATURED
          </div>
        `
            : ''
        }
        ${
          !p.has_verified_image
            ? `
          <div class="absolute top-3 right-3 z-10 bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-none ">
            Image Replacement Pending
          </div>
        `
            : ''
        }

        <a href="product-detail.html?id=${p.id}" class="block bg-white relative p-2 border-b border-slate-900 flex items-center justify-center h-64 sm:h-72 overflow-hidden">
          <div class="w-full h-full bg-white p-1 flex items-center justify-center overflow-hidden">
            <img 
              src="${imgUrl}" 
              alt="${p.product_name}" 
              class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
              onerror="this.onerror=null;this.src='/assets/images/product-placeholder.svg'"
              loading="lazy"
            >
          </div>
        </a>

        <div class="p-4 flex-1 flex flex-col justify-between">
          <div>
            <div class="mb-2 min-h-[46px] flex flex-col justify-center">
              <div class="text-[10px] font-bold text-blue-600 uppercase tracking-wider leading-snug">
                ${p.category_name}
              </div>
              <div class="mt-1 flex items-center justify-between">
                <span class="badge-model font-mono text-[10px] bg-slate-100 px-2 py-0.5 border border-slate-300 font-bold text-slate-800">
                  ${p.model_number || 'Standard'}
                </span>
              </div>
            </div>

            <h3 class="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition leading-snug line-clamp-2 mb-2">
              <a href="product-detail.html?id=${p.id}">
                ${p.product_name}
              </a>
            </h3>

            <p class="text-xs text-slate-500 line-clamp-2 mb-2.5">
              ${p.description || 'Precision metrology and quality control testing instrument designed according to ISO & ASTM international standards.'}
            </p>

            ${
              p.key_specs && p.key_specs.length > 0
                ? `
              <div class="mb-3 p-2 bg-slate-50 rounded-none border border-slate-900 border border-slate-900 space-y-1">
                ${p.key_specs
                  .slice(0, 2)
                  .map(
                    (ks) => `
                  <div class="flex items-baseline justify-between gap-2 text-[11px]">
                    <span class="font-semibold text-slate-500 truncate max-w-[48%]" title="${ks.spec_key}">${ks.spec_key}:</span>
                    <span class="font-mono font-semibold text-slate-800 truncate max-w-[52%] text-right" title="${ks.spec_value}">${String(ks.spec_value).replace(/\|/g, ' • ')}</span>
                  </div>
                `
                  )
                  .join('')}
              </div>
            `
                : ''
            }
          </div>

          <div class="pt-3 border-t border-slate-900 flex flex-col gap-2">
            <!-- Primary Specifications Button on Top -->
            <div>
              <a 
                href="product-detail.html?id=${p.id}" 
                class="w-full px-2.5 py-2 text-xs font-bold text-center bg-slate-900 hover:bg-slate-800 text-white rounded-none transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                View Technical Specifications
              </a>
            </div>

            <!-- Secondary Actions: Catalogue & Request Quote -->
            <div class="grid grid-cols-2 gap-2">
              <button 
                onclick="window.openPdfModal('${pdfUrl}', '${p.product_name.replace(/'/g, "\\'")}')" 
                class="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-none transition flex items-center justify-center gap-1"
                title="Preview Official Catalogue"
              >
                <svg class="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path>
                </svg>
                Catalogue
              </button>

              <button 
                onclick="RFQ.addItem({id: ${p.id}, product_name: '${p.product_name.replace(/'/g, "\\'")}', model_number: '${(p.model_number || '').replace(/'/g, "\\'")}', image_url: '${p.image_url}'})" 
                class="px-2.5 py-1.5 text-[11px] font-semibold text-center bg-blue-600 hover:bg-blue-700 text-white rounded-none transition"
              >
                + Request Quote
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderListCard(p) {
    const imgUrl = window.API.resolveImageUrl(p.image_url);
    const pdfUrl = window.API.resolveCatalogueUrl(p.catalogue_path);
    const isComparing = window.CompareManager && window.CompareManager.getIds().includes(p.id);

    return `
      <div class="industrial-card bg-white rounded-none border-2 border-slate-900  overflow-hidden p-4 sm:p-5 flex flex-col sm:flex-row gap-5 items-center relative">
        ${
          !p.has_verified_image
            ? `
          <div class="absolute top-3 left-3 z-10 bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-none ">
            Image Replacement Pending
          </div>
        `
            : ''
        }
        <a href="product-detail.html?id=${p.id}" class="w-full sm:w-52 h-48 bg-white rounded-none border border-slate-900 p-2 flex items-center justify-center flex-shrink-0 border border-slate-900 -inner">
          <img 
            src="${imgUrl}" 
            alt="${p.product_name}" 
            class="w-full h-full object-contain"
            onerror="this.onerror=null;this.src='/assets/images/product-placeholder.svg'"
            loading="lazy"
          >
        </a>

        <div class="flex-1 min-w-0 flex flex-col justify-between w-full">
          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-[11px] font-bold text-blue-600 uppercase tracking-wide">
                ${p.category_name}
              </span>
              <span class="text-slate-300">•</span>
              <span class="text-[11px] text-slate-500">
                ${p.subcategory_name || 'Standard'}
              </span>
              <span class="badge-model ml-auto text-[11px]">
                ${p.model_number || 'Standard'}
              </span>
            </div>

            <h3 class="text-base font-bold text-slate-900 hover:text-blue-600 transition mb-2">
              <a href="product-detail.html?id=${p.id}">
                ${p.product_name}
              </a>
            </h3>

            <p class="text-xs text-slate-600 line-clamp-2 mb-2.5">
              ${p.description || 'Precision metrology and quality control testing instrument designed according to ISO & ASTM international standards.'}
            </p>

            ${
              p.key_specs && p.key_specs.length > 0
                ? `
              <div class="flex flex-wrap gap-2 mb-3">
                ${p.key_specs
                  .map(
                    (ks) => `
                  <span class="inline-flex items-center px-2.5 py-1 rounded-none border border-slate-900 bg-slate-50 border border-slate-900 text-[11px] text-slate-700">
                    <strong class="text-slate-500 mr-1.5">${ks.spec_key}:</strong>
                    <span class="font-mono font-semibold text-slate-900 truncate max-w-[220px]">${String(ks.spec_value).replace(/\|/g, ' • ')}</span>
                  </span>
                `
                  )
                  .join('')}
              </div>
            `
                : ''
            }
          </div>

          <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900">
            <a 
              href="product-detail.html?id=${p.id}" 
              class="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-none transition flex items-center gap-1.5"
            >
              <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              View Specifications
            </a>

            <button 
              onclick="window.openPdfModal('${pdfUrl}', '${p.product_name.replace(/'/g, "\\'")}')" 
              class="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-none transition flex items-center gap-1.5"
            >
              <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path>
              </svg>
              Catalogue
            </button>

            <button 
              onclick="RFQ.addItem({id: ${p.id}, product_name: '${p.product_name.replace(/'/g, "\\'")}', model_number: '${(p.model_number || '').replace(/'/g, "\\'")}', image_url: '${p.image_url}'})" 
              class="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-none transition ml-auto"
            >
              + Request Quotation
            </button>
          </div>
        </div>
      </div>
    `;
  },

  renderPagination() {
    const container = document.getElementById('catalog-pagination-container');
    if (!container) return;

    if (this.state.totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = `
      <div class="flex items-center justify-center gap-1">
        <button 
          onclick="Catalog.goToPage(${this.state.page - 1})" 
          class="px-3 py-1.5 rounded-none border border-slate-900 border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition ${
            this.state.page <= 1 ? 'opacity-40 cursor-not-allowed' : ''
          }"
          ${this.state.page <= 1 ? 'disabled' : ''}
        >
          Previous
        </button>
    `;

    const start = Math.max(1, this.state.page - 2);
    const end = Math.min(this.state.totalPages, this.state.page + 2);

    if (start > 1) {
      html += `
        <button onclick="Catalog.goToPage(1)" class="w-8 h-8 rounded-none border border-slate-900 border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50">1</button>
        ${start > 2 ? '<span class="px-1 text-slate-400 text-xs">...</span>' : ''}
      `;
    }

    for (let i = start; i <= end; i++) {
      html += `
        <button 
          onclick="Catalog.goToPage(${i})" 
          class="w-8 h-8 rounded-none border border-slate-900 text-xs font-bold transition ${
            this.state.page === i ? 'bg-blue-600 text-white ' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
          }"
        >
          ${i}
        </button>
      `;
    }

    if (end < this.state.totalPages) {
      html += `
        ${end < this.state.totalPages - 1 ? '<span class="px-1 text-slate-400 text-xs">...</span>' : ''}
        <button onclick="Catalog.goToPage(${this.state.totalPages})" class="w-8 h-8 rounded-none border border-slate-900 border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50">${this.state.totalPages}</button>
      `;
    }

    html += `
        <button 
          onclick="Catalog.goToPage(${this.state.page + 1})" 
          class="px-3 py-1.5 rounded-none border border-slate-900 border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition ${
            this.state.page >= this.state.totalPages ? 'opacity-40 cursor-not-allowed' : ''
          }"
          ${this.state.page >= this.state.totalPages ? 'disabled' : ''}
        >
          Next
        </button>
      </div>
    `;

    container.innerHTML = html;
  },

  goToPage(pageNum) {
    if (pageNum < 1 || pageNum > this.state.totalPages || pageNum === this.state.page) return;
    this.state.page = pageNum;
    this.updateUrlParams();
    this.fetchAndRenderProducts();
    window.scrollTo({ top: 200, behavior: 'smooth' });
  },
};

window.Catalog = Catalog;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('catalog-products-container')) {
    Catalog.init();
  }
});
