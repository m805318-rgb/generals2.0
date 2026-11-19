'use strict';

config.myRole='player';
game.isSpectator=false;
game.spectatorTarget=-1;
function roomPlayers(){return (activeRoomRawData?.slots||[]).filter(s=>!s.isSpectator);}
function canCommand(){return !game.isSpectator&&game.myPlayerIndex>=0&&game.players[game.myPlayerIndex]?.alive&&!replayState.active;}
function displayViewer(){return game.isSpectator?game.spectatorTarget:game.myPlayerIndex;}
function selectLobbyRole(value){
 if(game.isRunning){showToast('對局中不能切換玩家／觀戰者身份','rose');return;}
 const role=value==='spectator'?'spectator':'player';
 if(activeRoomRawData&&isRoomHost){
  const me=activeRoomRawData.slots.find(s=>s.uid===localPlayerUid);
  if(me){
   if(role==='player'&&me.isSpectator&&roomPlayers().length>=8){showToast('玩家席位已滿','rose');renderSpectatorLobby();return;}
   me.isSpectator=role==='spectator';
  }
  config.myRole=role;broadcastRoomLobbyState();renderRoomSlotsUI();
 }else if(activeRoomRawData&&clientToHostConn?.open){
  clientToHostConn.send({type:'profile_update',uid:localPlayerUid,isSpectator:role==='spectator'});
 }else config.myRole=role;
 renderSpectatorLobby();
}
function renderSpectatorLobby(){
 const me=activeRoomRawData?.slots.find(s=>s.uid===localPlayerUid);
 if(me)config.myRole=me.isSpectator?'spectator':'player';
 const select=document.getElementById('lobbyRole');if(select)select.value=config.myRole;
 const start=document.querySelector('[onclick="startLocalGame()"]');
 if(start)start.textContent=config.myRole==='spectator'?'開始觀戰 AI 對局（至少 2 名 AI）':'立即開始單機對戰';
}
function updateSpectatorUI(){
 const panel=document.getElementById('spectatorPanel'),select=document.getElementById('spectatorView');
 if(!panel||!select)return;
 panel.classList.toggle('hidden',!game.isSpectator||replayState.active);
 if(!game.isSpectator)return;
 if(game.spectatorTarget>=game.players.length)game.spectatorTarget=-1;
 const signature=game.players.map(p=>`${p.uid}:${p.name}:${p.alive}`).join('|');
 if(select.dataset.signature!==signature){
  select.replaceChildren(new Option('全圖視角（無迷霧）','-1'));
  game.players.forEach((p,i)=>select.add(new Option(`${p.name}${p.alive?'':'（已淘汰）'}`,String(i))));
  select.dataset.signature=signature;
 }
 select.value=String(game.spectatorTarget);
 document.getElementById('hudBottomBar').classList.add('hidden');
}
function setSpectatorView(value){
 if(!game.isSpectator)return;
 const target=Number(value);
 if(!Number.isInteger(target)||target< -1||target>=game.players.length)return;
 game.spectatorTarget=target;game.selectedTile=-1;centerCameraOnMyGeneral();updateHudAndLeaderboard();
}
function spectatorStartPacket(){
 const frame=replayState.active&&replayState.liveBackup?replayState.liveBackup.frame:captureFrame();
 return {type:'match_start',turn:frame.turn,config:{...activeRoomRawData.config,rules:frame.rules},players:frame.players,mapData:{terrain:Array.from(frame.terrain),owner:Array.from(frame.owner),army:Array.from(frame.army),portalTarget:Array.from(frame.portalTarget),portalPairId:Array.from(frame.portalPairId),extra:frame.extra}};
}
function acceptRoomJoin(conn,data){
 const uid=data.uid;
 if(typeof uid!=='string'||!uid||uid===localPlayerUid||activeRoomRawData.slots.some(s=>s.uid===uid)){
  conn.send({type:'join_rejected',message:'此連線身份已使用，請重新加入'});return;
 }
 const spectator=data.isSpectator===true;
 if(game.isRunning&&!spectator){conn.send({type:'join_rejected',message:'對局已開始，請選擇觀戰者後加入'});return;}
 if(!spectator&&roomPlayers().length>=8){
  const bot=activeRoomRawData.slots.findIndex(s=>s.isBot&&!s.isSpectator);
  if(bot>=0)activeRoomRawData.slots.splice(bot,1);
  else{conn.send({type:'join_rejected',message:'玩家席位已滿，可改以觀戰者加入'});return;}
 }
 conn.peerUid=uid;hostClientConns[uid]=conn;
 activeRoomRawData.slots.push({uid,name:String(data.name||'Player').slice(0,40),colorIdx:Number.isInteger(data.colorIdx)?Math.abs(data.colorIdx)%PLAYER_COLORS.length:0,team:roomPlayers().length%2,isBot:false,isHost:false,isSpectator:spectator});
 broadcastRoomLobbyState();renderRoomSlotsUI();
 if(game.isRunning)conn.send(spectatorStartPacket());
}

function offerEliminatedSpectating(){
 if(replayState.active||game.isSpectator||game.deathPromptShown||game.myPlayerIndex<0||game.players[game.myPlayerIndex]?.alive)return;
 game.deathPromptShown=true;const panel=document.createElement('div');panel.id='eliminatedPrompt';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','已被淘汰');
 panel.className='glass-panel';panel.style.cssText='position:fixed;z-index:45;left:50%;top:50%;transform:translate(-50%,-50%);padding:24px;border-radius:18px;background:#0f172a;color:#fff;text-align:center;max-width:90vw';
 panel.innerHTML='<h2>你已被淘汰</h2><p>對局仍在進行，可繼續觀戰並切換玩家視角。</p><button class="expansion-btn" onclick="spectateAfterElimination()">繼續觀戰</button> <button class="expansion-btn" onclick="leaveAfterElimination()">返回大廳</button>';
 document.body.append(panel);
}
function spectateAfterElimination(){
 if(!game.isRunning||game.myPlayerIndex<0||game.players[game.myPlayerIndex]?.alive)return;
 game.isSpectator=true;game.spectatorTarget=-1;game.moveQueue=[];game.selectedTile=-1;game.bombMode=false;game.relocateTargetingMode=false;
 document.getElementById('eliminatedPrompt')?.remove();game.visualRevision=(game.visualRevision||0)+1;
 updateQueueUI();updateHudAndLeaderboard();centerCameraOnMyGeneral();
}

function leaveAfterElimination(){document.getElementById('eliminatedPrompt')?.remove();exitMatchToLobby();}
