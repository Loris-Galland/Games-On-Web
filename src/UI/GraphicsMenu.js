/**
 * GraphicsMenu
 * ------------
 * Panneau "GRAPHISMES" AAA réutilisable — MainMenu + PauseMenu.
 *
 * Comportement :
 *   - À l'ouverture, snapshot des params courants.
 *   - Sliders/toggles modifient la pipeline EN LIVE (prévisualisation).
 *   - "APPLIQUER" valide et ferme.
 *   - "ANNULER"   restaure le snapshot et ferme.
 *   - "RESET"     repasse sur le preset "high" (reste ouvert).
 */
export class GraphicsMenu {
    constructor(lightingManager) {
        this.lm = lightingManager;
        this._snapshot = null;
    }

    buildPanel(onBack) {
        // Snapshot au moment de l'ouverture
        this._snapshot = this.lm ? { ...this.lm.getGraphicsParams() } : null;

        const panel = document.createElement("div");
        panel.className = "gfx-panel";

        panel.innerHTML = `
            <div class="gfx-header">
                <div class="gfx-title">GRAPHISMES</div>
                <div class="gfx-subtitle">POST-PROCESSING PIPELINE — PRÉVISUALISATION EN DIRECT</div>
            </div>
            <div class="gfx-presets">
                <div class="gfx-preset-label">QUALITÉ PRÉDÉFINIE</div>
                <div class="gfx-preset-row" id="gfxPresetRow"></div>
            </div>
            <div class="gfx-scroll" id="gfxScroll"></div>
            <div class="gfx-footer">
                <button class="gfx-apply-btn" id="gfxApply">✓ APPLIQUER</button>
                <button class="gfx-back-btn"  id="gfxBack">✕ ANNULER</button>
                <button class="gfx-reset-btn" id="gfxReset">⟳ RESET</button>
            </div>
        `;

        this._buildPresetRow(panel.querySelector("#gfxPresetRow"));
        this._buildControls(panel.querySelector("#gfxScroll"));

        // APPLIQUER — valide et ferme
        panel.querySelector("#gfxApply").onclick = () => {
            this._snapshot = null;
            onBack();
        };

        // ANNULER — restaure le snapshot et ferme
        panel.querySelector("#gfxBack").onclick = () => {
            this._rollback();
            onBack();
        };

        // RESET — remet preset "high" et reste ouvert
        panel.querySelector("#gfxReset").onclick = () => {
            this.lm?.applyGraphicsPreset?.("low");
            this._refresh(panel);
        };

        return panel;
    }

    _rollback() {
        if (!this._snapshot || !this.lm) return;
        const saved = this._snapshot;
        Object.keys(saved).forEach(key => this.lm.setGraphicsParam(key, saved[key]));
        this._snapshot = null;
    }

