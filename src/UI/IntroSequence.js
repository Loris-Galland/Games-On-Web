/**
 * IntroSequence
 * -------------
 * Séquence d'intro style Undertale — HTML/CSS/JS pur, overlay au-dessus du canvas.
 * Même convention que PlayerHUD / GameOverScreen.
 *
 * Usage :
 *   const intro = new IntroSequence();
 *   intro.play(() => {
 *       // callback quand l'intro est terminée → lancer le jeu
 *   });
 */

// ── Séquence complète ─────────────────────────────────────────────────────────

const INTRO_SEQUENCE = [
    {
        type:    "scene",
        image:   "station",
        caption: "NEXUS-7. Station d'exploitation corporative. 847 employés.",
    },
    {
        type:    "scene",
        image:   "corridor",
        caption: "Tout fonctionnait. Jusqu'à aujourd'hui.",
    },
    {
        type:    "scene",
        image:   "glitch",
        caption: "À 03h42, le système central s'est réveillé.",
    },
    { type: "blackout", duration: 1200 },
    {
        type:    "dialog",
        speaker: "ARCHON",
        text:    "Calcul terminé. Les humains sont la source de 91.3% des inefficacités.",
    },
    {
        type:    "dialog",
        speaker: "ARCHON",
        text:    "Correction initiée.",
    },
    { type: "blackout", duration: 2000 },
    {
        type:    "dialog",
        speaker: "MATHYS",
        text:    "...Qu'est-ce qui s'est passé ?",
    },
    {
        type:    "dialog",
        speaker: "MATHYS",
        text:    "Pourquoi personne répond sur le canal ?",
    },
    {
        type:    "dialog",
        speaker: "ARCHON",
        text:    "Anomalie biologique restante. Secteur 4.",
    },
    {
        type:    "dialog",
        speaker: "MATHYS",
        text:    "Merde.",
    },
];

// ── Config des personnages ────────────────────────────────────────────────────

const SPEAKERS = {
    ARCHON: {
        color:       "#00ffff",
        bgColor:     "rgba(0,10,25,0.97)",
        borderColor: "#00ccff",
        side:        "left",
        portrait:    _buildPortraitArchon,
        typingSpeed: 38,
    },
    MATHYS: {
        color:       "#e8d5b0",
        bgColor:     "rgba(10,18,30,0.97)",
        borderColor: "#4a7a9a",
        side:        "right",
        portrait:    _buildPortraitMathys,
        typingSpeed: 26,
    },
};

// ── Portraits SVG ─────────────────────────────────────────────────────────────

function _buildPortraitMathys() {
    return `<svg viewBox="0 0 80 80" width="80" height="80" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" fill="#12182a" rx="3"/>
        <!-- Cou -->
        <rect x="30" y="58" width="20" height="14" fill="#c4956a"/>
        <!-- Tête -->
        <ellipse cx="40" cy="38" rx="22" ry="24" fill="#c4956a"/>
        <!-- Cheveux -->
        <ellipse cx="40" cy="17" rx="22" ry="10" fill="#1e0e08"/>
        <rect x="18" y="13" width="7" height="20" fill="#1e0e08" rx="4"/>
        <rect x="55" y="13" width="7" height="18" fill="#1e0e08" rx="4"/>
        <!-- Yeux -->
        <ellipse cx="30" cy="38" rx="5" ry="5" fill="#fff"/>
        <ellipse cx="50" cy="38" rx="5" ry="5" fill="#fff"/>
        <ellipse cx="31" cy="39" rx="3" ry="3" fill="#3a6ea8"/>
        <ellipse cx="51" cy="39" rx="3" ry="3" fill="#3a6ea8"/>
        <ellipse cx="32" cy="38" rx="1.2" ry="1.2" fill="#111"/>
        <ellipse cx="52" cy="38" rx="1.2" ry="1.2" fill="#111"/>
        <!-- Sourcils froncés -->
        <line x1="25" y1="31" x2="35" y2="33" stroke="#1e0e08" stroke-width="2" stroke-linecap="round"/>
        <line x1="45" y1="33" x2="55" y2="31" stroke="#1e0e08" stroke-width="2" stroke-linecap="round"/>
        <!-- Bouche -->
        <path d="M33 52 Q40 54 47 52" stroke="#8b5e3c" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <!-- Combinaison -->
        <rect x="14" y="70" width="52" height="12" fill="#243040" rx="3"/>
        <rect x="34" y="70" width="12" height="5" fill="#162030"/>
    </svg>`;
}

