import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

const T  = 4;
const H1 = 0;
const H2 = 4;

// ── Constantes de rotation ─────────────────────────────────────────────────
const R0   = 0;
const R90  = Math.PI / 2;
const R180 = Math.PI;
const R270 = Math.PI * 1.5;

const FLOOR_BY_COLOR = {
    blue:   ["Floor_Tile_Carpet_Blue.glb"],
    green:  ["Hydroponics_Floor.glb"],
    grey:   ["Floor_Metal_Square.glb"],
    orange: ["Hazard_Floor_1.glb"],
    red:    ["Hazard_Floor_2.glb"],
};

const WALL = {
    blue:  { base:"Wall_Blue.glb",   f2:"Wall_Blue_2nd_Floor.glb",   door:"Wall_With_Door_Blue.glb",   light:"Wall_Light_Blue.glb"   },
    green: { base:"Wall_Green.glb",  f2:"Wall_Green_2nd_Floor.glb",  door:"Wall_With_Door_Green.glb",  light:"Wall_Light_Green.glb"  },
    grey:  { base:"Wall_Grey.glb",   f2:"Wall_Grey_2nd_Floor.glb",   door:"Wall_With_Door_Grey.glb",   light:"Wall_Light_White.glb"  },
    orange:{ base:"Wall_Orange.glb", f2:"Wall_Orange_2nd_Floor.glb", door:"Wall_With_Door_Orange.glb", light:"Wall_Light_Orange.glb" },
    red:   { base:"Wall_Red.glb",    f2:"Wall_Red_2nd_Floor.glb",    door:"Wall_With_Door_Red.glb",    light:"Wall_Light_Red.glb"    },
};

const RAMP = {
    base:{ blue:"Ramp_Blue.glb",  green:"Ramp_Green.glb",  grey:"Ramp_Grey.glb",  orange:"Ramp_Orange.glb",  red:"Ramp_Red.glb"  },
    L:   { blue:"Ramp_Wall_Blue_L.glb", green:"Ramp_Wall_Green_L.glb", grey:"Ramp_Wall_Grey_L.glb", orange:"Ramp_Wall_Orange_L.glb", red:"Ramp_Wall_Red_L.glb" },
    R:   { blue:"Ramp_Wall_Blue_R.glb", green:"Ramp_Wall_Green_R.glb", grey:"Ramp_Wall_Grey_R.glb", orange:"Ramp_Wall_Orange_R.glb", red:"Ramp_Wall_Red_R.glb" },
};

