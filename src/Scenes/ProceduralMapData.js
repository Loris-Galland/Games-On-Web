// ── Dimensions ────────────────────────────────────────────────────────────────
export const T          = 4;   // taille d'une tuile en unités monde
export const H1         = 0;   // hauteur sol niveau 1
export const H2         = 4;   // hauteur sol niveau 2

// ── Constantes de rotation ────────────────────────────────────────────────────
export const R0   = 0;
export const R90  = Math.PI / 2;
export const R180 = Math.PI;
export const R270 = Math.PI * 1.5;

// ── Générateur de map ─────────────────────────────────────────────────────────
export const SPAWN_ROOM   = { type: "spawn", cols: 8, rows: 8, color: "grey" };
export const CORRIDOR_LEN = 4;
export const QUAD_NAMES   = ["NW", "NE", "SW", "SE"];

// ── Assets sol par couleur ────────────────────────────────────────────────────
export const FLOOR_BY_COLOR = {
    blue:   ["Floor_Tile_Carpet_Blue.glb"],
    green:  ["Hydroponics_Floor.glb"],
    grey:   ["Floor_Metal_Square.glb"],
    orange: ["Hazard_Floor_1.glb"],
    red:    ["Hazard_Floor_2.glb"],
};

// ── Assets murs par couleur ───────────────────────────────────────────────────
export const WALL = {
    blue:  { base: "Wall_Blue.glb",   f2: "Wall_Blue_2nd_Floor.glb",   door: "Wall_With_Door_Blue.glb",   light: "Wall_Light_Blue.glb"   },
    green: { base: "Wall_Green.glb",  f2: "Wall_Green_2nd_Floor.glb",  door: "Wall_With_Door_Green.glb",  light: "Wall_Light_Green.glb"  },
    grey:  { base: "Wall_Grey.glb",   f2: "Wall_Grey_2nd_Floor.glb",   door: "Wall_With_Door_Grey.glb",   light: "Wall_Light_White.glb"  },
    orange:{ base: "Wall_Orange.glb", f2: "Wall_Orange_2nd_Floor.glb", door: "Wall_With_Door_Orange.glb", light: "Wall_Light_Orange.glb" },
    red:   { base: "Wall_Red.glb",    f2: "Wall_Red_2nd_Floor.glb",    door: "Wall_With_Door_Red.glb",    light: "Wall_Light_Red.glb"    },
};

// ── Assets rampes par couleur ─────────────────────────────────────────────────
export const RAMP = {
    base: { blue: "Ramp_Blue.glb",        green: "Ramp_Green.glb",        grey: "Ramp_Grey.glb",        orange: "Ramp_Orange.glb",        red: "Ramp_Red.glb"        },
    L:    { blue: "Ramp_Wall_Blue_L.glb", green: "Ramp_Wall_Green_L.glb", grey: "Ramp_Wall_Grey_L.glb", orange: "Ramp_Wall_Orange_L.glb", red: "Ramp_Wall_Red_L.glb" },
    R:    { blue: "Ramp_Wall_Blue_R.glb", green: "Ramp_Wall_Green_R.glb", grey: "Ramp_Wall_Grey_R.glb", orange: "Ramp_Wall_Orange_R.glb", red: "Ramp_Wall_Red_R.glb" },
};

// ── Types de salles disponibles ───────────────────────────────────────────────
export const ROOM_TYPES = [
    { type: "command",   cols: 16, rows: 16, color: "blue"   },
    { type: "medbay",    cols: 16, rows: 16, color: "green"  },
    { type: "engine",    cols: 16, rows: 16, color: "orange" },
    { type: "cafeteria", cols: 16, rows: 16, color: "grey"   },
    { type: "hydro",     cols: 16, rows: 16, color: "green"  },
    { type: "quarters",  cols: 16, rows: 16, color: "blue"   },
    { type: "storage",   cols: 16, rows: 16, color: "red"    },
];