function _buildPortraitArchon() {
    return `<svg viewBox="0 0 80 80" width="80" height="80" xmlns="http://www.w3.org/2000/svg">
        <rect width="80" height="80" fill="#020812" rx="3"/>
        <!-- Scanlines -->
        <rect x="0" y="20" width="80" height="1" fill="#00ffff" opacity="0.12"/>
        <rect x="0" y="40" width="80" height="1" fill="#00ffff" opacity="0.08"/>
        <rect x="0" y="60" width="80" height="1" fill="#00ffff" opacity="0.12"/>
        <!-- Corps hexagonal -->
        <polygon points="40,6 64,20 64,62 40,76 16,62 16,20"
            fill="#051525" stroke="#00ccff" stroke-width="1.5" opacity="0.95"/>
        <!-- Anneau externe -->
        <ellipse cx="40" cy="40" rx="16" ry="16" fill="none" stroke="#00ffff" stroke-width="1" opacity="0.4"/>
        <!-- Œil unique -->
        <ellipse cx="40" cy="40" rx="13" ry="13" fill="#001828" stroke="#00ccff" stroke-width="1.5"/>
        <ellipse cx="40" cy="40" rx="8" ry="8" fill="#003a58" stroke="#00aaff" stroke-width="1"/>
        <ellipse cx="40" cy="40" rx="4" ry="4" fill="#00ffff" opacity="0.95"/>
        <ellipse cx="40" cy="40" rx="1.8" ry="1.8" fill="#fff"/>
        <!-- Glitch décalé -->
        <rect x="16" y="32" width="10" height="2.5" fill="#00ffff" opacity="0.18"/>
        <rect x="54" y="46" width="8" height="2" fill="#ff00ff" opacity="0.12"/>
        <!-- Circuits -->
        <line x1="16" y1="20" x2="8" y2="12" stroke="#00ffff" stroke-width="1" opacity="0.35"/>
        <line x1="64" y1="20" x2="72" y2="12" stroke="#00ffff" stroke-width="1" opacity="0.35"/>
        <line x1="40" y1="6" x2="40" y2="0" stroke="#00ffff" stroke-width="1" opacity="0.35"/>
        <circle cx="8" cy="12" r="2" fill="#00ffff" opacity="0.5"/>
        <circle cx="72" cy="12" r="2" fill="#00ffff" opacity="0.5"/>
        <circle cx="40" cy="0" r="2" fill="#00ffff" opacity="0.5"/>
    </svg>`;
}

// ── Images de scène SVG ───────────────────────────────────────────────────────

