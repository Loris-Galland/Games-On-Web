import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

const T  = 4;
const H1 = 0;
const H2 = 4;

// Sol uniforme par COULEUR (pas par type de salle)
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

const LAYOUTS = {
    command: [{
        floor1:[
            {a:"Orrery_Tall.glb",           ox:0.5,  oz:0.5 },
            {a:"Command_Console.glb",        ox:0.15, oz:0.15},
            {a:"Command_Console.glb",        ox:0.5,  oz:0.1 },
            {a:"Command_Console.glb",        ox:0.85, oz:0.15},
            {a:"Command_Console.glb",        ox:0.15, oz:0.85},
            {a:"Command_Console.glb",        ox:0.5,  oz:0.9 },
            {a:"Command_Console.glb",        ox:0.85, oz:0.85},
            {a:"Command_Wall.glb",           ox:0.1,  oz:0.5 },
            {a:"Command_Wall.glb",           ox:0.9,  oz:0.5 },
            {a:"Large_Monitor_Blue.glb",     ox:0.3,  oz:0.3 },
            {a:"Large_Monitor_Blue.glb",     ox:0.7,  oz:0.3 },
            {a:"Large_Monitor_Blue.glb",     ox:0.3,  oz:0.7 },
            {a:"Large_Monitor_Blue.glb",     ox:0.7,  oz:0.7 },
        ],
        floor2:[
            {a:"Briefing_Screen_Blue.glb",   ox:0.2,  oz:0.2 },
            {a:"Briefing_Screen_Purple.glb", ox:0.5,  oz:0.15},
            {a:"Briefing_Screen_Orange.glb", ox:0.8,  oz:0.2 },
            {a:"3D_Chess_Board.glb",         ox:0.5,  oz:0.5 },
            {a:"Railing_Flat.glb",           ox:0.25, oz:0.8 },
            {a:"Railing_Flat.glb",           ox:0.5,  oz:0.8 },
            {a:"Railing_Flat.glb",           ox:0.75, oz:0.8 },
        ],
        hasFloor2:false, rampCorner:"SW",
    }],

    medbay: [{
        floor1:[
            {a:"Cryo_Tube_ON.glb",           ox:0.15, oz:0.15},
            {a:"Cryo_Tube_ON.glb",           ox:0.5,  oz:0.15},
            {a:"Cryo_Tube_ON.glb",           ox:0.85, oz:0.15},
            {a:"Cryo_Tube_OFF.glb",          ox:0.15, oz:0.85},
            {a:"Cryo_Tube_OFF.glb",          ox:0.5,  oz:0.85},
            {a:"Cryo_Tube_OFF.glb",          ox:0.85, oz:0.85},
            {a:"BioMonitor_Blue.glb",        ox:0.25, oz:0.5 },
            {a:"BioMonitor_Green.glb",       ox:0.5,  oz:0.5 },
            {a:"BioMonitor_Red.glb",         ox:0.75, oz:0.5 },
            {a:"Sleeper Casket Static.glb",  ox:0.15, oz:0.5 },
            {a:"Sleeper Casket Static.glb",  ox:0.85, oz:0.5 },
            {a:"Table_Light.glb",            ox:0.5,  oz:0.35},
        ],
        floor2:[
            {a:"Cryo_Tube_OFF.glb",    ox:0.5,  oz:0.2 },
            {a:"BioMonitor_Blue.glb",  ox:0.2,  oz:0.35},
            {a:"BioMonitor_Red.glb",   ox:0.8,  oz:0.35},
            {a:"Railing_Flat.glb",     ox:0.25, oz:0.7 },
            {a:"Railing_Flat.glb",     ox:0.75, oz:0.7 },
        ],
        hasFloor2:false, rampCorner:"NE",
    }],

    engine: [{
        floor1:[
            {a:"Generator.glb",              ox:0.15, oz:0.15},
            {a:"Generator.glb",              ox:0.85, oz:0.15},
            {a:"Generator.glb",              ox:0.15, oz:0.85},
            {a:"Generator.glb",              ox:0.85, oz:0.85},
            {a:"Generator_Pile_Chonky.glb",  ox:0.5,  oz:0.5 },
            {a:"Generator_Pile_Small.glb",   ox:0.35, oz:0.35},
            {a:"Generator_Pile_Small.glb",   ox:0.65, oz:0.35},
            {a:"Generator_Pile_Small.glb",   ox:0.35, oz:0.65},
            {a:"Generator_Pile_Small.glb",   ox:0.65, oz:0.65},
            {a:"Air_Con.glb",                ox:0.5,  oz:0.2 },
            {a:"Air_Con.glb",                ox:0.5,  oz:0.8 },
        ],
        floor2:[
            {a:"Generator_Pile_Small.glb",   ox:0.3,  oz:0.3 },
            {a:"Generator_Pile_Small.glb",   ox:0.7,  oz:0.3 },
            {a:"Briefing_Screen_Orange.glb", ox:0.5,  oz:0.2 },
            {a:"Railing_Flat.glb",           ox:0.3,  oz:0.7 },
            {a:"Railing_Flat.glb",           ox:0.7,  oz:0.7 },
        ],
        hasFloor2:false, rampCorner:"SE",
    }],

    cafeteria: [{
        floor1:[
            {a:"Cafeteria_Table.glb",           ox:0.18, oz:0.2 },
            {a:"Cafeteria_Table.glb",           ox:0.5,  oz:0.2 },
            {a:"Cafeteria_Table.glb",           ox:0.82, oz:0.2 },
            {a:"Cafeteria_Table.glb",           ox:0.18, oz:0.8 },
            {a:"Cafeteria_Table.glb",           ox:0.5,  oz:0.8 },
            {a:"Cafeteria_Table.glb",           ox:0.82, oz:0.8 },
            {a:"Octo_Table.glb",                ox:0.5,  oz:0.5 },
            {a:"Chair_1.glb",                   ox:0.32, oz:0.5 },
            {a:"Chair_1.glb",                   ox:0.68, oz:0.5 },
            {a:"Space_Ketchup.glb",             ox:0.42, oz:0.5 },
            {a:"Space_Mayo_Naise.glb",          ox:0.58, oz:0.5 },
            {a:"Meeting_Table.glb",             ox:0.18, oz:0.5 },
            {a:"Cafeteria_Table_Inset_Red.glb", ox:0.82, oz:0.5 },
        ],
        floor2:[
            {a:"Meeting_Table.glb", ox:0.3,  oz:0.3 },
            {a:"Meeting_Table.glb", ox:0.7,  oz:0.3 },
            {a:"Chair_1.glb",       ox:0.3,  oz:0.5 },
            {a:"Chair_1.glb",       ox:0.7,  oz:0.5 },
            {a:"Lava_Lamp.glb",     ox:0.5,  oz:0.3 },
            {a:"Railing_Flat.glb",  ox:0.25, oz:0.75},
            {a:"Railing_Flat.glb",  ox:0.75, oz:0.75},
        ],
        hasFloor2:false, rampCorner:"NW",
    }],

    hydro: [{
        floor1:[
            {a:"Hydroponic_Bay.glb",    ox:0.15, oz:0.15},
            {a:"Hydroponic_Bay.glb",    ox:0.5,  oz:0.15},
            {a:"Hydroponic_Bay.glb",    ox:0.85, oz:0.15},
            {a:"Hydroponics_Full.glb",  ox:0.15, oz:0.85},
            {a:"Hydroponics_Full.glb",  ox:0.5,  oz:0.85},
            {a:"Hydroponics_Full.glb",  ox:0.85, oz:0.85},
            {a:"Hydroponics_Lamp.glb",  ox:0.3,  oz:0.5 },
            {a:"Hydroponics_Lamp.glb",  ox:0.7,  oz:0.5 },
            {a:"Plant_1.glb",           ox:0.5,  oz:0.5 },
            {a:"Plant_1.glb",           ox:0.33, oz:0.35},
            {a:"Plant_1.glb",           ox:0.67, oz:0.65},
        ],
        floor2:[
            {a:"Hydroponics_Full.glb", ox:0.25, oz:0.25},
            {a:"Hydroponics_Full.glb", ox:0.75, oz:0.25},
            {a:"Plant_1.glb",          ox:0.5,  oz:0.3 },
            {a:"Railing_Flat.glb",     ox:0.25, oz:0.75},
            {a:"Railing_Flat.glb",     ox:0.75, oz:0.75},
        ],
        hasFloor2:false, rampCorner:"SW",
    }],

    quarters: [{
        floor1:[
            {a:"Bunk_Double_Blue.glb",   ox:0.15, oz:0.18},
            {a:"Bunk_Double_Blue.glb",   ox:0.85, oz:0.18},
            {a:"Bunk_Double_Orange.glb", ox:0.15, oz:0.82},
            {a:"Bunk_Double_Orange.glb", ox:0.85, oz:0.82},
            {a:"Bunk_Single_Grey.glb",   ox:0.5,  oz:0.18},
            {a:"Bunk_Single_Grey.glb",   ox:0.5,  oz:0.82},
            {a:"End_Table.glb",          ox:0.35, oz:0.5 },
            {a:"End_Table.glb",          ox:0.65, oz:0.5 },
            {a:"Floor_Lamp.glb",         ox:0.5,  oz:0.5 },
            {a:"Table_Light.glb",        ox:0.27, oz:0.18},
            {a:"Lava_Lamp.glb",          ox:0.5,  oz:0.37},
        ],
        floor2:[
            {a:"Bunk_Single_Grey.glb", ox:0.2,  oz:0.2 },
            {a:"Bunk_Single_Grey.glb", ox:0.8,  oz:0.2 },
            {a:"Floor_Lamp.glb",       ox:0.5,  oz:0.3 },
            {a:"Railing_Flat.glb",     ox:0.25, oz:0.75},
            {a:"Railing_Flat.glb",     ox:0.75, oz:0.75},
        ],
        hasFloor2:false, rampCorner:"SE",
    }],

    storage: [{
        floor1:[
            {a:"Battery_Blue.glb",           ox:0.15, oz:0.15},
            {a:"Battery_Red.glb",            ox:0.85, oz:0.15},
            {a:"Battery_Green.glb",          ox:0.5,  oz:0.15},
            {a:"Battery_Grey.glb",           ox:0.15, oz:0.85},
            {a:"Battery_Orange.glb",         ox:0.85, oz:0.85},
            {a:"Battery_Blue.glb",           ox:0.5,  oz:0.85},
            {a:"Generator_Pile_Chonky.glb",  ox:0.5,  oz:0.5 },
            {a:"Generator_Pile_Small.glb",   ox:0.3,  oz:0.35},
            {a:"Generator_Pile_Small.glb",   ox:0.7,  oz:0.35},
            {a:"Generator_Pile_Small.glb",   ox:0.3,  oz:0.65},
            {a:"Generator_Pile_Small.glb",   ox:0.7,  oz:0.65},
        ],
        floor2:[
            {a:"Battery_Red.glb",           ox:0.3,  oz:0.3 },
            {a:"Battery_Blue.glb",          ox:0.7,  oz:0.3 },
            {a:"Generator_Pile_Small.glb",  ox:0.5,  oz:0.25},
            {a:"Railing_Flat.glb",          ox:0.25, oz:0.75},
            {a:"Railing_Flat.glb",          ox:0.75, oz:0.75},
        ],
        hasFloor2:false, rampCorner:"NE",
    }],

    default:[{
        floor1:[{a:"End_Table.glb",ox:0.3,oz:0.3},{a:"End_Table.glb",ox:0.7,oz:0.7}],
        floor2:[], hasFloor2:false,
    }],
};

