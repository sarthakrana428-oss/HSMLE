/**
 * HSMLE India Corporation - Product Detail Page Script
 * Loads individual machine specifications, features, PDF embed preview,
 * handles SEO metadata injection, and interactive RFQ / enquiry workflows.
 */

const SPEC_EXPLANATIONS = {
  'model number': 'Official factory model designation and series code',
  'model number / series': 'Available model configurations in this series',
  'model series variants': 'Selectable machine variants within this model family',
  'turret control mechanism': 'How the indenter and objective lenses switch positions',
  'supported hardness scales': 'Primary measurement scales directly tested by the machine',
  'hardness conversion scales': 'Automatic digital conversion to other hardness standards',
  'hardness measuring range': 'Minimum to maximum hardness values measurable',
  'minimum measuring resolution': 'Smallest optical/digital increment the sensor can resolve',
  'measurement resolution': 'Smallest readable measurement increment (Least Count)',
  'load resolution (least count)': 'Smallest detectable force increment',
  'elongation resolution (least count)': 'Smallest detectable extension/displacement increment',
  'test force loading method': 'Automated or manual application, holding, and release of load',
  'initial test force (pre-load)': 'Preliminary force applied to seat the indenter on the sample',
  'initial pre-load force': 'Preliminary force applied before main test load',
  'main test force selections': 'Selectable primary test loads applied during testing',
  'test force selections': 'Available force levels for testing different materials',
  'rockwell test loads (kgf)': 'Standard Rockwell loads for HRA, HRB, and HRC scales',
  'test force accuracy error': 'Maximum permissible deviation in applied test force',
  'measuring eyepiece': 'Optical eyepiece magnification and encoder read-out type',
  'objective lenses': 'Installed microscope objective lenses for indentation/sample viewing',
  'total optical magnification': 'Combined magnification of objective lens and eyepiece',
  'magnification range': 'Continuous or step optical magnification range',
  'total magnification range': 'Combined optical zoom magnification range',
  'test load dwell time': 'Duration the maximum test force is held on the specimen (1–99s)',
  'display & data output interface': 'Screen type, built-in printer, and computer/USB connectivity',
  'hardness readout display': 'Method used to display measured hardness results',
  'maximum test space (height × throat depth)': 'Max specimen height (vertical) and throat depth (horizontal)',
  'max. test height': 'Maximum vertical height of specimen accommodated on stage',
  'maximum test height': 'Maximum vertical height of specimen accommodated on stage',
  'depth of throat': 'Horizontal clearance from indenter center to machine frame',
  'electrical power supply': 'Required AC voltage, frequency, and phase configuration',
  'compliance standards': 'International quality & testing standards met (ISO / ASTM / JIS)',
  'machine dimensions & net weight': 'Unpacked physical footprint (L × W × H) and machine weight',
  'overall machine dimensions': 'External physical dimensions of the instrument',
  'net machine weight': 'Unpacked weight of the main machine unit',
  'packing dimensions & gross weight': 'Crated shipping dimensions and total shipping weight',
  'packing size & gross weight': 'Crated shipping dimensions and total shipping weight',
  'standard accessories & delivery kit': 'Factory-supplied accessories included with standard delivery',
  'grinding & polishing disc diameter': 'Diameter of the rotating platen for abrasive papers/cloths',
  'grinding disc rotation speed': 'Rotational speed range (RPM) of the main grinding wheel',
  'sample disc speed': 'Rotational speed (RPM) of the motorized specimen holder head',
  'sample holder': 'Number and diameter of mounted specimens held simultaneously',
  'working air pressure': 'Compressed air pressure required for pneumatic loading',
  'max. cutting diameter': 'Maximum cross-sectional diameter of bar/sample that can be cut',
  'maximum cutting diameter': 'Maximum cross-sectional diameter of specimen that can be cut',
  'cutting capacity': 'Maximum specimen diameter or cross-section capacity',
  'x-axis measuring travel': 'Horizontal stage measurement travel along X-axis',
  'y-axis measuring travel': 'Horizontal stage measurement travel along Y-axis',
  'z-axis focusing / measuring travel': 'Vertical focusing or height measurement travel along Z-axis',
  'x / y linear resolution': 'Digital readout resolution along X and Y measuring axes',
  'stage load capacity': 'Maximum specimen weight safely supported by the work stage',
  'screen diameter': 'Effective diameter of the optical projection screen',
  'work stage': 'Dimensions of the precision coordinate work table',
  'travel': 'Coordinate measuring travel range of the stage',
  'repeatability': 'Consistency of repeated measurements on the same feature',
  'accuracy': 'Maximum linear measurement error across travel range',
};

