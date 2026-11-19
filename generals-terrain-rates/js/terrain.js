'use strict';

function prepareExtendedMap(map,players,cfg) {
 const rules=normalizeRules(cfg.rules),w=cfg.width,h=cfg.height,total=w*h;
 const riverDir=new Int8Array(total).fill(-1),engineers=new Uint8Array(total),carts=new Uint8Array(total);
 // Reserve extra capitals before placing optional terrain, distributed across each faction's hinterland.
 for(let round=1;round<rules.capitals;round++)for(let p=0;p<players.length;p++) {
  const gen=players[p].generalIndex;
  const choices=Array.from({length:total},(_,i)=>i).filter(i=>map.terrain[i]===TILE_EMPTY&&map.owner[i]<0);
  choices.sort((a,b)=>{
   const score=i=>Math.abs(i%w-gen%w)+Math.abs(Math.floor(i/w)-Math.floor(gen/w));
   return score(a)-score(b);
  });
  const candidates=choices.filter(i=>Math.abs(i%w-gen%w)+Math.abs(Math.floor(i/w)-Math.floor(gen/w))>=3).slice(0,20);
  const pos=chooseRandom(candidates.length?candidates:choices.slice(0,1));
  if(pos!==undefined){map.terrain[pos]=TILE_GENERAL;map.owner[pos]=p;map.army[pos]=1;}
 }
 const empty=()=>shuffle(Array.from({length:total},(_,i)=>i).filter(i=>map.terrain[i]===TILE_EMPTY&&map.owner[i]===-1));
 for(const [kind,count,army] of [[TILE_OFFICER,rules.officerCount,0],[TILE_GOBLIN,rules.goblinCount,0],[TILE_WATCH,rules.watchCount,rules.watchGuard],[TILE_TURRET,rules.turretCount,rules.turretGuard],[TILE_CASINO,rules.casinoCount,0]]) {
  for(const i of empty().slice(0,count)){map.terrain[i]=kind;map.army[i]=army;}
 }
 generateRivers(map,w,h,rules,riverDir);
 generateWebRoads(map,w,h,rules.roadDensity);
 const cartSpots=shuffle(Array.from({length:total},(_,i)=>i).filter(i=>[TILE_EMPTY,TILE_ROAD].includes(map.terrain[i])));
 for(const i of cartSpots.slice(0,rules.cartCount))carts[i]=1;
 const capitals=Array.from({length:total},(_,i)=>i).filter(i=>map.terrain[i]===TILE_GENERAL);
 ensureDryCapitalPaths(map,w,h,capitals);
 map.extra={riverDir:Array.from(riverDir),engineers:Array.from(engineers),carts:Array.from(carts),officers:[],elapsedMs:0,sudden:false,sunUntil:0,mistUntil:0,eventLog:[],focus:[],nextEventAt:(rules.eventMinSeconds+Math.random()*(rules.eventMaxSeconds-rules.eventMinSeconds))*1000};
 return map;
}

// Lava and portals are transit-only: the old mountain-only BFS is insufficient.
// Keep at least one ordinary walkable route between capitals. Special tiles stay intact.
function ensureDryCapitalPaths(map,w,h,capitals) {
 if(capitals.length<2)return;
 const n=w*h,blocked=t=>[TILE_MOUNTAIN,TILE_LAVA,TILE_PORTAL].includes(t);
 function search(start,carve=false){
  const parent=new Int32Array(n).fill(-1),queue=[start];parent[start]=start;
  for(let head=0;head<queue.length;head++){
   const i=queue[head],x=i%w,y=Math.floor(i/w);
   for(const [dx,dy] of DIRECTIONS){
    const nx=x+dx,ny=y+dy,j=ny*w+nx;
    if(nx<0||ny<0||nx>=w||ny>=h||parent[j]>=0)continue;
    if(carve?map.terrain[j]===TILE_PORTAL:blocked(map.terrain[j]))continue;
    parent[j]=i;queue.push(j);
   }
  }
  return parent;
 }
 let reachable=search(capitals[0]);
 for(const target of capitals.slice(1))if(reachable[target]<0){
  let paths=search(capitals[0],true);
  if(paths[target]<0){
   // A rare complete portal enclosure must be opened as a pair, never leave a broken portal.
   for(let i=0;i<n;i++)if(map.terrain[i]===TILE_PORTAL){map.terrain[i]=TILE_EMPTY;map.portalTarget[i]=-1;map.portalPairId[i]=-1;}
   paths=search(capitals[0],true);
  }
  for(let i=target;i!==capitals[0]&&i>=0;i=paths[i])if([TILE_MOUNTAIN,TILE_LAVA].includes(map.terrain[i]))map.terrain[i]=TILE_EMPTY;
  reachable=search(capitals[0]);
 }
}

