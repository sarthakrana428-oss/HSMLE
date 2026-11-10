/**
 * HSMLE India Corporation - RFQ (Request For Quotation) Cart Module
 * Supports adding multiple industrial products to RFQ cart, updating quantities,
 * managing notes, and submitting quotations to FastAPI backend.
 */

const RFQ_STORAGE_KEY = 'hsmle_rfq_cart_v1';

const RFQ = {
  getItems() {
    try {
      const data = localStorage.getItem(RFQ_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse RFQ cart:', e);
      return [];
    }
  },

  saveItems(items) {
    try {
      localStorage.setItem(RFQ_STORAGE_KEY, JSON.stringify(items));
      this.updateBadges();
      this.renderDrawer();
    } catch (e) {
      console.error('Failed to save RFQ cart:', e);
    }
  },

  addItem(product, quantity = 1, notes = '') {
    if (!product || !product.id) return;
    const items = this.getItems();
    const existingIndex = items.findIndex((i) => i.product_id === product.id);

    if (existingIndex > -1) {
      items[existingIndex].quantity += quantity;
      if (notes) items[existingIndex].customization_notes = notes;
    } else {
      items.push({
        product_id: product.id,
        product_name: product.product_name,
        model_number: product.model_number || 'Standard',
        image_url: product.image_url || '/assets/images/product-placeholder.svg',
        quantity: Math.max(1, quantity),
        customization_notes: notes || '',
      });
    }

    this.saveItems(items);
    if (window.showToast) {
      window.showToast(`"${product.product_name}" added to Quotation Request`, 'success');
    }
    this.openDrawer();
  },

  removeItem(productId) {
    let items = this.getItems();
    items = items.filter((i) => i.product_id !== productId);
    this.saveItems(items);
    if (window.showToast) {
      window.showToast('Product removed from Quotation Request', 'info');
    }
  },

  updateQuantity(productId, quantity) {
    const items = this.getItems();
    const item = items.find((i) => i.product_id === productId);
    if (item) {
      item.quantity = Math.max(1, parseInt(quantity, 10) || 1);
      this.saveItems(items);
    }
  },

  clearCart() {
    this.saveItems([]);
  },

  getCount() {
    const items = this.getItems();
    return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  },

  updateBadges() {
    const count = this.getCount();
    const badges = document.querySelectorAll('.rfq-count-badge');
    badges.forEach((b) => {
      b.textContent = count;
      b.classList.remove('hidden');
    });
  },

  openDrawer() {
    const drawer = document.getElementById('rfq-drawer');
    const backdrop = document.getElementById('rfq-backdrop');
    if (drawer && backdrop) {
      drawer.classList.remove('translate-x-full');
      backdrop.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
      this.renderDrawer();
    }
  },

  closeDrawer() {
    const drawer = document.getElementById('rfq-drawer');
    const backdrop = document.getElementById('rfq-backdrop');
    if (drawer && backdrop) {
      drawer.classList.add('translate-x-full');
      backdrop.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  },

  renderDrawer() {
    const container = document.getElementById('rfq-items-list');
    const emptyState = document.getElementById('rfq-empty-state');
    const formContainer = document.getElementById('rfq-form-container');
    if (!container) return;

    const items = this.getItems();

    if (items.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      if (formContainer) formContainer.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (formContainer) formContainer.classList.remove('hidden');

    container.innerHTML = items
      .map(
        (item) => `
      <div class="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-none ">
        <img 
          src="${window.API ? window.API.resolveImageUrl(item.image_url) : item.image_url}" 
          alt="${item.product_name}" 
          class="w-14 h-14 object-contain bg-slate-50 border border-slate-100 rounded-none p-1 flex-shrink-0"
          onerror="this.onerror=null;this.src='/assets/images/product-placeholder.svg'"
        >
        <div class="flex-1 min-w-0">
          <h4 class="text-xs font-bold text-slate-900 truncate">${item.product_name}</h4>
          <p class="text-[11px] font-mono text-blue-600 truncate">${item.model_number}</p>
          <div class="flex items-center gap-2 mt-1">
            <label class="text-[11px] text-slate-500">Qty:</label>
            <input 
              type="number" 
              min="1" 
              max="99" 
              value="${item.quantity}" 
              onchange="RFQ.updateQuantity(${item.product_id}, this.value)" 
              class="w-12 h-6 px-1.5 text-xs text-center border border-slate-300 rounded-none font-semibold focus:ring-1 focus:ring-blue-500"
            >
          </div>
        </div>
        <button 
          onclick="RFQ.removeItem(${item.product_id})" 
          class="text-slate-400 hover:text-red-500 p-1.5 rounded-none transition"
          title="Remove item"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    `
      )
      .join('');
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const items = this.getItems();

    if (items.length === 0) {
      if (window.showToast) window.showToast('Please add at least one product to quotation', 'warning');
      return;
    }

    const getVal = (name) => {
      const el = form.elements[name];
      return el && el.value ? el.value.trim() : null;
    };

    const payload = {
      company_name: getVal('company_name') || '',
      contact_person: getVal('contact_person') || '',
      email: getVal('email') || '',
      phone: getVal('phone') || '',
      delivery_city: getVal('delivery_city') || 'Not Specified',
      delivery_state: getVal('delivery_state') || 'Not Specified',
      gst_number: getVal('gst_number') ? getVal('gst_number').toUpperCase() : null,
      industry_sector: getVal('industry_sector') || 'Industrial Quality & Testing',
      requirements_notes: getVal('requirements_notes'),
      target_delivery_date: getVal('target_delivery_date'),
      items: items.map((i) => ({
        product_id: parseInt(i.product_id, 10) || 1,
        product_name: i.product_name || 'Standard Equipment',
        model_number: i.model_number || 'Standard',
        quantity: Math.max(1, parseInt(i.quantity, 10) || 1),
        customization_notes: i.customization_notes || null,
      })),
    };

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg> Submitting Request...
        `;
      }

      const res = await window.API.submitQuotation(payload);

      // Success
      this.clearCart();
      this.closeDrawer();
      form.reset();

      if (window.showToast) {
        window.showToast(`Quotation ${res.rfq_number} submitted successfully! Our engineering team will contact you.`, 'success');
      }

      // Show modal confirmation
      if (window.showSuccessModal) {
        window.showSuccessModal({
          title: 'Quotation Request Received',
          message: `Thank you for your enquiry. Your official quotation reference number is <strong>${res.rfq_number}</strong>. An HSMLE technical specialist will send the formal techno-commercial offer to <strong>${res.email}</strong> shortly.`,
        });
      }
    } catch (err) {
      if (window.showToast) {
        window.showToast(`Failed to submit quotation: ${err.message}`, 'error');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Submit Quotation Request';
      }
    }
  },
};

window.RFQ = RFQ;
document.addEventListener('DOMContentLoaded', () => {
  RFQ.updateBadges();
});