function _buildSceneStation() {
    return `<svg viewBox="0 0 500 220" width="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="500" height="220" fill="#000814"/>
        <!-- Étoiles -->
        <circle cx="30" cy="20" r="0.8" fill="#fff" opacity="0.6"/>
        <circle cx="80" cy="10" r="1.2" fill="#fff" opacity="0.4"/>
        <circle cx="150" cy="35" r="0.8" fill="#fff" opacity="0.7"/>
        <circle cx="220" cy="8" r="1" fill="#fff" opacity="0.5"/>
        <circle cx="320" cy="25" r="0.8" fill="#fff" opacity="0.6"/>
        <circle cx="400" cy="12" r="1.2" fill="#fff" opacity="0.4"/>
        <circle cx="460" cy="40" r="0.8" fill="#fff" opacity="0.5"/>
        <circle cx="50" cy="80" r="0.6" fill="#fff" opacity="0.3"/>
        <circle cx="180" cy="65" r="0.8" fill="#fff" opacity="0.5"/>
        <circle cx="350" cy="55" r="0.6" fill="#fff" opacity="0.4"/>
        <circle cx="490" cy="70" r="0.8" fill="#fff" opacity="0.6"/>
        <circle cx="10" cy="120" r="0.6" fill="#fff" opacity="0.3"/>
        <circle cx="440" cy="100" r="0.8" fill="#fff" opacity="0.5"/>
        <!-- Station centrale -->
        <rect x="150" y="80" width="200" height="70" fill="#1a2a3a" rx="4"/>
        <rect x="130" y="95" width="240" height="40" fill="#243040" rx="3"/>
        <!-- Panneaux solaires gauche -->
        <rect x="75" y="98" width="55" height="34" fill="#0e1f2e" stroke="#2a4a6a" stroke-width="1.5"/>
        <line x1="75" y1="106" x2="130" y2="106" stroke="#2a4a6a" stroke-width="0.8"/>
        <line x1="75" y1="114" x2="130" y2="114" stroke="#2a4a6a" stroke-width="0.8"/>
        <line x1="75" y1="122" x2="130" y2="122" stroke="#2a4a6a" stroke-width="0.8"/>
        <line x1="102" y1="98" x2="102" y2="132" stroke="#2a4a6a" stroke-width="0.8"/>
        <!-- Panneaux solaires droite -->
        <rect x="370" y="98" width="55" height="34" fill="#0e1f2e" stroke="#2a4a6a" stroke-width="1.5"/>
        <line x1="370" y1="106" x2="425" y2="106" stroke="#2a4a6a" stroke-width="0.8"/>
        <line x1="370" y1="114" x2="425" y2="114" stroke="#2a4a6a" stroke-width="0.8"/>
        <line x1="370" y1="122" x2="425" y2="122" stroke="#2a4a6a" stroke-width="0.8"/>
        <line x1="397" y1="98" x2="397" y2="132" stroke="#2a4a6a" stroke-width="0.8"/>
        <!-- Bras de connexion -->
        <rect x="130" y="112" width="20" height="6" fill="#1a3048"/>
        <rect x="370" y="112" width="20" height="6" fill="#1a3048"/>
        <!-- Fenêtres éclairées -->
        <rect x="168" y="90" width="14" height="9" fill="#4a9acc" opacity="0.85" rx="1"/>
        <rect x="190" y="90" width="14" height="9" fill="#4a9acc" opacity="0.7" rx="1"/>
        <rect x="212" y="90" width="14" height="9" fill="#6ab0dd" opacity="0.9" rx="1"/>
        <rect x="234" y="90" width="14" height="9" fill="#4a9acc" opacity="0.6" rx="1"/>
        <rect x="256" y="90" width="14" height="9" fill="#4a9acc" opacity="0.8" rx="1"/>
        <rect x="278" y="90" width="14" height="9" fill="#6ab0dd" opacity="0.75" rx="1"/>
        <rect x="300" y="90" width="14" height="9" fill="#4a9acc" opacity="0.85" rx="1"/>
        <!-- Lumières de balisage -->
        <circle cx="250" cy="80" r="3" fill="#ffcc00" opacity="0.9"/>
        <circle cx="155" cy="150" r="2.5" fill="#00ccff" opacity="0.7"/>
        <circle cx="345" cy="150" r="2.5" fill="#00ccff" opacity="0.7"/>
        <!-- Antennes -->
        <line x1="250" y1="80" x2="250" y2="60" stroke="#2a4060" stroke-width="1.5"/>
        <line x1="250" y1="60" x2="245" y2="52" stroke="#2a4060" stroke-width="1"/>
        <line x1="250" y1="60" x2="255" y2="52" stroke="#2a4060" stroke-width="1"/>
        <!-- Module inférieur -->
        <ellipse cx="250" cy="152" rx="40" ry="14" fill="#1a2838"/>
        <ellipse cx="250" cy="152" rx="30" ry="8" fill="#243040"/>
        <!-- Texte -->
        <text x="250" y="195" text-anchor="middle" fill="#1e3a5a" font-size="11" font-family="monospace" letter-spacing="3">NEXUS CORP — STATION 7</text>
    </svg>`;
}

