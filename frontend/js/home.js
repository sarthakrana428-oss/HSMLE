/**
 * HSMLE India Corporation - Homepage Script
 * Manages world-class industrial hero slider, divisions showcase,
 * featured equipment grid, and live trust metrics.
 */

const Home = {
  heroIndex: 0,
  progressTimer: null,
  progress: 0,
  slideDuration: 5500, // 5.5s per slide
  totalSlides: 3,

  slideTabs: [
    { num: '01', title: 'Precision Testing Systems', sub: 'Chambers, Cutters & Metallurgical Systems' },
    { num: '02', title: 'Heavy Machining & Works', sub: 'Lathes, Milling & In-House Turning' },
    { num: '03', title: 'Frame Fabrication Bays', sub: 'Structural Steel & Heavy Machine Beds' },
  ],

  async init() {
    const urlParams = new URLSearchParams(window.location.search);
    const sParam = parseInt(urlParams.get('slide'), 10);
    if (!isNaN(sParam) && sParam >= 0 && sParam < this.totalSlides) {
      this.heroIndex = sParam;
    }
    this.setupHeroSlider();
    await this.loadDivisions();
    await this.loadFeaturedProducts();
  },

  setupHeroSlider() {
    const tabsContainer = document.getElementById('hero-slider-tabs');
    if (tabsContainer) {
      tabsContainer.innerHTML = this.slideTabs
        .map(
          (tab, idx) => `
        <button 
          onclick="Home.setHeroSlide(${idx})" 
          class="slide-tab-btn ${idx === 0 ? 'active' : ''}"
          id="slide-tab-${idx}"
        >
          <div class="slide-tab-progress-track">
            <div class="slide-tab-progress-fill" id="slide-tab-bar-${idx}"></div>
          </div>
          <div class="flex items-center gap-2 mb-0.5 mt-0.5">
            <span class="text-xs font-mono font-bold ${idx === 0 ? 'text-blue-400' : 'text-slate-400'}" id="slide-tab-num-${idx}">${tab.num}</span>
            <span class="text-xs font-bold text-slate-100">${tab.title}</span>
          </div>
          <p class="text-[11px] text-slate-400 truncate hidden sm:block">${tab.sub}</p>
        </button>
      `
        )
        .join('');
    }

    this.applyHeroSlide();
    this.startAutoPlay();
  },

  startAutoPlay() {
    if (this.progressTimer) clearInterval(this.progressTimer);

    this.progress = 0;
    const stepInterval = 50; // update every 50ms
    const stepCount = this.slideDuration / stepInterval;
    const progressStep = 100 / stepCount;

    this.progressTimer = setInterval(() => {
      this.progress += progressStep;
      const currentBar = document.getElementById(`slide-tab-bar-${this.heroIndex}`);
      if (currentBar) {
        currentBar.style.width = `${Math.min(100, this.progress)}%`;
      }
      if (this.progress >= 100) {
        this.nextSlide();
      }
    }, stepInterval);
  },

  nextSlide() {
    this.heroIndex = (this.heroIndex + 1) % this.totalSlides;
    this.applyHeroSlide();
    this.startAutoPlay();
  },

  prevSlide() {
    this.heroIndex = (this.heroIndex - 1 + this.totalSlides) % this.totalSlides;
    this.applyHeroSlide();
    this.startAutoPlay();
  },

  setHeroSlide(index) {
    this.heroIndex = index;
    this.applyHeroSlide();
    this.startAutoPlay();
  },

  applyHeroSlide() {
    // 1. Cross-fade between slides
    for (let i = 0; i < this.totalSlides; i++) {
      const slide = document.getElementById(`hero-slide-${i}`);
      if (slide) {
        if (i === this.heroIndex) {
          slide.classList.add('active');
        } else {
          slide.classList.remove('active');
        }
      }
    }

    // 2. Update bottom tabs & reset inactive bars
    for (let idx = 0; idx < this.totalSlides; idx++) {
      const tab = document.getElementById(`slide-tab-${idx}`);
      const num = document.getElementById(`slide-tab-num-${idx}`);
      const bar = document.getElementById(`slide-tab-bar-${idx}`);
      if (tab) {
        if (idx === this.heroIndex) {
          tab.classList.add('active');
          if (num) num.className = 'text-xs font-mono font-bold text-blue-400';
        } else {
          tab.classList.remove('active');
          if (num) num.className = 'text-xs font-mono font-bold text-slate-400';
          if (bar) bar.style.width = '0%';
        }
      }
    }
  },

  async loadDivisions() {
    const container = document.getElementById('home-divisions-grid');
    if (!container) return;

    try {
      const categories = await window.API.getCategories();
      const divisionIcons = {
        'analysis-software-imaging': 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
        'environmental-corrosion-testing': 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
        'benchtop-hardness-testing-equipment': 'M13 10V3L4 14h7v7l9-11h-7z',
        'portable-hardness-testing-equipment': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
        'material-handling-industrial-testing': 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
        'testing-machines': 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
        'mechanical-universal-testing-machines': 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
        'metallographic-sample-preparation': 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
        'ndt-inspection-instruments': 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
        'optical-metrology-systems': 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
        'thermal-laboratory-heating': 'M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z',
      };

      container.innerHTML = categories
        .map((cat) => {
          const iconPath = divisionIcons[cat.slug] || 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z';
          return `
          <a 
            href="products.html?category=${encodeURIComponent(cat.slug)}"
            class="group bg-white p-6 border-2 border-slate-900 hover:border-blue-600 transition-all flex flex-col justify-between"
          >
            <div>
              <div class="w-12 h-12 bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}"></path>
                </svg>
              </div>
              <h3 class="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-2">
                ${cat.name}
              </h3>
              <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                ${cat.description || 'Verified industrial metrology systems built to precision testing standards.'}
              </p>
            </div>

            <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span class="font-mono text-slate-500 font-semibold">${cat.total_products} Instruments</span>
              <span class="text-blue-600 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Explore Division →
              </span>
            </div>
          </a>
        `;
        })
        .join('');
    } catch (err) {
      console.error('Failed to load divisions:', err);
    }
  },

  async loadFeaturedProducts() {
    const container = document.getElementById('home-featured-grid');
    if (!container) return;

    try {
      const data = await window.API.getProducts({ featured: true, limit: 8 });
      const products = data.items || [];

      if (!products.length) {
        container.innerHTML = '<div class="col-span-full py-8 text-center text-slate-400 text-xs">Featured equipment loading...</div>';
        return;
      }

      container.innerHTML = products
        .map((p) => {
          const imgUrl = window.API.resolveImageUrl(p.image_url);

          return `
          <div class="bg-white border-2 border-slate-900 hover:border-blue-600 transition-all flex flex-col justify-between overflow-hidden group">
            <div class="p-4 pb-0">
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

              <a href="product-detail.html?id=${p.id}" class="block h-64 bg-white border border-slate-200 p-2 flex items-center justify-center overflow-hidden mb-3 relative">
                <img 
                  src="${imgUrl}" 
                  alt="${p.product_name}" 
                  class="h-full w-full object-contain hover:scale-105 transition-transform duration-300"
                  onerror="this.onerror=null;this.src='/assets/images/product-placeholder.svg'"
                  loading="lazy"
                >
              </a>

              <h4 class="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug mb-1">
                <a href="product-detail.html?id=${p.id}">${p.product_name}</a>
              </h4>
            </div>

            <div class="p-4 pt-3 border-t border-slate-100 flex items-center gap-2">
              <a 
                href="product-detail.html?id=${p.id}"
                class="flex-1 py-2 text-center text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition"
              >
                Specifications
              </a>
              <button 
                onclick="RFQ.addItem({ id: ${p.id}, product_name: '${p.product_name.replace(/'/g, "\'")}', model_number: '${p.model_number || 'Standard'}', image_url: '${p.image_url}' })"
                class="px-2.5 py-2 border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition font-bold text-xs"
                title="Add to RFQ"
              >
                + RFQ
              </button>
            </div>
          </div>
        `;
        })
        .join('');
    } catch (err) {
      console.error('Failed to load featured products:', err);
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  Home.init();
});
