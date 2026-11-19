'use strict';

const pendingSurrenders=new Set();
function requestSurrender(){
 if(!game.isRunning||!canCommand())return;
 if(!window.confirm('確定投降？領地與剩餘兵力將轉為中立，主堡變為教堂。投降後可繼續觀戰。'))return;
 if(game.mode==='online_client'){
  if(!clientToHostConn?.open){showToast('尚未連上房主，無法送出投降','rose');return;}
  clientToHostConn.send({type:'surrender_request',uid:localPlayerUid});
 }else if(game.mode==='single'&&game.isPaused){
  surrenderPlayer(game.myPlayerIndex);recordReplaySnapshot();checkVictoryCondition();updateHudAndLeaderboard();return;
 }else pendingSurrenders.add(game.myPlayerIndex);
 game.surrenderRequested=true;game.moveQueue=[];updateQueueUI();updateSpectatorUI();
}
function surrenderPlayer(idx){
 const p=game.players[idx];if(!p?.alive)return false;
 p.alive=false;p.surrendered=true;p.generalIndices=[];p.generalIndex=-1;
 for(let i=0;i<game.owner.length;i++)if(game.owner[i]===idx){game.owner[i]=-1;if(game.terrain[i]===TILE_GENERAL)game.terrain[i]=TILE_CITY;}
 pendingOnlineQueues[p.uid]=[];if(idx===game.myPlayerIndex)game.moveQueue=[];
 game.extra.officers=game.extra.officers.filter(o=>o.owner!==idx);game.extra.focus[idx]=-1;
 game.visualRevision=(game.visualRevision||0)+1;announceEvent('投降',p.name+' 已投降');return true;
}
function advanceGameTurn(dt=turnLoopIntervalMs) {
 if(!game.isRunning||game.isPaused||game.mode==='online_client')return;
 if(replayState.active){
  if(game.mode!=='online_host'||!replayState.liveBackup)return;
  // The host keeps simulating the authoritative world while its canvas shows an old frame.
  const viewedFrame=captureFrame(),viewedVision=game.visionMode,memory=game.strategyMemory,topology=game.topologyVersion;
  restoreFrame(replayState.liveBackup.frame);game.visionMode=replayState.liveBackup.visionMode;
  game.strategyMemory=memory;game.topologyVersion=topology;
  replayState.active=false;
  advanceGameTurn(dt);
  replayState.liveBackup.frame=captureFrame();
  replayState.liveBackup.memory=game.strategyMemory;replayState.liveBackup.topology=game.topologyVersion;
  replayState.active=true;restoreFrame(viewedFrame);game.visionMode=viewedVision;
  game.strategyMemory=replayState.liveBackup.memory;game.topologyVersion=replayState.liveBackup.topology;
  document.getElementById('replayScrubber').max=String(game.replayHistory.length-1);
  updateHudAndLeaderboard();return;
 }
 for(const idx of pendingSurrenders)surrenderPlayer(idx);pendingSurrenders.clear();
 const executedMeta={};
 const count=game.players.length;
 for(let pIdx=0;pIdx<count;pIdx++){
  const p=game.players[pIdx];if(!p?.alive)continue;
  const level=getAILevel(p);if(p.isBot&&game.turn%level.interval!==0)continue;
  game.extra.moveCredits=game.extra.moveCredits||{};
  let budget=(game.extra.moveCredits[pIdx]||0)+game.rules.moveRate*(p.isBot?level.budget:1),steps=0,previousTo=-1;
  while(budget>0.0001&&steps++<64){
   let action=null;
   if(p.isBot)action=commanderAction(pIdx,false,new Set(),budget<1?previousTo:-1);
   else {
    const queue=pIdx===game.myPlayerIndex?game.moveQueue:pendingOnlineQueues[p.uid]||[];
    while(queue.length){
     const candidate=queue[0];
     const valid=candidate&&(['relocate','recruit'].includes(candidate.type)||(candidate.type==='bomb'?canBomb(candidate.from,candidate.to)&&game.owner[candidate.from]===pIdx:isValidMoveStep(pIdx,candidate.from,candidate.to)));
     if(valid){action=candidate;break;}
     queue.shift();executedMeta[p.uid]=Math.max(executedMeta[p.uid]||0,candidate?.seq||0);
    }
    if(!action){budget=0;break;}
    // Speed bonuses apply to the same moving stack, not to unrelated orders.
    const cost=action.type==='move'?stepMovementCost(action.from):1;
    if(previousTo>=0&&action.from!==previousTo){budget=0;break;}
    if(cost>budget+0.0001)break;
    queue.shift();executedMeta[p.uid]=Math.max(executedMeta[p.uid]||0,action.seq||0);
   }
   if(!action){budget=0;break;}
   const cost=action.type==='move'?stepMovementCost(action.from):1;
   if(cost>budget+0.0001)break;
   const route=action.type==='move'?resolveTransit(action.from,action.to):null;
   if(action.type==='move'&&game.owner[action.from]===pIdx)game.extra.focus[pIdx]=action.from;
   executeAction(pIdx,action);budget-=cost;previousTo=route?.to??-1;
  }
  game.extra.moveCredits[pIdx]=Math.max(0,Math.min(1,budget));
 }
 updateQueueUI();runOfficers();game.turn++;
 for(const [uid,seq] of Object.entries(executedMeta))game.executedThrough[uid]=Math.max(game.executedThrough[uid]||0,seq);
 processTerrainTurn();advanceWorldTime(dt);
 recordReplaySnapshot();updateHudAndLeaderboard();
 if(game.mode==='online_host')broadcastHostTurnState(executedMeta);
 checkVictoryCondition();
}
function executeAction(playerIdx,action) {
 if(!game.players[playerIdx]?.alive)return false;
 if(action.type==='relocate')return executeCapitalRelocation(playerIdx,action.targetIndex);
 if(action.type==='recruit')return recruitAtCamp(playerIdx,action.targetIndex);
 if(action.type==='bomb')return explodeEngineer(playerIdx,action.from,action.to);
 if(action.type==='move')return executeSingleMove(playerIdx,action.from,action.to,!!action.isHalf);
 return false;
}
function isValidMoveStep(playerIdx,from,to) {
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=game.terrain.length||to>=game.terrain.length)return false;
 if(game.owner[from]!==playerIdx||game.army[from]<2||!moveDirection(from,to))return false;
 const route=resolveTransit(from,to);return !!route&&route.to!==from;
}
function resolvePortalDestination(from,to){return resolveTransit(from,to)?.to??-1;}
function executeSingleMove(playerIdx,from,to,isHalf) {
 if(!isValidMoveStep(playerIdx,from,to))return false;
 const amount=isHalf?Math.max(1,Math.floor(game.army[from]/2)):game.army[from]-1;
 return sendTroops(playerIdx,from,to,amount);
}

