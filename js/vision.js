'use strict';
function arePlayersAllied(p1,p2) {
 if(p1<0||p2<0)return false;
 if(p1===p2)return true;
 return game.teamMode&&game.players[p1]&&game.players[p2]&&game.players[p1].team===game.players[p2].team;
}
function revealAround(mask,index,radius) {
 if(index<0||index>=mask.length)return;
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  const i=neighborIndex(index,dx,dy);if(i>=0)mask[i]=1;
 }
}
function mistFocus(viewerIdx){
 const e=game.extra;let focus=e.focus[viewerIdx];
 // Selection is a queued destination, not necessarily the moving army's location.
 if(!Number.isInteger(focus)||game.owner[focus]!==viewerIdx){
  const pending=viewerIdx===game.myPlayerIndex?game.moveQueue.find(a=>a.type==='move'):null;
  focus=pending?.from??(viewerIdx===game.myPlayerIndex?game.selectedTile:-1);
 }
 if(!Number.isInteger(focus)||game.owner[focus]!==viewerIdx)focus=game.players[viewerIdx]?.generalIndex??-1;
 return focus;
}
// Human display only; commanders continue using mistFocus and the default mask.
function playerViewFocus(viewerIdx){
 if(!game.players[viewerIdx]?.isBot){
  const selected=viewerIdx===game.myPlayerIndex&&!game.isSpectator?game.selectedTile:game.extra?.viewSelection?.[viewerIdx];
  if(Number.isInteger(selected)&&selected>=0&&selected<game.terrain.length)return selected;
 }
 return mistFocus(viewerIdx);
}
function revealPublicShrines(mask){
 const shrines=game.extra?.shrines||[];
 for(const shrine of shrines)if(shrine.tiles?.some(i=>game.terrain[i]===TILE_SHRINE))revealAround(mask,shrine.tiles[0],2);
 // Compatibility with old maps that stored individual shrine tiles.
 if(!shrines.length)for(let i=0;i<game.terrain.length;i++)if(game.terrain[i]===TILE_SHRINE)revealAround(mask,i,2);
 return mask;
}
function computeVisibilityMask(viewerIdx,forDisplay=false) {
 const mask=new Uint8Array(game.width*game.height),e=game.extra;
 if(replayState.active||viewerIdx<0||e?.sudden||e?.sunUntil>e?.elapsedMs){mask.fill(1);return mask;}
 revealPublicShrines(mask);
 if(e?.mistUntil>e?.elapsedMs){
  revealAround(mask,forDisplay?playerViewFocus(viewerIdx):mistFocus(viewerIdx),2);return mask;
 }
 if(game.visionMode==='full'){mask.fill(1);return mask;}
 // Rectangle difference grid: large overlapping watchtower views cost O(map size).
 const w=game.width,h=game.height,stride=w+1,diff=new Int32Array((w+1)*(h+1));
 const intervals=(a,b,max)=>{
  if(!game.rules.wrap)return [[Math.max(0,a),Math.min(max-1,b)]];
  if(b-a+1>=max)return [[0,max-1]];
  a=(a%max+max)%max;b=(b%max+max)%max;return a<=b?[[a,b]]:[[a,max-1],[0,b]];
 };
 for(let i=0;i<mask.length;i++)if(game.owner[i]>=0&&arePlayersAllied(viewerIdx,game.owner[i])){
  const type=game.terrain[i],r=type===TILE_WATCH?game.rules.watchRadius:type===TILE_TURRET?game.rules.turretVision:1,x=i%w,y=Math.floor(i/w);
  for(const [x0,x1] of intervals(x-r,x+r,w))for(const [y0,y1] of intervals(y-r,y+r,h)){
   diff[y0*stride+x0]++;diff[y0*stride+x1+1]--;diff[(y1+1)*stride+x0]--;diff[(y1+1)*stride+x1+1]++;
  }
 }
 for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){const i=y*stride+x;row+=diff[i];diff[i]=row+(y?diff[i-stride]:0);if(diff[i]>0)mask[y*w+x]=1;}}
 return mask;
}
