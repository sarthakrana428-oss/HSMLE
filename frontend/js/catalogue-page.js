/**
 * HSMLE India Corporation - Machine Catalogues Archive Page Script
 * Renders all 681 machines with photos, names, model numbers, and direct PDF catalogue viewers.
 */

const CataloguePage = {
  allProducts: [],
  categories: [],
  activeCategorySlug: 'all',
  searchQuery: '',

  async init() {
    this.bindEvents();
    await this.loadData();
  },

  bindEvents() {
    const searchInput = document.getElementById('catalogue-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.renderGrid();
      });
    }

    const divisionSelect = document.getElementById('catalogue-division-select');
    if (divisionSelect) {
      divisionSelect.addEventListener('change', (e) => {
        this.activeCategorySlug = e.target.value;
        this.updatePillsActiveState();
        this.renderGrid();
      });
    }
  },

  async loadData() {
    try {
      const [catData, prodData] = await Promise.all([
        window.API.getCategories(),
        window.API.getProducts({ limit: 1000 })
      ]);

      this.categories = catData || [];
      this.allProducts = (prodData && prodData.items) ? prodData.items : [];

      this.populateCategoryFilters();
      this.renderGrid();
    } catch (err) {
      console.error('Failed to load catalogue data:', err);
      const grid = document.getElementById('catalogues-grid');
      if (grid) {
        grid.innerHTML = `
          <div class="col-span-full py-16 text-center">
            <div class="w-12 h-12 bg-red-100 text-red-600 rounded-none border border-slate-900 flex items-center justify-center mx-auto mb-3">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 class="text-base font-bold text-slate-800">Failed to load machine catalogues</h3>
            <p class="text-xs text-slate-500 mt-1 mb-4">Could not communicate with the backend catalogue archive.</p>
            <button onclick="CataloguePage.loadData()" class="px-4 py-2 bg-blue-600 text-white font-bold rounded-none text-xs hover:bg-blue-700 transition">
              Retry Connection
            </button>
          </div>
        `;
      }
    }
  },

  populateCategoryFilters() {
    const select = document.getElementById('catalogue-division-select');
    const pillsBar = document.getElementById('division-pills-bar');

    // Count machines per category slug from actual 681 products
    const countsBySlug = {};
    this.allProducts.forEach(p => {
      if (p.category_slug) {
        countsBySlug[p.category_slug] = (countsBySlug[p.category_slug] || 0) + 1;
      }
    });

    const activeCategories = this.categories
      .filter(c => (countsBySlug[c.slug] || 0) > 0)
      .sort((a, b) => (countsBySlug[b.slug] || 0) - (countsBySlug[a.slug] || 0));

    if (select) {
      select.innerHTML = `<option value="all">All Divisions (${this.allProducts.length} Machines)</option>` +
        activeCategories.map(c => `
          <option value="${c.slug}">${c.name} (${countsBySlug[c.slug] || 0})</option>
        `).join('');
    }

    if (pillsBar) {
      pillsBar.innerHTML = `
        <button 
          type="button"
          onclick="CataloguePage.selectCategory('all')"
          data-slug="all"
          class="cat-pill px-3 py-1.5 rounded-none border border-slate-900 font-bold whitespace-nowrap transition bg-blue-600 text-white  cursor-pointer"
        >
          All (${this.allProducts.length})
        </button>
      ` + activeCategories.map(c => `
        <button 
          type="button"
          onclick="CataloguePage.selectCategory('${c.slug}')"
          data-slug="${c.slug}"
          class="cat-pill px-3 py-1.5 rounded-none border border-slate-900 font-semibold whitespace-nowrap transition bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
        >
          ${c.name} (${countsBySlug[c.slug] || 0})
        </button>
      `).join('');
    }
  },

  selectCategory(slug) {
    this.activeCategorySlug = slug;
    const select = document.getElementById('catalogue-division-select');
    if (select) select.value = slug;
    this.updatePillsActiveState();
    this.renderGrid();
  },

  updatePillsActiveState() {
    const pills = document.querySelectorAll('.cat-pill');
    pills.forEach(p => {
      const slug = p.getAttribute('data-slug');
      if (slug === this.activeCategorySlug) {
        p.className = 'cat-pill px-3 py-1.5 rounded-none border border-slate-900 font-bold whitespace-nowrap transition bg-blue-600 text-white ';
      } else {
        p.className = 'cat-pill px-3 py-1.5 rounded-none border border-slate-900 font-semibold whitespace-nowrap transition bg-slate-100 text-slate-700 hover:bg-slate-200';
      }
    });
  },

  getFilteredProducts() {
    return this.allProducts.filter(p => {
      // Category filter
      if (this.activeCategorySlug !== 'all' && p.category_slug !== this.activeCategorySlug) {
        return false;
      }
      // Search filter
      if (this.searchQuery) {
        const text = `${p.product_name || ''} ${p.model_number || ''} ${p.category_name || ''} ${p.subcategory_name || ''} ${p.catalogue_path || ''}`.toLowerCase();
        return text.includes(this.searchQuery);
      }
      return true;
    });
  },

  renderGrid() {
    const grid = document.getElementById('catalogues-grid');
    const countBadge = document.getElementById('catalogue-count-badge');
    if (!grid) return;

    const filtered = this.getFilteredProducts();

    if (countBadge) {
      countBadge.textContent = `${filtered.length} Catalogue${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center bg-white rounded-none border-2 border-slate-900  border border-slate-900 p-8 my-4">
          <div class="w-12 h-12 bg-slate-100 text-slate-400 rounded-none border border-slate-900 flex items-center justify-center mx-auto mb-3">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <h3 class="text-base font-bold text-slate-800">No Machine Catalogues Matched</h3>
          <p class="text-xs text-slate-500 mt-1 mb-4">No machinery found matching "${this.searchQuery}". Try a different keyword or reset filters.</p>
          <button onclick="CataloguePage.resetFilters()" class="px-4 py-2 bg-slate-800 text-white font-bold rounded-none text-xs hover:bg-slate-700 transition">
            Reset Filters
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(p => {
      const imgSrc = window.API.resolveImageUrl(p.image_url);
      const pdfUrl = window.API.resolveCatalogueUrl(p.catalogue_path);
      const downloadUrl = window.API.resolvePdfDownloadUrl(p.id);
      const escapedTitle = (p.product_name || '').replace(/'/g, "\\'");

      return `
        <div class="bg-white rounded-none border-2 border-slate-900  border border-slate-900  hover: hover:border-blue-300 transition-all flex flex-col overflow-hidden group">
          <!-- Machine Photograph Container -->
          <div class="relative bg-white p-2 border-b border-slate-900 flex items-center justify-center h-64 sm:h-72 overflow-hidden">
            <a href="product-detail.html?id=${p.id}" class="w-full h-full flex items-center justify-center">
              <img 
                src="${imgSrc}" 
                alt="${p.product_name}" 
                loading="lazy" 
                class="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                onerror="this.onerror=null; this.src='assets/images/product-placeholder.svg';"
              >
            </a>
            <div class="absolute bottom-2 right-2 px-2 py-0.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono font-bold">
              ID #${p.id}
            </div>
          </div>

          <!-- Card Content Body -->
          <div class="p-4 flex-1 flex flex-col justify-between">
            <div>
              <!-- Model Number Badge & ID -->
              <div class="mb-1.5 flex items-center justify-between gap-1">
                <div class="flex items-center gap-1.5 truncate">
                  <span class="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-300 px-1.5 py-0.5">
                    ID #${p.id}
                  </span>
                  <span class="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-none truncate" title="${p.model_number || 'Standard Model'}">
                    ${p.model_number || 'HSMLE Standard'}
                  </span>
                </div>
                <span class="text-[10px] text-slate-400 font-mono shrink-0">
                  ${p.catalogue_pages || 1} Pg
                </span>
              </div>

              <!-- Product Name -->
              <h3 class="font-bold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-blue-600 transition mb-3" title="${p.product_name}">
                <a href="product-detail.html?id=${p.id}">${p.product_name}</a>
              </h3>
            </div>

            <!-- Catalogue Action Buttons -->
            <div class="pt-3 border-t border-slate-900 space-y-2">
              <div class="flex items-center gap-1.5">
                <!-- Main Catalogue Option: When clicked it opens the PDF -->
                <button 
                  type="button"
                  onclick="window.openPdfModal('${pdfUrl}', '${escapedTitle}')"
                  class="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-none border border-slate-900 text-xs  transition flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Open and read official PDF catalogue in interactive viewer"
                >
                  <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path>
                  </svg>
                  <span>Open Catalogue</span>
                </button>

                <!-- Direct Download Button -->
                <a 
                  href="${downloadUrl}" 
                  target="_blank" 
                  download 
                  class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-none border border-slate-900 text-xs font-bold border border-slate-900 transition flex items-center justify-center shrink-0"
                  title="Download catalogue PDF"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </a>
              </div>


            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  resetFilters() {
    this.searchQuery = '';
    this.activeCategorySlug = 'all';
    const input = document.getElementById('catalogue-search-input');
    if (input) input.value = '';
    const select = document.getElementById('catalogue-division-select');
    if (select) select.value = 'all';
    this.updatePillsActiveState();
    this.renderGrid();
  }
};

window.CataloguePage = CataloguePage;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('catalogues-grid')) {
    CataloguePage.init();
  }
});