const RELOCATION_RADIUS = 2;

function hasNearbyEnemy(playerIdx, tileIdx, visibleMask = null) {
    const x = tileIdx % game.width, y = Math.floor(tileIdx / game.width);
    for (let dy=-RELOCATION_RADIUS;dy<=RELOCATION_RADIUS;dy++) {
        for (let dx=-RELOCATION_RADIUS;dx<=RELOCATION_RADIUS;dx++) {
            if(Math.abs(dx)+Math.abs(dy)>RELOCATION_RADIUS) continue;
            const i=neighborIndex(tileIdx,dx,dy);
            if(i<0)continue;
            const owner=game.owner[i];
            if(visibleMask && !visibleMask[i]) continue;
            if(owner>=0 && game.army[i]>0 && !arePlayersAllied(playerIdx,owner)) return true;
        }
    }
    return false;
}

function getRelocationError(playerIdx, cityIdx, visibleOnly = false) {
    const pl=game.players[playerIdx];
    if(!game.allowRelocate || !pl || !pl.alive || pl.relocateLeft<=0) return '目前無法遷都或次數已用完';
    if(!Number.isInteger(cityIdx) || game.owner[cityIdx]!==playerIdx || game.terrain[cityIdx]!==TILE_CITY) return '請選擇己方已佔領城市';
    if(game.terrain[pl.generalIndex]!==TILE_GENERAL || game.owner[pl.generalIndex]!==playerIdx) return '目前主城無效';
    const mask=visibleOnly ? computeVisibilityMask(playerIdx) : null;
    if(hasNearbyEnemy(playerIdx,pl.generalIndex,mask) || hasNearbyEnemy(playerIdx,cityIdx,mask)) return '遷都失敗：舊主城或目的城市 2 格內有敵軍';
    return '';
}

