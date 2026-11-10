/**
 * HSMLE India Corporation - Global App Script
 * Manages Navigation, Megamenu, Toast notifications, Modals, RFQ drawer,
 * and common layout utilities across all pages.
 */

// Toast notification helper
window.showToast = function (message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        ${
          type === 'success'
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>'
            : type === 'warning'
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>'
            : type === 'error'
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>'
            : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
        }
      </svg>
      <span>${message}</span>
    </div>
    <button onclick="this.parentElement.remove()" class="text-white/80 hover:text-white p-1">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 4500);
};

// Global Success Confirmation Modal
window.showSuccessModal = function ({ title, message }) {
  let modal = document.getElementById('global-success-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'global-success-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="bg-white rounded-none max-w-md w-full p-6 text-center  border border-slate-100 transform transition-all">
        <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-none flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        <h3 id="gsm-title" class="text-xl font-bold text-slate-900 mb-2"></h3>
        <div id="gsm-msg" class="text-sm text-slate-600 mb-6 leading-relaxed"></div>
        <button 
          onclick="document.getElementById('global-success-modal').classList.add('hidden')"
          class="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-none  transition"
        >
          Close & Continue
        </button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('gsm-title').textContent = title || 'Success';
  document.getElementById('gsm-msg').innerHTML = message || 'Your request has been processed successfully.';
  modal.classList.remove('hidden');
};

// Global PDF Viewer Modal
window.openPdfModal = function (pdfUrl, title = 'Official Product Catalogue') {
  let modal = document.getElementById('global-pdf-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'global-pdf-modal';
    modal.className = 'fixed inset-0 z-50 flex flex-col bg-slate-950/80 backdrop-blur-md p-4 sm:p-6';
    modal.innerHTML = `
      <div class="flex items-center justify-between bg-slate-900 text-white px-4 py-3 rounded-none-xl border-b border-slate-800">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path>
          </svg>
          <span id="pdf-modal-title" class="font-bold text-sm truncate max-w-lg">Catalogue Preview</span>
        </div>
        <div class="flex items-center gap-2">
          <a 
            id="pdf-modal-download" 
            href="#" 
            target="_blank" 
            download 
            class="px-3 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-none transition flex items-center gap-1"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
            Download Original
          </a>
          <button 
            onclick="document.getElementById('global-pdf-modal').classList.add('hidden')"
            class="p-1.5 text-slate-400 hover:text-white rounded-none hover:bg-slate-800 transition"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="flex-1 bg-slate-800 rounded-none-xl overflow-hidden relative  border border-slate-800">
        <iframe id="pdf-modal-iframe" class="w-full h-full border-0" src="about:blank"></iframe>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('pdf-modal-title').textContent = title;
  document.getElementById('pdf-modal-download').href = pdfUrl;
  document.getElementById('pdf-modal-iframe').src = pdfUrl;
  modal.classList.remove('hidden');
};

// Global Quick Enquiry Modal
window.openEnquiryModal = function (product = {}) {
  let modal = document.getElementById('global-enquiry-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'global-enquiry-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="bg-white rounded-none max-w-lg w-full p-6  border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900">Direct Machine Enquiry</h3>
            <p id="enq-product-label" class="text-xs text-blue-600 font-medium"></p>
          </div>
          <button 
            onclick="document.getElementById('global-enquiry-modal').classList.add('hidden')" 
            class="text-slate-400 hover:text-slate-600 p-1"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <form id="global-enquiry-form" class="space-y-3" onsubmit="window.handleEnquirySubmit(event)">
          <input type="hidden" name="product_id" id="enq-pid" value="">
          <input type="hidden" name="product_name" id="enq-pname" value="">
          <input type="hidden" name="model_number" id="enq-pmodel" value="">

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Your Full Name *</label>
              <input type="text" name="full_name" required placeholder="e.g. Ramesh Patel" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Company / Organization *</label>
              <input type="text" name="company_name" required placeholder="e.g. Apex Engineering Ltd" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Corporate Email *</label>
              <input type="email" name="email" required placeholder="name@company.com" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Mobile / WhatsApp *</label>
              <input type="tel" name="phone" required placeholder="+91 9876543210" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-none focus:ring-2 focus:ring-blue-500">
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">City / Location</label>
              <input type="text" name="city" placeholder="e.g. Pune, Chennai" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
              <input type="text" name="subject" value="Commercial Price & Technical Proposal" class="w-full px-3 py-2 text-xs border border-slate-300 rounded-none">
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Technical Requirements & Testing Application *</label>
            <textarea name="message" rows="3" required placeholder="Specify specimen type, testing standards (ASTM/ISO), capacity or customized fixture requirements..." class="w-full px-3 py-2 text-xs border border-slate-300 rounded-none focus:ring-2 focus:ring-blue-500"></textarea>
          </div>

          <button 
            type="submit" 
            class="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-none  transition text-xs flex items-center justify-center gap-2 mt-2"
          >
            Submit Technical Enquiry
          </button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('enq-pid').value = product.id || '';
  document.getElementById('enq-pname').value = product.product_name || '';
  document.getElementById('enq-pmodel').value = product.model_number || '';
  document.getElementById('enq-product-label').textContent = product.product_name ? `${product.product_name} (${product.model_number || 'Standard'})` : 'General Technical Consultation';
  modal.classList.remove('hidden');
};

// Handle Enquiry Submission
window.handleEnquirySubmit = async function (e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');

  const payload = {
    product_id: form.product_id.value ? parseInt(form.product_id.value, 10) : null,
    product_name: form.product_name.value || null,
    model_number: form.model_number.value || null,
    full_name: form.full_name.value.trim(),
    company_name: form.company_name.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    city: form.city.value.trim() || null,
    country: 'India',
    subject: form.subject.value.trim() || 'Product Information Enquiry',
    message: form.message.value.trim(),
  };

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Submitting Enquiry...';
    }

    const res = await window.API.submitEnquiry(payload);
    form.reset();
    document.getElementById('global-enquiry-modal').classList.add('hidden');

    if (window.showToast) {
      window.showToast(`Enquiry ${res.enquiry_number} submitted! We will respond within 24 hours.`, 'success');
    }

    if (window.showSuccessModal) {
      window.showSuccessModal({
        title: 'Enquiry Received',
        message: `Thank you, ${res.full_name}. Your enquiry reference number is <strong>${res.enquiry_number}</strong>. Our technical engineering division will review your requirement and contact you at ${res.email}.`,
      });
    }
  } catch (err) {
    if (window.showToast) {
      window.showToast(`Enquiry failed: ${err.message}`, 'error');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Submit Technical Enquiry';
    }
  }
};

// Dynamic Categories Dropdown in Header
async function loadNavCategories() {
  const container = document.getElementById('nav-categories-dropdown');
  const mobileContainer = document.getElementById('mobile-nav-categories');
  if (!container && !mobileContainer) return;

  try {
    const categories = await window.API.getCategories();
    if (container) {
      container.innerHTML = categories
        .map(
          (c) => `
        <a 
          href="products.html?category=${encodeURIComponent(c.slug)}" 
          class="block px-4 py-2 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition flex items-center justify-between"
        >
          <span class="font-medium">${c.name}</span>
          <span class="text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-none font-mono">${c.total_products}</span>
        </a>
      `
        )
        .join('');
    }

    if (mobileContainer) {
      mobileContainer.innerHTML = categories
        .map(
          (c) => `
        <a 
          href="products.html?category=${encodeURIComponent(c.slug)}" 
          class="block py-1.5 text-xs text-slate-600 hover:text-blue-600 flex items-center justify-between"
        >
          <span>${c.name}</span>
          <span class="text-[10px] text-slate-400 font-mono">${c.total_products}</span>
        </a>
      `
        )
        .join('');
    }

    // Dynamically synchronize navbar total products count with active database
    const totalActiveProducts = categories.reduce((sum, c) => sum + (c.total_products || 0), 0);
    if (totalActiveProducts > 0) {
      document.querySelectorAll(".nav-label").forEach((el) => {
        if (el.innerHTML.includes("Products") && el.innerHTML.includes("All")) {
          el.innerHTML = `All ${totalActiveProducts}<br>Products`;
        }
      });
    }
  } catch (err) {
    console.error('Failed to load navigation categories:', err);
  }
}

// Global Search bar handler
function setupHeaderSearch() {
  const searchForms = document.querySelectorAll('.header-search-form');
  searchForms.forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="search"], input[type="text"]');
      if (input && input.value.trim()) {
        window.location.href = `products.html?search=${encodeURIComponent(input.value.trim())}`;
      }
    });
  });
}

// Mobile Menu Drawer Handler
function setupMobileMenu() {
  const openBtn = document.getElementById('mobile-menu-btn');
  const closeBtn = document.getElementById('close-mobile-menu-btn');
  const drawer = document.getElementById('mobile-menu-drawer');
  const backdrop = document.getElementById('mobile-menu-backdrop');

  if (openBtn && drawer && backdrop) {
    openBtn.addEventListener('click', () => {
      drawer.classList.remove('-translate-x-full');
      backdrop.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    });

    const closeMenu = () => {
      drawer.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    backdrop.addEventListener('click', closeMenu);
  }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Permanently remove all compare buttons
  document.querySelectorAll('.compare-toggle-btn, button[onclick*="CompareManager"]').forEach((el) => el.remove());

  loadNavCategories();
  setupHeaderSearch();
  setupMobileMenu();

  // Floating WhatsApp Business Button
  if (window.FloatingWhatsApp) {
    window.FloatingWhatsApp.init();
  }
});

// Admin Portal Dropdown Handler
window.toggleAdminMenu = function (e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const menu = document.getElementById('admin-dropdown-menu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
};

document.addEventListener('click', (e) => {
  const menu = document.getElementById('admin-dropdown-menu');
  const btn = document.getElementById('admin-menu-btn');
  if (menu && !menu.classList.contains('hidden')) {
    if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
      menu.classList.add('hidden');
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const menu = document.getElementById('admin-dropdown-menu');
    if (menu) menu.classList.add('hidden');
  }
});