const QUAD_PATTERNS = {

    command: {
        NW: [
            [
                {a:"Orrery_Tall.glb",           ox:0.5,  oz:0.3  /* rot absent → full random */ },
                {a:"Command_Console.glb",        ox:0.5,  oz:0.6,  rot:R0   },
                {a:"Command_Console.glb",        ox:0.5,  oz:0,  rot:R180 },
                {a:"Command_Console.glb",        ox:0.2,  oz:0.3,  rot:R270 },
                {a:"Command_Console.glb",        ox:0.8,  oz:0.3,  rot:R90  },
            ],
            [
                {a:"Command_Wall.glb",      ox:0.3,  oz:0.5,  rot:R270   },
                {a:"Large_Monitor_Blue.glb",ox:0.6,  oz:0.3,  rot:R180 },
                {a:"Command_Console.glb",   ox:0.6,  oz:0.7,  rot:R0    },
            ],
        ],
        NE: [
            [
                {a:"Command_Console.glb",   ox:0.5,  oz:0.2,  rot:R180    },
                {a:"Command_Console.glb",   ox:0.8,  oz:0.5,  rot:R90   },
                {a:"Large_Monitor_Blue.glb",ox:0.3,  oz:0.5,  rot:R270 },
                {a:"Large_Monitor_Blue.glb",ox:0.5,  oz:0.7,  rot:R0 },
            ],
            [
                {a:"Large_Monitor_Blue.glb",ox:0.25, oz:0.3,  rot:R180    },
                {a:"Large_Monitor_Blue.glb",ox:0.75, oz:0.3,  rot:R180    },
                {a:"Command_Console.glb",   ox:0.5,  oz:0.7,  rot:R0  },
            ],
        ],
        SE: [
            [
                {a:"Command_Console.glb",   ox:0.5,  oz:0.2,  rot:R270  },
                {a:"Command_Console.glb",   ox:0.5,  oz:0.8,  rot:R270   },
                {a:"Command_Wall.glb",      ox:0.8,  oz:0.5,  rot:R90  },
            ],
            [
                {a:"Briefing_Screen_Blue.glb",  ox:0.5, oz:0.2, rot:R180  },
                {a:"Briefing_Screen_Orange.glb",  ox:0.5, oz:1, rot:R0  },
                {a:"Command_Console.glb",       ox:0.3, oz:0.6, rot:R270 },
                {a:"Command_Console.glb",       ox:0.7, oz:0.6, rot:R90  },
            ],
        ],
        SW: [],
    },

    medbay: {
        NW: [
            [
                {a:"Cryo_Tube_ON.glb",          ox:0.3, oz:0.2, rot:R0   },
                {a:"Cryo_Tube_ON.glb",          ox:0.7, oz:0.2, rot:R0   },
                {a:"Sleeper Casket Static.glb",  ox:0.5, oz:0.7, rot:R90  },
            ],
        ],
        NE: [
            [
                {a:"Cryo_Tube_ON.glb",          ox:0.3, oz:0.2, rot:R0   },
                {a:"Cryo_Tube_ON.glb",          ox:0.7, oz:0.2, rot:R0   },
                {a:"BioMonitor_Blue.glb",        ox:0.5, oz:0.7, rot:R0   },
            ],
        ],
        SW: [
            [
                {a:"Cryo_Tube_OFF.glb",         ox:0.3, oz:0.8, rot:R180 },
                {a:"Cryo_Tube_OFF.glb",         ox:0.7, oz:0.8, rot:R180 },
                {a:"BioMonitor_Green.glb",       ox:0.5, oz:0.4, rot:[R0, R90, R180, R270] },
            ],
        ],
        SE: [
            [
                {a:"Cryo_Tube_OFF.glb",         ox:0.3, oz:0.8, rot:R180 },
                {a:"Cryo_Tube_OFF.glb",         ox:0.7, oz:0.8, rot:R180 },
                {a:"BioMonitor_Red.glb",         ox:0.5, oz:0.4, rot:R270 },
                {a:"Table_Light.glb",            ox:0.5, oz:0.2             },
            ],
        ],
        // NE est rampCorner pour medbay
    },

    engine: {
        NW: [
            [
                {a:"Generator.glb",             ox:0.25, oz:0.25, rot:R0   },
                {a:"Generator_Pile_Small.glb",  ox:0.7,  oz:0.5           },
                {a:"Air_Con.glb",               ox:0.5,  oz:0.1,  rot:R0  },
            ],
        ],
        NE: [
            [
                {a:"Generator.glb",             ox:0.75, oz:0.25, rot:R90  },
                {a:"Generator_Pile_Small.glb",  ox:0.3,  oz:0.5           },
                {a:"Air_Con.glb",               ox:0.5,  oz:0.1,  rot:R0  },
            ],
        ],
        SW: [
            [
                {a:"Generator.glb",             ox:0.25, oz:0.75, rot:R270 },
                {a:"Generator_Pile_Chonky.glb", ox:0.6,  oz:0.5           },
            ],
        ],
        // SE est rampCorner pour engine
        SE: [],
    },

    cafeteria: {
        NW: [
            [
                {a:"Cafeteria_Table.glb",       ox:0.3,  oz:0.25, rot:R0   },
                {a:"Cafeteria_Table.glb",       ox:0.7,  oz:0.25, rot:R0   },
                {a:"Chair_1.glb",               ox:0.3,  oz:0.5,  rot:R90  },
                {a:"Chair_1.glb",               ox:0.7,  oz:0.5,  rot:R270 },
            ],
        ],
        NE: [
            [
                {a:"Cafeteria_Table.glb",       ox:0.5,  oz:0.25, rot:R0   },
                {a:"Meeting_Table.glb",         ox:0.5,  oz:0.7,  rot:R90  },
            ],
        ],
        SW: [
            [
                {a:"Cafeteria_Table.glb",       ox:0.3,  oz:0.75, rot:R180 },
                {a:"Cafeteria_Table.glb",       ox:0.7,  oz:0.75, rot:R180 },
                {a:"Space_Ketchup.glb",         ox:0.3,  oz:0.5,  rot:[R0, R90, R180, R270] },
                {a:"Space_Mayo_Naise.glb",      ox:0.7,  oz:0.5,  rot:[R0, R90, R180, R270] },
            ],
        ],
        SE: [
            [
                {a:"Octo_Table.glb",            ox:0.5,  oz:0.5           },
                {a:"Chair_1.glb",               ox:0.3,  oz:0.5,  rot:R90 },
                {a:"Chair_1.glb",               ox:0.7,  oz:0.5,  rot:R270},
                {a:"Cafeteria_Table_Inset_Red.glb", ox:0.5, oz:0.75, rot:R90 },
            ],
        ],
        // NW est rampCorner pour cafeteria (mais hasFloor2:false, donc tous actifs)
    },

    hydro: {
        NW: [
            [
                {a:"Hydroponic_Bay.glb",        ox:0.3,  oz:0.2,  rot:R0  },
                {a:"Hydroponic_Bay.glb",        ox:0.7,  oz:0.2,  rot:R0  },
                {a:"Plant_1.glb",               ox:0.5,  oz:0.6            },
            ],
        ],
        NE: [
            [
                {a:"Hydroponic_Bay.glb",        ox:0.5,  oz:0.2,  rot:R0  },
                {a:"Hydroponics_Lamp.glb",      ox:0.3,  oz:0.6            },
                {a:"Plant_1.glb",               ox:0.7,  oz:0.6            },
            ],
        ],
        SW: [
            [
                {a:"Hydroponics_Full.glb",      ox:0.3,  oz:0.8,  rot:R180},
                {a:"Hydroponics_Full.glb",      ox:0.7,  oz:0.8,  rot:R180},
                {a:"Plant_1.glb",               ox:0.5,  oz:0.4            },
            ],
        ],
        SE: [
            [
                {a:"Hydroponics_Full.glb",      ox:0.5,  oz:0.8,  rot:R180},
                {a:"Hydroponics_Lamp.glb",      ox:0.3,  oz:0.4            },
                {a:"Plant_1.glb",               ox:0.7,  oz:0.4            },
            ],
        ],
        // SW est rampCorner pour hydro
    },

    quarters: {
        NW: [
            [
                {a:"Bunk_Double_Blue.glb",      ox:0.25, oz:0.2,  rot:R0  },
                {a:"Table_Light.glb",           ox:0.7,  oz:0.2,  rot:R0  },
                {a:"End_Table.glb",             ox:0.5,  oz:0.6,  rot:[R0, R90, R180, R270] },
            ],
        ],
        NE: [
            [
                {a:"Bunk_Double_Blue.glb",      ox:0.75, oz:0.2,  rot:R0  },
                {a:"End_Table.glb",             ox:0.3,  oz:0.6,  rot:[R0, R90, R180, R270] },
                {a:"Lava_Lamp.glb",             ox:0.7,  oz:0.6            },
            ],
        ],
        SW: [
            [
                {a:"Bunk_Double_Orange.glb",    ox:0.25, oz:0.8,  rot:R180},
                {a:"Floor_Lamp.glb",            ox:0.7,  oz:0.5            },
            ],
        ],
        // SE est rampCorner pour quarters
        SE: [],
    },

    storage: {
        NW: [
            [
                {a:"Battery_Blue.glb",          ox:0.25, oz:0.2,  rot:R0  },
                {a:"Battery_Green.glb",         ox:0.75, oz:0.2,  rot:R0  },
                {a:"Generator_Pile_Small.glb",  ox:0.5,  oz:0.6            },
            ],
        ],
        NE: [
            [
                {a:"Battery_Red.glb",           ox:0.25, oz:0.2,  rot:R0  },
                {a:"Battery_Blue.glb",          ox:0.75, oz:0.2,  rot:R0  },
                {a:"Generator_Pile_Small.glb",  ox:0.5,  oz:0.6            },
            ],
        ],
        SW: [
            [
                {a:"Battery_Grey.glb",          ox:0.25, oz:0.8,  rot:R180},
                {a:"Battery_Orange.glb",        ox:0.75, oz:0.8,  rot:R180},
                {a:"Generator_Pile_Chonky.glb", ox:0.5,  oz:0.4            },
            ],
        ],
        // NE est rampCorner pour storage
        SE: [
            [
                {a:"Battery_Blue.glb",          ox:0.5,  oz:0.8,  rot:R180},
                {a:"Generator_Pile_Small.glb",  ox:0.3,  oz:0.4            },
                {a:"Generator_Pile_Small.glb",  ox:0.7,  oz:0.4            },
            ],
        ],
    },

    // Fallback
    default: {
        NW: [ [ {a:"End_Table.glb", ox:0.5, oz:0.5} ] ],
        NE: [ [ {a:"End_Table.glb", ox:0.5, oz:0.5} ] ],
        SW: [ [ {a:"End_Table.glb", ox:0.5, oz:0.5} ] ],
        SE: [ [ {a:"End_Table.glb", ox:0.5, oz:0.5} ] ],
    },
};