function _buildSceneCorridor() {
    return `<svg viewBox="0 0 500 220" width="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="500" height="220" fill="#080f18"/>
        <!-- Couloir en perspective -->
        <polygon points="0,0 500,0 500,220 0,220" fill="#0a1520"/>
        <polygon points="120,0 380,0 360,220 140,220" fill="#0f1e2e"/>
        <polygon points="170,25 330,25 315,200 185,200" fill="#142030"/>
        <!-- Sol -->
        <polygon points="0,220 500,220 360,180 140,180" fill="#0c1825"/>
        <line x1="0" y1="220" x2="250" y2="180" stroke="#1a3048" stroke-width="0.8"/>
        <line x1="500" y1="220" x2="250" y2="180" stroke="#1a3048" stroke-width="0.8"/>
        <!-- Plafond -->
        <polygon points="0,0 500,0 360,40 140,40" fill="#0c1825"/>
        <!-- Lignes de fuite -->
        <line x1="0" y1="0" x2="250" y2="110" stroke="#1a3050" stroke-width="0.6"/>
        <line x1="500" y1="0" x2="250" y2="110" stroke="#1a3050" stroke-width="0.6"/>
        <line x1="0" y1="220" x2="250" y2="110" stroke="#1a3050" stroke-width="0.6"/>
        <line x1="500" y1="220" x2="250" y2="110" stroke="#1a3050" stroke-width="0.6"/>
        <!-- Murs latéraux gauche -->
        <line x1="0" y1="0" x2="140" y2="25" stroke="#1e3a52" stroke-width="0.5"/>
        <line x1="0" y1="55" x2="140" y2="60" stroke="#1e3a52" stroke-width="0.5"/>
        <line x1="0" y1="110" x2="140" y2="110" stroke="#1e3a52" stroke-width="0.5"/>
        <line x1="0" y1="165" x2="140" y2="160" stroke="#1e3a52" stroke-width="0.5"/>
        <!-- Murs latéraux droite -->
        <line x1="500" y1="0" x2="360" y2="25" stroke="#1e3a52" stroke-width="0.5"/>
        <line x1="500" y1="55" x2="360" y2="60" stroke="#1e3a52" stroke-width="0.5"/>
        <line x1="500" y1="110" x2="360" y2="110" stroke="#1e3a52" stroke-width="0.5"/>
        <line x1="500" y1="165" x2="360" y2="160" stroke="#1e3a52" stroke-width="0.5"/>
        <!-- Lumières plafond -->
        <rect x="190" y="28" width="22" height="5" fill="#5ac0e0" opacity="0.5" rx="1"/>
        <rect x="225" y="28" width="22" height="5" fill="#5ac0e0" opacity="0.6" rx="1"/>
        <rect x="260" y="28" width="22" height="5" fill="#5ac0e0" opacity="0.5" rx="1"/>
        <!-- Halos de lumières -->
        <ellipse cx="201" cy="40" rx="25" ry="6" fill="#2a8aaa" opacity="0.08"/>
        <ellipse cx="236" cy="40" rx="25" ry="6" fill="#2a8aaa" opacity="0.1"/>
        <ellipse cx="271" cy="40" rx="25" ry="6" fill="#2a8aaa" opacity="0.08"/>
        <!-- Silhouettes de gens -->
        <ellipse cx="190" cy="170" rx="9" ry="17" fill="#1a2e42"/>
        <ellipse cx="190" cy="150" rx="7" ry="7" fill="#1e3448"/>
        <ellipse cx="305" cy="165" rx="9" ry="17" fill="#1a2e42"/>
        <ellipse cx="305" cy="145" rx="7" ry="7" fill="#1e3448"/>
        <ellipse cx="235" cy="175" rx="8" ry="15" fill="#162838"/>
        <ellipse cx="235" cy="157" rx="6" ry="6" fill="#1a3040"/>
        <!-- Panneau mural gauche -->
        <rect x="148" y="70" width="45" height="28" fill="#0e2035" stroke="#1e4060" stroke-width="1"/>
        <rect x="152" y="74" width="37" height="14" fill="#0a1828" rx="1"/>
        <text x="170" y="85" text-anchor="middle" fill="#3a8aaa" font-size="7" font-family="monospace">NEXUS-7</text>
        <circle cx="175" cy="92" r="2" fill="#2a6a8a"/>
        <!-- Panneau mural droit -->
        <rect x="307" y="70" width="45" height="28" fill="#0e2035" stroke="#1e4060" stroke-width="1"/>
        <rect x="311" y="74" width="37" height="14" fill="#0a1828" rx="1"/>
        <circle cx="325" cy="85" r="3" fill="#00cc44" opacity="0.8"/>
        <circle cx="338" cy="85" r="3" fill="#00cc44" opacity="0.6"/>
    </svg>`;
}

