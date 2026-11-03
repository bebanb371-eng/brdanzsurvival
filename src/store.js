export const SAVE_KEY = 'brdanz-survival-v1';
export const DEFAULT_BINDINGS = Object.freeze({forward:'w',backward:'s',left:'a',right:'d',run:'shift',jump:'space',interact:'e',mine:'f',camera:'q',pause:'escape'});
export const defaults = () => ({ version:1, player:{name:'BRDANZ',level:1,xp:0,coins:1000,gems:50,hp:100,hunger:100,thirst:100,stamina:100,kills:0}, inventory:{wood:12,stone:8,metal:3,crystal:0,medkit:2,water:3,food:3,ammo:30,pistolAmmo:24,sniperAmmo:5}, selectedWeapon:'rifle', unlockedSkins:['Rookie'], skin:'Rookie', settings:{quality:'High',music:75,sfx:73,cameraMode:'third',keyBindings:{...DEFAULT_BINDINGS},controlLayout:{}}, missions:{wood:0,survive:0}, world:{day:1,played:0,timeOfDay:9,weather:'clear',position:{x:0,y:0,z:0},yaw:0,openDoors:[],takenLoot:[],defeatedThreats:[],minedNodes:[],houses:{guardian:{owned:true,level:1}}}, rank:0 });
function valid(raw){
  const d=defaults(); if(!raw||raw.version!==1||!raw.player||!raw.inventory||!raw.settings)return d;
  for(const k of ['level','xp','coins','gems','hp','hunger','thirst','stamina','kills']) if(!Number.isFinite(raw.player[k]))raw.player[k]=d.player[k];
  for(const k of Object.keys(d.inventory)) if(!Number.isFinite(raw.inventory[k])||raw.inventory[k]<0)raw.inventory[k]=d.inventory[k];
  raw.player.hp=Math.max(0,Math.min(100,raw.player.hp)); raw.player.hunger=Math.max(0,Math.min(100,raw.player.hunger)); raw.player.thirst=Math.max(0,Math.min(100,raw.player.thirst));raw.player.stamina=Math.max(0,Math.min(100,raw.player.stamina));
  const world={...d.world,...raw.world,position:{...d.world.position,...(raw.world.position||{})},houses:{...d.world.houses,...(raw.world?.houses||{})}};
  for(const k of ['x','y','z'])if(!Number.isFinite(world.position[k]))world.position[k]=0;
  for(const k of ['x','z'])world.position[k]=Math.max(-174,Math.min(174,world.position[k]));
  if(Math.abs(world.position.y)>100)world.position.y=0;
  if(!Number.isFinite(world.yaw))world.yaw=0;
  world.timeOfDay=Number.isFinite(world.timeOfDay)?((world.timeOfDay%24)+24)%24:d.world.timeOfDay;
  world.weather=['clear','cloudy','rain'].includes(world.weather)?world.weather:d.world.weather;
  world.day=Math.max(1,Math.min(9999,Number.isFinite(world.day)?Math.floor(world.day):d.world.day));
  for(const [id,house] of Object.entries(world.houses)){
    if(!['guardian','forest','hill'].includes(id)||!house||typeof house!=='object'){delete world.houses[id];continue;}
    house.owned=Boolean(house.owned);house.level=Math.max(1,Math.min(5,Number.isFinite(house.level)?Math.floor(house.level):1));
  }
  world.yaw=((world.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  for(const key of ['openDoors','takenLoot','defeatedThreats','minedNodes'])world[key]=Array.isArray(world[key])?world[key].filter(value=>typeof value==='string').slice(0,key==='takenLoot'?512:128):[];
  const selectedWeapon=['rifle','pistol','sniper','knife','pickaxe'].includes(raw.selectedWeapon)?raw.selectedWeapon:d.selectedWeapon;
  const skins=['Rookie','Ranger','Shadow','Medic','Nomad'];
  const unlockedSkins=Array.isArray(raw.unlockedSkins)?[...new Set(raw.unlockedSkins.filter(value=>skins.includes(value)))]:d.unlockedSkins;
  if(!unlockedSkins.includes('Rookie'))unlockedSkins.unshift('Rookie');
  const skin=skins.includes(raw.skin)&&unlockedSkins.includes(raw.skin)?raw.skin:'Rookie';
  const quality=['Low','Medium','High','Ultra'].includes(raw.settings.quality)?raw.settings.quality:d.settings.quality;
  const cameraMode=['first','shoulder','third'].includes(raw.settings.cameraMode)?raw.settings.cameraMode:d.settings.cameraMode;
  const sourceBindings=raw.settings.keyBindings&&typeof raw.settings.keyBindings==='object'&&!Array.isArray(raw.settings.keyBindings)?raw.settings.keyBindings:{};
  const keyBindings={...DEFAULT_BINDINGS};for(const key of Object.keys(DEFAULT_BINDINGS)){const value=sourceBindings[key];if(typeof value==='string'&&/^(?:[a-z0-9]|space|shift|escape|arrowup|arrowdown|arrowleft|arrowright)$/.test(value.toLowerCase()))keyBindings[key]=value.toLowerCase();}
  const sourceLayout=raw.settings.controlLayout&&typeof raw.settings.controlLayout==='object'&&!Array.isArray(raw.settings.controlLayout)?raw.settings.controlLayout:{};
  const controlLayout={};for(const [id,point] of Object.entries(sourceLayout).slice(0,16))if(/^[a-z0-9_-]{1,24}$/i.test(id)&&point&&Number.isFinite(point.x)&&Number.isFinite(point.y))controlLayout[id]={x:Math.max(0,Math.min(1,point.x)),y:Math.max(0,Math.min(1,point.y))};
  return {...d,...raw,skin,unlockedSkins,selectedWeapon,player:{...d.player,...raw.player},inventory:{...d.inventory,...raw.inventory},settings:{...d.settings,...raw.settings,quality,cameraMode,keyBindings,controlLayout},missions:{...d.missions,...raw.missions},world};
}
export function loadGame(storage=globalThis.localStorage){try{return valid(JSON.parse(storage?.getItem(SAVE_KEY)||'null'));}catch{return defaults();}}
export function saveGame(state,storage=globalThis.localStorage){const safe=valid(structuredClone(state));storage?.setItem(SAVE_KEY,JSON.stringify(safe));return safe;}
export function updateGame(fn,storage=globalThis.localStorage){const state=loadGame(storage);fn(state);return saveGame(state,storage);}
export function addItem(state,item,count=1){state.inventory[item]=(state.inventory[item]||0)+count;}
export function craft(state,item){const recipes={campfire:{wood:3,stone:2},medkit:{wood:1,metal:1},ammo:{metal:1,stone:1}};const recipe=recipes[item];if(!recipe||Object.entries(recipe).some(([k,n])=>(state.inventory[k]||0)<n))return false;for(const [k,n]of Object.entries(recipe))state.inventory[k]-=n;addItem(state,item,1);return true;}