// ── Layouts (floor2 uniquement — floor1 est généré via QUAD_PATTERNS) ──────
const LAYOUTS = {
    command:  [{ floor2:[
            {a:"Briefing_Screen_Blue.glb",   ox:0.2,  oz:0.8,  rot:R0   },
            {a:"Briefing_Screen_Purple.glb", ox:0.5,  oz:0.75, rot:R0   },
            {a:"Briefing_Screen_Orange.glb", ox:0.8,  oz:0.8,  rot:R0   },
            {a:"Chair_1.glb", ox:0.45,  oz:0.5,  rot:R270   },
            {a:"Chair_1.glb", ox:0.55,  oz:0.5,  rot:R90   },
        ], hasFloor2:true,  rampCorner:"SW" }],

    medbay:   [{ floor2:[
            {a:"Cryo_Tube_OFF.glb",    ox:0.5,  oz:0.2,  rot:R0   },
            {a:"BioMonitor_Blue.glb",  ox:0.2,  oz:0.35, rot:R90  },
            {a:"BioMonitor_Red.glb",   ox:0.8,  oz:0.35, rot:R270 },
            {a:"Railing_Flat.glb",     ox:0.25, oz:0.7,  rot:R0   },
            {a:"Railing_Flat.glb",     ox:0.75, oz:0.7,  rot:R0   },
        ], hasFloor2:true,  rampCorner:"NE" }],

    engine:   [{ floor2:[
            {a:"Generator_Pile_Small.glb",   ox:0.3,  oz:0.3             },
            {a:"Generator_Pile_Small.glb",   ox:0.7,  oz:0.3             },
            {a:"Briefing_Screen_Orange.glb", ox:0.5,  oz:0.2,  rot:R0   },
            {a:"Railing_Flat.glb",           ox:0.3,  oz:0.7,  rot:R0   },
            {a:"Railing_Flat.glb",           ox:0.7,  oz:0.7,  rot:R0   },
        ], hasFloor2:true,  rampCorner:"SE" }],

    cafeteria:[{ floor2:[
            {a:"Meeting_Table.glb", ox:0.3,  oz:0.3, rot:R0  },
            {a:"Meeting_Table.glb", ox:0.7,  oz:0.3, rot:R0  },
            {a:"Chair_1.glb",       ox:0.3,  oz:0.5, rot:R90 },
            {a:"Chair_1.glb",       ox:0.7,  oz:0.5, rot:R90 },
            {a:"Lava_Lamp.glb",     ox:0.5,  oz:0.3           },
            {a:"Railing_Flat.glb",  ox:0.25, oz:0.75,rot:R0  },
            {a:"Railing_Flat.glb",  ox:0.75, oz:0.75,rot:R0  },
        ], hasFloor2:false, rampCorner:"NW" }],

    hydro:    [{ floor2:[
            {a:"Hydroponics_Full.glb", ox:0.25, oz:0.25, rot:R0  },
            {a:"Hydroponics_Full.glb", ox:0.75, oz:0.25, rot:R0  },
            {a:"Plant_1.glb",          ox:0.5,  oz:0.3            },
            {a:"Railing_Flat.glb",     ox:0.25, oz:0.75, rot:R0  },
            {a:"Railing_Flat.glb",     ox:0.75, oz:0.75, rot:R0  },
        ], hasFloor2:true,  rampCorner:"SW" }],

    quarters: [{ floor2:[
            {a:"Bunk_Single_Grey.glb", ox:0.2,  oz:0.2,  rot:R0   },
            {a:"Bunk_Single_Grey.glb", ox:0.8,  oz:0.2,  rot:R0   },
            {a:"Floor_Lamp.glb",       ox:0.5,  oz:0.3              },
            {a:"Railing_Flat.glb",     ox:0.25, oz:0.75, rot:R0   },
            {a:"Railing_Flat.glb",     ox:0.75, oz:0.75, rot:R0   },
        ], hasFloor2:true,  rampCorner:"SE" }],

    storage:  [{ floor2:[
            {a:"Battery_Red.glb",           ox:0.3,  oz:0.3,  rot:R0   },
            {a:"Battery_Blue.glb",          ox:0.7,  oz:0.3,  rot:R0   },
            {a:"Generator_Pile_Small.glb",  ox:0.5,  oz:0.25             },
            {a:"Railing_Flat.glb",          ox:0.25, oz:0.75, rot:R0   },
            {a:"Railing_Flat.glb",          ox:0.75, oz:0.75, rot:R0   },
        ], hasFloor2:true,  rampCorner:"NE" }],

    default:  [{ floor2:[], hasFloor2:false, rampCorner:"NW" }],
};

