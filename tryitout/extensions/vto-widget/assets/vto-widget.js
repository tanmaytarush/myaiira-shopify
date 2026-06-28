(function () {
  window.__AIIRA_VTO__ = true;
  const PROXY = "/apps/myaiira/vto";
  const BG_TEXTURE =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBNeRxuDQucEBOxMKI30q7YCMgzL1csVWhEp2UVdkF7Ge52679lmZa2bhmAz8LrIsweamenq_uwvYdRH-EJWjRT7DulhV3Zzk8v_bNABJZFJojxiOO5rt9HbvjN_sJOuNDsMRrBF4sSSApirt555fL2p1izpc-EU-Bs6oiS-Kq8Rx7MCUyDG5O5byrBrudXYg8MN8jQd5Y_ntWgnlT6mlK_AtTlERg5lYgx4O0UFldZ-Zm36WEQ59V6P4vOG7k68AknPGRjEku2Nwr8";
  const GENERATING_AVATAR =
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDO00AH16yevQSG95Sq83n1FW-wrxcXTBHdmJkvQPQy5pNZn2UOlKzJL41LcQGyNKkWPF8SZHgRHNivnv4fUeYz32hrOBsEdZYTGHD6p0Q2WFI8u1MUz1ZsiGPbz_u90KFlLCYMNIEYtHuNfHeznM04FRYVO7vfVORVDlzGRnZiTbfJvqrF6ARG3EnnMV77LLZpT1nCG_OdvT1SPgvJfBQFJe-GsuTwvIOfk_4FcTpZk3J4auRDMqrd74N3oU3_a--0MkPDFMymEyun";

  const STEPS = [
    { label: "Step 01: Capture Identity", status: "Waiting for input", activeDot: 0 },
    { label: "Step 02: Analyse Silhouette", status: "Mapping proportions", activeDot: 1 },
    { label: "Step 03: Virtual Styling", status: "Processing Geometry", activeDot: 2 },
    { label: "Step 04: Final Result", status: "Rendering Complete", activeDot: 3 },
  ];

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function formatMoney(cents, currency) {
    if (cents == null) return "";
    const amount = Number(cents) / 100;
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
      }).format(amount);
    } catch {
      return "$" + amount.toFixed(2);
    }
  }

  let modalEl = null;
  let zoomLevel = 1;
  let pollTimer = null;
  let currentProduct = null;
  let uploadedPreview = null;
  let swapModeOpen = false;
  let activeReplaceSlot = null;

  function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement("div");
    modalEl.className = "aiira-vto-overlay";
    modalEl.innerHTML = `
      <div class="aiira-vto-overlay__backdrop"></div>
      <div class="aiira-vto-overlay__bg-texture" style="background-image:url('${BG_TEXTURE}')"></div>
      <main class="aiira-vto-modal" role="dialog" aria-modal="true" aria-label="Atelier Virtual Try-On">
        <header class="aiira-vto-modal__header">
          <div class="aiira-vto-modal__header-text">
            <span class="aiira-eyebrow">SERVICE D'ATELIER</span>
            <h1 data-aiira-modal-title>Atelier — Virtual Try-On</h1>
          </div>
          <button type="button" class="aiira-vto-modal__close" data-aiira-close aria-label="Close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>
        <div class="aiira-vto-modal__body">
          <aside class="aiira-vto-modal__intro">
            <div>
              <span class="aiira-eyebrow aiira-vto-modal__intro-champagne">ESTHÉTIQUE</span>
              <h2 class="aiira-heading aiira-heading--md aiira-heading--italic" style="margin-top:1rem;">Styled for you</h2>
              <p class="aiira-body" style="margin-top:1.5rem;max-width:none;">
                Curated to enhance your silhouette using our proprietary AI model. Every fold, drape, and texture is calculated to reflect real-world physics and textile behavior.
              </p>
              <div class="aiira-vto-modal__engine">
                <div class="aiira-vto-modal__engine-icon">
                  <span class="material-symbols-outlined" style="font-size:1rem;">auto_fix_high</span>
                </div>
                <span class="aiira-vto-modal__engine-label">Vision Engine v4.2</span>
              </div>
            </div>
          </aside>
          <section class="aiira-vto-stage" data-aiira-stage>
            <div class="aiira-vto-stage__panel aiira-vto-stage__panel--interactive" data-aiira-upload>
              <div class="aiira-vto-stage__corners" aria-hidden="true">
                <span></span><span></span><span></span><span></span>
              </div>
              <div class="aiira-vto-upload__pulse">
                <div class="aiira-vto-upload__silhouette">
                  <span class="material-symbols-outlined">person</span>
                </div>
              </div>
              <h3 class="aiira-heading aiira-heading--md" style="margin-bottom:1rem;">Your model photo</h3>
              <p class="aiira-body" style="margin-bottom:2rem;">Upload one full-body photo of yourself.<br>We will style all look pieces onto you.</p>
              <button type="button" class="aiira-btn" data-aiira-select>SELECT IMAGE</button>
              <input type="file" accept="image/*" data-aiira-file class="aiira-vto-hidden" />
            </div>
            <div class="aiira-vto-stage__panel aiira-vto-hidden" data-aiira-generating>
              <div class="aiira-vto-stage__corners" aria-hidden="true">
                <span style="border-color:var(--aiira-champagne)"></span>
                <span style="border-color:var(--aiira-champagne)"></span>
                <span style="border-color:var(--aiira-champagne)"></span>
                <span style="border-color:var(--aiira-champagne)"></span>
              </div>
              <div class="aiira-vto-generating__gradient"></div>
              <div class="aiira-vto-generating__avatar">
                <img src="${GENERATING_AVATAR}" alt="" data-aiira-preview />
              </div>
              <h3 class="aiira-heading aiira-heading--md aiira-heading--italic" style="margin-bottom:1rem;">Atelier is styling you…</h3>
              <p class="aiira-body" data-aiira-generating-copy>Our Vision Engine is mapping the garment to your unique proportions.</p>
              <div class="aiira-vto-progress__bar"><div class="aiira-vto-progress__fill" data-aiira-fill></div></div>
            </div>
            <div class="aiira-vto-stage__panel aiira-vto-result__frame aiira-vto-hidden" data-aiira-result-wrap>
              <div class="aiira-vto-stage__corners" aria-hidden="true">
                <span></span><span></span><span></span><span></span>
              </div>
              <div class="aiira-vto-result__curtain" data-aiira-curtain></div>
              <div class="aiira-vto-result__media">
                <img data-aiira-result alt="Virtual try-on result" />
              </div>
              <div class="aiira-vto-result__zoom aiira-vto-hidden" data-aiira-zoom>
                <button type="button" data-zoom-out aria-label="Zoom out"><span class="material-symbols-outlined" style="font-size:1rem;">remove</span></button>
                <button type="button" class="aiira-vto-result__zoom-reset" data-zoom-reset>Reset</button>
                <button type="button" data-zoom-in aria-label="Zoom in"><span class="material-symbols-outlined" style="font-size:1rem;">add</span></button>
              </div>
            </div>
          </section>
          <aside class="aiira-vto-sidebar" data-aiira-sidebar></aside>
        </div>
        <footer class="aiira-vto-modal__footer">
          <div class="aiira-vto-modal__steps">
            <div class="aiira-vto-modal__dots" data-aiira-dots>
              <span class="aiira-vto-modal__dot is-active"></span>
              <span class="aiira-vto-modal__dot"></span>
              <span class="aiira-vto-modal__dot"></span>
              <span class="aiira-vto-modal__dot"></span>
            </div>
            <span class="aiira-vto-modal__step-label" data-aiira-step-label>${STEPS[0].label}</span>
          </div>
          <div class="aiira-vto-modal__status">
            <div class="aiira-vto-modal__orbit">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" fill="none" r="45" stroke="#E8E8E8" stroke-width="2"></circle>
                <circle cx="50" cy="5" fill="#C4A574" r="5"></circle>
              </svg>
              <div class="aiira-vto-modal__orbit-center">
                <span class="material-symbols-outlined">sync</span>
              </div>
            </div>
            <span class="aiira-vto-modal__status-text" data-aiira-status-text>${STEPS[0].status}</span>
          </div>
        </footer>
      </main>`;

    document.body.appendChild(modalEl);

    qs("[data-aiira-close]", modalEl).addEventListener("click", closeModal);
    modalEl.querySelector(".aiira-vto-overlay__backdrop").addEventListener("click", closeModal);

    qs("[data-aiira-select]", modalEl).addEventListener("click", function () {
      qs("[data-aiira-file]", modalEl).click();
    });

    const uploadPanel = qs("[data-aiira-upload]", modalEl);
    uploadPanel.addEventListener("click", function (e) {
      if (e.target.closest("[data-aiira-select]")) return;
      qs("[data-aiira-file]", modalEl).click();
    });

    uploadPanel.addEventListener("dragover", function (e) {
      e.preventDefault();
      uploadPanel.classList.add("aiira-vto-stage__panel--drag");
    });
    uploadPanel.addEventListener("dragleave", function () {
      uploadPanel.classList.remove("aiira-vto-stage__panel--drag");
    });
    uploadPanel.addEventListener("drop", function (e) {
      e.preventDefault();
      uploadPanel.classList.remove("aiira-vto-stage__panel--drag");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    qs("[data-aiira-file]", modalEl).addEventListener("change", function (e) {
      const file = e.target.files && e.target.files[0];
      if (file) handleFile(file);
    });

    qsa("[data-zoom-in],[data-zoom-out],[data-zoom-reset]", modalEl).forEach(function (btn) {
      btn.addEventListener("click", onZoomClick);
    });

    modalEl.addEventListener("click", function (e) {
      if (e.target.closest("[data-aiira-change-pieces]")) {
        e.preventDefault();
        e.stopPropagation();
        toggleSwapMode();
        return;
      }
      const presetBtn = e.target.closest("[data-aiira-apply-preset]");
      if (presetBtn) {
        e.preventDefault();
        applyLookPreset(Number(presetBtn.getAttribute("data-aiira-apply-preset")));
        return;
      }
      const slotBtn = e.target.closest("[data-aiira-replace-slot]");
      if (slotBtn && swapModeOpen) {
        e.preventDefault();
        selectReplaceSlot(Number(slotBtn.getAttribute("data-aiira-replace-slot")));
        return;
      }
      const altBtn = e.target.closest("[data-aiira-pick-alternative]");
      if (altBtn) {
        e.preventDefault();
        replaceSlotWithAlternative(Number(altBtn.getAttribute("data-aiira-pick-alternative")));
      }
    });

    return modalEl;
  }

  function setStep(stepIndex) {
    const step = STEPS[stepIndex] || STEPS[0];
    qsa("[data-aiira-dots] .aiira-vto-modal__dot", modalEl).forEach(function (dot, i) {
      dot.classList.toggle("is-active", i === step.activeDot);
    });
    qs("[data-aiira-step-label]", modalEl).textContent = step.label;
    qs("[data-aiira-status-text]", modalEl).textContent = step.status;
  }

  function setModalTitle(text) {
    qs("[data-aiira-modal-title]", modalEl).textContent = text;
  }

  function onZoomClick(e) {
    const img = qs("[data-aiira-result]", modalEl);
    if (!img || img.classList.contains("aiira-vto-hidden")) return;
    const btn = e.currentTarget;
    if (btn.hasAttribute("data-zoom-in")) {
      zoomLevel = Math.min(3, zoomLevel + 0.25);
    } else if (btn.hasAttribute("data-zoom-out")) {
      zoomLevel = Math.max(0.5, zoomLevel - 0.25);
    } else {
      zoomLevel = 1;
    }
    img.style.transform = "scale(" + zoomLevel + ")";
  }

  function closeModal() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    swapModeOpen = false;
    activeReplaceSlot = null;
    modalEl.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  function formatSubType(subType) {
    return String(subType || "item")
      .replace(/_/g, " ")
      .replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
  }

  function normalizeOutfitItem(item) {
    return {
      item_image_url: String(item.item_image_url || "").trim(),
      sub_type: String(item.sub_type || "item").trim().toLowerCase(),
      label: item.label ? String(item.label) : "",
    };
  }

  function parseOutfitAlternatives(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(function (entry, index) {
          if (Array.isArray(entry)) {
            return {
              name: "Look " + (index + 2),
              items: entry.map(normalizeOutfitItem).filter(function (item) {
                return item.item_image_url;
              }),
            };
          }
          if (entry && Array.isArray(entry.items)) {
            return {
              name: entry.name || "Look " + (index + 2),
              items: entry.items.map(normalizeOutfitItem).filter(function (item) {
                return item.item_image_url;
              }),
            };
          }
          return null;
        })
        .filter(function (look) {
          return look && look.items.length > 0;
        });
    } catch (_) {
      return [];
    }
  }

  function buildLookPresets(baseItems, alternativesRaw, lookName) {
    const looks = [
      {
        name: lookName || "Current look",
        items: baseItems.map(normalizeOutfitItem),
      },
    ];
    parseOutfitAlternatives(alternativesRaw).forEach(function (look) {
      looks.push(look);
    });
    return looks;
  }

  function getCatalogBySubType() {
    const catalog = {};
    if (!currentProduct || !currentProduct.lookPresets) return catalog;
    currentProduct.lookPresets.forEach(function (look) {
      look.items.forEach(function (item) {
        const key = item.sub_type;
        if (!catalog[key]) catalog[key] = [];
        const exists = catalog[key].some(function (entry) {
          return entry.item_image_url === item.item_image_url;
        });
        if (!exists) catalog[key].push(item);
      });
    });
    return catalog;
  }

  function getAlternativesForSlot(index) {
    const item = currentProduct.items[index];
    if (!item) return [];
    const catalog = getCatalogBySubType();
    return catalog[item.sub_type] || [];
  }

  function updateGeneratingCopy() {
    if (!currentProduct) return;
    const count = (currentProduct.items || []).length;
    qs("[data-aiira-generating-copy]", modalEl).textContent =
      "Styling " +
      count +
      " piece" +
      (count === 1 ? "" : "s") +
      " from " +
      currentProduct.title +
      " onto your photo.";
  }

  function toggleSwapMode() {
    swapModeOpen = !swapModeOpen;
    activeReplaceSlot = null;
    renderSidebar(currentProduct);
  }

  function applyLookPreset(presetIndex) {
    const preset = currentProduct.lookPresets[presetIndex];
    if (!preset) return;
    currentProduct.items = preset.items.map(function (item) {
      return Object.assign({}, item);
    });
    currentProduct.activeLookIndex = presetIndex;
    swapModeOpen = false;
    activeReplaceSlot = null;
    renderSidebar(currentProduct);
    updateGeneratingCopy();
  }

  function selectReplaceSlot(index) {
    if (!swapModeOpen) return;
    activeReplaceSlot = activeReplaceSlot === index ? null : index;
    renderSidebar(currentProduct);
  }

  function replaceSlotWithAlternative(altIndex) {
    if (activeReplaceSlot == null) return;
    const options = getAlternativesForSlot(activeReplaceSlot);
    const picked = options[altIndex];
    if (!picked) return;
    currentProduct.items[activeReplaceSlot] = Object.assign({}, picked);
    activeReplaceSlot = null;
    renderSidebar(currentProduct);
    updateGeneratingCopy();
  }

  function renderSwapPanel() {
    if (!swapModeOpen || !currentProduct) return "";

    const presets = currentProduct.lookPresets || [];
    const presetCards =
      presets.length > 1
        ? presets
            .map(function (look, index) {
              const isActive = currentProduct.activeLookIndex === index;
              const preview = look.items[0];
              return (
                '<button type="button" class="aiira-vto-preset' +
                (isActive ? " is-active" : "") +
                '" data-aiira-apply-preset="' +
                index +
                '">' +
                '<div class="aiira-vto-preset__img">' +
                (preview
                  ? '<img src="' + preview.item_image_url + '" alt="" loading="lazy" />'
                  : "") +
                "</div>" +
                '<span class="aiira-vto-preset__name">' +
                look.name +
                "</span>" +
                '<span class="aiira-vto-preset__count">' +
                look.items.length +
                " pieces</span>" +
                "</button>"
              );
            })
            .join("")
        : "";

    let alternativesHtml = "";
    if (activeReplaceSlot != null) {
      const slotItem = currentProduct.items[activeReplaceSlot];
      const options = getAlternativesForSlot(activeReplaceSlot);
      alternativesHtml =
        '<div class="aiira-vto-alternatives">' +
        '<p class="aiira-vto-alternatives__title">Replace ' +
        formatSubType(slotItem.sub_type) +
        "</p>" +
        '<div class="aiira-vto-alternatives__list">' +
        options
          .map(function (option, index) {
            const isCurrent = option.item_image_url === slotItem.item_image_url;
            return (
              '<button type="button" class="aiira-vto-alternative' +
              (isCurrent ? " is-current" : "") +
              '" data-aiira-pick-alternative="' +
              index +
              '">' +
              '<img src="' +
              option.item_image_url +
              '" alt="' +
              formatSubType(option.sub_type) +
              '" loading="lazy" />' +
              "</button>"
            );
          })
          .join("") +
        "</div></div>";
    }

    return (
      '<div class="aiira-vto-swap-panel">' +
      (presets.length > 1
        ? '<p class="aiira-vto-swap-panel__title">Choose a full look</p>' +
          '<div class="aiira-vto-presets">' +
          presetCards +
          "</div>"
        : "") +
      '<p class="aiira-vto-swap-panel__title">' +
      (presets.length > 1 ? "Or swap one piece" : "Tap a piece to replace it") +
      "</p>" +
      alternativesHtml +
      "</div>"
    );
  }

  function itemLabel(item) {
    return item.title || formatSubType(item.sub_type);
  }

  function renderSidebar(product) {
    const sidebar = qs("[data-aiira-sidebar]", modalEl);
    const items = product.items || [];
    const pieceCount = items.length;
    const price = formatMoney(product.price, product.currency);
    const itemsHtml = items
      .map(function (item, index) {
        const isEditing = swapModeOpen && activeReplaceSlot === index;
        const tag = swapModeOpen ? "button" : "article";
        const attrs =
          swapModeOpen
            ? ' type="button" data-aiira-replace-slot="' +
              index +
              '" aria-label="Replace ' +
              itemLabel(item) +
              '"'
            : "";
        return (
          "<" +
          tag +
          ' class="aiira-vto-item' +
          (isEditing ? " is-editing" : "") +
          (swapModeOpen ? " aiira-vto-item--swappable" : "") +
          '"' +
          attrs +
          ">" +
          '<div class="aiira-vto-item__img">' +
          '<img src="' +
          item.item_image_url +
          '" alt="' +
          itemLabel(item) +
          '" loading="lazy" />' +
          (swapModeOpen
            ? '<span class="aiira-vto-item__swap material-symbols-outlined" aria-hidden="true">swap_horiz</span>'
            : "") +
          "</div>" +
          '<p class="aiira-vto-item__type">' +
          itemLabel(item) +
          "</p>" +
          "</" +
          tag +
          ">"
        );
      })
      .join("");

    sidebar.innerHTML =
      "<div>" +
      '<span class="aiira-eyebrow" data-aiira-piece-count>YOUR LOOK · ' +
      pieceCount +
      " PIECE" +
      (pieceCount === 1 ? "" : "S") +
      "</span>" +
      '<p class="aiira-vto-sidebar__look-title">' +
      (product.title || "Atelier look") +
      "</p>" +
      '<p class="aiira-vto-sidebar__look-meta">' +
      (product.vendor || "Atelier") +
      " — " +
      price +
      "</p>" +
      renderSwapPanel() +
      '<div class="aiira-vto-items-list">' +
      itemsHtml +
      "</div>" +
      '<p class="aiira-vto-sidebar__hint" data-aiira-piece-hint>' +
      (swapModeOpen
        ? activeReplaceSlot != null
          ? "Pick a replacement above, or tap another piece"
          : "Tap any piece to swap it, or choose a full look above"
        : "One model photo · all pieces styled together") +
      "</p>" +
      '<button type="button" class="aiira-btn aiira-btn--wide aiira-btn--outline" data-aiira-change-pieces>' +
      '<span class="material-symbols-outlined" style="font-size:1rem;">' +
      (swapModeOpen ? "check" : "swap_horiz") +
      "</span>" +
      " " +
      (swapModeOpen ? "DONE" : "CHANGE PIECES") +
      "</button>" +
      "</div>" +
      '<p class="aiira-vto-sidebar__legal">' +
      "Precision fit mapping © 2024 Atelier AI Labs. Images are processed securely and never stored." +
      "</p>";
  }

  function showPanel(name) {
    qs("[data-aiira-upload]", modalEl).classList.toggle("aiira-vto-hidden", name !== "upload");
    qs("[data-aiira-generating]", modalEl).classList.toggle("aiira-vto-hidden", name !== "generating");
    qs("[data-aiira-result-wrap]", modalEl).classList.toggle("aiira-vto-hidden", name !== "result");

    const stage = qs("[data-aiira-stage]", modalEl);
    const body = qs(".aiira-vto-modal__body", modalEl);
    if (stage) stage.classList.toggle("is-result", name === "result");
    if (body) body.classList.toggle("is-result-view", name === "result");
  }

  function resetUpload() {
    zoomLevel = 1;
    uploadedPreview = null;
    showPanel("upload");
    setModalTitle("Atelier — Virtual Try-On");
    setStep(0);
    qs("[data-aiira-fill]", modalEl).style.width = "0%";
    qs("[data-aiira-file]", modalEl).value = "";
    qs("[data-aiira-zoom]", modalEl).classList.add("aiira-vto-hidden");
    const img = qs("[data-aiira-result]", modalEl);
    img.style.transform = "";
    img.removeAttribute("src");
    const curtain = qs("[data-aiira-curtain]", modalEl);
    if (curtain) {
      curtain.style.animation = "none";
      curtain.offsetHeight;
      curtain.style.animation = "";
    }
    if (currentProduct) {
      updateGeneratingCopy();
    }
  }

  function openModal(product) {
    const items = parseOutfitItems(product.itemsRaw) || product.items || null;
    if (!items || items.length === 0) {
      alert(
        "No look pieces linked yet. In Admin, add products to this look (theme editor → Look pieces, or product metafield vto_outfit_products).",
      );
      return;
    }

    product.items = items.map(normalizeOutfitItem);
    product.lookPresets = buildLookPresets(
      product.items,
      product.alternativesRaw,
      product.title,
    );
    product.activeLookIndex = 0;
    currentProduct = product;
    swapModeOpen = false;
    activeReplaceSlot = null;
    ensureModal();
    resetUpload();
    renderSidebar(product);
    updateGeneratingCopy();
    modalEl.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function resizeImageFile(file, maxDim) {
    maxDim = maxDim || 1200;
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(objectUrl);
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          function (blob) {
            if (!blob) {
              resolve(file);
              return;
            }
            resolve(
              new File([blob], file.name || "photo.jpg", { type: "image/jpeg" }),
            );
          },
          "image/jpeg",
          0.85,
        );
      };
      img.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  }

  async function handleFile(file) {
    if (!file || !currentProduct) return;

    const items = currentProduct.items || [];
    if (items.length === 0) {
      alert("Add at least one piece to your look before uploading a photo.");
      return;
    }

    const photoFile = await resizeImageFile(file);

    try {
      uploadedPreview = await readFileAsDataUrl(photoFile);
      const previewImg = qs("[data-aiira-preview]", modalEl);
      if (previewImg) previewImg.src = uploadedPreview;
    } catch (_) {
      /* keep default avatar */
    }

    showPanel("generating");
    setStep(1);
    qs("[data-aiira-fill]", modalEl).style.width = "10%";

    try {
      if (items.length === 0) {
        throw new Error("Add at least one piece to your look.");
      }

      setStep(2);
      qs("[data-aiira-fill]", modalEl).style.width = "25%";

      const formData = new FormData();
      formData.append("photo", photoFile);
      formData.append("product_id", String(currentProduct.id));
      formData.append("product_image_url", currentProduct.image || "");
      formData.append("product_title", currentProduct.title || "");
      formData.append("items", JSON.stringify(items));

      const res = await fetch(PROXY + "/jobs", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        let detail = "Job submit failed";
        try {
          const err = await res.json();
          if (err && err.error) detail = err.error;
        } catch (_) {
          detail = "Job submit failed (" + res.status + ")";
        }
        throw new Error(detail);
      }
      const data = await res.json();
      pollJob(data.job_id);
    } catch (err) {
      showPanel("upload");
      setStep(0);
      alert(err.message || "Something went wrong. Please try again.");
    }
  }

  function pollJob(jobId) {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async function () {
      try {
        const res = await fetch(PROXY + "/jobs/" + encodeURIComponent(jobId));
        if (!res.ok) throw new Error("Poll failed");
        const data = await res.json();
        const pct = data.progress || 0;
        qs("[data-aiira-fill]", modalEl).style.width = Math.max(25, pct) + "%";
        qs("[data-aiira-status-text]", modalEl).textContent = data.status || "Processing Geometry";

        if (data.status === "completed" && data.image_url) {
          clearInterval(pollTimer);
          showResult(data.image_url);
        } else if (data.status === "failed") {
          clearInterval(pollTimer);
          showPanel("upload");
          setStep(0);
          alert(data.error || "Try-on failed. Please try another photo.");
        }
      } catch (err) {
        clearInterval(pollTimer);
        showPanel("upload");
        setStep(0);
        alert(err.message);
      }
    }, 2000);
  }

  function showResult(url) {
    showPanel("result");
    setModalTitle("Your look is ready");
    setStep(3);

    const img = qs("[data-aiira-result]", modalEl);
    img.onload = function () {
      qs("[data-aiira-zoom]", modalEl).classList.remove("aiira-vto-hidden");
    };
    img.src = url;
    zoomLevel = 1;
    img.style.transform = "scale(1)";
  }

  function parseOutfitItems(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-aiira-open-vto]");
    if (!btn) return;
    e.preventDefault();
    openModal({
      id: btn.dataset.productId,
      title: btn.dataset.productTitle,
      image: btn.dataset.productImage,
      price: btn.dataset.productPrice,
      currency: btn.dataset.productCurrency,
      vendor: btn.dataset.productVendor,
      itemsRaw: btn.getAttribute("data-outfit-items"),
      alternativesRaw: btn.getAttribute("data-outfit-alternatives"),
    });
  });

  document.addEventListener("click", function (e) {
    const thumb = e.target.closest("[data-aiira-hero-src]");
    if (!thumb) return;
    const root = thumb.closest(".aiira-look-pdp__hero");
    const hero = root && qs(".aiira-look-pdp__hero-img", root);
    if (!hero) return;
    hero.style.opacity = "0";
    setTimeout(function () {
      hero.src = thumb.getAttribute("data-aiira-hero-src");
      hero.style.opacity = "1";
    }, 300);
    qsa(".aiira-look-pdp__thumb", root).forEach(function (t) {
      t.classList.toggle("is-active", t === thumb);
    });
  });

  document.addEventListener("click", function (e) {
    const pill = e.target.closest("[data-variant-id]");
    if (!pill || !pill.closest("[data-aiira-size-pills]")) return;
    const form = pill.closest(".aiira-look-pdp");
    const select = form && qs("[data-aiira-variant-select]", form);
    const variantId = pill.getAttribute("data-variant-id");
    if (select) select.value = variantId;
    qsa(".aiira-look-pdp__size", form).forEach(function (p) {
      p.classList.toggle("is-active", p === pill);
    });
  });

  qsa("[data-aiira-trends-track]").forEach(function (track) {
    const section = track.closest(".aiira-section, .aiira-trends");
    const prev = section && qs("[data-aiira-carousel-prev]", section);
    const next = section && qs("[data-aiira-carousel-next]", section);

    function scrollByCard(dir) {
      const card = track.querySelector(".aiira-look-card");
      if (!card) return;
      track.scrollBy({ left: dir * (card.offsetWidth + 24), behavior: "smooth" });
    }

    if (prev) prev.addEventListener("click", function () {
      scrollByCard(-1);
    });
    if (next) next.addEventListener("click", function () {
      scrollByCard(1);
    });

    track.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        track.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  });
})();