function executeCapitalRelocation(playerIdx, cityIdx) {
    const error=getRelocationError(playerIdx,cityIdx);
    if(error) {
        if(playerIdx===game.myPlayerIndex) showToast(error,'rose');
        else if(game.mode==='online_host') {
            const conn=hostClientConns[game.players[playerIdx]?.uid];
            if(conn?.open) conn.send({type:'action_rejected',message:error});
        }
        return false;
    }
    const pl=game.players[playerIdx];
    game.terrain[pl.generalIndex]=TILE_CITY;
    game.army[pl.generalIndex]=0;
    game.terrain[cityIdx]=TILE_GENERAL;
    pl.generalIndex=cityIdx;
    refreshCapitals(playerIdx);
    pl.relocateLeft--;
    if(playerIdx===game.myPlayerIndex) {
        game.relocateTargetingMode=false;
        updateRelocateButtonUI();
        showToast('遷都成功！舊主城駐軍已全數損失，目的城市兵力保留','amber');
    }
    return true;
}

function handleGeneralCaptured(capturerIdx, victimIdx, capturedTileIdx) {
    const victim = game.players[victimIdx];
    const capturer = game.players[capturerIdx];
    if (!victim) return;

    game.terrain[capturedTileIdx] = TILE_CITY;
    refreshCapitals(victimIdx);
    if(victim.generalIndices.length){showToast(victim.name+' 失去一座主城，剩 '+victim.generalIndices.length+' 座','amber');return;}
    victim.alive = false;

    const total = game.width * game.height;
    for (let i = 0; i < total; i++) {
        if (game.owner[i] === victimIdx) {
            game.owner[i] = capturerIdx;
            game.army[i] = Math.max(1, Math.ceil(game.army[i] / 2));
        }
    }

    showToast(`${capturer.name} 攻陷了 ${victim.name} 的主堡！`, 'amber');
}

function checkVictoryCondition() {
    const alivePlayers = game.players.filter(p => p.alive);


    let isOver = alivePlayers.length===0;
    let winnerTitle = isOver?'所有玩家均已退出戰鬥':'';

    if (alivePlayers.length&&game.teamMode) {
        const aliveTeams = new Set(alivePlayers.map(p => p.team));
        if (aliveTeams.size <= 1) {
            isOver = true;
            const winTeam = alivePlayers[0].team;
            winnerTitle = `${TEAM_LABELS[winTeam]||('軍閥隊 '+winTeam)} 獲得最終勝利！`;
        }
    } else if(alivePlayers.length) {
        if (alivePlayers.length <= 1) {
            isOver = true;
            winnerTitle = `${alivePlayers[0].name} 統一天下！`;
        }
    }

    if(!isOver)offerEliminatedSpectating();
    if (isOver) {
        document.getElementById('eliminatedPrompt')?.remove();
        game.isRunning = false;
        if (game.turnTimer) clearTimeout(game.turnTimer);
        saveCurrentMatchReplay(winnerTitle);

        document.getElementById('goTitleText').textContent = winnerTitle;
        document.getElementById('goSubtitleText').textContent = `總計進行 ${game.turn} 回合・回放已自動保存`;
        document.getElementById('gameOverModal').classList.remove('hidden');
    }
}