const ROOM_TYPES = [
    {type:"command",   cols:16, rows:16, color:"blue"  },
    {type:"medbay",    cols:16, rows:16, color:"green" },
    {type:"engine",    cols:16, rows:16, color:"orange"},
    {type:"cafeteria", cols:16, rows:16, color:"grey"  },
    {type:"hydro",     cols:16, rows:16, color:"green" },
    {type:"quarters",  cols:16, rows:16, color:"blue"  },
    {type:"storage",   cols:16, rows:16, color:"red"   },
];

const SPAWN_ROOM   = {type:"spawn", cols:8, rows:8, color:"grey"};
const CORRIDOR_LEN = 4;
const QUAD_NAMES   = ["NW","NE","SW","SE"];

function rng(seed){let s=seed;return()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/0xffffffff;};}
function pick(arr,rand){return arr[Math.floor(rand()*arr.length)];}

function resolveRot(rot, rand) {
    if (Array.isArray(rot)) return rot[Math.floor(rand() * rot.length)];
    if (rot !== undefined)  return rot;
    return Math.floor(rand() * 4) * (Math.PI / 2);
}

// Retourne l'origine (worldX, worldZ en tuiles) et la taille (cols, rows) d'un quadrant
// dans l'espace global de la salle.
function quadBounds(room, quad) {
    const hC = Math.floor(room.cols / 2);
    const hR = Math.floor(room.rows / 2);
    const oX = (quad === "NE" || quad === "SE") ? room.worldX + hC : room.worldX;
    const oZ = (quad === "SW" || quad === "SE") ? room.worldZ + hR : room.worldZ;
    return { oX, oZ, cols: hC, rows: hR };
}

export class ProceduralMap {
    constructor(scene, options={}) {
        this.scene      = scene;
        this.seed       = options.seed      ?? Date.now();
        this.roomCount  = options.roomCount ?? 6;
        this.assetBase  = options.assetBase ?? "assets/";
        this.rand       = rng(this.seed);
        this._cache     = new Map();
        this._root      = new BABYLON.TransformNode("ProceduralMap", scene);
        this.rooms      = [];
        this.corridors  = [];
        this.spawnPoint = BABYLON.Vector3.Zero();
        this._activeNode    = null;
        this._corridorNode  = null;
        this._corridorInNode= null;
        this._activeIdx     = -1;
        this._loading       = false;
        this._camera        = null;
        this._onRoomReady   = null;
        this._builtRooms    = new Map();
        this._lastTransition  = 0;
        this._cooldownMs      = 1500;
        this._lastTriggerKey  = null;
    }

    async generate() {
        this._buildChain();
        const r0=this.rooms[0];
        this.spawnPoint=new BABYLON.Vector3((r0.worldX+r0.cols/2)*T,0,(r0.worldZ+r0.rows/2)*T);
        await this._activateRoom(0);
        return this;
    }

    attachCamera(camera){ this._camera=camera; this._setupTriggerLoop(); }

    _buildChain(){
        this.rooms.push({...SPAWN_ROOM,worldX:0,worldZ:0,isSpawn:true});
        const dirs=[
            {side:1,dx:1,dz:0},{side:2,dx:0,dz:1},{side:1,dx:1,dz:0},
            {side:0,dx:0,dz:-1},{side:1,dx:1,dz:0},{side:2,dx:0,dz:1},
        ];
        for(let i=0;i<this.roomCount;i++){
            const prev=this.rooms[this.rooms.length-1],dir=dirs[i%dirs.length],tpl=ROOM_TYPES[i%ROOM_TYPES.length];
            let wx,wz;
            if      (dir.dx===1) {wx=prev.worldX+prev.cols+CORRIDOR_LEN;wz=prev.worldZ+Math.floor((prev.rows-tpl.rows)/2);}
            else if (dir.dx===-1){wx=prev.worldX-tpl.cols-CORRIDOR_LEN; wz=prev.worldZ+Math.floor((prev.rows-tpl.rows)/2);}
            else if (dir.dz===1) {wx=prev.worldX+Math.floor((prev.cols-tpl.cols)/2);wz=prev.worldZ+prev.rows+CORRIDOR_LEN;}
            else                 {wx=prev.worldX+Math.floor((prev.cols-tpl.cols)/2);wz=prev.worldZ-tpl.rows-CORRIDOR_LEN;}
            this.rooms.push({...tpl,worldX:wx,worldZ:wz,isSpawn:false});
            this.corridors.push(this._calcCorridor(prev,this.rooms[this.rooms.length-1],dir.side));
        }
    }

    _calcCorridor(from,to,exitSide){
        const tiles=[];
        let sx,sz,tx,tz;
        if      (exitSide===1){sx=from.worldX+from.cols;sz=from.worldZ+Math.floor(from.rows/2);tx=to.worldX-1;tz=to.worldZ+Math.floor(to.rows/2);}
        else if (exitSide===3){sx=from.worldX-1;sz=from.worldZ+Math.floor(from.rows/2);tx=to.worldX+to.cols;tz=to.worldZ+Math.floor(to.rows/2);}
        else if (exitSide===2){sx=from.worldX+Math.floor(from.cols/2);sz=from.worldZ+from.rows;tx=to.worldX+Math.floor(to.cols/2);tz=to.worldZ-1;}
        else                  {sx=from.worldX+Math.floor(from.cols/2);sz=from.worldZ-1;tx=to.worldX+Math.floor(to.cols/2);tz=to.worldZ+to.rows;}
        let cx=sx,cz=sz;
        const sX=tx>cx?1:tx<cx?-1:0,sZ=tz>cz?1:tz<cz?-1:0;
        while(cx!==tx+sX){tiles.push({x:cx,z:cz});cx+=sX;}
        while(cz!==tz+sZ){tiles.push({x:cx,z:cz});cz+=sZ;}
        return{from,to,exitSide,tiles};
    }