// Toutes les arènes = même taille (16×16), différenciées uniquement par la couleur
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

function rng(seed){let s=seed;return()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/0xffffffff;};}
function pick(arr,rand){return arr[Math.floor(rand()*arr.length)];}

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
        this._activeNode   = null;
        this._corridorNode = null;
        this._activeIdx    = -1;
        this._loading      = false;
        this._camera       = null;
        this._onRoomReady  = null;
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

    async _activateRoom(idx){
        if(this._loading||idx===this._activeIdx)return;
        this._loading=true;
        console.log(`[Map] Chargement salle ${idx}...`);

        const newNode=new BABYLON.TransformNode(`room_${idx}`,this.scene);
        newNode.parent=this._root;
        const room=this.rooms[idx];
        const cIn =idx>0                    ?this.corridors[idx-1]:null;
        const cOut=idx<this.corridors.length?this.corridors[idx]  :null;

        await this._buildRoom(room,cIn,cOut,newNode);

        if(this._activeNode){
            this._activeNode.getChildMeshes().forEach(m=>m.dispose());
            this._activeNode.dispose();
            this._activeNode=null;
        }
        this._activeNode=newNode;
        this._activeIdx=idx;
        await this._buildCorridorDisplay(idx);

        console.log(`[Map] Salle ${idx} prête.`);
        this._loading=false;

        // Calcul du point de spawn : 3 tuiles en retrait depuis la porte d'entrée
        const spawnPos = this._calcEntrySpawn(room, cIn);
        if(this._onRoomReady) setTimeout(()=>this._onRoomReady(room,idx,spawnPos),50);
    }

    async _buildCorridorDisplay(roomIdx){
        if(this._corridorNode){
            this._corridorNode.getChildMeshes().forEach(m=>m.dispose());
            this._corridorNode.dispose();
            this._corridorNode=null;
        }
        if(roomIdx>=this.corridors.length)return;

        const corridor=this.corridors[roomIdx];
        const node=new BABYLON.TransformNode(`corr_${roomIdx}`,this.scene);
        node.parent=this._root;
        this._corridorNode=node;

        const tiles=corridor.tiles,tileSet=new Set(tiles.map(t=>`${t.x},${t.z}`));
        const ps=[];

        const darkMat=new BABYLON.StandardMaterial(`cMat_${roomIdx}`,this.scene);
        darkMat.diffuseColor=new BABYLON.Color3(0.08,0.08,0.1);
        darkMat.emissiveColor=new BABYLON.Color3(0.03,0.03,0.05);

        for(let i=0;i<tiles.length;i++){
            const tile=tiles[i],wx=tile.x*T,wz=tile.z*T;
            const prev=tiles[i-1],next=tiles[i+1];
            const gX=next?next.x!==tile.x:prev?prev.x!==tile.x:false;
            const gZ=next?next.z!==tile.z:prev?prev.z!==tile.z:false;
            const prog=i/tiles.length;

            const fb=BABYLON.MeshBuilder.CreateBox(`cf_${i}`,{width:T,height:0.1,depth:T},this.scene);
            fb.position=new BABYLON.Vector3(wx+T/2,-0.05,wz+T/2);
            fb.material=darkMat;fb.checkCollisions=false;fb.isPickable=false;fb.parent=node;
            this._mkCol(`ccF_${i}`,wx+T/2,-0.1,wz+T/2,T,0.2,T,node);

            if(gX){
                if(!tileSet.has(`${tile.x},${tile.z-1}`)){ps.push(this._vis("Wall_Grey.glb",new BABYLON.Vector3(wx+T/2,0,wz),new BABYLON.Vector3(0,Math.PI,0),node));this._mkCol(`ccWN_${i}`,wx+T/2,1.5,wz,T,3,0.3,node);}
                if(!tileSet.has(`${tile.x},${tile.z+1}`)){ps.push(this._vis("Wall_Grey.glb",new BABYLON.Vector3(wx+T/2,0,wz+T),BABYLON.Vector3.Zero(),node));this._mkCol(`ccWS_${i}`,wx+T/2,1.5,wz+T,T,3,0.3,node);}
            }
            if(gZ){
                if(!tileSet.has(`${tile.x-1},${tile.z}`)){ps.push(this._vis("Wall_Grey.glb",new BABYLON.Vector3(wx,0,wz+T/2),new BABYLON.Vector3(0,-Math.PI/2,0),node));this._mkCol(`ccWW_${i}`,wx,1.5,wz+T/2,0.3,3,T,node);}
                if(!tileSet.has(`${tile.x+1},${tile.z}`)){ps.push(this._vis("Wall_Grey.glb",new BABYLON.Vector3(wx+T,0,wz+T/2),new BABYLON.Vector3(0,Math.PI/2,0),node));this._mkCol(`ccWE_${i}`,wx+T,1.5,wz+T/2,0.3,3,T,node);}
            }

            if(prog>0.3){
                const alpha=Math.min(0.97,(prog-0.3)*1.5);
                const fm=new BABYLON.StandardMaterial(`fm_${i}`,this.scene);
                fm.diffuseColor=new BABYLON.Color3(0,0,0);
                fm.emissiveColor=new BABYLON.Color3(0,0,0);
                fm.alpha=alpha;fm.backFaceCulling=false;
                fm.alphaMode=BABYLON.Engine.ALPHA_COMBINE;
                const fp=BABYLON.MeshBuilder.CreateBox(`fp_${i}`,{width:T*0.98,height:3.5,depth:T*0.98},this.scene);
                fp.position=new BABYLON.Vector3(wx+T/2,1.75,wz+T/2);
                fp.material=fm;fp.isPickable=false;fp.checkCollisions=false;fp.parent=node;
            }
        }

        if(tiles.length>=2){
            const tTile=tiles[tiles.length-2];
            const trigger=BABYLON.MeshBuilder.CreateBox(`trig_${roomIdx}`,{width:T*1.5,height:4,depth:T*1.5},this.scene);
            trigger.position=new BABYLON.Vector3(tTile.x*T+T/2,1,tTile.z*T+T/2);
            trigger.isVisible=false;trigger.checkCollisions=false;trigger.isPickable=false;trigger.parent=node;
            trigger._toRoom=roomIdx+1;
        }

        await Promise.all(ps);
    }

    _setupTriggerLoop(){
        this.scene.registerBeforeRender(()=>{
            if(!this._camera||this._loading||!this._corridorNode)return;
            const cam=this._camera.position;
            for(const m of this._corridorNode.getChildMeshes()){
                if(!m.name.startsWith("trig_"))continue;
                const p=m.getAbsolutePosition();
                if(Math.abs(cam.x-p.x)<T*1.2&&Math.abs(cam.z-p.z)<T*1.2){
                    const to=m._toRoom;
                    if(to!==undefined&&to<this.rooms.length)this._activateRoom(to);
                    break;
                }
            }
        });
    }

    async _buildRoom(room,cIn,cOut,parent){
        const ox=room.worldX*T,oz=room.worldZ*T,rW=room.cols*T,rD=room.rows*T;
        const wSet  =WALL[room.color]            ??WALL.grey;
        const floors=FLOOR_BY_COLOR[room.color]  ??FLOOR_BY_COLOR.grey;

        const openings=new Set();
        if(cIn) {const l=cIn.tiles[cIn.tiles.length-1];if(l){const s=this._side(room,l);if(s)openings.add(s);}}
        if(cOut){const f=cOut.tiles[0];                 if(f){const s=this._side(room,f);if(s)openings.add(s);}}

        const ps=[];

        // Sol uniforme par couleur
        for(let tx=0;tx<room.cols;tx++)
            for(let tz=0;tz<room.rows;tz++)
                ps.push(this._vis(pick(floors,this.rand),new BABYLON.Vector3(ox+tx*T+T/2,H1,oz+tz*T+T/2),BABYLON.Vector3.Zero(),parent));
        this._mkCol(`fRDC_${ox}_${oz}`,ox+rW/2,-0.1,oz+rD/2,rW,0.2,rD,parent);

        // Murs de la couleur de la salle
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
            const lays=LAYOUTS[room.type]??LAYOUTS.default;
            const lay=pick(lays,this.rand);
            const margin=T*2,usableW=rW-margin*2,usableD=rD-margin*2;
            for(const item of lay.floor1){
                const px=ox+margin+item.ox*usableW,pz=oz+margin+item.oz*usableD;
                const rot=item.rot??Math.floor(this.rand()*4)*(Math.PI/2);
                ps.push(this._place(item.a,new BABYLON.Vector3(px,H1,pz),new BABYLON.Vector3(0,rot,0),parent));
            }
            if(lay.hasFloor2)await this._buildFloor2(room,lay,parent);
        }

        await Promise.all(ps);
    }

    async _buildFloor2(room,lay,parent){
        const ox=room.worldX*T,oz=room.worldZ*T,rW=room.cols*T,rD=room.rows*T;
        const wSet  =WALL[room.color]           ??WALL.grey;
        const floors=FLOOR_BY_COLOR[room.color] ??FLOOR_BY_COLOR.grey;
        const ps=[];

        const fCols=Math.floor(room.cols*0.5),fRows=Math.floor(room.rows*0.5);
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

        for(let tx=sCo;tx<sCo+fCols;tx++){
            const wx=ox+tx*T+T/2;
            if(sRo===0)              ps.push(this._vis(wSet.f2,new BABYLON.Vector3(wx,H2,oz),   new BABYLON.Vector3(0,Math.PI,0),parent));
            if(sRo+fRows===room.rows)ps.push(this._vis(wSet.f2,new BABYLON.Vector3(wx,H2,oz+rD),BABYLON.Vector3.Zero(),          parent));
        }
        for(let tz=sRo;tz<sRo+fRows;tz++){
            const wz=oz+tz*T+T/2;
            if(sCo===0)              ps.push(this._vis(wSet.f2,new BABYLON.Vector3(ox,   H2,wz),new BABYLON.Vector3(0,-Math.PI/2,0),parent));
            if(sCo+fCols===room.cols)ps.push(this._vis(wSet.f2,new BABYLON.Vector3(ox+rW,H2,wz),new BABYLON.Vector3(0,Math.PI/2,0), parent));
        }
        this._mkCol(`w2N_${ox}`,eOx+eW/2,H2+1.5,eOz,      eW,3,0.3,parent);
        this._mkCol(`w2S_${ox}`,eOx+eW/2,H2+1.5,eOz+eD,   eW,3,0.3,parent);
        this._mkCol(`w2W_${oz}`,eOx,      H2+1.5,eOz+eD/2,0.3,3,eD,parent);
        this._mkCol(`w2E_${oz}`,eOx+eW,   H2+1.5,eOz+eD/2,0.3,3,eD,parent);

        let rX,rZ,rRot;
        if     (corner==="NW"){rX=eOx+T/2;    rZ=eOz+T/2;    rRot=0;}
        else if(corner==="NE"){rX=eOx+eW-T/2; rZ=eOz+T/2;    rRot=Math.PI/2;}
        else if(corner==="SW"){rX=eOx+T/2;    rZ=eOz+eD-T/2; rRot=-Math.PI/2;}
        else                  {rX=eOx+eW-T/2; rZ=eOz+eD-T/2; rRot=Math.PI;}

        ps.push(this._place(RAMP.base[room.color]??RAMP.base.grey,new BABYLON.Vector3(rX,   H1,rZ),new BABYLON.Vector3(0,rRot,0),parent));
        ps.push(this._vis(  RAMP.L[room.color]  ??RAMP.L.grey,    new BABYLON.Vector3(rX-T/2,H1,rZ),new BABYLON.Vector3(0,rRot,0),parent));
        ps.push(this._vis(  RAMP.R[room.color]  ??RAMP.R.grey,    new BABYLON.Vector3(rX+T/2,H1,rZ),new BABYLON.Vector3(0,rRot,0),parent));

        for(let s=0;s<3;s++){
            const sy=H1+(H2/3)*s+(H2/6);
            const dz=(corner.includes("N")?1:-1)*s*(T/3);
            this._mkCol(`rs_${s}_${ox}`,rX,sy,rZ+dz,T,H2/3,T/3,parent);
        }

        for(let tx=sCo;tx<sCo+fCols;tx++){
            const wx=ox+tx*T+T/2;
            ps.push(this._vis("Deck_Height_Metal.glb",new BABYLON.Vector3(wx,H1+0.5,eOz),   new BABYLON.Vector3(0,Math.PI,0),parent));
            ps.push(this._vis("Deck_Height_Metal.glb",new BABYLON.Vector3(wx,H1+0.5,eOz+eD),BABYLON.Vector3.Zero(),          parent));
        }

        for(const item of lay.floor2){
            const px=eOx+item.ox*eW,pz=eOz+item.oz*eD;
            const rot=item.rot??Math.floor(this.rand()*4)*(Math.PI/2);
            ps.push(this._place(item.a,new BABYLON.Vector3(px,H2,pz),new BABYLON.Vector3(0,rot,0),parent));
        }

        await Promise.all(ps);
    }

    // Calcule un point de spawn 3 tuiles en retrait depuis la porte d'entrée.
    // Si pas de couloir entrant (salle 0), retourne le centre de la salle.
    _calcEntrySpawn(room, cIn) {
        const OFFSET = 3; // tuiles en retrait depuis le mur d'entrée
        const ox = room.worldX * T, oz = room.worldZ * T;
        const cx = (room.worldX + room.cols / 2) * T;
        const cz = (room.worldZ + room.rows / 2) * T;

        if (!cIn || !cIn.tiles.length) {
            // Salle spawn : centre
            return new BABYLON.Vector3(cx, 2, cz);
        }

        // La dernière tuile du couloir entrant est contre le mur d'entrée
        const entryTile = cIn.tiles[cIn.tiles.length - 1];
        const side = this._side(room, entryTile);

        // On place le joueur OFFSET tuiles à l'intérieur depuis ce mur
        switch(side) {
            case "N": return new BABYLON.Vector3((entryTile.x + 0.5) * T, 2, oz + OFFSET * T);
            case "S": return new BABYLON.Vector3((entryTile.x + 0.5) * T, 2, oz + (room.rows - OFFSET) * T);
            case "W": return new BABYLON.Vector3(ox + OFFSET * T, 2, (entryTile.z + 0.5) * T);
            case "E": return new BABYLON.Vector3(ox + (room.cols - OFFSET) * T, 2, (entryTile.z + 0.5) * T);
            default:  return new BABYLON.Vector3(cx, 2, cz);
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

    // ─────────────────────────────────────────────
    //  OCCLUSION CULLING
    //  Babylon.js supporte l'occlusion culling via des requêtes GPU (WebGL occlusion queries).
    //  OCCLUSION_TYPE_OPTIMISTIC = le GPU teste si le mesh est caché derrière d'autres géométries.
    //  Si oui, il n'est pas rendu. En mode OPTIMISTIC, le mesh est quand même rendu 1 frame
    //  avant que le test soit confirmé, ce qui évite le flickering.
    //  Résultat : tous les murs/props derrière le joueur et hors de vue sont ignorés par le GPU.
    // ─────────────────────────────────────────────
    _applyOcclusion(mesh){
        if(!mesh.isVisible)return;
        mesh.occlusionType               = BABYLON.AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
        mesh.occlusionQueryAlgorithmType = BABYLON.AbstractMesh.OCCLUSION_ALGORITHM_TYPE_ACCURATE;
    }

    async _place(filename,position,rotation=BABYLON.Vector3.Zero(),parent=this._root){
        try{
            const c=await this._load(filename);
            const e=c.instantiateModelsToScene(()=>`${filename}_${Math.random().toString(36).slice(2)}`,false,{doNotInstantiate:false});
            const r=e.rootNodes[0];if(!r)return;
            r.position=position;r.rotation=rotation;r.parent=parent;r.computeWorldMatrix(true);
            r.getChildMeshes().forEach(m=>{
                m.computeWorldMatrix(true);m.refreshBoundingInfo();
                m.checkCollisions=true;
                this._applyOcclusion(m);
            });
        }catch(e){console.warn(`[Map] ${filename}`,e.message);}
    }

    async _vis(filename,position,rotation=BABYLON.Vector3.Zero(),parent=this._root){
        try{
            const c=await this._load(filename);
            const e=c.instantiateModelsToScene(()=>`${filename}_${Math.random().toString(36).slice(2)}`,false,{doNotInstantiate:false});
            const r=e.rootNodes[0];if(!r)return;
            r.position=position;r.rotation=rotation;r.parent=parent;r.computeWorldMatrix(true);
            r.getChildMeshes().forEach(m=>{
                m.computeWorldMatrix(true);m.refreshBoundingInfo();
                m.checkCollisions=false;
                this._applyOcclusion(m);
            });
        }catch(e){console.warn(`[Map] ${filename}`,e.message);}
    }

    _load(filename){
        if(this._cache.has(filename))return this._cache.get(filename);
        const p=BABYLON.SceneLoader.LoadAssetContainerAsync(this.assetBase,filename,this.scene);
        this._cache.set(filename,p);
        return p;
    }
}