'use strict';

function queueRecruit() {
 if(!canCommand())return;
 if(!game.isRunning||replayState.active)return;
 const i=game.selectedTile;
 if(game.owner[i]!==game.myPlayerIndex||![TILE_OFFICER,TILE_GOBLIN].includes(game.terrain[i])){showToast('先選取己方軍官營地或哥布林營地','rose');return;}
 game.moveQueue.push({seq:++clientMoveSeq,type:'recruit',targetIndex:i});updateQueueUI();syncNextMoveToOnlineHostIfNeeded();
 showToast('招募已排入佇列，執行時從營地扣兵','sky');
}
function toggleBombMode(){
 if(!canCommand())return;
 if(!game.isRunning||replayState.active)return;
 game.bombMode=!game.bombMode;
 document.getElementById('bombButton').classList.toggle('active',game.bombMode);
 if(game.bombMode)showToast('選取帶工兵的部隊，再點相鄰山脈或賭場；X 取消','amber');
}
function queueBomb(to){
 if(!canCommand())return;
 const from=game.selectedTile;
 if(!canBomb(from,to)||game.owner[from]!==game.myPlayerIndex){showToast('需要己方部隊帶著工兵，目標須為相鄰山脈或賭場','rose');return;}
 game.moveQueue.push({seq:++clientMoveSeq,type:'bomb',from,to});game.bombMode=false;
 document.getElementById('bombButton').classList.remove('active');updateQueueUI();syncNextMoveToOnlineHostIfNeeded();
}
function handleBorderClick(col,row){
 if(!game.rules.wrap||game.selectedTile<0)return;
 const x=game.selectedTile%game.width,y=Math.floor(game.selectedTile/game.width);
 if(col===-1&&row===y&&x===0)queueMoveDirection(-1,0);
 else if(col===game.width&&row===y&&x===game.width-1)queueMoveDirection(1,0);
 else if(row===-1&&col===x&&y===0)queueMoveDirection(0,-1);
 else if(row===game.height&&col===x&&y===game.height-1)queueMoveDirection(0,1);
}
function updateExpansionHud(){
 const recruit=document.getElementById('btnRecruit');
 if(recruit&&game.rules){
  const r=game.rules,type=game.terrain[game.selectedTile];
  recruit.textContent=type===TILE_OFFICER?`招募軍官：${r.officerCost} 兵 (B)`:type===TILE_GOBLIN?`招募工兵：${r.goblinCost} 兵 (B)`:`招募：軍官 ${r.officerCost}／工兵 ${r.goblinCost} 兵 (B)`;
  recruit.title='選取己方營地後招募；扣除費用後須留下至少 1 兵。';
 }
 const hud=document.getElementById('expansionHud'),info=document.getElementById('tileInfo');if(!hud||!game.extra)return;
 const e=game.extra,r=game.rules,seconds=Math.floor(e.elapsedMs/1000);
 const weather=e.sudden?'驟死 · 全圖':e.sunUntil>e.elapsedMs?`放晴 ${Math.ceil((e.sunUntil-e.elapsedMs)/1000)}s`:e.mistUntil>e.elapsedMs?`濃霧 ${Math.ceil((e.mistUntil-e.elapsedMs)/1000)}s`:'';
 const officers=e.officers.filter(o=>o.owner===game.myPlayerIndex).length;
 const latest=e.eventLog.at(-1);
 hud.textContent=`${game.isSpectator?'觀戰 · ':''}${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} · 主城 ${playerCapitals(game.myPlayerIndex).length} · 軍官 ${officers} · ${r.wrap?'四邊互通':'硬邊界'} ${weather}${r.suddenDeath&&!e.sudden?' · 驟死倒數 '+Math.max(0,Math.ceil(r.suddenMinutes*60-seconds))+'s':''}${latest?' ｜'+latest.name:''}`;
 if(game.isSpectator)hud.textContent=`觀戰 · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} · ${displayViewer()<0?'全圖':game.players[displayViewer()]?.name||'未知勢力'} ${weather}${latest?' ｜'+latest.name:''}`;
 const i=game.selectedTile;
 if(i<0){info.textContent=game.isSpectator?'點擊格子查看資訊 · 拖曳平移／滾輪縮放':'選格查看資訊 · B 招募 · X 工兵爆破';return;}
 const vis=computeVisibilityMask(displayViewer(),true);
 if(!vis[i]){info.textContent='視野外';return;}
 const type=game.terrain[i];
 const notes={
  [TILE_RIVER]:`每次沿箭頭輸送 ${r.riverFlow} 兵，每回合 ${r.riverRate} 次（留下 1 兵）`,
  [TILE_OFFICER]:`B：花 ${r.officerCost} 兵招募軍官；不動用主城`,
  [TILE_GOBLIN]:`B：花 ${r.goblinCost} 兵於營地旁產生工兵`,
  [TILE_WATCH]:`視野半徑 ${r.watchRadius}，每回合減 ${r.watchDrain} 兵；歸零失去佔領`,
  [TILE_TURRET]:`射程 ${r.turretRadius*2+1}×${r.turretRadius*2+1}，每回合射 ${r.turretShot>0?r.turretShot+' 兵':r.turretPercent+'% 駐軍'}；不佔領目標`,
  [TILE_CASINO]:`入場兵力：${r.jackpotChance}% ×${r.jackpotMultiplier}；${50-r.jackpotChance}% ×2；50% 歸零`,
  [TILE_ROAD]:`同一支部隊 ${1+r.roadBonus} 倍行軍速度`,
  [TILE_SHRINE]:'2×2 四格完整佔領後，全勢力教堂產兵 ×2；總產兵相當於 4 教堂；周邊 5×5 為公共視野',
  [TILE_LAVA]:`可佔領；進入扣 ${r.lavaLoss} 兵，駐軍每回合再扣 ${r.lavaLoss} 兵，歸零變中立`,
  [TILE_PORTAL]:'同方向穿越成對出口，不留兵'
 };
 info.textContent=`${TILE_LABELS[type]} · ${game.army[i]} 兵${e.engineers[i]?' · 工兵 '+e.engineers[i]:''}${e.carts[i]?' · 馬車 ×'+r.cartSteps+'速':''} ${notes[type]||''}`;
}
function drawExpansionTile(c,x,y,size,index){drawReadableTile(c,x,y,size,index);}
function drawWrapBorder(c,ts){
 if(!game.rules.wrap)return;
 c.save();c.fillStyle='rgba(14,165,233,0.10)';c.strokeStyle='rgba(56,189,248,0.45)';c.setLineDash([5,5]);
 for(const [x,y,w,h] of [[-1,0,1,game.height],[game.width,0,1,game.height],[0,-1,game.width,1],[0,game.height,game.width,1]]){c.fillRect(camera.x+x*ts,camera.y+y*ts,w*ts,h*ts);c.strokeRect(camera.x+x*ts,camera.y+y*ts,w*ts,h*ts);}
 c.restore();
}