function initExpansion(cfg,extra) {
 game.rules=normalizeRules(cfg.rules);
 game.extra=extra?structuredClone(extra):{};
 const total=game.width*game.height;
 for(const [key,value] of [['riverDir',-1],['engineers',0],['carts',0]])if(!Array.isArray(game.extra[key])||game.extra[key].length!==total)game.extra[key]=Array(total).fill(value);
 Object.assign(game.extra,{officers:game.extra.officers||[],elapsedMs:game.extra.elapsedMs||0,eventLog:game.extra.eventLog||[],focus:game.extra.focus||[]});
 if(!Number.isFinite(game.extra.nextEventAt))scheduleDisaster();
 game.strategyMemory={};
 game.topologyVersion=(game.topologyVersion||0)+1;
 game.aiScanCursor={};
 game.visualRevision=(game.visualRevision||0)+1;
 game.bombMode=false;
 game.players.forEach((p,i)=>{p.difficulty=p.difficulty||game.rules.difficulty;refreshCapitals(i);});
}

// Resolve both portals and lava as transit tiles. Neither can retain an owner or army.
function resolveTransit(from,to) {
 const direction=moveDirection(from,to);if(!direction)return null;
 let current=to,loss=0;
 const seen=new Set();
 for(let hops=0;hops<game.terrain.length;hops++) {
  if(current<0||seen.has(current))return null;seen.add(current);
  const type=game.terrain[current];
  if(type===TILE_MOUNTAIN)return null;
  if(type===TILE_PORTAL){const pair=game.portalTarget[current];if(pair<0)return null;current=neighborIndex(pair,...direction);}
  else if(type===TILE_LAVA){loss+=game.rules.lavaLoss;current=neighborIndex(current,...direction);}
  else return {to:current,loss};
 }
 return null;
}
function canBomb(from,to) {
 return game.extra?.engineers[from]>0&&!!moveDirection(from,to)&&[TILE_MOUNTAIN,TILE_CASINO].includes(game.terrain[to]);
}
function squareArea(center,size) {
 const result=[],seen=game.rules.wrap?new Set():null,low=-Math.floor((size-1)/2),high=low+size-1;
 for(let dy=low;dy<=high;dy++)for(let dx=low;dx<=high;dx++){
  const i=neighborIndex(center,dx,dy);if(i>=0&&(!seen||!seen.has(i))){result.push(i);if(seen)seen.add(i);}
 }
 return result;
}
function explodeEngineer(playerIdx,from,to) {
 if(game.owner[from]!==playerIdx||game.army[from]<1||!canBomb(from,to))return false;
 game.extra.engineers[from]--;
 const area=squareArea(to,game.rules.blastSize);
 for(const i of area){
  game.army[i]=0;
  if(game.terrain[i]===TILE_MOUNTAIN)game.terrain[i]=TILE_EMPTY;
  else if(game.terrain[i]===TILE_CASINO){
   const loot=Math.min(200,12+Math.floor(Math.random()*20)+Math.floor(game.army[i]*0.1));
   game.terrain[i]=TILE_EMPTY;game.army[i]=0;game.owner[i]=-1;
   const spots=shuffle(squareArea(i,game.rules.blastSize+2).filter(n=>!area.includes(n)&&game.terrain[n]===TILE_EMPTY));
   if(spots.length)for(let n=0;n<loot;n++)game.army[spots[n%spots.length]]++;
  }
 }
 game.topologyVersion=(game.topologyVersion||0)+1;
 announceEvent('工兵爆破',`${game.players[playerIdx].name} 引爆工兵，炸開 ${game.rules.blastSize}×${game.rules.blastSize} 區域`);
 return true;
}
function recruitAtCamp(playerIdx,index) {
 const type=game.terrain[index],p=game.players[playerIdx];
 if(!p?.alive||game.owner[index]!==playerIdx||![TILE_OFFICER,TILE_GOBLIN].includes(type))return false;
 const cost=type===TILE_OFFICER?game.rules.officerCost:game.rules.goblinCost;
 if(game.army[index]<cost+1)return rejectAction(playerIdx,`招募需要 ${cost} 兵力，並留下至少 1 兵`);
 if(type===TILE_OFFICER){
  if(game.extra.officers.filter(o=>o.owner===playerIdx).length>=game.rules.officerLimit)return rejectAction(playerIdx,'軍官已達上限');
  game.extra.officers.push({owner:playerIdx,home:index,lastFrom:-1});
 }else{
  const spots=DIRECTIONS.map(d=>neighborIndex(index,...d)).filter(i=>i>=0&&![TILE_MOUNTAIN,TILE_LAVA,TILE_PORTAL].includes(game.terrain[i])&&game.extra.engineers[i]<20);
  const spot=chooseRandom(spots);if(spot===undefined)return rejectAction(playerIdx,'營地旁無法放置工兵');
  game.extra.engineers[spot]++;
 }
 game.army[index]-=cost;
 return true;
}
function rejectAction(playerIdx,message) {
 if(playerIdx===game.myPlayerIndex)showToast(message,'rose');
 else {const c=hostClientConns[game.players[playerIdx]?.uid];if(c?.open)c.send({type:'action_rejected',message});}
 return false;
}
function applyTroops(playerIdx,to,amount) {
 if(amount<=0)return;
 const owner=game.owner[to];
 if(owner===playerIdx||arePlayersAllied(playerIdx,owner)){
  game.army[to]=Math.min(1000000000,game.army[to]+amount);if(game.terrain[to]!==TILE_GENERAL)game.owner[to]=playerIdx;
 }else{
  const remaining=amount-game.army[to];
  game.army[to]=Math.min(1000000000,Math.abs(remaining));
  if(remaining>0){game.owner[to]=playerIdx;if(game.terrain[to]===TILE_GENERAL&&owner>=0)handleGeneralCaptured(playerIdx,owner,to);}
 }
 game.army[to]=Math.min(1000000000,game.army[to]);
}
function sendTroops(playerIdx,from,rawTo,amount) {
 const route=resolveTransit(from,rawTo);if(!route||route.to===from||amount<=0)return false;
 const to=route.to;
 amount=Math.min(amount,Math.max(0,game.army[from]-1));if(!amount)return false;
 game.army[from]-=amount;
 let arriving=Math.max(0,amount-route.loss);
 if(game.terrain[to]===TILE_CASINO&&arriving>0){
  const roll=Math.random()*100;
  const multiplier=roll<game.rules.jackpotChance?game.rules.jackpotMultiplier:roll<50?2:0;
  arriving*=multiplier;
  if(multiplier>2)announceEvent('賭場大獎',`${game.players[playerIdx].name} 中了 ${multiplier} 倍大獎！`);
 }
 if(arriving>0){
  // Vehicles and engineers travel with a surviving escort; if combat loses they remain capturable.
  for(const key of ['engineers','carts']){game.extra[key][to]=Math.min(100,game.extra[key][to]+game.extra[key][from]);game.extra[key][from]=0;}
  applyTroops(playerIdx,to,arriving);
 }
 // Unrelated river flows/officers must not steal the player's fog viewpoint.
 if(game.extra.focus[playerIdx]===from&&game.owner[to]===playerIdx&&arriving>0)game.extra.focus[playerIdx]=to;
 return true;
}
function scaledProduction(rate,cycle){return Math.floor(cycle*rate+1e-9)-Math.floor((cycle-1)*rate+1e-9);}
function processTerrainTurn() {
 game.extra.riverCredit=(game.extra.riverCredit||0)+game.rules.riverRate;
 const flowRounds=Math.floor(game.extra.riverCredit+1e-9);game.extra.riverCredit=Math.max(0,game.extra.riverCredit-flowRounds);
 for(let flowRound=0;flowRound<flowRounds;flowRound++){
 // Snapshot source amounts so one army cannot cascade down the whole river in one turn.
 const flows=[];
 for(let i=0;i<game.terrain.length;i++)if(game.terrain[i]===TILE_RIVER&&game.owner[i]>=0&&game.army[i]>1){
  const dir=DIRECTIONS[game.extra.riverDir[i]];
  if(dir)flows.push({from:i,to:neighborIndex(i,...dir),owner:game.owner[i],n:Math.min(game.rules.riverFlow,game.army[i]-1)});
 }
 for(const f of flows)if(game.owner[f.from]===f.owner&&game.players[f.owner]?.alive)sendTroops(f.owner,f.from,f.to,f.n);
 }
 const blessings=new Set(),groupedShrines=new Set();
 for(const shrine of game.extra.shrines||[]){
  shrine.tiles.forEach(i=>groupedShrines.add(i));
  const owner=game.owner[shrine.tiles[0]];
  if(owner>=0&&shrine.tiles.every(i=>game.terrain[i]===TILE_SHRINE&&game.owner[i]===owner))blessings.add(owner);
 }
 for(let i=0;i<game.terrain.length;i++)if(game.terrain[i]===TILE_SHRINE&&game.owner[i]>=0&&!groupedShrines.has(i))blessings.add(game.owner[i]);
 for(let i=0;i<game.terrain.length;i++){
  const type=game.terrain[i],owner=game.owner[i];
  if(type===TILE_LAVA||type===TILE_PORTAL){game.owner[i]=-1;game.army[i]=0;continue;}
  if(owner<0||!game.players[owner]?.alive)continue;
  if(type===TILE_WATCH){game.army[i]=Math.max(0,game.army[i]-game.rules.watchDrain);if(!game.army[i])game.owner[i]=-1;continue;}
  if(type===TILE_GENERAL)game.army[i]++;
  if(isChurch(type))game.army[i]+=scaledProduction(game.rules.churchGrowth*(type===TILE_SHRINE&&!groupedShrines.has(i)?4:1)*(blessings.has(owner)?2:1),game.turn);
  if(game.turn%25===0)game.army[i]+=type===TILE_EMPTY?scaledProduction(game.rules.plainGrowth,game.turn/25):1;
 }
 // Neutral batteries defend against every player; owned batteries respect teams.
 for(let i=0;i<game.terrain.length;i++)if(game.terrain[i]===TILE_TURRET&&game.army[i]>1) {
  const owner=game.owner[i];let target=-1,distance=Infinity;
  for(const j of squareArea(i,game.rules.turretRadius*2+1)){
   const d=tileDistance(i,j);
   if(game.owner[j]>=0&&!arePlayersAllied(owner,game.owner[j])&&game.army[j]>0&&d<distance){target=j;distance=d;}
  }
  if(target>=0){const shots=Math.min(game.rules.turretShot>0?game.rules.turretShot:Math.floor(game.army[i]*game.rules.turretPercent/100),game.army[i]-1);if(shots>0)queueCannonShot(i,target);game.army[i]-=shots;game.army[target]=Math.max(0,game.army[target]-shots);}
 }
}