// ── Patterns de props par type de salle et quadrant ──────────────────────────
// Structure : QUAD_PATTERNS[roomType][quadrant] = tableau de patterns possibles
// Chaque pattern est un tableau d'items { a, ox, oz, rot? }
// ox/oz sont des fractions [0..1] dans l'espace du quadrant
// rot absent → rotation aléatoire complète ; tableau → choix aléatoire parmi les valeurs
export const QUAD_PATTERNS = {

    command: {
        NW: [
            [
                { a: "Orrery_Tall.glb",            ox: 0.5, oz: 0.3 /* rot absent → full random */ },
                { a: "Command_Console.glb",         ox: 0.5, oz: 0.6, rot: R0   },
                { a: "Command_Console.glb",         ox: 0.5, oz: 0,   rot: R180 },
                { a: "Command_Console.glb",         ox: 0.2, oz: 0.3, rot: R270 },
                { a: "Command_Console.glb",         ox: 0.8, oz: 0.3, rot: R90  },
            ],
            [
                { a: "Command_Wall.glb",            ox: 0.3, oz: 0.5, rot: R270 },
                { a: "Large_Monitor_Blue.glb",      ox: 0.6, oz: 0.3, rot: R180 },
                { a: "Command_Console.glb",         ox: 0.6, oz: 0.7, rot: R0   },
            ],
        ],
        NE: [
            [
                { a: "Command_Console.glb",         ox: 0.5, oz: 0.2, rot: R180 },
                { a: "Command_Console.glb",         ox: 0.8, oz: 0.5, rot: R90  },
                { a: "Large_Monitor_Blue.glb",      ox: 0.3, oz: 0.5, rot: R270 },
                { a: "Large_Monitor_Blue.glb",      ox: 0.5, oz: 0.7, rot: R0   },
            ],
            [
                { a: "Large_Monitor_Blue.glb",      ox: 0.25, oz: 0.3, rot: R180 },
                { a: "Large_Monitor_Blue.glb",      ox: 0.75, oz: 0.3, rot: R180 },
                { a: "Command_Console.glb",         ox: 0.5,  oz: 0.7, rot: R0   },
            ],
        ],
        SE: [
            [
                { a: "Command_Console.glb",         ox: 0.5, oz: 0.2, rot: R270 },
                { a: "Command_Console.glb",         ox: 0.5, oz: 0.8, rot: R270 },
                { a: "Command_Wall.glb",            ox: 0.8, oz: 0.5, rot: R90  },
            ],
            [
                { a: "Briefing_Screen_Blue.glb",    ox: 0.5, oz: 0.2, rot: R180 },
                { a: "Briefing_Screen_Orange.glb",  ox: 0.5, oz: 1,   rot: R0   },
                { a: "Command_Console.glb",         ox: 0.3, oz: 0.6, rot: R270 },
                { a: "Command_Console.glb",         ox: 0.7, oz: 0.6, rot: R90  },
            ],
        ],
        SW: [],
    },

    medbay: {
        NW: [
            [
                { a: "Cryo_Tube_ON.glb",            ox: 0.3, oz: 0.2, rot: R0   },
                { a: "Cryo_Tube_ON.glb",            ox: 0.7, oz: 0.2, rot: R0   },
                { a: "Sleeper Casket Static.glb",   ox: 0.5, oz: 0.7, rot: R90  },
            ],
        ],
        NE: [
            [
                { a: "Cryo_Tube_ON.glb",            ox: 0.3, oz: 0.2, rot: R0 },
                { a: "Cryo_Tube_ON.glb",            ox: 0.7, oz: 0.2, rot: R0 },
                { a: "BioMonitor_Blue.glb",         ox: 0.5, oz: 0.7, rot: R0 },
            ],
        ],
        SW: [
            [
                { a: "Cryo_Tube_OFF.glb",           ox: 0.3, oz: 0.8, rot: R180 },
                { a: "Cryo_Tube_OFF.glb",           ox: 0.7, oz: 0.8, rot: R180 },
                { a: "BioMonitor_Green.glb",        ox: 0.5, oz: 0.4, rot: [R0, R90, R180, R270] },
            ],
        ],
        SE: [
            [
                { a: "Cryo_Tube_OFF.glb",           ox: 0.3, oz: 0.8, rot: R180 },
                { a: "Cryo_Tube_OFF.glb",           ox: 0.7, oz: 0.8, rot: R180 },
                { a: "BioMonitor_Red.glb",          ox: 0.5, oz: 0.4, rot: R270 },
                { a: "Table_Light.glb",             ox: 0.5, oz: 0.2             },
            ],
        ],
    },

    engine: {
        NW: [
            [
                { a: "Generator.glb",               ox: 0.25, oz: 0.25, rot: R0   },
                { a: "Generator_Pile_Small.glb",    ox: 0.7,  oz: 0.5              },
                { a: "Air_Con.glb",                 ox: 0.5,  oz: 0.1,  rot: R0   },
            ],
        ],
        NE: [
            [
                { a: "Generator.glb",               ox: 0.75, oz: 0.25, rot: R90  },
                { a: "Generator_Pile_Small.glb",    ox: 0.3,  oz: 0.5              },
                { a: "Air_Con.glb",                 ox: 0.5,  oz: 0.1,  rot: R0   },
            ],
        ],
        SW: [
            [
                { a: "Generator.glb",               ox: 0.25, oz: 0.75, rot: R270 },
                { a: "Generator_Pile_Chonky.glb",   ox: 0.6,  oz: 0.5              },
            ],
        ],
        SE: [], // rampCorner pour engine
    },

    cafeteria: {
        NW: [
            [
                { a: "Cafeteria_Table.glb",         ox: 0.3, oz: 0.25, rot: R0   },
                { a: "Cafeteria_Table.glb",         ox: 0.7, oz: 0.25, rot: R0   },
                { a: "Chair_1.glb",                 ox: 0.3, oz: 0.5,  rot: R90  },
                { a: "Chair_1.glb",                 ox: 0.7, oz: 0.5,  rot: R270 },
            ],
        ],
        NE: [
            [
                { a: "Cafeteria_Table.glb",         ox: 0.5, oz: 0.25, rot: R0  },
                { a: "Meeting_Table.glb",           ox: 0.5, oz: 0.7,  rot: R90 },
            ],
        ],
        SW: [
            [
                { a: "Cafeteria_Table.glb",         ox: 0.3, oz: 0.75, rot: R180 },
                { a: "Cafeteria_Table.glb",         ox: 0.7, oz: 0.75, rot: R180 },
                { a: "Space_Ketchup.glb",           ox: 0.3, oz: 0.5,  rot: [R0, R90, R180, R270] },
                { a: "Space_Mayo_Naise.glb",        ox: 0.7, oz: 0.5,  rot: [R0, R90, R180, R270] },
            ],
        ],
        SE: [
            [
                { a: "Octo_Table.glb",              ox: 0.5, oz: 0.5              },
                { a: "Chair_1.glb",                 ox: 0.3, oz: 0.5,  rot: R90  },
                { a: "Chair_1.glb",                 ox: 0.7, oz: 0.5,  rot: R270 },
                { a: "Cafeteria_Table_Inset_Red.glb", ox: 0.5, oz: 0.75, rot: R90 },
            ],
        ],
    },

    hydro: {
        NW: [
            [
                { a: "Hydroponic_Bay.glb",          ox: 0.3, oz: 0.2, rot: R0 },
                { a: "Hydroponic_Bay.glb",          ox: 0.7, oz: 0.2, rot: R0 },
                { a: "Plant_1.glb",                 ox: 0.5, oz: 0.6           },
            ],
        ],
        NE: [
            [
                { a: "Hydroponic_Bay.glb",          ox: 0.5, oz: 0.2, rot: R0 },
                { a: "Hydroponics_Lamp.glb",        ox: 0.3, oz: 0.6           },
                { a: "Plant_1.glb",                 ox: 0.7, oz: 0.6           },
            ],
        ],
        SW: [
            [
                { a: "Hydroponics_Full.glb",        ox: 0.3, oz: 0.8, rot: R180 },
                { a: "Hydroponics_Full.glb",        ox: 0.7, oz: 0.8, rot: R180 },
                { a: "Plant_1.glb",                 ox: 0.5, oz: 0.4             },
            ],
        ],
        SE: [
            [
                { a: "Hydroponics_Full.glb",        ox: 0.5, oz: 0.8, rot: R180 },
                { a: "Hydroponics_Lamp.glb",        ox: 0.3, oz: 0.4             },
                { a: "Plant_1.glb",                 ox: 0.7, oz: 0.4             },
            ],
        ],
    },

    quarters: {
        NW: [
            [
                { a: "Bunk_Double_Blue.glb",        ox: 0.25, oz: 0.2, rot: R0 },
                { a: "Table_Light.glb",             ox: 0.7,  oz: 0.2, rot: R0 },
                { a: "End_Table.glb",               ox: 0.5,  oz: 0.6, rot: [R0, R90, R180, R270] },
            ],
        ],
        NE: [
            [
                { a: "Bunk_Double_Blue.glb",        ox: 0.75, oz: 0.2, rot: R0 },
                { a: "End_Table.glb",               ox: 0.3,  oz: 0.6, rot: [R0, R90, R180, R270] },
                { a: "Lava_Lamp.glb",               ox: 0.7,  oz: 0.6           },
            ],
        ],
        SW: [
            [
                { a: "Bunk_Double_Orange.glb",      ox: 0.25, oz: 0.8, rot: R180 },
                { a: "Floor_Lamp.glb",              ox: 0.7,  oz: 0.5             },
            ],
        ],
        SE: [], // rampCorner pour quarters
    },

    storage: {
        NW: [
            [
                { a: "Battery_Blue.glb",            ox: 0.25, oz: 0.2, rot: R0 },
                { a: "Battery_Green.glb",           ox: 0.75, oz: 0.2, rot: R0 },
                { a: "Generator_Pile_Small.glb",    ox: 0.5,  oz: 0.6           },
            ],
        ],
        NE: [
            [
                { a: "Battery_Red.glb",             ox: 0.25, oz: 0.2, rot: R0 },
                { a: "Battery_Blue.glb",            ox: 0.75, oz: 0.2, rot: R0 },
                { a: "Generator_Pile_Small.glb",    ox: 0.5,  oz: 0.6           },
            ],
        ],
        SW: [
            [
                { a: "Battery_Grey.glb",            ox: 0.25, oz: 0.8, rot: R180 },
                { a: "Battery_Orange.glb",          ox: 0.75, oz: 0.8, rot: R180 },
                { a: "Generator_Pile_Chonky.glb",   ox: 0.5,  oz: 0.4             },
            ],
        ],
        SE: [
            [
                { a: "Battery_Blue.glb",            ox: 0.5,  oz: 0.8, rot: R180 },
                { a: "Generator_Pile_Small.glb",    ox: 0.3,  oz: 0.4             },
                { a: "Generator_Pile_Small.glb",    ox: 0.7,  oz: 0.4             },
            ],
        ],
    },

    // Fallback pour les types inconnus
    default: {
        NW: [ [ { a: "End_Table.glb", ox: 0.5, oz: 0.5 } ] ],
        NE: [ [ { a: "End_Table.glb", ox: 0.5, oz: 0.5 } ] ],
        SW: [ [ { a: "End_Table.glb", ox: 0.5, oz: 0.5 } ] ],
        SE: [ [ { a: "End_Table.glb", ox: 0.5, oz: 0.5 } ] ],
    },
};

