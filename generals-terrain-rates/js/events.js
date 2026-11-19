'use strict';

function announceEvent(name,message=name) {
 game.extra.eventLog.push({turn:game.turn,time:game.extra.elapsedMs,name,message});
 if(game.extra.eventLog.length>30)game.extra.eventLog.shift();
 if(!replayState.active)showToast(message,'amber');
}
function scheduleDisaster() {
 game.extra.nextEventAt=(game.extra.elapsedMs||0)+(game.rules.eventMinSeconds+Math.random()*(game.rules.eventMaxSeconds-game.rules.eventMinSeconds))*1000;
}
function eventSafeCell(i){return game.owner[i]<0&&game.army[i]===0&&[TILE_EMPTY,TILE_MOUNTAIN].includes(game.terrain[i])&&!game.extra.carts[i]&&!game.extra.engineers[i];}
function preserveCapitalPaths(){
 const capitals=game.players.flatMap((p,i)=>p.alive?playerCapitals(i):[]);
 ensureDryCapitalPaths(game,game.width,game.height,capitals);
 game.topologyVersion=(game.topologyVersion||0)+1;
}
function carveVolcanoPassages(center,radius,affected){
 // Straight crossings are important: lava transit continues in the entry direction.
 const paths=[];
 for(const [dx,dy] of [[1,0],[0,1]]){
  const path=[],seen=new Set();
  for(let step=-Math.ceil(radius)-1;step<=Math.ceil(radius)+1;step++){
   const i=neighborIndex(center,dx*step,dy*step);if(i<0||seen.has(i))continue;seen.add(i);path.push(i);
   if(game.terrain[i]===TILE_MOUNTAIN){
    game.terrain[i]=TILE_EMPTY;affected.push(i);
   }
  }
  paths.push(path);
 }
 return paths;
}
function triggerDisaster(type) {
 const r=game.rules,extra=game.extra;
 if(type==='miracle'&&(extra.shrines||[]).length>=r.shrineLimit)return;
 if(type==='sun'){queueDisasterEffect('sun');extra.sunUntil=extra.elapsedMs+r.sunSeconds*1000;announceEvent('放晴',`放晴：全圖視野開放 ${r.sunSeconds} 秒`);return;}
 if(type==='mist'){queueDisasterEffect('mist');extra.mistUntil=extra.elapsedMs+r.mistSeconds*1000;announceEvent('迷霧',`濃霧：${r.mistSeconds} 秒內僅能看到目前操作格附近`);return;}
 if(type==='meteor'){
  const impacts=Array.from({length:r.meteorCount},()=>Math.floor(Math.random()*game.terrain.length));
  for(const hit of impacts)for(const i of squareArea(hit,r.meteorSize))game.army[i]=0;
  queueDisasterEffect('meteor',impacts,r.meteorSize/2,impacts.flatMap(i=>squareArea(i,r.meteorSize)));
  announceEvent('隕石雨',`隕石雨：${r.meteorCount} 顆隕石清空 ${r.meteorSize}×${r.meteorSize} 區域兵力`);return;
 }
 const safe=Array.from({length:game.terrain.length},(_,i)=>i).filter(eventSafeCell);
 let center=chooseRandom(safe);
 if(type==='volcano'){
  const canCross=i=>{
   const x=i%game.width,y=Math.floor(i/game.width);
   if(!r.wrap&&(x===0||y===0||x===game.width-1||y===game.height-1))return false;
   for(const [dx,dy] of [[1,0],[0,1]])for(let s=-Math.ceil(r.volcanoRadius*1.5)-1;s<=Math.ceil(r.volcanoRadius*1.5)+1;s++){
    const j=neighborIndex(i,dx*s,dy*s);if(j>=0&&game.terrain[j]===TILE_PORTAL)return false;
   }
   return true;
  };
  if(center!==undefined&&!canCross(center))center=chooseRandom(safe.filter(canCross));
 }
 if(center===undefined){announceEvent('天災略過','沒有足夠空地，這次地形事件略過');return;}
 if(type==='quake'){
  const area=squareArea(center,r.eventRadius*4+1).filter(eventSafeCell);
  const mountains=area.filter(i=>game.terrain[i]===TILE_MOUNTAIN).length;
  area.forEach(i=>game.terrain[i]=TILE_EMPTY);
  shuffle(area).slice(0,mountains).forEach(i=>game.terrain[i]=TILE_MOUNTAIN);
  queueDisasterEffect('quake',[center],r.eventRadius*2,area);
  preserveCapitalPaths();announceEvent('地震','地震：局部山脈重新排列');
 }else if(type==='volcano'){
  const volcanoRadius=r.volcanoRadius*1.5,coreRadius=Math.max(1,Math.floor(volcanoRadius/3));
  const affected=[];
  for(const i of squareArea(center,Math.ceil(volcanoRadius)*2+1))if(eventSafeCell(i)){
   let dx=Math.abs(i%game.width-center%game.width),dy=Math.abs(Math.floor(i/game.width)-Math.floor(center/game.width));
   if(r.wrap){dx=Math.min(dx,game.width-dx);dy=Math.min(dy,game.height-dy);}
   const d=Math.hypot(dx,dy);
   if(d<=coreRadius){game.terrain[i]=TILE_LAVA;affected.push(i);}
   else if(d<=volcanoRadius){
    // Round, porous slopes: sparse foothills instead of a solid mountain wall.
    const slope=(d-coreRadius)/(volcanoRadius-coreRadius);
    const mountainChance=.85-.73*slope,roll=Math.random();
    const terrain=roll<mountainChance?TILE_MOUNTAIN:roll> .965?TILE_LAVA:TILE_EMPTY;
    if(game.terrain[i]!==terrain){game.terrain[i]=terrain;affected.push(i);}
   }
  }
  game.terrain[center]=TILE_LAVA;
  carveVolcanoPassages(center,volcanoRadius,affected);
  queueDisasterEffect('volcano',[center],volcanoRadius,affected);preserveCapitalPaths();announceEvent('火山','火山爆發：稀疏山腳與圓形岩漿核心，東西及南北兩條平地通路貫穿中心');
 }else if(type==='miracle'){
  const layouts=[];
  for(let y=1;y<game.height-2;y++)for(let x=1;x<game.width-2;x++){
   const tiles=[y*game.width+x,y*game.width+x+1,(y+1)*game.width+x,(y+1)*game.width+x+1];
   const turrets=[(y-1)*game.width+x,(y-1)*game.width+x+1,(y+2)*game.width+x,(y+2)*game.width+x+1,y*game.width+x-1,(y+1)*game.width+x-1,y*game.width+x+2,(y+1)*game.width+x+2];
   if([...tiles,...turrets].every(eventSafeCell))layouts.push({tiles,turrets});
  }
  const shrine=chooseRandom(layouts);
  if(!shrine){announceEvent('神蹟略過','空間不足，無法放置 2×2 超級教堂與 8 座砲台');return;}
  for(const [n,i] of shrine.tiles.entries()){game.terrain[i]=TILE_SHRINE;game.army[i]=Math.floor(r.shrineGuard/4)+(n<r.shrineGuard%4?1:0);}
  for(const i of shrine.turrets){game.terrain[i]=TILE_TURRET;game.army[i]=r.shrineTurretGuard;}
  game.extra.shrines=game.extra.shrines||[];game.extra.shrines.push(shrine);
  queueDisasterEffect('miracle',[shrine.tiles[0]],3,[...shrine.tiles,...shrine.turrets]);
  preserveCapitalPaths();announceEvent('神蹟','2×2 超級教堂與 8 座砲台降臨；完整佔領四格後教堂產兵 ×2');
 }else if(type==='warlord'){
  const generated=game.players.filter(p=>p.isWarlord||p.uid?.startsWith('warlord_')).length;
  const wanted=Math.min(1+Math.floor(Math.random()*r.warlordMax),Math.max(0,r.warlordLimit-generated));let spawned=0;const landings=[],landingCells=[];
  for(let n=0;n<wanted;n++){
   const spots=shuffle(Array.from({length:game.terrain.length},(_,i)=>i).filter(i=>game.terrain[i]===TILE_EMPTY&&eventSafeCell(i)));
   if(spots.length<3)break;
   const capital=spots[0];spots.sort((a,b)=>tileDistance(a,capital)-tileDistance(b,capital));
   const idx=game.players.length,team=Math.max(...game.players.map(p=>p.team||0))+1;
   game.players.push({isWarlord:true,index:idx,uid:'warlord_'+idx,name:`軍閥 ${idx+1}`,colorIdx:idx%PLAYER_COLORS.length,team,isBot:true,alive:true,generalIndex:capital,generalIndices:[capital],relocateLeft:0,difficulty:r.difficulty});
   for(const [j,i] of spots.slice(0,3).entries()){game.terrain[i]=j===0?TILE_GENERAL:TILE_CITY;game.owner[i]=idx;game.army[i]=j===0?40:20;}
   spawned++;landings.push(capital);landingCells.push(...spots.slice(0,3));
  }
  if(landings.length)queueDisasterEffect('warlord',landings,2,landingCells);
  preserveCapitalPaths();announceEvent('軍閥',spawned?`${spawned} 名軍閥降落，各帶 1 主城及 2 教堂`:`軍閥未能降落：空地不足或已達本局 ${r.warlordLimit} 名軍閥上限`);
 }
}
function advanceWorldTime(dt) {
 const e=game.extra,r=game.rules;e.elapsedMs+=Math.max(0,dt);
 if(r.suddenDeath&&!e.sudden&&e.elapsedMs>=r.suddenMinutes*60000){e.sudden=true;announceEvent('驟死賽','驟死賽開始：永久解除所有玩家的戰爭迷霧');}
 if(r.disasters&&e.elapsedMs>=e.nextEventAt){
  const types=['quake','volcano','sun','meteor','mist','miracle','warlord'].filter(t=>r['event'+t[0].toUpperCase()+t.slice(1)]&&(t!=='miracle'||(e.shrines||[]).length<r.shrineLimit));
  const type=chooseRandom(types);if(type)triggerDisaster(type);scheduleDisaster();
 }
}