    async _activateRoom(idx, comingFromIdx = null){
        if(this._loading||idx===this._activeIdx)return;
        this._loading=true;

        const room=this.rooms[idx];
        const cIn =idx>0                    ?this.corridors[idx-1]:null;
        const cOut=idx<this.corridors.length?this.corridors[idx]  :null;

        let roomNode;
        if(this._builtRooms.has(idx)){
            roomNode = this._builtRooms.get(idx);
        } else {
            roomNode = new BABYLON.TransformNode(`room_${idx}`, this.scene);
            roomNode.parent = this._root;
            await this._buildRoom(room, cIn, cOut, roomNode);
            this._builtRooms.set(idx, roomNode);
        }

        if(this._activeNode && this._activeNode !== roomNode) this._activeNode.setEnabled(false);
        roomNode.setEnabled(true);
        this._activeNode = roomNode;
        this._activeIdx  = idx;

        await this._buildCorridorDisplay(idx);
        await this._buildCorridorInDisplay(idx);

        const comingBack = comingFromIdx !== null && comingFromIdx > idx;
        const spawnEntry = this._calcEntrySpawn(room, cIn);
        const spawnExit  = this._calcExitSpawn(room, cOut);
        const spawnPos   = comingBack ? spawnExit : spawnEntry;

        if(this._onRoomReady){
            await new Promise(resolve => setTimeout(resolve, 50));
            this._onRoomReady(room, idx, spawnPos, {spawnEntry, spawnExit, comingBack});
        }

        this._lastTriggerKey = null;
        this._lastTransition = performance.now();
        this._loading=false;
    }

    async _buildCorridorDisplay(roomIdx){
        if(this._corridorNode){
            this._corridorNode.getChildMeshes().forEach(m=>m.dispose());
            this._corridorNode.dispose();
            this._corridorNode=null;
        }
        if(roomIdx>=this.corridors.length)return;
        const corridor=this.corridors[roomIdx];
        const node=new BABYLON.TransformNode(`corrOut_${roomIdx}`,this.scene);
        node.parent=this._root;
        this._corridorNode=node;
        await this._buildCorridorGeometry(corridor.tiles, node, roomIdx, false);
    }

    async _buildCorridorInDisplay(roomIdx){
        if(this._corridorInNode){
            this._corridorInNode.getChildMeshes().forEach(m=>m.dispose());
            this._corridorInNode.dispose();
            this._corridorInNode=null;
        }
        if(roomIdx===0)return;
        const corridor=this.corridors[roomIdx-1];
        const node=new BABYLON.TransformNode(`corrIn_${roomIdx}`,this.scene);
        node.parent=this._root;
        this._corridorInNode=node;
        const tilesRev=[...corridor.tiles].reverse();
        await this._buildCorridorGeometry(tilesRev, node, roomIdx, true);
    }

    async _buildCorridorGeometry(tiles, node, roomIdx, isReturn){
        const tileSet=new Set(tiles.map(t=>`${t.x},${t.z}`));
        const ps=[];
        const darkMat=new BABYLON.StandardMaterial(`cMat_${roomIdx}_${isReturn}`,this.scene);
        darkMat.diffuseColor=new BABYLON.Color3(0.08,0.08,0.1);
        darkMat.emissiveColor=new BABYLON.Color3(0.03,0.03,0.05);

        for(let i=0;i<tiles.length;i++){
            const tile=tiles[i],wx=tile.x*T,wz=tile.z*T;
            const prev=tiles[i-1],next=tiles[i+1];
            const gX=next?next.x!==tile.x:prev?prev.x!==tile.x:false;
            const gZ=next?next.z!==tile.z:prev?prev.z!==tile.z:false;
            const prog=i/tiles.length;

            const fb=BABYLON.MeshBuilder.CreateBox(`cf_${i}_${roomIdx}_${isReturn}`,{width:T,height:0.1,depth:T},this.scene);
            fb.position=new BABYLON.Vector3(wx+T/2,-0.05,wz+T/2);
            fb.material=darkMat;fb.checkCollisions=false;fb.isPickable=false;fb.parent=node;
            this._mkCol(`cF_${i}_${roomIdx}_${isReturn}`,wx+T/2,-0.1,wz+T/2,T,0.2,T,node);

            if(gX){
                if(!tileSet.has(`${tile.x},${tile.z-1}`)){ps.push(this._vis("Wall_Grey.glb",new BABYLON.Vector3(wx+T/2,0,wz),new BABYLON.Vector3(0,Math.PI,0),node));this._mkCol(`cWN_${i}_${roomIdx}_${isReturn}`,wx+T/2,1.5,wz,T,3,0.3,node);}
                if(!tileSet.has(`${tile.x},${tile.z+1}`)){ps.push(this._vis("Wall_Grey.glb",new BABYLON.Vector3(wx+T/2,0,wz+T),BABYLON.Vector3.Zero(),node));this._mkCol(`cWS_${i}_${roomIdx}_${isReturn}`,wx+T/2,1.5,wz+T,T,3,0.3,node);}
            }
            if(gZ){
                if(!tileSet.has(`${tile.x-1},${tile.z}`)){ps.push(this._vis("Wall_Grey.glb",new BABYLON.Vector3(wx,0,wz+T/2),new BABYLON.Vector3(0,-Math.PI/2,0),node));this._mkCol(`cWW_${i}_${roomIdx}_${isReturn}`,wx,1.5,wz+T/2,0.3,3,T,node);}
                if(!tileSet.has(`${tile.x+1},${tile.z}`)){ps.push(this._vis("Wall_Grey.glb",new BABYLON.Vector3(wx+T,0,wz+T/2),new BABYLON.Vector3(0,Math.PI/2,0),node));this._mkCol(`cWE_${i}_${roomIdx}_${isReturn}`,wx+T,1.5,wz+T/2,0.3,3,T,node);}
            }

            if(prog>0.3){
                const alpha=Math.min(0.97,(prog-0.3)*1.5);
                const fm=new BABYLON.StandardMaterial(`fm_${i}_${roomIdx}_${isReturn}`,this.scene);
                fm.diffuseColor=new BABYLON.Color3(0,0,0);fm.emissiveColor=new BABYLON.Color3(0,0,0);
                fm.alpha=alpha;fm.backFaceCulling=false;fm.alphaMode=BABYLON.Engine.ALPHA_COMBINE;
                const fp=BABYLON.MeshBuilder.CreateBox(`fp_${i}_${roomIdx}_${isReturn}`,{width:T*0.98,height:3.5,depth:T*0.98},this.scene);
                fp.position=new BABYLON.Vector3(wx+T/2,1.75,wz+T/2);
                fp.material=fm;fp.isPickable=false;fp.checkCollisions=false;fp.parent=node;
            }
        }

        if(tiles.length>=2){
            const tTile=tiles[tiles.length-2];
            const prefix=isReturn?"trigIn":"trig";
            const trigger=BABYLON.MeshBuilder.CreateBox(`${prefix}_${roomIdx}`,{width:T*1.5,height:4,depth:T*1.5},this.scene);
            trigger.position=new BABYLON.Vector3(tTile.x*T+T/2,1,tTile.z*T+T/2);
            trigger.isVisible=false;trigger.checkCollisions=false;trigger.isPickable=false;trigger.parent=node;
            trigger._toRoom   = isReturn ? roomIdx-1 : roomIdx+1;
            trigger._fromRoom = roomIdx;
        }
        await Promise.all(ps);
    }