// ── Layouts niveau 2 par type de salle ────────────────────────────────────────
// floor2    : liste de props à placer sur le balcon
// hasFloor2 : si false, le balcon n'est pas construit (mais rampCorner reste réservé)
// rampCorner: quadrant occupé par la rampe/balcon (skippé dans QUAD_PATTERNS)
export const LAYOUTS = {
    command:  [{ floor2: [
            { a: "Briefing_Screen_Blue.glb",   ox: 0.2,  oz: 0.8,  rot: R0   },
            { a: "Briefing_Screen_Purple.glb", ox: 0.5,  oz: 0.75, rot: R0   },
            { a: "Briefing_Screen_Orange.glb", ox: 0.8,  oz: 0.8,  rot: R0   },
            { a: "Chair_1.glb",                ox: 0.45, oz: 0.5,  rot: R270 },
            { a: "Chair_1.glb",                ox: 0.55, oz: 0.5,  rot: R90  },
        ], hasFloor2: true,  rampCorner: "SW" }],

    medbay:   [{ floor2: [
            { a: "Cryo_Tube_OFF.glb",          ox: 0.5,  oz: 0.2,  rot: R0   },
            { a: "BioMonitor_Blue.glb",        ox: 0.2,  oz: 0.35, rot: R90  },
            { a: "BioMonitor_Red.glb",         ox: 0.8,  oz: 0.35, rot: R270 },
            { a: "Railing_Flat.glb",           ox: 0.25, oz: 0.7,  rot: R0   },
            { a: "Railing_Flat.glb",           ox: 0.75, oz: 0.7,  rot: R0   },
        ], hasFloor2: true,  rampCorner: "NE" }],

    engine:   [{ floor2: [
            { a: "Generator_Pile_Small.glb",   ox: 0.3,  oz: 0.3             },
            { a: "Generator_Pile_Small.glb",   ox: 0.7,  oz: 0.3             },
            { a: "Briefing_Screen_Orange.glb", ox: 0.5,  oz: 0.2,  rot: R0   },
            { a: "Railing_Flat.glb",           ox: 0.3,  oz: 0.7,  rot: R0   },
            { a: "Railing_Flat.glb",           ox: 0.7,  oz: 0.7,  rot: R0   },
        ], hasFloor2: true,  rampCorner: "SE" }],

    cafeteria:[{ floor2: [
            { a: "Meeting_Table.glb",          ox: 0.3,  oz: 0.3,  rot: R0   },
            { a: "Meeting_Table.glb",          ox: 0.7,  oz: 0.3,  rot: R0   },
            { a: "Chair_1.glb",                ox: 0.3,  oz: 0.5,  rot: R90  },
            { a: "Chair_1.glb",                ox: 0.7,  oz: 0.5,  rot: R90  },
            { a: "Lava_Lamp.glb",              ox: 0.5,  oz: 0.3              },
            { a: "Railing_Flat.glb",           ox: 0.25, oz: 0.75, rot: R0   },
            { a: "Railing_Flat.glb",           ox: 0.75, oz: 0.75, rot: R0   },
        ], hasFloor2: false, rampCorner: "NW" }],

    hydro:    [{ floor2: [
            { a: "Hydroponics_Full.glb",       ox: 0.25, oz: 0.25, rot: R0 },
            { a: "Hydroponics_Full.glb",       ox: 0.75, oz: 0.25, rot: R0 },
            { a: "Plant_1.glb",                ox: 0.5,  oz: 0.3            },
            { a: "Railing_Flat.glb",           ox: 0.25, oz: 0.75, rot: R0 },
            { a: "Railing_Flat.glb",           ox: 0.75, oz: 0.75, rot: R0 },
        ], hasFloor2: true,  rampCorner: "SW" }],

    quarters: [{ floor2: [
            { a: "Bunk_Single_Grey.glb",       ox: 0.2,  oz: 0.2,  rot: R0 },
            { a: "Bunk_Single_Grey.glb",       ox: 0.8,  oz: 0.2,  rot: R0 },
            { a: "Floor_Lamp.glb",             ox: 0.5,  oz: 0.3            },
            { a: "Railing_Flat.glb",           ox: 0.25, oz: 0.75, rot: R0 },
            { a: "Railing_Flat.glb",           ox: 0.75, oz: 0.75, rot: R0 },
        ], hasFloor2: true,  rampCorner: "SE" }],

    storage:  [{ floor2: [
            { a: "Battery_Red.glb",            ox: 0.3,  oz: 0.3,  rot: R0 },
            { a: "Battery_Blue.glb",           ox: 0.7,  oz: 0.3,  rot: R0 },
            { a: "Generator_Pile_Small.glb",   ox: 0.5,  oz: 0.25           },
            { a: "Railing_Flat.glb",           ox: 0.25, oz: 0.75, rot: R0 },
            { a: "Railing_Flat.glb",           ox: 0.75, oz: 0.75, rot: R0 },
        ], hasFloor2: true,  rampCorner: "NE" }],

    default:  [{ floor2: [], hasFloor2: false, rampCorner: "NW" }],
};