    _buildPresetRow(container) {
        const presets = [
            { id: "low",    label: "BAS"   },
            { id: "medium", label: "MOYEN" },
            { id: "high",   label: "ÉLEVÉ" },
            { id: "ultra",  label: "ULTRA" },
        ];
        container.innerHTML = "";
        const current = this.lm?.getCurrentPreset?.() ?? "high";
        presets.forEach(({ id, label }) => {
            const btn = document.createElement("button");
            btn.className = "gfx-preset-btn" + (current === id ? " active" : "");
            btn.dataset.preset = id;
            btn.textContent = label;
            btn.onclick = () => {
                this.lm?.applyGraphicsPreset?.(id);
                container.querySelectorAll(".gfx-preset-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                const scroll = container.closest(".gfx-panel")?.querySelector("#gfxScroll");
                if (scroll) this._buildControls(scroll);
            };
            container.appendChild(btn);
        });
    }

    _buildControls(container) {
        const params = this.lm?.getGraphicsParams?.() ?? {};
        container.innerHTML = "";

        const SECTIONS = [
            {
                title: "BLOOM",
                icon: "◈",
                rows: [
                    { key: "bloomEnabled",   label: "Activé",    type: "toggle" },
                    { key: "bloomThreshold", label: "Seuil",     type: "range", min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
                    { key: "bloomWeight",    label: "Intensité", type: "range", min: 0,   max: 1,   step: 0.01, fmt: v => v.toFixed(2) },
                    { key: "bloomKernel",    label: "Kernel",    type: "range", min: 4,   max: 128, step: 4,    fmt: v => Math.round(v) + "px" },
                    { key: "bloomScale",     label: "Scale",     type: "range", min: 0.1, max: 1,   step: 0.05, fmt: v => v.toFixed(2) },
                ],
            },
            {
                title: "VIGNETTE",
                icon: "◉",
                rows: [
                    { key: "vignetteEnabled", label: "Activée", type: "toggle" },
                    { key: "vignetteWeight",  label: "Force",   type: "range", min: 0, max: 8, step: 0.1, fmt: v => v.toFixed(1) },
                ],
            },
            {
                title: "IMAGE",
                icon: "▣",
                rows: [
                    { key: "contrast",           label: "Contraste",    type: "range", min: 0.5, max: 2.5, step: 0.01, fmt: v => v.toFixed(2) },
                    { key: "exposure",           label: "Exposition",   type: "range", min: 0.5, max: 3.0, step: 0.01, fmt: v => v.toFixed(2) },
                    { key: "toneMappingEnabled", label: "Tone Mapping", type: "toggle" },
                    { key: "toneMappingType",    label: "Mode TM",      type: "select",
                      options: [
                          { v: 0, l: "Standard" }, { v: 1, l: "ACES" }, { v: 2, l: "Photographic" },
                      ],
                    },
                ],
            },
            {
                title: "ANTI-ALIASING",
                icon: "◫",
                rows: [
                    { key: "fxaaEnabled", label: "FXAA", type: "toggle" },
                ],
            },
            {
                title: "ABERRATION CHROMATIQUE",
                icon: "◐",
                rows: [
                    { key: "chromaticAberrationEnabled", label: "Activée",   type: "toggle" },
                    { key: "chromaticAberrationAmount",  label: "Intensité", type: "range", min: 0, max: 60, step: 0.5, fmt: v => v.toFixed(1) },
                ],
            },
            {
                title: "PROFONDEUR DE CHAMP",
                icon: "◎",
                rows: [
                    { key: "depthOfFieldEnabled",       label: "Activée",        type: "toggle" },
                    { key: "depthOfFieldFocalLength",   label: "Focale (mm)",     type: "range", min: 10,  max: 500,   step: 5,   fmt: v => Math.round(v) + "mm" },
                    { key: "depthOfFieldFStop",         label: "Ouverture (f/)",  type: "range", min: 0.5, max: 16,    step: 0.1, fmt: v => "f/" + v.toFixed(1) },
                    { key: "depthOfFieldFocusDistance", label: "Distance focus",  type: "range", min: 100, max: 10000, step: 100, fmt: v => Math.round(v) + "mm" },
                ],
            },
            {
                title: "GRAIN CINÉMATIQUE",
                icon: "◌",
                rows: [
                    { key: "grainEnabled",   label: "Activé",    type: "toggle" },
                    { key: "grainAnimated",  label: "Animé",     type: "toggle" },
                    { key: "grainIntensity", label: "Intensité", type: "range", min: 0, max: 60, step: 0.5, fmt: v => v.toFixed(1) },
                ],
            },
            {
                title: "NETTETÉ",
                icon: "◪",
                rows: [
                    { key: "sharpenEnabled",     label: "Activée",  type: "toggle" },
                    { key: "sharpenEdgeAmount",  label: "Contours", type: "range", min: 0, max: 2, step: 0.05, fmt: v => v.toFixed(2) },
                    { key: "sharpenColorAmount", label: "Couleur",  type: "range", min: 0, max: 1, step: 0.01, fmt: v => v.toFixed(2) },
                ],
            },
        ];

        SECTIONS.forEach(section => {
            const sec = document.createElement("div");
            sec.className = "gfx-section";

            const hdr = document.createElement("div");
            hdr.className = "gfx-section-hdr";
            hdr.innerHTML = `<span class="gfx-section-icon">${section.icon}</span><span>${section.title}</span>`;
            sec.appendChild(hdr);

            const body = document.createElement("div");
            body.className = "gfx-section-body";

            section.rows.forEach(row => {
                const val = params[row.key];
                const rowEl = document.createElement("div");
                rowEl.className = "gfx-row";

                if (row.type === "toggle") {
                    rowEl.innerHTML = `
                        <span class="gfx-row-label">${row.label}</span>
                        <label class="gfx-toggle">
                            <input type="checkbox" data-key="${row.key}" ${val ? "checked" : ""}>
                            <span class="gfx-toggle-track"><span class="gfx-toggle-thumb"></span></span>
                        </label>
                    `;
                    rowEl.querySelector("input").onchange = (e) => {
                        this.lm?.setGraphicsParam?.(row.key, e.target.checked);
                        this._markCustom(container.closest(".gfx-panel"));
                    };
                } else if (row.type === "range") {
                    const fmt = row.fmt ?? (v => v);
                    rowEl.innerHTML = `
                        <span class="gfx-row-label">${row.label}</span>
                        <div class="gfx-slider-wrap">
                            <input type="range" class="gfx-slider" data-key="${row.key}"
                                min="${row.min}" max="${row.max}" step="${row.step}" value="${val}">
                            <span class="gfx-slider-val">${fmt(val)}</span>
                        </div>
                    `;
                    const input   = rowEl.querySelector("input");
                    const display = rowEl.querySelector(".gfx-slider-val");
                    input.oninput = (e) => {
                        const v = parseFloat(e.target.value);
                        display.textContent = fmt(v);
                        this.lm?.setGraphicsParam?.(row.key, v);
                        this._markCustom(container.closest(".gfx-panel"));
                    };
                } else if (row.type === "select") {
                    const opts = row.options.map(o =>
                        `<option value="${o.v}" ${val === o.v ? "selected" : ""}>${o.l}</option>`
                    ).join("");
                    rowEl.innerHTML = `
                        <span class="gfx-row-label">${row.label}</span>
                        <select class="gfx-select" data-key="${row.key}">${opts}</select>
                    `;
                    rowEl.querySelector("select").onchange = (e) => {
                        this.lm?.setGraphicsParam?.(row.key, parseInt(e.target.value));
                        this._markCustom(container.closest(".gfx-panel"));
                    };
                }

                body.appendChild(rowEl);
            });

            sec.appendChild(body);
            container.appendChild(sec);
        });
    }

    _markCustom(panel) {
        panel?.querySelectorAll(".gfx-preset-btn").forEach(b => b.classList.remove("active"));
    }

    _refresh(panel) {
        const presetRow = panel.querySelector("#gfxPresetRow");
        const scroll    = panel.querySelector("#gfxScroll");
        if (presetRow) this._buildPresetRow(presetRow);
        if (scroll)    this._buildControls(scroll);
    }
}