const ProductDetail = {
  product: null,
  galleryUrls: [],
  activeImageIndex: 0,
  detectedModels: [],
  selectedModel: null,
  isSpecsExpanded: false,

  async init() {
    const urlParams = new URLSearchParams(window.location.search);
    const idOrSlug = urlParams.get('id') || urlParams.get('slug');

    if (!idOrSlug) {
      this.renderNotFound('No product ID or slug specified in request URL.');
      return;
    }

    await this.fetchAndRender(idOrSlug);
  },

  async fetchAndRender(idOrSlug) {
    const mainContainer = document.getElementById('product-detail-main');
    if (!mainContainer) return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const [p, manifest] = await Promise.all([
        window.API.getProduct(idOrSlug),
        window.API.getGalleryManifest(),
      ]);
      this.product = p;
      // Strictly keep only the single cover photo and remove all extra photos
      const primaryUrl = p.image_url;
      const rawGallery = primaryUrl ? [primaryUrl] : [];
      this.galleryUrls = rawGallery.map((u) => window.API.resolveImageUrl(u));
      this.activeImageIndex = 0;

      // Detect distinct machine models/variants for model-specific specification filtering
      this.detectedModels = this.detectProductModels(p);
      const urlModel = urlParams.get('model');
      if (urlModel && (this.detectedModels.includes(urlModel) || urlModel === 'all')) {
        this.selectedModel = urlModel;
      } else if (this.detectedModels.length > 1) {
        // Default to the first individual model variant so specs are uncombined by default!
        this.selectedModel = this.detectedModels[0];
      } else {
        this.selectedModel = 'all';
      }

      this.isSpecsExpanded = urlParams.get('expand_specs') === 'true' || urlParams.get('expand') === 'specs';

      // Update Document Meta for SEO
      document.title = `${p.product_name} (${p.model_number || 'Standard'}) | HSMLE India Corporation`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute(
          'content',
          p.meta_description || `${p.product_name} - Official specifications, features and PDF catalogue from HSMLE India Corporation.`
        );
      }

      // Render Breadcrumbs
      this.renderBreadcrumbs(p);

      // Render Product Layout
      this.renderLayout(p);

      // Update Floating WhatsApp message with actual product name and model
      if (window.FloatingWhatsApp && window.WHATSAPP_CONFIG) {
        window.FloatingWhatsApp.updateMessage(
          window.WHATSAPP_CONFIG.productMessage(p.product_name, p.model_number)
        );
      }

      // Update Compare button state
      if (window.CompareManager) {
        window.CompareManager.updateCompareCheckboxes();
      }
    } catch (err) {
      this.renderNotFound(err.message);
    }
  },

  getSpecExplanation(key) {
    if (!key) return '';
    const low = key.toLowerCase().trim();
    if (SPEC_EXPLANATIONS[low]) return SPEC_EXPLANATIONS[low];
    if (low.startsWith('hardness scale (')) {
      return 'Test forces and Vickers scales supported by this specific model variant';
    }
    if (low.includes('temperature') && low.includes('range')) {
      return 'Operating temperature range controlled inside the test chamber';
    }
    if (low.includes('humidity') && low.includes('range')) {
      return 'Relative humidity (% RH) range maintained inside the chamber';
    }
    if (low.includes('motor')) {
      return 'Drive motor power rating and electrical specification';
    }
    if (low.includes('cool')) {
      return 'Recirculating coolant or thermal cooling system specification';
    }
    if (low.includes('illumination') || low.includes('light')) {
      return 'Optical lighting source for clear specimen observation';
    }
    return '';
  },

  formatSpecValueHtml(val) {
    if (!val) return '—';
    const str = String(val).trim();
    // If value contains pipe-separated multi-model or multi-part entries
    if (str.includes('|')) {
      const parts = str
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        return `
          <div class="flex flex-wrap gap-1.5">
            ${parts
              .map((part) => {
                const colonIdx = part.indexOf(':');
                if (colonIdx > 0 && colonIdx < 28) {
                  const mLabel = part.slice(0, colonIdx).trim();
                  const mVal = part.slice(colonIdx + 1).trim();
                  return `<span class="inline-flex items-center px-2.5 py-1 rounded-none border border-slate-200 bg-slate-100 border border-slate-200 text-xs text-slate-800 leading-snug"><strong class="font-mono text-blue-700 mr-1.5">${mLabel}:</strong><span>${mVal}</span></span>`;
                }
                return `<span class="inline-flex items-center px-2.5 py-1 rounded-none border border-slate-200 bg-slate-100 border border-slate-200 text-xs text-slate-800 leading-snug">${part}</span>`;
              })
              .join('')}
          </div>
        `;
      }
    }
    return `<span class="text-slate-800 text-xs sm:text-[13px] font-medium leading-relaxed">${str}</span>`;
  },

  formatSystematicOverview(p) {
    if (!p) return '';
    const rawDesc = typeof p === 'string' ? p : (p.description || '');
    let text = rawDesc
      .replace(/&#038;/g, '&')
      .replace(/&amp;/g, '&')
      .replace(/\uFFFD/g, '•')
      .trim();

    // 1. Extract Packaging Details
    let packaging = null;
    const pkgMatch = text.match(/Packaging Details\s*:\s*([^\n\r]+)/i);
    if (pkgMatch) {
      packaging = pkgMatch[1].trim();
      text = text.replace(pkgMatch[0], '');
    }

    // 2. Extract Lead Time
    let leadTime = null;
    const ltMatch = text.match(/Lead Time\s*:\s*([^\n\r]+)/i);
    if (ltMatch) {
      leadTime = ltMatch[1].trim();
      text = text.replace(ltMatch[0], '');
    }

    // 3. Extract Applications from description
    let applications = [];
    const appMatch = text.match(/(?:Main purpose and application|APPLICATIONS)\s*:(.*?)(?=(ACCESSORIES & OPTIONS|FEATURES|Main Features|$))/is);
    if (appMatch) {
      const rawApps = appMatch[1].trim();
      applications = rawApps
        .split('\n')
        .map((s) => s.trim().replace(/^(\d+[\.\)]|[•\-\*–\s\t])+\s*/, '').trim())
        .filter((s) => s.length > 0 && s !== '•');
      text = text.replace(appMatch[0], '');
    }

    // 4. Extract Features from description
    let descFeatures = [];
    const featMatch = text.match(/(?:Main Features|FEATURES)\s*:(.*?)(?=(ACCESSORIES & OPTIONS|$))/is);
    if (featMatch) {
      const rawFeat = featMatch[1].trim();
      descFeatures = rawFeat
        .split('\n')
        .map((s) => s.trim().replace(/^(\d+[\.\)]|[•\-\*–\s\t])+\s*/, '').trim())
        .filter((s) => s.length > 0 && s !== '•');
      text = text.replace(featMatch[0], '');
    }

    // 5. Extract Accessories & Options from description
    let accessories = [];
    const accMatch = text.match(/ACCESSORIES & OPTIONS\s*:(.*)/is);
    if (accMatch) {
      const rawAcc = accMatch[1].trim();
      accessories = rawAcc
        .split('\n')
        .map((s) => s.trim().replace(/^(\d+[\.\)]|[•\-\*–\s\t])+\s*/, '').trim())
        .filter((s) => s.length > 0 && s !== '•');
      text = text.replace(accMatch[0], '');
    }

    // 6. Incorporate features from database (p.features)
    const ignoredWords = new Set(['product', 'application', 'message', 'contact', 'home', 'about', 'enquiry', 'specifications']);
    const mainFeatures = [];
    
    if (p && p.features && Array.isArray(p.features)) {
      p.features.forEach((f) => {
        const txt = (typeof f === 'string' ? f : (f.feature_text || '')).trim();
        if (!txt || txt.length < 5 || ignoredWords.has(txt.toLowerCase())) return;
        
        // If it describes applications / specimen / testing purpose and we don't have applications yet
        const low = txt.toLowerCase();
        if ((low.includes('used to test') || low.includes('application') || low.includes('materials (steel') || low.includes('surface layer/coating') || low.includes('glass, chip')) && applications.length === 0) {
          if (!applications.includes(txt)) applications.push(txt);
        } else {
          if (!mainFeatures.includes(txt)) mainFeatures.push(txt);
        }
      });
    }

    descFeatures.forEach((f) => {
      if (f && !mainFeatures.includes(f)) mainFeatures.push(f);
    });

    // 7. Clean overview paragraphs
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let html = `<div class="space-y-4 text-slate-800 text-xs sm:text-sm">`;

    // Overview introductory narrative
    if (paragraphs.length > 0) {
      html += `
        <div class="space-y-2 text-slate-700 leading-relaxed">
          ${paragraphs.map((para) => `<p>${para}</p>`).join('')}
        </div>
      `;
    }

    // 1. Main purpose and application:
    if (applications.length > 0) {
      html += `
        <div>
          <h4 class="font-bold text-slate-900 text-xs sm:text-sm mb-2">Main purpose and application:</h4>
          <ol class="list-decimal pl-5 space-y-1.5 text-slate-700 leading-relaxed">
            ${applications.map((app) => `<li>${app}</li>`).join('')}
          </ol>
        </div>
      `;
    }

    // 2. Main Features:
    if (mainFeatures.length > 0) {
      html += `
        <div>
          <h4 class="font-bold text-slate-900 text-xs sm:text-sm mb-2">Main Features:</h4>
          <ol class="list-decimal pl-5 space-y-1.5 text-slate-700 leading-relaxed">
            ${mainFeatures.map((feat) => `<li>${feat}</li>`).join('')}
          </ol>
        </div>
      `;
    }

    // 3. Accessories & Options:
    if (accessories.length > 0) {
      html += `
        <div>
          <h4 class="font-bold text-slate-900 text-xs sm:text-sm mb-2">Accessories & Options:</h4>
          <ol class="list-decimal pl-5 space-y-1.5 text-slate-700 leading-relaxed">
            ${accessories.map((acc) => `<li>${acc}</li>`).join('')}
          </ol>
        </div>
      `;
    }

    // 4. Packaging Details (Lead Time completely excluded per requirement)
    if (packaging) {
      html += `
        <div class="pt-3 border-t border-slate-200/80 space-y-1.5">
          <div>
            <span class="font-bold text-slate-900">Packaging Details:</span>
            <span class="text-slate-700 ml-1.5">${packaging}</span>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  },

  getQuickHighlightSpecs(specs) {
    if (!specs || !specs.length) return [];
    // Filter out Model Number (already shown at top), long Standard Accessories, and sub-model-specific rows first
    const primary = [];
    const secondary = [];
    let hasScaleRow = false;

    for (const s of specs) {
      const k = (s.spec_key || '').toLowerCase();
      if (k.startsWith('model') || k.includes('accessories') || k.includes('packing') || k.includes('conversion')) {
        continue;
      }
      if (k.startsWith('hardness scale (')) {
        if (!hasScaleRow) {
          secondary.push(s);
          hasScaleRow = true;
        }
        continue;
      }
      primary.push(s);
    }

    const combined = [...primary, ...secondary];
    return (combined.length >= 4 ? combined : specs).slice(0, 6);
  },

  parseModelVariants(p) {
    const models = this.detectProductModels(p);
    const variants = models.filter((m) => m !== p.model_number);
    if (variants.length > 0) return variants.slice(0, 8);
    if (!p.all_detected_models) return [];
    const rawParts = p.all_detected_models
      .split(/[|;,]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 3 && s.length <= 32 && s !== p.model_number);
    return [...new Set(rawParts)].slice(0, 8);
  },

  detectProductModels(p) {
    if (!p) return [];
    const models = [];
    const seen = new Set();

    function addModel(m) {
      if (!m) return;
      let clean = m.trim().replace(/^[\s/,\-;|]+|[\s/,\-;|]+$/g, '');
      if (clean.length >= 2 && clean.length <= 40 && !clean.includes('http') && !clean.toLowerCase().startsWith('page')) {
        const low = clean.toLowerCase();
        if ([
          'name', 'quantity', 'standard', 'optional', 'accessories', 'table top model', 
          'sturdy floor model', 'are subject to change.', 'details/models', 'item', 'description'
        ].includes(low)) {
          return;
        }
        if (!seen.has(clean)) {
          seen.add(clean);
          models.push(clean);
        }
      }
    }

    // 1. Check Model Number / Series spec row
    if (p.specifications && p.specifications.length > 0) {
      for (const s of p.specifications) {
        const k = (s.spec_key || '').toLowerCase();
        if ((k.includes('model') || k.includes('series') || k.includes('variant')) && s.spec_value && s.spec_value.includes('|')) {
          const parts = s.spec_value.split('|').map((x) => x.trim()).filter(Boolean);
          if (parts.length >= 2 && parts.every((pt) => pt.length <= 45 && !pt.includes(':'))) {
            parts.forEach(addModel);
            break;
          }
        }
      }
    }

    // 2. If not found or only 1, check all_detected_models
    if (models.length < 2 && p.all_detected_models) {
      const parts = p.all_detected_models.split(/[|;]/).map((x) => x.trim()).filter(Boolean);
      parts.forEach(addModel);
    }

    // 3. Check colon prefixes in spec values (e.g. "HVH-5/10/30/50BA: Automatic | HVH-5/10/30/50BM: Manual")
    if (models.length < 2 && p.specifications) {
      for (const s of p.specifications) {
        if (s.spec_value && s.spec_value.includes('|') && s.spec_value.includes(':')) {
          const parts = s.spec_value.split('|');
          for (const pt of parts) {
            if (pt.includes(':')) {
              const prefix = pt.split(':')[0].trim();
              if (prefix.length >= 2 && prefix.length <= 35 && !prefix.toLowerCase().includes('note') && !prefix.toLowerCase().includes('temp')) {
                addModel(prefix);
              }
            }
          }
        }
      }
    }

    // 4. Fallback to model_number splitting if it contains &
    if (models.length < 2 && p.model_number && p.model_number.includes('&')) {
      const parts = p.model_number.split('&').map((x) => x.trim()).filter(Boolean);
      parts.forEach(addModel);
    }

    return models;
  },

  filterSpecsForModel(specs, selectedModel, allModels) {
    if (!specs || !specs.length) return [];
    if (!selectedModel || selectedModel === 'all') {
      return specs.map((s, idx) => ({
        index: idx + 1,
        key: s.spec_key,
        value: s.spec_value,
        isModelSpecific: false,
      }));
    }

    const selNorm = selectedModel.toLowerCase().trim();
    const filtered = [];
    let displayIndex = 1;

    for (const s of specs) {
      const k = s.spec_key || '';
      const v = s.spec_value || '';
      const kNorm = k.toLowerCase().trim();

      // Check if key specifies a parenthesized model: e.g. "Hardness Scale (HVH-5BA)"
      if (k.includes('(') && k.includes(')')) {
        const parenContent = k.slice(k.indexOf('(') + 1, k.indexOf(')')).toLowerCase().trim();
        let belongsToOther = false;
        let belongsToThis = false;

        for (const other of allModels) {
          if (other === selectedModel) continue;
          const otherNorm = other.toLowerCase();

          // Suffix or acronym matching: BA vs BM, AT vs MT
          if (selNorm.includes('ba') && otherNorm.includes('bm')) {
            if (parenContent.includes('bm') && !parenContent.includes('ba')) belongsToOther = true;
            if (parenContent.includes('ba')) belongsToThis = true;
          } else if (selNorm.includes('bm') && otherNorm.includes('ba')) {
            if (parenContent.includes('ba') && !parenContent.includes('bm')) belongsToOther = true;
            if (parenContent.includes('bm')) belongsToThis = true;
          } else if (selNorm.includes('at') && otherNorm.includes('mt')) {
            if (parenContent.includes('mt') && !parenContent.includes('at')) belongsToOther = true;
            if (parenContent.includes('at')) belongsToThis = true;
          } else if (selNorm.includes('mt') && otherNorm.includes('at')) {
            if (parenContent.includes('at') && !parenContent.includes('mt')) belongsToOther = true;
            if (parenContent.includes('mt')) belongsToThis = true;
          } else {
            if (parenContent.includes(otherNorm) && !parenContent.includes(selNorm)) {
              belongsToOther = true;
            }
          }
        }

        if (belongsToOther && !belongsToThis) {
          continue; // row belongs strictly to another model
        }
      }

      let finalValue = v;
      let isSpecific = false;

      if (v.includes('|')) {
        const parts = v.split('|').map((x) => x.trim()).filter(Boolean);
        let matchedVal = null;

        // 1. Colon-separated prefix match: "Model: Value"
        for (const part of parts) {
          if (part.includes(':')) {
            const colonIdx = part.indexOf(':');
            const pfx = part.slice(0, colonIdx).trim().toLowerCase();
            const pval = part.slice(colonIdx + 1).trim();

            if (pfx === selNorm || selNorm.includes(pfx) || pfx.includes(selNorm)) {
              matchedVal = pval;
              isSpecific = true;
              break;
            }

            if (selNorm.includes('ba') && pfx.includes('ba') && !pfx.includes('bm')) {
              matchedVal = pval;
              isSpecific = true;
              break;
            }
            if (selNorm.includes('bm') && pfx.includes('bm') && !pfx.includes('ba')) {
              matchedVal = pval;
              isSpecific = true;
              break;
            }
            if (selNorm.includes('at') && pfx.includes('at') && !pfx.includes('mt')) {
              matchedVal = pval;
              isSpecific = true;
              break;
            }
            if (selNorm.includes('mt') && pfx.includes('mt') && !pfx.includes('at')) {
              matchedVal = pval;
              isSpecific = true;
              break;
            }
          }
        }

        // 2. Positional match (e.g. 5 items for 5 models)
        if (!matchedVal && parts.length === allModels.length && allModels.includes(selectedModel)) {
          const modelIdx = allModels.indexOf(selectedModel);
          if (modelIdx >= 0 && modelIdx < parts.length) {
            matchedVal = parts[modelIdx];
            isSpecific = true;
          }
        }

        if (matchedVal) {
          finalValue = matchedVal;
        } else {
          // If row exclusively defines other models with colons, hide it
          let allOther = true;
          let colonCount = 0;
          for (const part of parts) {
            if (part.includes(':')) {
              colonCount++;
              const pfx = part.split(':')[0].trim().toLowerCase();
              const matchesOther = allModels.some((m) => m !== selectedModel && m.toLowerCase().includes(pfx));
              if (!matchesOther) allOther = false;
            }
          }
          if (colonCount >= 2 && allOther) {
            continue;
          }
        }
      }

      // If key is Model Number / Series, show only the selected model
      if (
        (kNorm.includes('model number') || kNorm.includes('model series') || kNorm === 'model') &&
        !kNorm.includes('accessories')
      ) {
        finalValue = selectedModel;
        isSpecific = true;
      }

      filtered.push({
        index: displayIndex++,
        key: k,
        value: finalValue,
        isModelSpecific: isSpecific,
      });
    }

    return filtered;
  },

  selectModel(modelName) {
    this.selectedModel = modelName;
    
    // Update active tab buttons styling
    const tabsContainer = document.getElementById('model-tabs-container');
    if (tabsContainer) {
      tabsContainer.innerHTML = this.renderModelTabsHtml();
    }

    // Update status badge
    const badge = document.getElementById('model-filter-badge');
    if (badge) {
      if (modelName === 'all') {
        badge.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-blue-500"></span>
          <span>Showing: <strong>All Models (Combined)</strong></span>
        `;
      } else {
        badge.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Active Model: <strong>${modelName}</strong></span>
        `;
      }
    }

    // Re-render specifications table
    this.renderSpecificationsTable();
  },

  renderModelTabsHtml() {
    if (!this.detectedModels || this.detectedModels.length < 2) return '';
    
    const tabs = [];
    
    // Individual Model Tabs
    for (const model of this.detectedModels) {
      const isActive = this.selectedModel === model;
      tabs.push(`
        <button
          type="button"
          onclick="ProductDetail.selectModel('${model.replace(/'/g, "\\'")}')"
          class="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
            isActive
              ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30 border border-blue-600'
              : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-300'
          }"
          title="View isolated specifications for model ${model}"
        >
          ${
            isActive
              ? `<svg class="w-4 h-4 text-white shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>`
              : `<span class="w-2 h-2 rounded-full bg-slate-300"></span>`
          }
          <span>${model}</span>
        </button>
      `);
    }

    // All Models / Combined Tab
    const isAllActive = this.selectedModel === 'all';
    tabs.push(`
      <button
        type="button"
        onclick="ProductDetail.selectModel('all')"
        class="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-2 cursor-pointer ml-auto ${
          isAllActive
            ? 'bg-slate-800 text-white shadow-sm border border-slate-800'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
        }"
        title="View combined parameters for all models in comparison mode"
      >
        <svg class="w-4 h-4 ${isAllActive ? 'text-blue-400' : 'text-slate-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
        </svg>
        <span>All Models (Combined)</span>
      </button>
    `);

    return tabs.join('');
  },

  renderSpecificationsTable() {
    const tableContainer = document.getElementById('specs-table-container');
    if (!tableContainer || !this.product) return;

    const filtered = this.filterSpecsForModel(
      this.product.specifications,
      this.selectedModel,
      this.detectedModels
    );

    // Update param count badge at top of section
    const countBadge = document.getElementById('specs-count-badge');
    if (countBadge) {
      if (this.selectedModel && this.selectedModel !== 'all') {
        countBadge.textContent = `${filtered.length} Parameters (${this.selectedModel})`;
      } else {
        countBadge.textContent = `${filtered.length} Verified Parameters`;
      }
    }

    const cutoff = 10;
    const hasMany = filtered.length > cutoff;
    const shouldHideExtra = hasMany && !this.isSpecsExpanded;

    tableContainer.innerHTML = `
      <div class="rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div class="overflow-x-auto">
          <table class="spec-table w-full">
            <thead>
              <tr class="bg-blue-600 text-white">
                <th class="w-1/3 sm:w-1/4 py-3.5 px-4 text-left font-bold text-xs uppercase tracking-wider">Specification Parameter</th>
                <th class="w-2/3 sm:w-3/4 py-3.5 px-4 text-left font-bold text-xs uppercase tracking-wider">
                  ${
                    this.selectedModel && this.selectedModel !== 'all'
                      ? `Technical Specification Value — <span class="text-blue-100 font-mono underline underline-offset-2">${this.selectedModel}</span>`
                      : `Verified Technical Value / Model Configuration`
                  }
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              ${filtered
                .map((s, idx) => {
                  const explanation = this.getSpecExplanation(s.key);
                  const isExtra = shouldHideExtra && idx >= cutoff;
                  return `
                    <tr class="${isExtra ? 'spec-row-extra hidden' : ''} hover:bg-blue-50/40 transition">
                      <td class="align-top py-3.5 px-4 bg-slate-50/60 sm:bg-transparent">
                        <div class="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                          <span class="w-6 h-6 rounded border border-blue-400 bg-blue-50 text-blue-700 text-xs font-mono font-bold flex items-center justify-center shrink-0">${s.index}</span>
                          <span>${s.key}</span>
                        </div>
                        ${
                          explanation
                            ? `<div class="text-[11px] text-slate-500 font-normal mt-0.5 ml-7 leading-snug">${explanation}</div>`
                            : ''
                        }
                      </td>
                      <td class="align-top py-3.5 px-4">
                        ${this.formatSpecValueHtml(s.value)}
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>

        ${
          hasMany
            ? `
          <div class="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div class="text-xs text-slate-500">
              Showing <span class="font-bold text-slate-800" id="specs-shown-count">${this.isSpecsExpanded ? `all ${filtered.length}` : `top ${cutoff}`}</span> of <span class="font-bold text-slate-800">${filtered.length}</span> parameters ${this.selectedModel && this.selectedModel !== 'all' ? `for <strong class="text-blue-700">${this.selectedModel}</strong>` : ''}
            </div>
            <button 
              id="toggle-specs-btn" 
              type="button"
              onclick="ProductDetail.toggleSpecsExpand()"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 font-bold text-xs sm:text-sm border border-blue-400 transition group cursor-pointer shadow-xs"
            >
              <span id="toggle-specs-text">${this.isSpecsExpanded ? 'Show Less Specifications' : `View All ${filtered.length} Specifications (${filtered.length - cutoff} More Parameters)`}</span>
              <svg id="toggle-specs-icon" class="w-4 h-4 transition-transform duration-200 group-hover:translate-y-0.5 ${this.isSpecsExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
          </div>
        `
            : ''
        }
      </div>
    `;
  },

  selectGalleryImage(idx) {
    if (!this.galleryUrls || idx < 0 || idx >= this.galleryUrls.length) return;
    this.activeImageIndex = idx;
    const mainImg = document.getElementById('main-product-image');
    if (mainImg) {
      mainImg.src = this.galleryUrls[idx];
    }
    const counterBadge = document.getElementById('gallery-counter-badge');
    if (counterBadge) {
      counterBadge.textContent = `Photo ${idx + 1} of ${this.galleryUrls.length}`;
    }
    document.querySelectorAll('.product-gallery-thumb').forEach((btn, bIdx) => {
      if (bIdx === idx) {
        btn.classList.add('border-blue-600', 'ring-2', 'ring-blue-500/30', 'bg-blue-50/30');
        btn.classList.remove('border-slate-900', 'opacity-75');
      } else {
        btn.classList.remove('border-blue-600', 'ring-2', 'ring-blue-500/30', 'bg-blue-50/30');
        btn.classList.add('border-slate-900', 'opacity-75');
      }
    });
  },

  stepGallery(delta) {
    if (!this.galleryUrls || this.galleryUrls.length <= 1) return;
    const nextIdx = (this.activeImageIndex + delta + this.galleryUrls.length) % this.galleryUrls.length;
    this.selectGalleryImage(nextIdx);
  },

  openLightbox() {
    const currentUrl = this.galleryUrls[this.activeImageIndex] || window.API.resolveImageUrl(this.product?.image_url);
    let modal = document.getElementById('machine-photo-lightbox');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'machine-photo-lightbox';
      modal.className = 'fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4';
      modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      };
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="relative bg-white rounded-none border border-slate-200  max-w-4xl w-full p-6  flex flex-col items-center">
        <button onclick="document.getElementById('machine-photo-lightbox').classList.add('hidden')" class="absolute top-4 right-4 w-9 h-9 rounded-none border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center">✕</button>
        <div class="w-full h-[70vh] flex items-center justify-center p-4">
          <img src="${currentUrl}" alt="${this.product?.product_name || 'Machine Photograph'}" class="max-h-full max-w-full object-contain">
        </div>
        <div class="mt-2 text-center">
          <p class="text-sm font-bold text-slate-900">${this.product?.product_name || ''}</p>
          <p class="text-xs font-mono text-blue-600">Model: ${this.product?.model_number || 'Standard'}</p>
        </div>
      </div>
    `;
    modal.classList.remove('hidden');
  },

  renderBreadcrumbs(p) {
    const nav = document.getElementById('product-breadcrumbs');
    if (!nav) return;

    nav.innerHTML = `
      <ol class="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto whitespace-nowrap py-1">
        <li><a href="index.html" class="hover:text-blue-600 transition">Home</a></li>
        <li><span>/</span></li>
        <li><a href="products.html" class="hover:text-blue-600 transition">Catalogue</a></li>
        <li><span>/</span></li>
        <li><a href="products.html?category=${encodeURIComponent(p.category_slug || p.category_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}" class="hover:text-blue-600 transition">${p.category_name}</a></li>
        ${
          p.subcategory_name
            ? `
          <li><span>/</span></li>
          <li class="text-slate-700">${p.subcategory_name}</li>
        `
            : ''
        }
        <li><span>/</span></li>
        <li class="font-semibold text-slate-900 line-clamp-1">${p.product_name}</li>
      </ol>
    `;
  },

  renderLayout(p) {
    const mainContainer = document.getElementById('product-detail-main');
    if (!mainContainer) return;

    const imgUrl = this.galleryUrls[0] || window.API.resolveImageUrl(p.image_url);
    const hasGallery = this.galleryUrls && this.galleryUrls.length > 1;
    const pdfUrl = window.API.resolveCatalogueUrl(p.catalogue_path);
    const downloadUrl = window.API.resolvePdfDownloadUrl(p.id);
    const modelVariants = this.parseModelVariants(p);

    mainContainer.innerHTML = `
      <!-- Product Header & Key Info -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-10">
        <!-- Machine Media Gallery (Left Column) -->
        <div class="lg:col-span-6 bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center lg:sticky lg:top-24">
          <div class="w-full h-96 sm:h-[480px] lg:h-[520px] bg-white rounded-lg border border-slate-200 p-2 flex items-center justify-center relative overflow-hidden group">
            <img 
              id="main-product-image"
              src="${imgUrl}" 
              alt="${p.product_name}" 
              onclick="ProductDetail.openLightbox()"
              class="w-full h-full object-contain cursor-zoom-in transition-transform duration-300 group-hover:scale-105"
              onerror="this.onerror=null;this.src='/assets/images/product-placeholder.svg'"
            >
            ${
              hasGallery
                ? `
              <span id="gallery-counter-badge" class="absolute top-3 left-3 bg-slate-900/80 backdrop-blur text-white text-[11px] font-semibold px-2.5 py-1 rounded-none border border-slate-200 ">
                Photo 1 of ${this.galleryUrls.length}
              </span>
              <button 
                onclick="ProductDetail.stepGallery(-1)" 
                class="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-none border border-slate-200 bg-white/90 hover:bg-white border border-slate-200  flex items-center justify-center text-slate-700 hover:text-blue-600 transition"
                title="Previous Photograph"
              >
                ‹
              </button>
              <button 
                onclick="ProductDetail.stepGallery(1)" 
                class="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-none border border-slate-200 bg-white/90 hover:bg-white border border-slate-200  flex items-center justify-center text-slate-700 hover:text-blue-600 transition"
                title="Next Photograph"
              >
                ›
              </button>
            `
                : ''
            }
            ${
              !p.has_verified_image
                ? `
              <div class="absolute bottom-3 left-3 bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold px-3 py-1 rounded-none border border-slate-200 ">
                Marked for Image Replacement (ID #${p.id})
              </div>
            `
                : ''
            }
          </div>

          ${
            hasGallery
              ? `
            <!-- Multi-Photograph Thumbnail Gallery -->
            <div class="w-full mt-3 pt-3 border-t border-slate-900">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Product Photograph Gallery (${this.galleryUrls.length} Views)</span>
                <span class="text-[11px] text-slate-400">Click thumbnail to switch view</span>
              </div>
              <div class="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                ${this.galleryUrls
                  .map(
                    (gUrl, gIdx) => `
                  <button 
                    type="button"
                    onclick="ProductDetail.selectGalleryImage(${gIdx})"
                    class="product-gallery-thumb h-20 bg-white rounded-none border border-slate-200 border p-1.5 flex items-center justify-center transition overflow-hidden ${
                      gIdx === 0
                        ? 'border-blue-600 ring-2 ring-blue-500/30 bg-blue-50/30'
                        : 'border-slate-900 opacity-75 hover:opacity-100'
                    }"
                  >
                    <img src="${gUrl}" alt="${p.product_name} View ${gIdx + 1}" class="w-full h-full object-contain">
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
              : ''
          }

          <!-- Quick Document actions under image -->
          <div class="grid grid-cols-2 gap-3 w-full mt-4">
            <button 
              onclick="window.openPdfModal('${pdfUrl}', '${p.product_name.replace(/'/g, "\\'")}')" 
              class="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-none border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <svg class="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path>
              </svg>
              View Catalogue
            </button>

            <a 
              href="${downloadUrl}" 
              target="_blank"
              download
              class="w-full py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-none border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
              </svg>
              Download PDF
            </a>
          </div>
        </div>

        <!-- Machine Identification & Overview (Right Column) -->
        <div class="lg:col-span-6 flex flex-col justify-between space-y-5">
          <div>
            <!-- Category & Certification Badges -->
            <div class="flex flex-wrap items-center gap-2 mb-2.5">
              <span class="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200/60 px-2.5 py-1 rounded-none border border-slate-200">
                ${p.category_name}
              </span>
              <span class="badge-iso text-[11px]">ISO 9001:2015 CERTIFIED</span>

            </div>

            <!-- Machine Title -->
            <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight mb-4">
              ${p.product_name}
            </h1>

            <!-- Structured Model Identification Card -->
            <div class="p-4 bg-white rounded-xl border border-slate-200 mb-4 space-y-2.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2.5">
                  <span class="px-2.5 py-1 bg-slate-900 text-white font-mono text-xs font-bold border border-slate-700">
                    Machine ID: #${p.id}
                  </span>
                  <span class="text-xs font-black text-slate-900 uppercase tracking-wider">Primary Model:</span>
                  <span class="px-2.5 py-1 bg-blue-600 text-white font-mono text-xs sm:text-sm font-bold rounded-none border border-slate-200">
                    ${p.model_number || 'Standard'}
                  </span>
                </div>
                <span class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-none border border-slate-200">
                  ✓ Factory Calibrated
                </span>
              </div>
              ${
                modelVariants.length > 0
                  ? `
                <div class="pt-2 border-t border-slate-900">
                  <span class="text-xs font-black text-slate-900 uppercase tracking-wider block mb-1.5">Available Model Series Variants:</span>
                  <div class="flex flex-wrap gap-1.5">
                    ${modelVariants
                      .map(
                        (mv) => `
                      <button 
                        type="button"
                        onclick="ProductDetail.selectModel('${mv.replace(/'/g, "\\'")}'); document.getElementById('full-specifications-section')?.scrollIntoView({ behavior: 'smooth' });"
                        class="px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-400 rounded-md font-mono text-[11px] font-bold text-slate-700 hover:text-blue-700 shadow-2xs transition cursor-pointer flex items-center gap-1"
                        title="Click to view specifications for model ${mv}"
                      >
                        <span>${mv}</span>
                        <svg class="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                      </button>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              `
                  : ''
              }
            </div>

            <!-- Clean Full Description -->
            <div class="text-slate-600 text-xs sm:text-sm leading-relaxed mb-4 bg-white p-4 rounded-xl border border-slate-200 ">
              <span class="text-xs font-black uppercase tracking-wider text-blue-600 block mb-1.5">Instrument Overview</span>
              ${this.formatSystematicOverview(p)}
            </div>

            <!-- Quick Specs Summary Row (Compact Horizontal Pills) -->
            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-2">
              <span class="font-bold text-slate-700">Jump to:</span>
              <a href="#full-specifications-section" class="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 font-semibold rounded-none border border-slate-200 hover:bg-blue-100 transition">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                Complete Technical Specifications (${p.specifications.length} Parameters)
              </a>
              <a href="#catalogue-actions-section" class="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 font-semibold rounded-none border border-slate-200 hover:bg-slate-200 transition">
                Official Catalogue Options
              </a>
            </div>
          </div>

          <!-- CTAs & Action Buttons Card (Fixed Layout) -->
          <div class="p-5 bg-white rounded-xl border border-slate-200 space-y-3.5">
            <div class="flex flex-col sm:flex-row gap-3">
              <button 
                onclick="RFQ.addItem({id: ${p.id}, product_name: '${p.product_name.replace(/'/g, "\\'")}', model_number: '${(p.model_number || '').replace(/'/g, "\\'")}', image_url: '${p.image_url}'})" 
                class="flex-1 py-3 px-5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition flex items-center justify-center gap-2"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Request Quotation (RFQ)
              </button>

              <button 
                onclick="window.openEnquiryModal({id: ${p.id}, product_name: '${p.product_name.replace(/'/g, "\\'")}', model_number: '${(p.model_number || '').replace(/'/g, "\\'")}'})" 
                class="py-3 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-sm transition flex items-center justify-center gap-2"
              >
                <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                </svg>
                Direct Enquiry
              </button>
            </div>
          </div>
        </div>
      </div>

      ${
        (() => {
          if (!p.video_url) return '';
          const isMp4 = p.video_url.toLowerCase().endsWith('.mp4') || p.video_url.includes('/static/videos/') || p.video_url.toLowerCase().includes('.mp4?');
          const resolvedVideoSrc = isMp4 ? (API.resolveVideoUrl ? API.resolveVideoUrl(p.video_url) : p.video_url) : p.video_url;

          return `
      <!-- Factory Demonstration Video Section -->
      <div class="w-full bg-slate-900 rounded-none border border-slate-800 p-6 sm:p-8 mb-10 text-white shadow-xl">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 mb-6 gap-3">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 rounded-none bg-blue-600 flex items-center justify-center text-white text-base font-bold shadow-lg shadow-blue-600/30">
              ▶
            </span>
            <div>
              <h2 class="text-lg sm:text-xl font-bold text-white tracking-wide flex items-center gap-2">
                ${isMp4 ? 'Official 30-Second Product Demonstration' : 'Factory Demonstration & Video Operation'}
              </h2>
              <p class="text-xs text-slate-400 mt-0.5">
                ${isMp4 ? 'Certified 30-second industrial metrology inspection cycle for Model ' : 'Official OEM machinery testing operation for Model '}${p.model_number || p.product_name}
              </p>
            </div>
          </div>
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-none text-xs font-semibold ${isMp4 ? 'bg-emerald-950 text-emerald-300 border-emerald-800/60' : 'bg-blue-950 text-blue-300 border-blue-800/60'} border self-start sm:self-auto font-mono">
            <span class="w-2 h-2 rounded-full ${isMp4 ? 'bg-emerald-400' : 'bg-red-500'} animate-pulse"></span>
            ${isMp4 ? '1080p 30s HD Stream' : 'HD Video Feed'}
          </span>
        </div>
        <div class="relative w-full aspect-video rounded-none overflow-hidden bg-black border border-slate-800 shadow-2xl group">
          ${isMp4 ? `
          <video 
            src="${resolvedVideoSrc}" 
            controls 
            playsinline 
            preload="metadata"
            poster="${imgUrl || ''}"
            class="w-full h-full object-contain bg-black"
          >
            Your browser does not support HTML5 video playback.
          </video>
          ` : `
          <iframe 
            src="${p.video_url}" 
            title="${p.product_name} Demonstration Video"
            class="w-full h-full" 
            allowfullscreen 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          ></iframe>

          <!-- HSMLE Protective Brand Shield Overlay (Conceals Chinese OEM Watermark) -->
          <div class="absolute top-0 left-0 z-20 pointer-events-none max-w-[90%] sm:max-w-md bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/80 backdrop-blur-md px-3.5 sm:px-5 py-2 sm:py-2.5 border-b border-r border-slate-700/80 shadow-2xl flex items-center gap-2.5 sm:gap-3">
            <img src="assets/images/hsmle-diamond-white.png" alt="HSMLE Logo" class="h-6 sm:h-8 w-auto object-contain shrink-0 filter drop-shadow">
            <div class="flex flex-col text-left">
              <span class="text-[11px] sm:text-xs font-extrabold text-white tracking-wider leading-tight flex items-center gap-1.5 sm:gap-2">
                HSMLE INDIA CORPORATION
                <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </span>
              <span class="text-[8px] sm:text-[9px] text-amber-400 font-mono tracking-widest uppercase font-semibold mt-0.5">
                Certified Industrial Metrology Operation
              </span>
            </div>
          </div>
          `}

          <!-- Top-Right Official Inspection Master Badge -->
          <div class="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-20 pointer-events-none hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-none shadow-xl text-[10px] font-mono text-slate-300">
            <span class="text-amber-400 font-bold">ISO 9001:2015</span>
            <span class="text-slate-600">|</span>
            <span class="text-emerald-400 font-semibold">Factory Certified</span>
          </div>
        </div>
      </div>
      `;
        })()
      }

      <!-- Complete Technical Specifications Section (Expanded Horizontally Full Width) -->
      <div id="full-specifications-section" class="w-full bg-white rounded-xl border border-slate-200 p-6 sm:p-8 mb-10 scroll-mt-24">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-900 mb-6">
          <div>
            <h2 class="text-xl font-bold text-slate-900 flex items-center gap-2">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Complete Technical Specifications
            </h2>
            <p class="text-xs text-slate-500 mt-1">
              Comprehensive factory parameters and model capacities directly verified from official HSMLE technical documentation
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span id="specs-count-badge" class="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-none font-mono">
              ${p.specifications ? p.specifications.length : 0} Verified Parameters
            </span>
            <button 
              onclick="window.openPdfModal('${pdfUrl}', '${p.product_name.replace(/'/g, "\\'")}')" 
              class="text-xs font-semibold text-slate-600 hover:text-blue-600 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-none border border-slate-200 transition"
            >
              Verify with Original PDF
            </button>
          </div>
        </div>

        ${
          this.detectedModels && this.detectedModels.length > 1
            ? `
          <!-- Machine Model / Variant Filter Tabs Bar -->
          <div id="model-selector-container" class="mb-6 p-4 sm:p-5 bg-gradient-to-r from-slate-50 via-blue-50/25 to-slate-50 border border-slate-200 rounded-xl">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shrink-0">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                  </svg>
                </div>
                <div>
                  <h3 class="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wide">Select Machine Model / Variant</h3>
                  <p class="text-[11px] text-slate-500">Click a specific model to display its isolated factory specifications</p>
                </div>
              </div>
              <div id="model-filter-badge" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-white border border-blue-200 text-blue-700 shadow-2xs">
                ${
                  this.selectedModel && this.selectedModel !== 'all'
                    ? `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span>Active Model: <strong>${this.selectedModel}</strong></span>`
                    : `<span class="w-2 h-2 rounded-full bg-blue-500"></span><span>Showing: <strong>All Models (Combined)</strong></span>`
                }
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80" id="model-tabs-container">
              ${this.renderModelTabsHtml()}
            </div>
          </div>
        `
            : ''
        }

        ${
          p.specifications && p.specifications.length > 0
            ? `
          <div id="specs-table-container"></div>
        `
            : `
          <div class="p-8 bg-slate-50 rounded-none border border-slate-200 text-center text-slate-500 text-xs">
            <p>Detailed technical specifications for <strong>${p.product_name}</strong> are comprehensively documented in the official PDF catalogue.</p>
            <button 
              onclick="window.openPdfModal('${pdfUrl}', '${p.product_name.replace(/'/g, "\\'")}')" 
              class="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-none border border-slate-200 text-xs font-semibold transition"
            >
              Open Official Catalogue PDF
            </button>
          </div>
        `
        }

      </div>

      <!-- Official Product Catalogue Options (No Embedded Catalogue iframe, Two Clear Options: View and Download) -->
      <div id="catalogue-actions-section" class="w-full bg-white rounded-xl border border-slate-200 p-6 sm:p-8 mb-12">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="flex items-start gap-4">
            <div class="w-14 h-14 bg-red-50 text-red-600 rounded-none border border-slate-200  border border-red-200 flex items-center justify-center shrink-0 ">
              <svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"></path>
              </svg>
            </div>
            <div>
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <h3 class="text-lg font-bold text-slate-900">Official Product Catalogue</h3>
                <span class="px-2.5 py-0.5 rounded-none border border-slate-200 text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                  ${p.catalogue_pages || 1} Pages • ${(p.catalogue_size_bytes / 1024).toFixed(0)} KB
                </span>
              </div>
              <p class="text-xs text-slate-500 mb-1.5">
                Authentic technical catalogue document directly from HSMLE India Corporation manufacturer archives.
              </p>
              <p class="text-[11px] font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded-none border border-slate-200 inline-block">
                File: ${p.original_filename}
              </p>
            </div>
          </div>

          <!-- Two Options: View Catalogue & Download Catalogue -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button 
              onclick="window.openPdfModal('${pdfUrl}', '${p.product_name.replace(/'/g, "\\'")}')" 
              class="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs sm:text-sm transition flex items-center justify-center gap-2"
              title="Open and read catalogue inside interactive viewer"
            >
              <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
              View Catalogue
            </button>

            <a 
              href="${downloadUrl}" 
              target="_blank" 
              download 
              class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs sm:text-sm transition flex items-center justify-center gap-2"
              title="Download official PDF to your computer"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
              </svg>
              Download Catalogue
            </a>
          </div>
        </div>
      </div>
    `;

    // Render the initial model-filtered specifications table
    this.renderSpecificationsTable();
  },

  toggleSpecsExpand() {
    this.isSpecsExpanded = !this.isSpecsExpanded;
    this.renderSpecificationsTable();
    if (!this.isSpecsExpanded) {
      const specsSection = document.getElementById('full-specifications-section');
      if (specsSection) {
        specsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  },

  renderNotFound(message) {
    const mainContainer = document.getElementById('product-detail-main');
    if (!mainContainer) return;

    mainContainer.innerHTML = `
      <div class="text-center py-20 bg-white rounded-none border border-slate-200 p-8  my-8">
        <div class="w-16 h-16 bg-red-50 text-red-600 rounded-none border border-slate-200 flex items-center justify-center mx-auto mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </div>
        <h2 class="text-xl font-bold text-slate-900 mb-2">Product Not Found</h2>
        <p class="text-sm text-slate-500 max-w-md mx-auto mb-6">${message || 'The requested machine model does not exist or has been relocated in the catalogue.'}</p>
        <a href="products.html" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-none border border-slate-200 text-xs  transition">
          Browse All 713 Products
        </a>
      </div>
    `;
  },
};

window.ProductDetail = ProductDetail;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('product-detail-main')) {
    ProductDetail.init();
  }
});