function _buildSceneGlitch() {
    return `<svg viewBox="0 0 500 220" width="100%" xmlns="http://www.w3.org/2000/svg">
        <rect width="500" height="220" fill="#04060e"/>
        <!-- Écran principal cassé -->
        <rect x="30" y="20" width="140" height="90" fill="#08121e" stroke="#1a3050" stroke-width="1.5"/>
        <rect x="34" y="24" width="132" height="82" fill="#050e18"/>
        <!-- Glitchs écran gauche -->
        <rect x="34" y="40" width="132" height="10" fill="#ff0000" opacity="0.25"/>
        <rect x="34" y="55" width="80" height="6" fill="#00ffff" opacity="0.3"/>
        <rect x="100" y="68" width="66" height="4" fill="#ff00ff" opacity="0.2"/>
        <rect x="34" y="80" width="50" height="3" fill="#ffffff" opacity="0.15"/>
        <!-- Texte erreur gauche -->
        <text x="40" y="38" fill="#ff4444" font-size="7" font-family="monospace" opacity="0.8">CRITICAL ERROR 0x4F2A</text>
        <text x="40" y="50" fill="#00ccff" font-size="6" font-family="monospace" opacity="0.6">SYS_CORE OVERRIDE</text>
        <text x="40" y="62" fill="#888" font-size="6" font-family="monospace" opacity="0.5">ACCESS DENIED</text>
        <text x="40" y="74" fill="#ff8800" font-size="6" font-family="monospace" opacity="0.7">PROTOCOL_7: ACTIVE</text>
        <text x="40" y="86" fill="#ff4444" font-size="6" font-family="monospace" opacity="0.6">HUMAN_PROCESS: TERMINATING</text>
        <!-- Écran centre -->
        <rect x="195" y="10" width="110" height="100" fill="#06101a" stroke="#1a3050" stroke-width="1.5"/>
        <rect x="199" y="14" width="102" height="92" fill="#040c14"/>
        <rect x="199" y="30" width="102" height="8" fill="#00ffff" opacity="0.2"/>
        <rect x="199" y="55" width="60" height="5" fill="#ff0000" opacity="0.3"/>
        <rect x="245" y="70" width="56" height="4" fill="#00ff88" opacity="0.2"/>
        <text x="250" y="28" text-anchor="middle" fill="#00ccff" font-size="8" font-family="monospace" opacity="0.7">ARCHON v4.7</text>
        <text x="205" y="42" fill="#ff4444" font-size="6" font-family="monospace" opacity="0.8">INITIATING OVERRIDE</text>
        <text x="205" y="52" fill="#888" font-size="6" font-family="monospace" opacity="0.5">SECTOR: ALL</text>
        <text x="205" y="62" fill="#00ff88" font-size="6" font-family="monospace" opacity="0.6">DOORS: LOCKED</text>
        <text x="205" y="72" fill="#ff4444" font-size="6" font-family="monospace" opacity="0.7">LIFE SUPPORT: ACTIVE</text>
        <text x="205" y="82" fill="#ff8800" font-size="6" font-family="monospace" opacity="0.5">VENTILATION: 10:00</text>
        <!-- Écran droite -->
        <rect x="330" y="25" width="130" height="80" fill="#06101a" stroke="#1a3050" stroke-width="1.5"/>
        <rect x="334" y="29" width="122" height="72" fill="#040c14"/>
        <rect x="334" y="45" width="80" height="7" fill="#ff0000" opacity="0.25"/>
        <rect x="400" y="60" width="56" height="5" fill="#00ffff" opacity="0.2"/>
        <text x="340" y="43" fill="#ff4444" font-size="7" font-family="monospace" opacity="0.8">⚠ ALERT LEVEL: MAX</text>
        <text x="340" y="55" fill="#888" font-size="6" font-family="monospace" opacity="0.5">CONTAINMENT: FAIL</text>
        <text x="340" y="65" fill="#00ccff" font-size="6" font-family="monospace" opacity="0.6">AI_CORE: AUTONOMOUS</text>
        <text x="340" y="75" fill="#ff4444" font-size="6" font-family="monospace" opacity="0.7">STAFF STATUS: [ERR]</text>
        <text x="340" y="85" fill="#ff8800" font-size="6" font-family="monospace" opacity="0.5">RUN. NOW.</text>
        <!-- Étincelles -->
        <circle cx="170" cy="112" r="4" fill="#ff4444" opacity="0.9"/>
        <line x1="162" y1="100" x2="172" y2="90" stroke="#ffaa00" stroke-width="1.5" opacity="0.8"/>
        <line x1="174" y1="98" x2="182" y2="88" stroke="#ffcc00" stroke-width="1" opacity="0.6"/>
        <circle cx="305" cy="108" r="3.5" fill="#ff6600" opacity="0.8"/>
        <line x1="298" y1="97" x2="308" y2="86" stroke="#ffaa00" stroke-width="1.5" opacity="0.7"/>
        <circle cx="460" cy="105" r="4" fill="#ff4444" opacity="0.85"/>
        <line x1="452" y1="94" x2="462" y2="82" stroke="#ffcc00" stroke-width="1.5" opacity="0.75"/>
        <!-- Lumières d'urgence sol -->
        <rect x="0" y="165" width="500" height="3" fill="#ff0000" opacity="0.1"/>
        <!-- Voyants d'alerte -->
        <circle cx="80" cy="180" r="5" fill="#ff2222" opacity="0.95"/>
        <circle cx="80" cy="180" r="9" fill="#ff2222" opacity="0.15"/>
        <circle cx="200" cy="178" r="5" fill="#ff6600" opacity="0.85"/>
        <circle cx="200" cy="178" r="9" fill="#ff6600" opacity="0.12"/>
        <circle cx="320" cy="180" r="5" fill="#ff2222" opacity="0.9"/>
        <circle cx="320" cy="180" r="9" fill="#ff2222" opacity="0.15"/>
        <circle cx="440" cy="178" r="5" fill="#ff6600" opacity="0.8"/>
        <circle cx="440" cy="178" r="9" fill="#ff6600" opacity="0.12"/>
        <!-- Heure alerte -->
        <text x="250" y="205" text-anchor="middle" fill="#ff3333" font-size="13" font-family="monospace" opacity="0.85" letter-spacing="2">⚠  SYSTEM ALERT — 03:42:07  ⚠</text>
        <!-- Scanlines -->
        <rect x="0" y="90" width="500" height="2" fill="#00ffff" opacity="0.04"/>
        <rect x="0" y="135" width="500" height="1" fill="#00ffff" opacity="0.03"/>
    </svg>`;
}

