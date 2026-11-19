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
function computeVisibilityMask(viewerIdx) {
 const mask=new Uint8Array(game.width*game.height),e=game.extra;
 if(replayState.active||viewerIdx<0||e?.sudden||e?.sunUntil>e?.elapsedMs){mask.fill(1);return mask;}
 if(e?.mistUntil>e?.elapsedMs){
  revealAround(mask,mistFocus(viewerIdx),2);return mask;
 }
 if(game.visionMode==='full'){mask.fill(1);return mask;}
 for(let i=0;i<mask.length;i++)if(game.owner[i]>=0&&arePlayersAllied(viewerIdx,game.owner[i])){
  const type=game.terrain[i];
  revealAround(mask,i,type===TILE_WATCH?game.rules.watchRadius:type===TILE_TURRET?game.rules.turretVision:1);
 }
 return mask;
}