    _setupTriggerLoop(){
        this.scene.registerBeforeRender(()=>{
            if(!this._camera||this._loading)return;
            const cam=this._camera.position;
            const now=performance.now();
            const triggerSources=[];
            if(this._corridorNode)   triggerSources.push({node:this._corridorNode,   prefix:"trig_"  });
            if(this._corridorInNode) triggerSources.push({node:this._corridorInNode, prefix:"trigIn_"});
            let inAnyTrigger=false;
            for(const {node,prefix} of triggerSources){
                for(const m of node.getChildMeshes()){
                    if(!m.name.startsWith(prefix))continue;
                    const p=m.getAbsolutePosition();
                    const inside=Math.abs(cam.x-p.x)<T*1.2&&Math.abs(cam.z-p.z)<T*1.2;
                    if(!inside)continue;
                    inAnyTrigger=true;
                    const key=m.name;
                    if(now-this._lastTransition<this._cooldownMs)break;
                    if(key===this._lastTriggerKey)break;
                    const to=m._toRoom;
                    const valid=prefix==="trig_"?(to!==undefined&&to<this.rooms.length):(to!==undefined&&to>=0);
                    if(valid){
                        this._lastTriggerKey=key;
                        this._lastTransition=now;
                        this._activateRoom(to,m._fromRoom);
                    }
                    break;
                }
            }
            if(!inAnyTrigger)this._lastTriggerKey=null;
        });
    }

    async _buildRoom(room,cIn,cOut,parent){
        const ox=room.worldX*T,oz=room.worldZ*T,rW=room.cols*T,rD=room.rows*T;
        const wSet  =WALL[room.color]           ??WALL.grey;
        const floors=FLOOR_BY_COLOR[room.color] ??FLOOR_BY_COLOR.grey;

        const openings=new Set();
        if(cIn) {const l=cIn.tiles[cIn.tiles.length-1];if(l){const s=this._side(room,l);if(s)openings.add(s);}}
        if(cOut){const f=cOut.tiles[0];                 if(f){const s=this._side(room,f);if(s)openings.add(s);}}

        const ps=[];

        // Sol
        for(let tx=0;tx<room.cols;tx++)
            for(let tz=0;tz<room.rows;tz++)
                ps.push(this._vis(pick(floors,this.rand),new BABYLON.Vector3(ox+tx*T+T/2,H1,oz+tz*T+T/2),BABYLON.Vector3.Zero(),parent));
        this._mkCol(`fRDC_${ox}_${oz}`,ox+rW/2,-0.1,oz+rD/2,rW,0.2,rD,parent);

        // Murs
        for(let tx=0;tx<room.cols;tx++){
            const wx=ox+tx*T+T/2,tX=room.worldX+tx;
            const dN=openings.has("N")&&((cIn&&this._at(cIn.tiles,tX,room.worldZ-1))||(cOut&&this._at(cOut.tiles,tX,room.worldZ-1)));
            const dS=openings.has("S")&&((cIn&&this._at(cIn.tiles,tX,room.worldZ+room.rows))||(cOut&&this._at(cOut.tiles,tX,room.worldZ+room.rows)));
            ps.push(this._vis(dN?wSet.door:wSet.base,new BABYLON.Vector3(wx,H1,oz),   new BABYLON.Vector3(0,Math.PI,0),parent));
            ps.push(this._vis(dS?wSet.door:wSet.base,new BABYLON.Vector3(wx,H1,oz+rD),BABYLON.Vector3.Zero(),          parent));
            if(!dN)this._mkCol(`wN_${tx}_${ox}`,wx,H1+1.5,oz,   T,3,0.3,parent);
            if(!dS)this._mkCol(`wS_${tx}_${ox}`,wx,H1+1.5,oz+rD,T,3,0.3,parent);
            if(tx%3===1){
                ps.push(this._vis(wSet.light,new BABYLON.Vector3(wx,H1,oz),   new BABYLON.Vector3(0,Math.PI,0),parent));
                ps.push(this._vis(wSet.light,new BABYLON.Vector3(wx,H1,oz+rD),BABYLON.Vector3.Zero(),          parent));
            }
        }
        for(let tz=0;tz<room.rows;tz++){
            const wz=oz+tz*T+T/2,tZ=room.worldZ+tz;
            const dW=openings.has("W")&&((cIn&&this._at(cIn.tiles,room.worldX-1,tZ))||(cOut&&this._at(cOut.tiles,room.worldX-1,tZ)));
            const dE=openings.has("E")&&((cIn&&this._at(cIn.tiles,room.worldX+room.cols,tZ))||(cOut&&this._at(cOut.tiles,room.worldX+room.cols,tZ)));
            ps.push(this._vis(dW?wSet.door:wSet.base,new BABYLON.Vector3(ox,   H1,wz),new BABYLON.Vector3(0,-Math.PI/2,0),parent));
            ps.push(this._vis(dE?wSet.door:wSet.base,new BABYLON.Vector3(ox+rW,H1,wz),new BABYLON.Vector3(0,Math.PI/2,0), parent));
            if(!dW)this._mkCol(`wW_${tz}_${oz}`,ox,   H1+1.5,wz,0.3,3,T,parent);
            if(!dE)this._mkCol(`wE_${tz}_${oz}`,ox+rW,H1+1.5,wz,0.3,3,T,parent);
            if(tz%3===1){
                ps.push(this._vis(wSet.light,new BABYLON.Vector3(ox,   H1,wz),new BABYLON.Vector3(0,-Math.PI/2,0),parent));
                ps.push(this._vis(wSet.light,new BABYLON.Vector3(ox+rW,H1,wz),new BABYLON.Vector3(0,Math.PI/2,0), parent));
            }
        }

        if(!room.isSpawn){
            const lay = pick(LAYOUTS[room.type]??LAYOUTS.default, this.rand);
            const qpats = QUAD_PATTERNS[room.type] ?? QUAD_PATTERNS.default;

            // ── Props floor1 via patterns par quadrant ──────────────────────
            for(const quad of QUAD_NAMES){
                // Le quadrant rampCorner est réservé au balcon → on skip
                if(quad === lay.rampCorner) continue;

                const pool = qpats[quad];
                if(!pool || pool.length === 0) continue;

                // Tirage d'un pattern dans le pool
                const pattern = pick(pool, this.rand);

                // Bornes du quadrant en coordonnées monde (tuiles)
                const {oX, oZ, cols: qC, rows: qR} = quadBounds(room, quad);

                // Marge interne au quadrant (évite de placer dans le mur)
                const margin = T * 1.0;
                const usableW = qC * T - margin * 2;
                const usableD = qR * T - margin * 2;

                for(const item of pattern){
                    const px = oX * T + margin + item.ox * usableW;
                    const pz = oZ * T + margin + item.oz * usableD;
                    const rot = resolveRot(item.rot, this.rand);
                    ps.push(this._place(item.a, new BABYLON.Vector3(px, H1, pz), new BABYLON.Vector3(0, rot, 0), parent));
                }
            }

            if(lay.hasFloor2) await this._buildFloor2(room, lay, parent);
        }

        await Promise.all(ps);
    }

