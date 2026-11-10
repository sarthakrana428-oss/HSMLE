/**
 * HSMLE India Corporation - Category & Subcategory Management
 * Controls product divisions, subcategories, descriptions, and ordering.
 */

const CategoryManager = {
  categories: [],
  editingCatId: null,
  editingSubId: null,

  async init() {
    await this.fetchCategories();
  },

  async fetchCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    container.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Loading divisions...</div>`;

    try {
      this.categories = await window.AdminAPI.getCategories();
      this.renderList();
    } catch (err) {
      container.innerHTML = `<div class="p-8 text-center text-xs text-red-600">Failed to load categories: ${err.message}</div>`;
    }
  },

  renderList() {
    const container = document.getElementById('categories-container');
    if (!container) return;

    if (this.categories.length === 0) {
      container.innerHTML = `<p class="p-8 text-center text-xs text-slate-400">No categories found.</p>`;
      return;
    }

    container.innerHTML = this.categories
      .map(
        (c) => `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4">
        <div class="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div class="flex items-center gap-3">
            <span class="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">${c.id}</span>
            <div>
              <h3 class="text-sm font-bold text-slate-900">${c.name}</h3>
              <p class="text-[11px] font-mono text-slate-400">Slug: /${c.slug} • Order: ${c.display_order}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 self-end sm:self-auto">
            <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
              ${c.total_products} Products
            </span>
            <button 
              onclick="CategoryManager.openEditCategoryModal(${c.id})" 
              class="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-50 transition"
            >
              Edit Division
            </button>
            <button 
              onclick="CategoryManager.openAddSubcategoryModal(${c.id}, '${c.name.replace(/'/g, "\\'")}')" 
              class="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition"
            >
              + Subcategory
            </button>
          </div>
        </div>

        <!-- Subcategories List -->
        <div class="p-4">
          <h4 class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Subcategories (${c.subcategories.length})</h4>
          ${
            c.subcategories && c.subcategories.length > 0
              ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              ${c.subcategories
                .map(
                  (s) => `
                <div class="flex items-center justify-between p-2.5 bg-slate-50/70 border border-slate-200/80 rounded-lg text-xs">
                  <div>
                    <span class="font-semibold text-slate-800">${s.name}</span>
                    <span class="text-[10px] text-slate-400 font-mono block">/${s.slug}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">${s.product_count}</span>
                    <button 
                      onclick="CategoryManager.openEditSubcategoryModal(${s.id}, ${c.id}, '${s.name.replace(/'/g, "\\'")}', '${s.slug}', '${(s.description || '').replace(/'/g, "\\'")}')" 
                      class="text-slate-400 hover:text-blue-600 text-xs"
                      title="Edit Subcategory"
                    >
                      ✎
                    </button>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          `
              : `<p class="text-xs text-slate-400 italic">No subcategories created yet.</p>`
          }
        </div>
      </div>
    `
      )
      .join('');
  },

  // Category Modal
  openAddCategoryModal() {
    this.editingCatId = null;
    document.getElementById('cat-modal-title').textContent = 'Add Product Division';
    document.getElementById('category-form').reset();
    document.getElementById('category-modal').classList.remove('hidden');
  },

  openEditCategoryModal(catId) {
    this.editingCatId = catId;
    const cat = this.categories.find((c) => c.id === catId);
    if (!cat) return;

    document.getElementById('cat-modal-title').textContent = `Edit Division (${cat.name})`;
    const form = document.getElementById('category-form');
    form.name.value = cat.name;
    form.slug.value = cat.slug;
    form.description.value = cat.description || '';
    form.display_order.value = cat.display_order || 0;

    document.getElementById('category-modal').classList.remove('hidden');
  },

  closeCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
  },

  async handleCategorySubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');

    const payload = {
      name: form.name.value.trim(),
      slug: form.slug.value.trim() || null,
      description: form.description.value.trim() || null,
      display_order: parseInt(form.display_order.value, 10) || 0,
    };

    try {
      btn.disabled = true;
      btn.textContent = 'Saving...';

      if (this.editingCatId) {
        await window.AdminAPI.updateCategory(this.editingCatId, payload);
        if (window.showAdminToast) window.showAdminToast('Division updated', 'success');
      } else {
        await window.AdminAPI.createCategory(payload);
        if (window.showAdminToast) window.showAdminToast('Division created', 'success');
      }

      this.closeCategoryModal();
      this.fetchCategories();
    } catch (err) {
      if (window.showAdminToast) window.showAdminToast(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Division';
    }
  },

  // Subcategory Modal
  openAddSubcategoryModal(catId, catName) {
    this.editingSubId = null;
    document.getElementById('sub-modal-title').textContent = `Add Subcategory under "${catName}"`;
    const form = document.getElementById('subcategory-form');
    form.reset();
    form.category_id.value = catId;
    document.getElementById('subcategory-modal').classList.remove('hidden');
  },

  openEditSubcategoryModal(subId, catId, name, slug, desc) {
    this.editingSubId = subId;
    document.getElementById('sub-modal-title').textContent = `Edit Subcategory (${name})`;
    const form = document.getElementById('subcategory-form');
    form.category_id.value = catId;
    form.name.value = name;
    form.slug.value = slug;
    form.description.value = desc;
    document.getElementById('subcategory-modal').classList.remove('hidden');
  },

  closeSubcategoryModal() {
    document.getElementById('subcategory-modal').classList.add('hidden');
  },

  async handleSubcategorySubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');

    const payload = {
      category_id: parseInt(form.category_id.value, 10),
      name: form.name.value.trim(),
      slug: form.slug.value.trim() || null,
      description: form.description.value.trim() || null,
    };

    try {
      btn.disabled = true;
      btn.textContent = 'Saving...';

      if (this.editingSubId) {
        await window.AdminAPI.updateSubcategory(this.editingSubId, payload);
        if (window.showAdminToast) window.showAdminToast('Subcategory updated', 'success');
      } else {
        await window.AdminAPI.createSubcategory(payload);
        if (window.showAdminToast) window.showAdminToast('Subcategory created', 'success');
      }

      this.closeSubcategoryModal();
      this.fetchCategories();
    } catch (err) {
      if (window.showAdminToast) window.showAdminToast(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Subcategory';
    }
  },
};

window.CategoryManager = CategoryManager;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('categories-container')) {
    CategoryManager.init();
  }
});