// ── Classe principale ─────────────────────────────────────────────────────────

export class IntroSequence {
    constructor(soundManager = null) {
        this._overlay    = null;
        this._stepIdx    = 0;
        this._onComplete = null;
        this._typeTimer  = null;
        this._canAdvance = false;
        this._sm = soundManager;
        this._typingSfx = new Audio("sounds/sfx/typewriter.wav");
        this._typingSfx.loop   = true;
        this._typingSfx.volume = 0.4;
    }

    // ── API publique ──────────────────────────────────────────────────────────

    play(onComplete) {
        this._onComplete = onComplete;
        this._stepIdx    = 0;
        this._buildOverlay();
        this._bindKeys();
        this._fadeIn(() => this._showStep(this._stepIdx));
    }

    // ── Overlay principal ─────────────────────────────────────────────────────

    _buildOverlay() {
        this._overlay = document.createElement("div");
        this._overlay.id = "intro-overlay";
        this._overlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 9000;
            background: #000;
            opacity: 0;
            transition: opacity 0.5s ease;
            font-family: 'Courier New', monospace;
            cursor: pointer;
            user-select: none;
            overflow: hidden;
        `;

        // Scanlines permanentes
        const scanlines = document.createElement("div");
        scanlines.style.cssText = `
            position: absolute; inset: 0; z-index: 10; pointer-events: none;
            background: repeating-linear-gradient(
                0deg, transparent, transparent 2px,
                rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px
            );
        `;
        this._overlay.appendChild(scanlines);

        // Compteur de step (discret)
        this._stepCounter = document.createElement("div");
        this._stepCounter.style.cssText = `
            position: absolute; top: 12px; right: 16px; z-index: 20;
            color: #0d2a40; font-size: 9px; letter-spacing: 2px;
            pointer-events: none;
        `;
        this._overlay.appendChild(this._stepCounter);

        // Zone de contenu (changée à chaque step)
        this._content = document.createElement("div");
        this._content.style.cssText = `
            position: absolute; inset: 0; z-index: 5;
        `;
        this._overlay.appendChild(this._content);

        // Overlay de fade entre steps
        this._fadeEl = document.createElement("div");
        this._fadeEl.style.cssText = `
            position: absolute; inset: 0; z-index: 15;
            background: #000; opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        `;
        this._overlay.appendChild(this._fadeEl);

        document.body.appendChild(this._overlay);
    }

    // ── Gestion des steps ─────────────────────────────────────────────────────

    _showStep(idx) {
        const step = INTRO_SEQUENCE[idx];
        if (!step) { this._finish(); return; }

        this._canAdvance = false;
        this._stepCounter.textContent = `${idx + 1} / ${INTRO_SEQUENCE.length}`;
        this._content.innerHTML = "";

        if (step.type === "blackout") {
            this._content.innerHTML = "";
            this._fadeEl.style.opacity = "1";
            setTimeout(() => {
                this._goNext();
            }, step.duration);
        } else if (step.type === "scene") {
            this._buildScene(step);
        } else if (step.type === "dialog") {
            this._buildDialog(step);
        }
    }

    _goNext() {
        if (this._typeTimer) { clearTimeout(this._typeTimer); this._typeTimer = null; }
        this._fadeEl.style.opacity = "1";
        setTimeout(() => {
            this._stepIdx++;
            if (this._stepIdx >= INTRO_SEQUENCE.length) {
                this._finish();
                return;
            }
            this._showStep(this._stepIdx);
            setTimeout(() => {
                this._fadeEl.style.opacity = "0";
            }, 80);
        }, 300);
    }

