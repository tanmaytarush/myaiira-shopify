(function () {
  const PROXY = "/apps/myaiira/vto";
  const VTO_TRYON_PATH = "/apps/myaiira/virtual-tryon";
  const DEFAULT_TRYON_WEBHOOK = "https://ai.talentool.in/webhook/virtual-tryon";
  const DEFAULT_UPLOAD_WEBHOOK = "https://ai.talentool.in/webhook/vto-user-upload";
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
  let activeReplaceSlot = null;
  let catalogSearchQuery = "";
  let catalogSearchLoading = false;
  let catalogSearchResults = [];
  let catalogSearchError = null;
  let catalogSearchSeq = 0;
  let catalogSearchTimer = null;

  function ensureModal() {
    if (modalEl) {
      const hasBuilder =
        qs("[data-aiira-catalog-results]", modalEl) &&
        qs("[data-aiira-catalog-search-input]", modalEl);
      if (!hasBuilder) {
        modalEl.remove();
        modalEl = null;
      }
    }
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
          <div class="aiira-vto-modal__header-actions">
            <button type="button" class="aiira-vto-modal__close" data-aiira-close aria-label="Close">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </header>
        <div class="aiira-vto-toolbar" data-aiira-search-strip aria-label="Catalog search"></div>
        <div class="aiira-vto-modal__body">
          <div class="aiira-vto-workspace">
            <section class="aiira-vto-catalog-results" data-aiira-catalog-results aria-label="Catalog products"></section>
            <div class="aiira-vto-upload-bar" data-aiira-upload-bar>
              <div class="aiira-vto-upload-bar__copy">
                <span class="aiira-vto-upload-bar__icon material-symbols-outlined" aria-hidden="true">portrait</span>
                <div>
                  <p class="aiira-vto-upload-bar__title">Upload model photo</p>
                  <p class="aiira-vto-upload-bar__sub" data-aiira-upload-hint>Add catalog pieces, then upload JPG or PNG</p>
                </div>
              </div>
              <button type="button" class="aiira-btn aiira-vto-upload-bar__btn" data-aiira-select>Upload photo</button>
              <input type="file" accept="image/*" data-aiira-file class="aiira-vto-hidden" />
            </div>
            <section class="aiira-vto-stage aiira-vto-hidden" data-aiira-stage>
              <div class="aiira-vto-stage__panel aiira-vto-hidden" data-aiira-upload></div>
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
          </div>
          <aside class="aiira-vto-sidebar" data-aiira-sidebar aria-label="Your selected look"></aside>
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

    qs("[data-aiira-select]", modalEl).addEventListener("click", function (e) {
      e.stopPropagation();
      qs("[data-aiira-file]", modalEl).click();
    });

    const uploadBar = qs("[data-aiira-upload-bar]", modalEl);
    uploadBar.addEventListener("dragover", function (e) {
      e.preventDefault();
      uploadBar.classList.add("is-drag");
    });
    uploadBar.addEventListener("dragleave", function () {
      uploadBar.classList.remove("is-drag");
    });
    uploadBar.addEventListener("drop", function (e) {
      e.preventDefault();
      uploadBar.classList.remove("is-drag");
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
      if (e.target.closest("[data-aiira-remove-piece]")) {
        e.preventDefault();
        removeSelectedPiece(Number(e.target.closest("[data-aiira-remove-piece]").getAttribute("data-aiira-remove-piece")));
        return;
      }
      const slotBtn = e.target.closest("[data-aiira-replace-slot]");
      if (slotBtn) {
        e.preventDefault();
        selectReplaceSlot(Number(slotBtn.getAttribute("data-aiira-replace-slot")));
        return;
      }
      const catalogPick = e.target.closest("[data-aiira-pick-catalog]");
      if (catalogPick) {
        e.preventDefault();
        pickCatalogItem(Number(catalogPick.getAttribute("data-aiira-pick-catalog")));
      }
    });

    modalEl.addEventListener("input", function (e) {
      if (!e.target.matches("[data-aiira-catalog-search-input]")) return;
      scheduleCatalogSearch(e.target.value);
    });

    modalEl.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || !e.target.matches("[data-aiira-catalog-search-input]")) return;
      e.preventDefault();
      if (catalogSearchTimer) clearTimeout(catalogSearchTimer);
      fetchCatalogSearch(e.target.value);
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
    activeReplaceSlot = null;
    catalogSearchQuery = "";
    catalogSearchResults = [];
    catalogSearchError = null;
    if (catalogSearchTimer) clearTimeout(catalogSearchTimer);
    catalogSearchTimer = null;
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

  function extractResultImageUrl(data) {
    if (!data || typeof data !== "object") return null;
    if (
      data.data &&
      typeof data.data === "object" &&
      typeof data.data.result_image_url === "string" &&
      data.data.result_image_url.startsWith("http")
    ) {
      return data.data.result_image_url;
    }
    for (const key of ["result_image_url", "image_url", "result_url", "user_image_url"]) {
      const value = data[key];
      if (typeof value === "string" && value.startsWith("http")) return value;
    }
    for (const nestedKey of ["data", "output", "result"]) {
      const nested = data[nestedKey];
      const url = extractResultImageUrl(nested);
      if (url) return url;
    }
    return null;
  }

  function extractUserImageUrl(data) {
    if (!data || typeof data !== "object") return null;
    if (
      data.data &&
      typeof data.data === "object" &&
      typeof data.data.user_image_url === "string" &&
      data.data.user_image_url.startsWith("http")
    ) {
      return data.data.user_image_url;
    }
    if (typeof data.user_image_url === "string" && data.user_image_url.startsWith("http")) {
      return data.user_image_url;
    }
    return null;
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      return fetch(url, Object.assign({}, options, { signal: AbortSignal.timeout(timeoutMs) }));
    }
    const controller = new AbortController();
    const timer = window.setTimeout(function () {
      controller.abort();
    }, timeoutMs);
    return fetch(url, Object.assign({}, options, { signal: controller.signal })).finally(
      function () {
        window.clearTimeout(timer);
      },
    );
  }

  function fetchErrorMessage(err, context) {
    if (!(err instanceof Error)) return context + " failed";
    if (err.name === "AbortError") return context + " timed out. Try a smaller photo.";
    if (err.message === "Failed to fetch") {
      return (
        context +
        " could not reach n8n. Confirm the webhook is active on ai.talentool.in and CORS allows this store."
      );
    }
    return err.message;
  }
  function isHtmlResponse(raw) {
    const sample = String(raw || "")
      .trim()
      .slice(0, 64)
      .toLowerCase();
    return sample.startsWith("<!doctype") || sample.startsWith("<html");
  }

  function humanizeApiError(raw, status, context) {
    if (isHtmlResponse(raw)) {
      const label = context || "Request";
      if (label.toLowerCase().includes("upload")) {
        return (
          label +
          " returned a web page instead of JSON. Confirm the n8n vto-user-upload (S3) workflow is active on ai.talentool.in."
        );
      }
      return (
        label +
        " returned a web page instead of JSON. Confirm the n8n virtual-tryon workflow is active on ai.talentool.in."
      );
    }
    if (!raw || !String(raw).trim()) {
      if (context && context.toLowerCase().includes("try-on")) {
        return (
          context +
          " returned an empty response (" +
          status +
          "). The user_image_url from upload is likely not reachable by n8n, " +
          "or item_image_url values are invalid (must be https://, not //cdn.shopify.com/...)."
        );
      }
      return (
        (context || "Request") +
        " returned an empty response (" +
        status +
        "). On n8n, open the virtual-tryon workflow: Webhook must use " +
        "\"Respond using Respond to Webhook node\" (not Respond immediately), " +
        "and the Respond node must return JSON with result_image_url."
      );
    }
    return String(raw).trim().slice(0, 200);
  }

  function webhookErrorMessage(data, raw, status, context) {
    if (data && typeof data === "object") {
      if (data.success === false && data.error) return String(data.error);
      if (data.error) return String(data.error);
      if (data.message) return String(data.message);
    }
    return humanizeApiError(raw, status, context || "Virtual try-on");
  }

  function vtoTryOnWebhookUrl() {
    const configured =
      typeof window !== "undefined" && window.__AIIRA_VTO_WEBHOOK_URL__;
    const url = String(configured || DEFAULT_TRYON_WEBHOOK).trim();
    if (url === VTO_TRYON_PATH || url.indexOf("/apps/myaiira/virtual-tryon") !== -1) {
      return DEFAULT_TRYON_WEBHOOK;
    }
    return url;
  }

  function vtoUploadWebhookUrl() {
    const configured =
      typeof window !== "undefined" && window.__AIIRA_VTO_UPLOAD_WEBHOOK_URL__;
    const url = String(configured || DEFAULT_UPLOAD_WEBHOOK).trim();
    if (url.charAt(0) === "/") return url;
    return url;
  }

  function isSameOriginPath(url) {
    return String(url).charAt(0) === "/";
  }

  function vtoFetch(url, options, timeoutMs) {
    const opts = isSameOriginPath(url)
      ? Object.assign({}, options, { credentials: "same-origin" })
      : options;
    return fetchWithTimeout(url, opts, timeoutMs);
  }

  async function buildTryOnPayload(photoFile) {
    const override =
      (typeof window !== "undefined" && window.__AIIRA_VTO_USER_IMAGE_URL__) || null;
    if (override && String(override).startsWith("http")) {
      return { user_image_url: String(override) };
    }

    const userImageUrl = await uploadUserModelPhoto(photoFile);
    return { user_image_url: userImageUrl };
  }

  function isPresignedS3Url(url) {
    return /X-Amz-Signature=/.test(url) || /X-Amz-Algorithm=/.test(url);
  }

  function verifyReachableImageUrl(url) {
    if (isPresignedS3Url(url)) {
      return Promise.resolve(true);
    }

    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () {
        resolve(true);
      };
      img.onerror = function () {
        reject(
          new Error(
            "Uploaded photo URL is not reachable. Check S3 upload returned a valid image URL.",
          ),
        );
      };
      img.src = url.indexOf("?") === -1 ? url + "?v=" + Date.now() : url;
    });
  }

  function fileToBase64Payload(photoFile) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        const base64 = comma >= 0 ? result.slice(comma + 1) : result;
        if (!base64) {
          reject(new Error("Could not read photo file"));
          return;
        }
        resolve({
          image_base64: base64,
          content_type: photoFile.type || "image/jpeg",
          filename: photoFile.name || "model.jpg",
        });
      };
      reader.onerror = function () {
        reject(new Error("Could not read photo file"));
      };
      reader.readAsDataURL(photoFile);
    });
  }

  function shouldRetryUploadAsJson(data, raw) {
    const message = String(
      (data && data.error) || raw || "",
    ).toLowerCase();
    return message.indexOf("photo required") !== -1;
  }

  async function uploadUserModelPhoto(photoFile) {
    if (!photoFile || !photoFile.size) {
      throw new Error("Choose a photo before continuing.");
    }

    let lastError = null;
    const uploadUrl = vtoUploadWebhookUrl();

    async function parseUploadResponse(res) {
      const raw = await res.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (_) {
        data = null;
      }
      const userImageUrl = extractUserImageUrl(data);
      if (res.ok && userImageUrl) {
        await verifyReachableImageUrl(userImageUrl);
        return userImageUrl;
      }
      const err = new Error(
        webhookErrorMessage(data, raw, res.status, "Model photo upload"),
      );
      err.retryAsJson = shouldRetryUploadAsJson(data, raw);
      throw err;
    }

    try {
      const jsonPayload = await fileToBase64Payload(photoFile);
      const jsonRes = await vtoFetch(
        uploadUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(jsonPayload),
        },
        120000,
      );
      return await parseUploadResponse(jsonRes);
    } catch (jsonErr) {
      if (!(jsonErr instanceof Error) || !jsonErr.retryAsJson) {
        lastError =
          jsonErr instanceof Error
            ? jsonErr
            : new Error(fetchErrorMessage(jsonErr, "Model photo upload"));
      } else {
        lastError = jsonErr;
      }
    }

    try {
      const form = new FormData();
      form.append("photo", photoFile, photoFile.name || "model.jpg");
      const formRes = await vtoFetch(
        uploadUrl,
        { method: "POST", body: form },
        120000,
      );
      return await parseUploadResponse(formRes);
    } catch (formErr) {
      lastError =
        formErr instanceof Error
          ? formErr
          : new Error(fetchErrorMessage(formErr, "Model photo upload"));
    }

    throw (
      lastError ||
      new Error(
        "Could not upload model photo. Import scripts/n8n/vto-user-upload-s3.workflow.json on ai.talentool.in and set AWS env vars.",
      )
    );
  }

  async function submitVirtualTryOn(items, userImagePayload) {
    const userImageUrl = normalizeHttpUrl(userImagePayload.user_image_url);
    if (!userImageUrl.startsWith("http")) {
      throw new Error("Model photo must be uploaded to a public URL before try-on.");
    }

    const normalizedItems = items
      .map(function (item) {
        return {
          item_image_url: normalizeHttpUrl(item.item_image_url),
          sub_type: item.sub_type || "default",
        };
      })
      .filter(function (item) {
        return item.item_image_url.startsWith("http");
      });

    if (!normalizedItems.length) {
      throw new Error(
        "Add at least one catalog item with a valid image URL before try-on.",
      );
    }

    const payload = {
      user_image_url: userImageUrl,
      items: normalizedItems,
    };

    const res = await vtoFetch(
      vtoTryOnWebhookUrl(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      300000,
    );
    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (_) {
      data = null;
    }
    if (!res.ok) {
      throw new Error(webhookErrorMessage(data, raw, res.status, "Virtual try-on"));
    }
    if (data && typeof data === "object" && data.success === false) {
      throw new Error(webhookErrorMessage(data, raw, res.status, "Virtual try-on"));
    }
    const imageUrl = extractResultImageUrl(data);
    if (!imageUrl) {
      throw new Error(webhookErrorMessage(data, raw, res.status, "Virtual try-on"));
    }
    return imageUrl;
  }

  function normalizeHttpUrl(url) {
    const s = String(url || "").trim();
    if (!s) return "";
    if (s.indexOf("//") === 0) return "https:" + s;
    return s;
  }

  function normalizeOutfitItem(item) {
    return {
      item_image_url: normalizeHttpUrl(item.item_image_url),
      sub_type: String(item.sub_type || "item").trim().toLowerCase(),
      label: item.label ? String(item.label) : "",
      title: item.title ? String(item.title) : "",
    };
  }

  function catalogEntryToOutfitItem(entry) {
    return normalizeOutfitItem({
      item_image_url: entry.item_image_url,
      sub_type: entry.sub_type,
      title: entry.title || "",
    });
  }

  function cacheCatalogItem(item) {
    if (!currentProduct) return;
    if (!currentProduct.adminCatalogCache) currentProduct.adminCatalogCache = {};
    const key = item.sub_type || "default";
    if (!currentProduct.adminCatalogCache[key]) currentProduct.adminCatalogCache[key] = [];
    const exists = currentProduct.adminCatalogCache[key].some(function (entry) {
      return entry.item_image_url === item.item_image_url;
    });
    if (!exists) currentProduct.adminCatalogCache[key].push(item);
  }

  const BUILDER_SLOT_MAP = {
    saree: "upperwear",
    lehenga: "upperwear",
    dress: "upperwear",
    top: "upperwear",
    kurta: "upperwear",
    kurti: "upperwear",
    blouse: "upperwear",
    dupatta: "upperwear",
    bottom: "lowerwear",
    bracelet: "handbag",
  };

  function getActiveCatalogSlot() {
    let raw = "upperwear";
    if (activeReplaceSlot != null && currentProduct && currentProduct.items[activeReplaceSlot]) {
      raw = currentProduct.items[activeReplaceSlot].sub_type;
    } else if (currentProduct && currentProduct.items && currentProduct.items[0]) {
      raw = currentProduct.items[0].sub_type;
    }
    return BUILDER_SLOT_MAP[raw] || raw;
  }

  const CATALOG_SLOT_MATCH = {
    upperwear: ["upperwear", "top", "dress", "saree", "lehenga", "kurta", "kurti", "blouse", "dupatta"],
    lowerwear: ["lowerwear", "bottom"],
    earrings: ["earrings"],
    necklace: ["necklace"],
    footwear: ["footwear"],
    handbag: ["handbag", "bracelet"],
  };

  let storefrontCatalogCache = null;

  function catalogSlotMatches(slot, itemSubType) {
    const normalized = String(itemSubType || "")
      .trim()
      .toLowerCase();
    const match = CATALOG_SLOT_MATCH[slot];
    if (!match) return slot === normalized;
    return match.includes(normalized);
  }

  function getStorefrontCatalog() {
    if (storefrontCatalogCache) return storefrontCatalogCache;
    if (Array.isArray(window.__AIIRA_STOREFRONT_CATALOG__)) {
      storefrontCatalogCache = window.__AIIRA_STOREFRONT_CATALOG__;
      return storefrontCatalogCache;
    }
    const el = document.getElementById("aiira-storefront-catalog");
    if (el && el.textContent) {
      try {
        storefrontCatalogCache = JSON.parse(el.textContent);
        if (Array.isArray(storefrontCatalogCache)) return storefrontCatalogCache;
      } catch (_) {}
    }
    storefrontCatalogCache = [];
    return storefrontCatalogCache;
  }

  function expandSearchQuery(raw) {
    const q = String(raw || "")
      .trim()
      .toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    const expanded = new Set([q, ...tokens]);
    if (q.includes("upperware") || q.includes("upperwear")) {
      expanded.add("upperwear");
      expanded.add("dress");
      expanded.add("top");
      expanded.add("saree");
      expanded.add("gown");
      expanded.add("lehenga");
    }
    if (q.includes("footwear") || q.includes("footware") || q.includes("shoe")) {
      expanded.add("footwear");
      expanded.add("heel");
      expanded.add("sandal");
    }
    if (q.includes("handbag") || q.includes("bag")) {
      expanded.add("handbag");
      expanded.add("clutch");
    }
    if (q.includes("lower")) {
      expanded.add("lowerwear");
      expanded.add("bottom");
      expanded.add("pant");
    }
    if (q.includes("dress")) {
      expanded.add("dress");
      expanded.add("gown");
    }
    return Array.from(expanded);
  }

  function entryMatchesStorefrontSearch(entry, query) {
    const needles = expandSearchQuery(query);
    if (!needles.length) return true;
    const title = String(entry.title || "").toLowerCase();
    const searchText = String(entry.search_text || "").toLowerCase();
    const handle = String(entry.handle || "").toLowerCase();
    const subType = String(entry.sub_type || "").toLowerCase();
    const productType = String(entry.product_type || "").toLowerCase();
    return needles.some(function (needle) {
      return (
        title.includes(needle) ||
        searchText.includes(needle) ||
        handle.includes(needle) ||
        subType.includes(needle) ||
        productType.includes(needle)
      );
    });
  }

  function searchStorefrontCatalog(query, slot) {
    const catalog = getStorefrontCatalog();
    if (!catalog.length) return [];
    let entries = catalog.slice();
    const q = String(query || "").trim();
    if (q) {
      entries = entries.filter(function (entry) {
        return entryMatchesStorefrontSearch(entry, q);
      });
    }
    entries.sort(function (a, b) {
      const aSlot = slot && catalogSlotMatches(slot, a.sub_type) ? 0 : 1;
      const bSlot = slot && catalogSlotMatches(slot, b.sub_type) ? 0 : 1;
      if (aSlot !== bSlot) return aSlot - bSlot;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
    return entries.slice(0, 48);
  }

  async function fetchSuggestCatalog(query) {
    const q = String(query || "").trim();
    if (!q) return [];
    const url =
      "/search/suggest.json?q=" +
      encodeURIComponent(q) +
      "&resources[type]=product&resources[limit]=24";
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const products = (data.resources && data.resources.results && data.resources.results.products) || [];
    return products
      .map(function (product) {
        const image =
          (product.featured_image && product.featured_image.url) ||
          product.image ||
          product.featured_image ||
          "";
        return {
          item_image_url: normalizeHttpUrl(image),
          sub_type: "default",
          title: product.title || "",
          handle: product.handle || "",
          search_text: String(product.title || "").toLowerCase(),
        };
      })
      .filter(function (entry) {
        return entry.item_image_url;
      });
  }

  async function fetchCatalogSearch(query) {
    if (!currentProduct) return;
    const seq = ++catalogSearchSeq;
    catalogSearchQuery = String(query || "");
    catalogSearchLoading = true;
    catalogSearchError = null;
    renderCatalogZone();
    try {
      const slot = getActiveCatalogSlot();
      const params = new URLSearchParams({ limit: "48", page: "1" });
      if (slot) params.set("slot", slot);
      const trimmed = catalogSearchQuery.trim();
      if (trimmed) params.set("q", trimmed);

      let results = null;
      let proxyUsable = false;

      try {
        const res = await fetch(PROXY + "/catalog?" + params.toString());
        const raw = await res.text();
        let data = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch (_) {
          data = null;
        }
        if (data && res.ok && Array.isArray(data.items)) {
          results = data.items;
          proxyUsable = true;
        } else if (data && !res.ok && data.error) {
          throw new Error(String(data.error));
        }
      } catch (proxyErr) {
        if (proxyErr instanceof Error && proxyErr.message && proxyErr.message !== "Failed to fetch") {
          throw proxyErr;
        }
      }

      if (seq !== catalogSearchSeq) return;

      if (!proxyUsable) {
        results = searchStorefrontCatalog(trimmed, slot);
        if (trimmed) {
          const suggested = await fetchSuggestCatalog(trimmed);
          if (seq !== catalogSearchSeq) return;
          if (suggested.length) {
            const seen = new Set(
              (results || []).map(function (entry) {
                return entry.item_image_url;
              }),
            );
            suggested.forEach(function (entry) {
              if (!seen.has(entry.item_image_url)) {
                results.push(entry);
                seen.add(entry.item_image_url);
              }
            });
          }
        }
        if (!results.length && !getStorefrontCatalog().length) {
          throw new Error(
            "Catalog search unavailable. Confirm the app is installed and the proxy is running.",
          );
        }
      }

      catalogSearchResults = results || [];
    } catch (err) {
      if (seq !== catalogSearchSeq) return;
      catalogSearchError = err instanceof Error ? err.message : "Search failed";
      catalogSearchResults = [];
    } finally {
      if (seq !== catalogSearchSeq) return;
      catalogSearchLoading = false;
      renderAllChrome();
      const input = qs("[data-aiira-catalog-search-input]", modalEl);
      if (input && document.activeElement !== input) input.focus();
    }
  }

  function scheduleCatalogSearch(query) {
    catalogSearchQuery = query;
    if (catalogSearchTimer) clearTimeout(catalogSearchTimer);
    catalogSearchTimer = setTimeout(function () {
      fetchCatalogSearch(catalogSearchQuery);
    }, 280);
  }

  function pickCatalogItem(index) {
    const entry = catalogSearchResults[index];
    if (!entry || !currentProduct) return;
    const item = catalogEntryToOutfitItem(entry);
    cacheCatalogItem(item);

    if (!currentProduct.items) currentProduct.items = [];

    if (activeReplaceSlot != null) {
      currentProduct.items[activeReplaceSlot] = item;
      activeReplaceSlot = null;
    } else {
      const slotIdx = currentProduct.items.findIndex(function (piece) {
        return piece.sub_type === item.sub_type;
      });
      if (slotIdx >= 0) {
        currentProduct.items[slotIdx] = item;
      } else {
        currentProduct.items.push(item);
      }
    }

    activeReplaceSlot = null;
    renderAllChrome();
    updateGeneratingCopy();
  }

  function removeSelectedPiece(index) {
    if (!currentProduct || !currentProduct.items) return;
    currentProduct.items.splice(index, 1);
    if (activeReplaceSlot === index) activeReplaceSlot = null;
    else if (activeReplaceSlot != null && activeReplaceSlot > index) activeReplaceSlot -= 1;
    renderAllChrome();
    updateGeneratingCopy();
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
    const local = catalog[item.sub_type] || [];
    const admin =
      (currentProduct.adminCatalogCache && currentProduct.adminCatalogCache[item.sub_type]) || [];
    const merged = local.slice();
    admin.forEach(function (entry) {
      if (
        !merged.some(function (existing) {
          return existing.item_image_url === entry.item_image_url;
        })
      ) {
        merged.push(entry);
      }
    });
    return merged;
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

  function selectReplaceSlot(index) {
    activeReplaceSlot = activeReplaceSlot === index ? null : index;
    renderAllChrome();
    if (activeReplaceSlot != null) {
      const input = qs("[data-aiira-catalog-search-input]", modalEl);
      if (input) input.focus();
    }
  }

  function renderCatalogResults() {
    if (catalogSearchLoading) {
      return '<p class="aiira-vto-catalog-search__status">Searching your catalog…</p>';
    }
    if (catalogSearchError) {
      return (
        '<p class="aiira-vto-catalog-search__status aiira-vto-catalog-search__status--error">' +
        catalogSearchError +
        "</p>"
      );
    }
    if (catalogSearchResults.length === 0) {
      return (
        '<p class="aiira-vto-catalog-search__status">No products found. Try another term or add products in Admin.</p>'
      );
    }
    return (
      '<div class="aiira-vto-catalog-search__grid">' +
      catalogSearchResults
        .map(function (entry, index) {
          return (
            '<button type="button" class="aiira-vto-catalog-search__item" data-aiira-pick-catalog="' +
            index +
            '" aria-label="Add ' +
            (entry.title || formatSubType(entry.sub_type)) +
            '">' +
            '<img src="' +
            entry.item_image_url +
            '" alt="" loading="lazy" />' +
            '<span class="aiira-vto-catalog-search__item-title">' +
            (entry.title || formatSubType(entry.sub_type)) +
            "</span>" +
            '<span class="aiira-vto-catalog-search__item-type">' +
            formatSubType(entry.sub_type) +
            "</span>" +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderSearchStrip() {
    const strip = qs("[data-aiira-search-strip]", modalEl);
    if (!strip) return;
    const replaceHint =
      activeReplaceSlot != null
        ? "Replacing piece " + (activeReplaceSlot + 1) + " — pick a replacement below"
        : "Search your Admin catalog and tap items to build your look";

    strip.innerHTML =
      '<div class="aiira-vto-toolbar__inner">' +
      '<div class="aiira-vto-catalog-search__bar">' +
      '<span class="material-symbols-outlined aiira-vto-catalog-search__icon" aria-hidden="true">search</span>' +
      '<input type="search" class="aiira-vto-catalog-search__input" data-aiira-catalog-search-input placeholder="Search dresses, sarees, footwear, bags…" value="' +
      (catalogSearchQuery || "").replace(/"/g, "&quot;") +
      '" autocomplete="off" aria-label="Search admin catalog" />' +
      "</div>" +
      '<p class="aiira-vto-toolbar__hint">' +
      replaceHint +
      "</p>" +
      "</div>";
  }

  function renderCatalogZone() {
    const host = qs("[data-aiira-catalog-results]", modalEl);
    if (!host) return;
    host.innerHTML = renderCatalogResults();
  }

  function updateUploadHint() {
    const hint = qs("[data-aiira-upload-hint]", modalEl);
    const uploadBar = qs("[data-aiira-upload-bar]", modalEl);
    if (!hint || !currentProduct) return;
    const count = (currentProduct.items || []).length;
    hint.textContent =
      count === 0
        ? "Add catalog pieces from search above, then upload JPG or PNG"
        : count + " piece" + (count === 1 ? "" : "s") + " selected — ready to upload your photo";
    if (uploadBar) uploadBar.classList.toggle("is-ready", count > 0);
  }

  function itemLabel(item) {
    return item.title || formatSubType(item.sub_type);
  }

  function renderSidebar(product) {
    const sidebar = qs("[data-aiira-sidebar]", modalEl);
    if (!sidebar) return;
    const items = product.items || [];
    const pieceCount = items.length;
    const itemsHtml = items
      .map(function (item, index) {
        const isEditing = activeReplaceSlot === index;
        return (
          '<div class="aiira-vto-selected' +
          (isEditing ? " is-editing" : "") +
          '">' +
          '<button type="button" class="aiira-vto-selected__main" data-aiira-replace-slot="' +
          index +
          '" aria-label="Select ' +
          itemLabel(item) +
          ' for replacement">' +
          '<div class="aiira-vto-item__img">' +
          '<img src="' +
          item.item_image_url +
          '" alt="' +
          itemLabel(item) +
          '" loading="lazy" />' +
          "</div>" +
          '<div class="aiira-vto-selected__meta">' +
          '<p class="aiira-vto-item__type">' +
          itemLabel(item) +
          "</p>" +
          '<p class="aiira-vto-selected__slot">' +
          formatSubType(item.sub_type) +
          "</p>" +
          "</div>" +
          "</button>" +
          '<button type="button" class="aiira-vto-selected__remove" data-aiira-remove-piece="' +
          index +
          '" aria-label="Remove ' +
          itemLabel(item) +
          '">' +
          '<span class="material-symbols-outlined" aria-hidden="true">close</span>' +
          "</button>" +
          "</div>"
        );
      })
      .join("");

    sidebar.innerHTML =
      '<div class="aiira-vto-sidebar__inner">' +
      '<div class="aiira-vto-sidebar__head">' +
      '<span class="aiira-eyebrow" data-aiira-piece-count>Your look</span>' +
      '<p class="aiira-vto-sidebar__count">' +
      pieceCount +
      " piece" +
      (pieceCount === 1 ? "" : "s") +
      " selected</p>" +
      "</div>" +
      '<div class="aiira-vto-items-list">' +
      (pieceCount === 0
        ? '<div class="aiira-vto-sidebar__empty">' +
          '<span class="material-symbols-outlined" aria-hidden="true">checkroom</span>' +
          "<p>Selected pieces appear here.</p>" +
          "<p>Use the search bar above to add items.</p>" +
          "</div>"
        : itemsHtml) +
      "</div>" +
      (pieceCount > 0
        ? '<p class="aiira-vto-sidebar__hint" data-aiira-piece-hint>' +
          (activeReplaceSlot != null
            ? "Highlighted piece will be replaced by your next pick"
            : "Tap a piece to replace · remove with ✕") +
          "</p>"
        : "") +
      "</div>" +
      '<p class="aiira-vto-sidebar__legal">' +
      "Processed securely · not stored" +
      "</p>";
  }

  function renderAllChrome() {
    if (!currentProduct || !modalEl) return;
    renderSearchStrip();
    renderCatalogZone();
    renderSidebar(currentProduct);
    updateUploadHint();
  }

  function showPanel(name) {
    const isBuilder = name === "upload";
    const searchStrip = qs("[data-aiira-search-strip]", modalEl);
    const catalogResults = qs("[data-aiira-catalog-results]", modalEl);
    const uploadBar = qs("[data-aiira-upload-bar]", modalEl);
    const stage = qs("[data-aiira-stage]", modalEl);
    const body = qs(".aiira-vto-modal__body", modalEl);

    if (searchStrip) searchStrip.classList.toggle("aiira-vto-hidden", !isBuilder);
    if (catalogResults) catalogResults.classList.toggle("aiira-vto-hidden", !isBuilder);
    if (uploadBar) uploadBar.classList.toggle("aiira-vto-hidden", !isBuilder);
    if (stage) stage.classList.toggle("aiira-vto-hidden", isBuilder);

    qs("[data-aiira-generating]", modalEl).classList.toggle("aiira-vto-hidden", name !== "generating");
    qs("[data-aiira-result-wrap]", modalEl).classList.toggle("aiira-vto-hidden", name !== "result");

    if (stage) stage.classList.toggle("is-result", name === "result");
    if (body) body.classList.toggle("is-result-view", name === "result");
    if (body) body.classList.toggle("is-builder-view", isBuilder);
    if (stage) stage.classList.toggle("is-generating", name === "generating");
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
    const parsed = parseOutfitItems(product.itemsRaw);
    const rawItems =
      parsed !== null ? parsed : Array.isArray(product.items) ? product.items : [];
    product.items = rawItems
      .map(normalizeOutfitItem)
      .filter(function (item) {
        return item.item_image_url;
      });
    product.lookPresets = buildLookPresets(
      product.items,
      product.alternativesRaw,
      product.title,
    );
    product.activeLookIndex = 0;
    if (!product.id) product.id = "vto-builder";
    currentProduct = product;
    currentProduct.adminCatalogCache = {};
    activeReplaceSlot = null;
    catalogSearchQuery = "";
    catalogSearchResults = [];
    catalogSearchError = null;
    ensureModal();
    resetUpload();
    renderAllChrome();
    updateGeneratingCopy();
    modalEl.classList.add("is-open");
    document.body.style.overflow = "hidden";
    fetchCatalogSearch("");
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
    maxDim = maxDim || 768;
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
          0.72,
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
      alert("Search admin catalog and add at least one piece before uploading your model photo.");
      fetchCatalogSearch(catalogSearchQuery);
      renderAllChrome();
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

      const tryOnPayload = await buildTryOnPayload(photoFile);

      const progressTimer = window.setInterval(function () {
        const fill = qs("[data-aiira-fill]", modalEl);
        if (!fill) return;
        const pct = parseFloat(fill.style.width) || 25;
        if (pct < 92) fill.style.width = Math.min(92, pct + 3) + "%";
      }, 2500);

      let resultUrl;
      try {
        resultUrl = await submitVirtualTryOn(items, tryOnPayload);
      } finally {
        window.clearInterval(progressTimer);
      }

      qs("[data-aiira-fill]", modalEl).style.width = "100%";
      showResult(resultUrl);
    } catch (err) {
      showPanel("upload");
      setStep(0);
      alert(err.message || "Something went wrong. Please try again.");
    }
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

  function openFromElement(btn) {
    if (!btn) return;
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
  }

  window.__AIIRA_VTO__ = {
    open: openModal,
    openFromElement: openFromElement,
  };

  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-aiira-open-vto]");
    if (!btn) return;
    e.preventDefault();
    openFromElement(btn);
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

})();