    async _buildFloor2(room,lay,parent){
        const ox=room.worldX*T,oz=room.worldZ*T;
        const wSet  =WALL[room.color]           ??WALL.grey;
        const floors=FLOOR_BY_COLOR[room.color] ??FLOOR_BY_COLOR.grey;
        const ps=[];

        const fCols=Math.floor(room.cols*0.4),fRows=Math.floor(room.rows*0.35);
        const corner=lay.rampCorner??"NW";
        let sCo,sRo;
        if     (corner==="NW"){sCo=0;              sRo=0;}
        else if(corner==="NE"){sCo=room.cols-fCols;sRo=0;}
        else if(corner==="SW"){sCo=0;              sRo=room.rows-fRows;}
        else                  {sCo=room.cols-fCols;sRo=room.rows-fRows;}

        const eOx=ox+sCo*T,eOz=oz+sRo*T,eW=fCols*T,eD=fRows*T;

        for(let tx=sCo;tx<sCo+fCols;tx++)
            for(let tz=sRo;tz<sRo+fRows;tz++)
                ps.push(this._vis(pick(floors,this.rand),new BABYLON.Vector3(ox+tx*T+T/2,H2,oz+tz*T+T/2),BABYLON.Vector3.Zero(),parent));

        this._mkCol(`f2_${ox}_${oz}`,eOx+eW/2,H2-0.1,eOz+eD/2,eW,0.2,eD,parent);

        const openSide=(corner==="NW"||corner==="NE")?"S":"N";

        for(let tx=sCo;tx<sCo+fCols;tx++){
            const wx=ox+tx*T+T/2;
            if(openSide!=="N")ps.push(this._vis(wSet.f2,new BABYLON.Vector3(wx,H2,eOz),    new BABYLON.Vector3(0,Math.PI,0),parent));
            if(openSide!=="S")ps.push(this._vis(wSet.f2,new BABYLON.Vector3(wx,H2,eOz+eD), BABYLON.Vector3.Zero(),          parent));
        }
        for(let tz=sRo;tz<sRo+fRows;tz++){
            const wz=oz+tz*T+T/2;
            if(openSide!=="W")ps.push(this._vis(wSet.f2,new BABYLON.Vector3(eOx,   H2,wz),new BABYLON.Vector3(0,-Math.PI/2,0),parent));
            if(openSide!=="E")ps.push(this._vis(wSet.f2,new BABYLON.Vector3(eOx+eW,H2,wz),new BABYLON.Vector3(0, Math.PI/2,0),parent));
        }

        if(openSide!=="N")this._mkCol(`w2N_${ox}`,eOx+eW/2,H2+1.5,eOz,      eW,3,0.3,parent);
        if(openSide!=="S")this._mkCol(`w2S_${ox}`,eOx+eW/2,H2+1.5,eOz+eD,   eW,3,0.3,parent);
        if(openSide!=="W")this._mkCol(`w2W_${oz}`,eOx,      H2+1.5,eOz+eD/2,0.3,3,eD,parent);
        if(openSide!=="E")this._mkCol(`w2E_${oz}`,eOx+eW,   H2+1.5,eOz+eD/2,0.3,3,eD,parent);

        if(openSide==="N"||openSide==="S"){
            const rZ  =openSide==="N"?eOz-T:eOz+eD+T;
            const rRot=openSide==="N"?0:Math.PI;
            const count=fCols;
            for(let i=0;i<count;i++){
                const rX=eOx+i*T+T/2;
                const isFlipped=rRot!==0;
                const asset=i===0?(isFlipped?RAMP.R[room.color]??RAMP.R.grey:RAMP.L[room.color]??RAMP.L.grey)
                    :i===count-1?(isFlipped?RAMP.L[room.color]??RAMP.L.grey:RAMP.R[room.color]??RAMP.R.grey)
                        :RAMP.base[room.color]??RAMP.base.grey;
                ps.push(this._place(asset,new BABYLON.Vector3(rX,H1,rZ+T*0.5),new BABYLON.Vector3(0,rRot,0),parent));
            }
        } else {
            const rX  =openSide==="W"?eOx-T:eOx+eW+T;
            const rRot=openSide==="W"?-Math.PI/2:Math.PI/2;
            const count=fRows;
            for(let i=0;i<count;i++){
                const rZ=eOz+i*T+T/2;
                const asset=i===0?RAMP.L[room.color]??RAMP.L.grey
                    :i===count-1?RAMP.R[room.color]??RAMP.R.grey
                        :RAMP.base[room.color]??RAMP.base.grey;
                ps.push(this._place(asset,new BABYLON.Vector3(rX,H1,rZ+T*0.5),new BABYLON.Vector3(0,rRot,0),parent));
            }
        }

        for(const item of lay.floor2){
            const px=eOx+item.ox*eW,pz=eOz+item.oz*eD;
            const rot=resolveRot(item.rot,this.rand);
            ps.push(this._place(item.a,new BABYLON.Vector3(px,H2,pz),new BABYLON.Vector3(0,rot,0),parent));
        }

        await Promise.all(ps);
    }