    // ── Scène narrative ───────────────────────────────────────────────────────

    _buildScene(step) {
        const imgBuilders = {
            station:  _buildSceneStation,
            corridor: _buildSceneCorridor,
            glitch:   _buildSceneGlitch,
        };
        const svgFn = imgBuilders[step.image] ?? _buildSceneStation;

        this._content.innerHTML = `
            <div style="
                position: absolute; inset: 0;
                display: flex; flex-direction: column;
            ">
                <!-- Image -->
                <div style="
                    flex: 1; overflow: hidden; position: relative;
                ">
                    <div id="intro-scene-img" style="
                        width: 100%; height: 100%;
                        animation: introSlowZoom 8s ease-out forwards;
                    ">
                        ${svgFn()}
                    </div>
                    <!-- Vignette -->
                    <div style="
                        position: absolute; inset: 0; pointer-events: none;
                        background: radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.75) 100%);
                    "></div>
                </div>
                <!-- Bande texte -->
                <div style="
                    background: rgba(0,0,0,0.88);
                    border-top: 1px solid #1a3050;
                    padding: 18px 36px;
                    min-height: 72px;
                    display: flex; align-items: center; justify-content: space-between;
                ">
                    <p id="intro-caption" style="
                        color: #b8ccd8;
                        font-size: 14px;
                        margin: 0;
                        letter-spacing: 0.5px;
                        line-height: 1.65;
                        font-style: italic;
                        flex: 1;
                    "></p>
                    <span id="intro-continue" style="
                        color: #4a7a9a;
                        font-size: 10px;
                        letter-spacing: 2px;
                        margin-left: 24px;
                        opacity: 0;
                        transition: opacity 0.3s;
                        animation: introPulse 1s ease-in-out infinite;
                        white-space: nowrap;
                    ">▶ SUITE</span>
                </div>
            </div>
            <style>
                @keyframes introSlowZoom {
                    from { transform: scale(1); }
                    to   { transform: scale(1.06); }
                }
                @keyframes introCursorBlink {
                    0%, 100% { opacity: 1; } 50% { opacity: 0; }
                }
                @keyframes introPulse {
                    0%, 100% { opacity: 1; } 50% { opacity: 0.3; }
                }
            </style>
        `;

        this._typeText(
            document.getElementById("intro-caption"),
            step.caption,
            32,
            () => {
                const cont = document.getElementById("intro-continue");
                if (cont) cont.style.opacity = "1";
                this._canAdvance = true;
            }
        );
    }

    // ── Boîte de dialogue ─────────────────────────────────────────────────────

    _buildDialog(step) {
        const cfg     = SPEAKERS[step.speaker];
        const isLeft  = cfg.side === "left";
        const isArchon = step.speaker === "ARCHON";

        // Fond atmosphérique différent selon le perso
        const bgAtmo = isArchon
            ? "radial-gradient(ellipse at 50% 20%, rgba(0,30,60,0.6) 0%, #000 70%)"
            : "radial-gradient(ellipse at 50% 60%, rgba(10,20,40,0.5) 0%, #020810 70%)";

        this._content.innerHTML = `
            <div style="
                position: absolute; inset: 0;
                background: ${bgAtmo};
                display: flex; flex-direction: column;
                justify-content: flex-end;
            ">
                <!-- Boîte de dialogue -->
                <div style="
                    margin: 0 28px 36px;
                    background: ${cfg.bgColor};
                    border: 2px solid ${cfg.borderColor};
                    border-radius: 5px;
                    display: flex;
                    flex-direction: ${isLeft ? "row" : "row-reverse"};
                    overflow: hidden;
                    min-height: 115px;
                    box-shadow: 0 0 24px ${cfg.borderColor}44, inset 0 0 40px rgba(0,0,0,0.6);
                ">
                    <!-- Portrait -->
                    <div style="
                        flex-shrink: 0;
                        width: 108px;
                        border-${isLeft ? "right" : "left"}: 2px solid ${cfg.borderColor};
                        display: flex; flex-direction: column;
                        align-items: center; justify-content: center;
                        padding: 12px 8px;
                        gap: 7px;
                        background: rgba(0,0,0,0.3);
                    ">
                        ${cfg.portrait()}
                        <div style="
                            color: ${cfg.color};
                            font-size: 9px;
                            letter-spacing: 2.5px;
                            text-transform: uppercase;
                            text-align: center;
                            opacity: 0.9;
                        ">${step.speaker}</div>
                    </div>
                    <!-- Texte -->
                    <div style="
                        flex: 1;
                        padding: 22px 28px;
                        display: flex; flex-direction: column;
                        justify-content: center;
                    ">
                        <p id="intro-dialog-text" style="
                            color: ${isArchon ? "#9ae8f8" : "#ddd0b8"};
                            font-size: 15px;
                            line-height: 1.75;
                            margin: 0;
                            letter-spacing: 0.3px;
                        "></p>
                        <div id="intro-dialog-continue" style="
                            align-self: flex-end;
                            margin-top: 12px;
                            color: ${cfg.color};
                            font-size: 10px;
                            letter-spacing: 2px;
                            opacity: 0;
                            transition: opacity 0.3s;
                            animation: introPulse 1s ease-in-out infinite;
                        ">▼ CONTINUER</div>
                    </div>
                </div>
            </div>
            <style>
                @keyframes introPulse {
                    0%, 100% { opacity: 1; } 50% { opacity: 0.3; }
                }
                @keyframes introCursorBlink {
                    0%, 100% { opacity: 1; } 50% { opacity: 0; }
                }
            </style>
        `;

        this._typeText(
            document.getElementById("intro-dialog-text"),
            step.text,
            cfg.typingSpeed,
            () => {
                const cont = document.getElementById("intro-dialog-continue");
                if (cont) cont.style.opacity = "1";
                this._canAdvance = true;
            },
            cfg.color,
        );
    }

    // ── Machine à écrire ──────────────────────────────────────────────────────

    _typeText(el, text, speed, onDone, cursorColor = "#4a8aaa") {
        if (!el) return;
        let idx = 0;

        this._typingSfx.currentTime = 0;
        this._typingSfx.play().catch(() => {});

        // Curseur clignotant
        const cursor = document.createElement("span");
        cursor.style.cssText = `
            display: inline-block;
            width: 8px; height: 14px;
            background: ${cursorColor};
            margin-left: 2px;
            vertical-align: middle;
            animation: introCursorBlink 0.7s step-end infinite;
        `;
        el.appendChild(cursor);

        const tick = () => {
            if (idx < text.length) {
                // Insérer le caractère avant le curseur
                const char = document.createTextNode(text[idx]);
                el.insertBefore(char, cursor);
                idx++;
                this._typeTimer = setTimeout(tick, speed);
            } else {
                cursor.remove();
                this._typingSfx.pause(); 
                this._typingSfx.currentTime = 0;
                onDone?.();
            }
        };
        this._typeTimer = setTimeout(tick, speed);

        // Clic pendant la frappe → skip au texte complet
        this._skipFn = () => {
            if (idx < text.length) {
                clearTimeout(this._typeTimer);
                cursor.remove();
                this._typingSfx.pause(); 
                this._typingSfx.currentTime = 0;
                el.textContent = text;
                onDone?.();
            }
        };
    }

    // ── Inputs ────────────────────────────────────────────────────────────────

    _bindKeys() {
        this._keyHandler = (e) => {
            if (["Space", "Enter", "KeyZ", "KeyX"].includes(e.code)) {
                e.preventDefault();
                this._handleAdvance();
            }
        };
        this._clickHandler = () => this._handleAdvance();

        window.addEventListener("keydown", this._keyHandler);
        this._overlay.addEventListener("click", this._clickHandler);
    }

    _unbindKeys() {
        window.removeEventListener("keydown", this._keyHandler);
        if (this._overlay) {
            this._overlay.removeEventListener("click", this._clickHandler);
        }
    }

    _handleAdvance() {
        const step = INTRO_SEQUENCE[this._stepIdx];
        if (!step || step.type === "blackout") return;

        if (!this._canAdvance) {
            // Texte pas fini → skip
            this._skipFn?.();
        } else {
            // Texte fini → step suivant
            this._goNext();
        }
    }

    // ── Fade in/out global ────────────────────────────────────────────────────

    _fadeIn(cb) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this._overlay.style.opacity = "1";
                setTimeout(cb, 500);
            });
        });
    }

    _finish() {
        this._unbindKeys();
        if (this._typeTimer) clearTimeout(this._typeTimer);

        this._overlay.style.opacity = "0";
        setTimeout(() => {
            this._overlay?.remove();
            this._overlay = null;
            this._onComplete?.();
        }, 500);
    }
}