    _calcEntrySpawn(room,cIn){
        const OFFSET=0.5;
        const ox=room.worldX*T,oz=room.worldZ*T;
        const cx=(room.worldX+room.cols/2)*T,cz=(room.worldZ+room.rows/2)*T;
        if(!cIn||!cIn.tiles.length)return new BABYLON.Vector3(cx,2,cz);
        const e=cIn.tiles[cIn.tiles.length-1],s=this._side(room,e);
        switch(s){
            case"N":return new BABYLON.Vector3((e.x+0.5)*T,2,oz+OFFSET*T);
            case"S":return new BABYLON.Vector3((e.x+0.5)*T,2,oz+(room.rows-OFFSET)*T);
            case"W":return new BABYLON.Vector3(ox+OFFSET*T,2,(e.z+0.5)*T);
            case"E":return new BABYLON.Vector3(ox+(room.cols-OFFSET)*T,2,(e.z+0.5)*T);
            default:return new BABYLON.Vector3(cx,2,cz);
        }
    }

    _calcExitSpawn(room,cOut){
        const OFFSET=0.5;
        const ox=room.worldX*T,oz=room.worldZ*T;
        const cx=(room.worldX+room.cols/2)*T,cz=(room.worldZ+room.rows/2)*T;
        if(!cOut||!cOut.tiles.length)return new BABYLON.Vector3(cx,2,cz);
        const e=cOut.tiles[0],s=this._side(room,e);
        switch(s){
            case"N":return new BABYLON.Vector3((e.x+0.5)*T,2,oz+OFFSET*T);
            case"S":return new BABYLON.Vector3((e.x+0.5)*T,2,oz+(room.rows-OFFSET)*T);
            case"W":return new BABYLON.Vector3(ox+OFFSET*T,2,(e.z+0.5)*T);
            case"E":return new BABYLON.Vector3(ox+(room.cols-OFFSET)*T,2,(e.z+0.5)*T);
            default:return new BABYLON.Vector3(cx,2,cz);
        }
    }

    _side(room,tile){
        if(tile.z===room.worldZ-1         &&tile.x>=room.worldX&&tile.x<room.worldX+room.cols)return"N";
        if(tile.z===room.worldZ+room.rows &&tile.x>=room.worldX&&tile.x<room.worldX+room.cols)return"S";
        if(tile.x===room.worldX-1         &&tile.z>=room.worldZ&&tile.z<room.worldZ+room.rows)return"W";
        if(tile.x===room.worldX+room.cols &&tile.z>=room.worldZ&&tile.z<room.worldZ+room.rows)return"E";
        return null;
    }
    _at(tiles,x,z){return tiles.some(t=>t.x===x&&t.z===z);}

    _mkCol(name,cx,cy,cz,w,h,d,parent){
        const b=BABYLON.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},this.scene);
        b.position=new BABYLON.Vector3(cx,cy,cz);
        b.isVisible=false;b.checkCollisions=true;b.isPickable=false;
        b.parent=parent;b.freezeWorldMatrix();
    }

    _applyOcclusion(mesh){
        if(!mesh.isVisible)return;
        mesh.occlusionType               =BABYLON.AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
        mesh.occlusionQueryAlgorithmType =BABYLON.AbstractMesh.OCCLUSION_ALGORITHM_TYPE_ACCURATE;
    }

    async _place(filename,position,rotation=BABYLON.Vector3.Zero(),parent=this._root){
        try{
            const c=await this._load(filename);
            const e=c.instantiateModelsToScene(()=>`${filename}_${Math.random().toString(36).slice(2)}`,false,{doNotInstantiate:false});
            const r=e.rootNodes[0];if(!r)return;
            r.position=position;r.rotation=rotation;r.parent=parent;r.computeWorldMatrix(true);
            r.getChildMeshes().forEach(m=>{m.computeWorldMatrix(true);m.refreshBoundingInfo();m.checkCollisions=true;this._applyOcclusion(m);});
        }catch(e){console.warn(`[Map] ${filename}`,e.message);}
    }

    async _vis(filename,position,rotation=BABYLON.Vector3.Zero(),parent=this._root){
        try{
            const c=await this._load(filename);
            const e=c.instantiateModelsToScene(()=>`${filename}_${Math.random().toString(36).slice(2)}`,false,{doNotInstantiate:false});
            const r=e.rootNodes[0];if(!r)return;
            r.position=position;r.rotation=rotation;r.parent=parent;r.computeWorldMatrix(true);
            r.getChildMeshes().forEach(m=>{m.computeWorldMatrix(true);m.refreshBoundingInfo();m.checkCollisions=false;this._applyOcclusion(m);});
        }catch(e){console.warn(`[Map] ${filename}`,e.message);}
    }

    _load(filename){
        if(this._cache.has(filename))return this._cache.get(filename);
        const p=BABYLON.SceneLoader.LoadAssetContainerAsync(this.assetBase,filename,this.scene);
        this._cache.set(filename,p);
        return p;
    }
}