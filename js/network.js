'use strict';

// ============================================================================
// ONLINE MULTIPLAYER ENGINE (ZERO-CONFIG WEBRTC PEERJS FOR GITHUB PAGES)
// ============================================================================
function getPeerRoomId(code) {
    return `generals-io-tw-lava-v20-${code.toUpperCase()}`;
}

let peerSetupToken=0,peerSetupTimer=null,peerSetupBusy=false;
function setPeerSetupBusy(busy,message){
 if(busy)document.getElementById('connectionErrorPanel')?.remove();
 peerSetupBusy=busy;
 document.querySelectorAll('[onclick="createOnlineRoom()"],[onclick="joinOnlineRoom()"],#btnJoinRunning').forEach(b=>b.disabled=busy);
 const badge=document.getElementById('netStatusBadge');if(badge)badge.textContent=message||(busy?'連線中…':'可建立／加入房間');
}
function peerErrorMessage(error){
 const messages={'unavailable-id':'房號已被使用，請重新建立房間。','network':'無法連上房間服務，請檢查網路或稍後重試。','socket-error':'房間服務連線失敗，請檢查網路或防火牆。','socket-closed':'房間服務連線已中斷，請稍後重試。','server-error':'房間服務暫時無法回應，請稍後重試。','browser-incompatible':'此瀏覽器不支援 WebRTC，請使用最新版 Chrome、Edge 或 Firefox。','timeout':'房間服務 15 秒未回應，請檢查網路後重試。','invalid-id':'房號格式錯誤，請重新建立房間。','peer-unavailable':'找不到房間，請確認房號、房主仍在線，且雙方使用相同版本。','ssl-unavailable':'目前環境無法建立安全連線。'};
 return (messages[error?.type]||'連線失敗，請稍後重試。')+' ['+(error?.type||'unknown')+']';
}
function createOnlineRoom() {
 if(peerSetupBusy)return;
 if(typeof Peer==='undefined'){showConnectionError({type:'library-unavailable',message:'連線元件下載失敗，請確認網路後重新整理頁面。'},'建立房間');return;}
 const token=++peerSetupToken,usedCodes=new Set();
 setPeerSetupBusy(true,'正在建立房間…');
 if(peerInstance)peerInstance.destroy();
 function attempt(number){
  if(token!==peerSetupToken)return;
  const random=new Uint32Array(1);crypto.getRandomValues(random);let code=String(1000+random[0]%9000);
  while(usedCodes.has(code))code=String(1000+(Number(code)-999)%9000);usedCodes.add(code);
  let peer,opened=false,failed=false;
  const current=()=>token===peerSetupToken&&peerInstance===peer;
  function fail(error){
   if(!current()||failed)return;
   if(opened){showConnectionError(error,'建立房間');return;}
   failed=true;clearTimeout(peerSetupTimer);peer.destroy();
   if((error.type==='unavailable-id'&&number<5)||(['network','socket-error','server-error','socket-closed'].includes(error.type)&&number<2)){
    setPeerSetupBusy(true,error.type==='unavailable-id'?'房號衝突，正在換號…':'連線失敗，正在重試…');
    peerSetupTimer=setTimeout(()=>attempt(number+1),error.type==='unavailable-id'?0:700);return;
   }
   peerInstance=null;setPeerSetupBusy(false,'建立失敗，可重試');showToast(peerErrorMessage(error),'rose');
  }
  try{peer=new Peer(getPeerRoomId(code));peerInstance=peer;}catch(error){peerInstance=null;setPeerSetupBusy(false,'建立失敗，可重試');showToast(peerErrorMessage(error),'rose');return;}
  peerSetupTimer=setTimeout(()=>fail({type:'timeout'}),15000);
  peer.on('open',()=>{
   if(!current()||failed)return;opened=true;clearTimeout(peerSetupTimer);setPeerSetupBusy(false,'房間已建立');
        activeRoomCode = code;
        isRoomHost = true;
        hostClientConns = {};

        const myName = (document.getElementById('inpPlayerName').value || 'Commander').trim();
        activeRoomRawData = {
            roomCode: code,
            hostUid: localPlayerUid,
            config: { ...config },
            slots: [
                {
                    uid: localPlayerUid,
                    name: myName,
                    colorIdx: config.myColorIdx,
                    team: 0,
                    isBot: false,
                    isSpectator: config.myRole==='spectator',
                    isHost: true
                },
                {
                    uid: 'bot_1',
                    name: 'AI 指揮官 #1',
                    colorIdx: (config.myColorIdx + 1) % PLAYER_COLORS.length,
                    team: 1,
                    isBot: true,
                    isHost: false
                }
            ]
        };

        enterRoomLobbyUI();
        showToast(`已建立房間 #${code}！可複製連結邀請朋友`, 'sky');

  });
    peer.on('connection', (conn) => {
        if(token!==peerSetupToken||peerInstance!==peer){conn.close();return;}
        conn.on('data', (data) => handleHostReceivedPeerData(conn, data));
        conn.on('close', () => {
            if(token!==peerSetupToken||peerInstance!==peer)return;
            if (conn.peerUid) {
                delete hostClientConns[conn.peerUid];
                if (activeRoomRawData) {
                    activeRoomRawData.slots = activeRoomRawData.slots.filter(s => s.uid !== conn.peerUid);
                    broadcastRoomLobbyState();
                    renderRoomSlotsUI();
                }
            }
        });
    });


  peer.on('error',fail);
  peer.on('disconnected',()=>{if(current()&&opened){const badge=document.getElementById('netStatusBadge');if(badge)badge.textContent='房間服務暫時斷線';showToast('房間服務暫時斷線；已連線玩家可繼續，新的玩家暫時無法加入。','amber');}});
 }
 attempt(0);
}

function joinOnlineRoom() {
    if(peerSetupBusy)return;
    const rawCode = (document.getElementById('inpJoinRoomCode').value || '').trim().toUpperCase();
    if (!/^\d{4}$/.test(rawCode)) {
        showToast('請輸入 4 位數房間號碼', 'rose');
        return;
    }
    if (typeof Peer === 'undefined') {
        showConnectionError({type:'library-unavailable',message:'連線元件下載失敗，請確認網路後重新整理頁面。'},'加入房間');
        return;
    }

    const token=++peerSetupToken;
    setPeerSetupBusy(true,'正在加入房間…');
    if(peerInstance)peerInstance.destroy();
    let peer;try{peer=new Peer();peerInstance=peer;}catch(error){setPeerSetupBusy(false);showToast(peerErrorMessage(error),'rose');return;}
    const current=()=>token===peerSetupToken&&peerInstance===peer;
    const failed=error=>{if(!current())return;showToast(peerErrorMessage(error),'rose');leaveOnlineRoom();};
    peerSetupTimer=setTimeout(()=>failed({type:'timeout'}),15000);
    peer.on('error',failed);

    peer.on('open', () => {
        if(!current())return;
        const conn = peer.connect(getPeerRoomId(rawCode), { reliable: true });
        clientToHostConn = conn;

        conn.on('error',failed);
        conn.on('open', () => {
            if(!current())return;clearTimeout(peerSetupTimer);setPeerSetupBusy(true,'已連上房主，等待房間資料…');
            peerSetupTimer=setTimeout(()=>failed({type:'handshake-timeout'}),10000);
            activeRoomCode = rawCode;
            isRoomHost = false;
            const myName = (document.getElementById('inpPlayerName').value || 'Commander').trim();
            conn.send({
                type: 'join_request',
                allowSpectate: true,
                uid: localPlayerUid,
                name: myName,
                colorIdx: config.myColorIdx,
                isSpectator: config.myRole==='spectator'
            });
        });

        conn.on('data', (data) => {if(current())handleClientReceivedPeerData(data);});
        conn.on('close', () => {
            if(!current())return;
            showToast('與房主的連線已中斷', 'rose');
            leaveOnlineRoom();
        });
    });
}

function handleHostReceivedPeerData(conn, data) {
    if (!data || !activeRoomRawData) return;
    if (handleLatencyPacket(conn, data)) return;
    if(data.type==='state_resync'&&conn.peerUid&&hostClientConns[conn.peerUid]===conn&&game.isRunning){
        const frame=replayState.active&&replayState.liveBackup?replayState.liveBackup.frame:captureFrame();
        conn.send(fullTurnPacket(frame,game.executedThrough||{}));return;
    }

    if(data.type==='surrender_request'){
        if(conn.peerUid!==data.uid)return;
        const idx=game.players.findIndex(p=>p.uid===conn.peerUid);
        if(game.isRunning&&idx>=0&&game.players[idx].alive)pendingSurrenders.add(idx);
        return;
    }
    if (data.type === 'join_request') {
        acceptRoomJoin(conn,data);
    } else if (data.type === 'profile_update') {
        if(conn.peerUid!==data.uid||game.isRunning)return;
        const sl = activeRoomRawData.slots.find(s => s.uid === data.uid);
        if (sl) {
            if(typeof data.isSpectator==='boolean'){
                if(!data.isSpectator&&sl.isSpectator&&roomPlayers().length>=8){conn.send({type:'action_rejected',message:'玩家席位已滿'});broadcastRoomLobbyState();return;}
                sl.isSpectator=data.isSpectator;
            }
            if (data.name) sl.name = data.name;
            if (data.colorIdx !== undefined) sl.colorIdx = data.colorIdx;
            if (data.team !== undefined) sl.team = data.team;
            broadcastRoomLobbyState();
            renderRoomSlotsUI();
        }
    } else if (data.type === 'player_queue_sync') {
        if(conn.peerUid!==data.uid)return;
        const playerIdx=game.players.findIndex(p=>p.uid===conn.peerUid);
        if(playerIdx<0||!game.players[playerIdx].alive)return;
        if(playerIdx>=0&&Number.isInteger(data.focus)&&game.owner[data.focus]===playerIdx)game.extra.focus[playerIdx]=data.focus;
        if(Number.isInteger(data.selection)&&data.selection>=-1&&data.selection<game.terrain.length){game.extra.viewSelection=game.extra.viewSelection||{};game.extra.viewSelection[playerIdx]=data.selection;}
        if (Array.isArray(data.queue)) {
            pendingOnlineQueues[data.uid] = data.queue.filter(a=>a&&Number.isInteger(a.seq)&&a.seq>(game.executedThrough?.[data.uid]||0)).slice(0,150);
        } else {
            pendingOnlineQueues[data.uid] = [];
        }
    }
}

function handleClientReceivedPeerData(data) {
    if (!data) return;
    if (handleLatencyPacket(clientToHostConn, data)) return;
    if(data.type==='join_rejected'){showConnectionError({type:'join-rejected',message:data.message},'加入房間');leaveOnlineRoom();return;}
    if (data.type === 'action_rejected') { showToast(data.message, 'rose'); return; }
    if(data.type==='turn_sync'){
        if(data.delta){
            if(!game.networkFrame||data.baseTurn!==game.networkFrame.turn){if(clientToHostConn?.open)clientToHostConn.send({type:'state_resync'});return;}
            data=expandTurnPacket(data,game.networkFrame);
        }
        const n=game.width*game.height;
        if(!data.players||!data.terrain||data.terrain.length!==n||data.owner?.length!==n||data.army?.length!==n){
            if(clientToHostConn?.open&&performance.now()-(game.resyncRequestedAt||-10000)>1000){game.resyncRequestedAt=performance.now();clientToHostConn.send({type:'state_resync'});}
            return;
        }
        game.networkFrame=frameFromPacket(data);
    }
    if (data.type === 'room_lobby_sync') {
        clearTimeout(peerSetupTimer);setPeerSetupBusy(false,'已加入房間');
        activeRoomRawData = data.roomData;
        enterRoomLobbyUI();
        applyRoomConfigToLobbyUI(activeRoomRawData.config);
        renderRoomSlotsUI();
    } else if (data.type === 'match_start') {
        clearTimeout(peerSetupTimer);setPeerSetupBusy(false,'已加入對局');
        const myIdx = data.players.findIndex(p => p.uid === localPlayerUid);
        if(myIdx<0)showToast('已以觀戰者身分加入對局','sky');
        initMatchSession('online_client', data.config, data.players, data.mapData, myIdx);
        if(data.turn){game.turn=data.turn;game.replayHistory=[];recordReplaySnapshot();updateHudAndLeaderboard();}
        game.networkFrame=captureFrame();
    } else if (data.type === 'turn_sync') {
        if(replayState.active){
            game.livePacket=data;appendReplayFrame(game.networkFrame);
            const ack=data.executedMeta?.[localPlayerUid]||0;
            game.moveQueue=game.moveQueue.filter(a=>a.seq>ack);return;
        }
        game.turn = data.turn;
        if(data.extra)game.extra=structuredClone(data.extra);
        game.terrain = new Uint8Array(data.terrain);
        game.owner = new Int8Array(data.owner);
        game.army = new Int32Array(data.army);
        if(data.portalTarget)game.portalTarget=new Int32Array(data.portalTarget);
        if(data.portalPairId)game.portalPairId=new Int8Array(data.portalPairId);
        if (data.players) game.players = data.players;

        // Remove all moves up to the sequence number already executed by host
        const execSeq = (data.executedMeta && data.executedMeta[localPlayerUid]) ? data.executedMeta[localPlayerUid] : 0;
        if (execSeq > 0) {
            while (game.moveQueue.length > 0 && game.moveQueue[0].seq <= execSeq) {
                game.moveQueue.shift();
            }
        }

        updateQueueUI();
        updateRelocateButtonUI();
        appendReplayFrame(game.networkFrame);
        updateHudAndLeaderboard();
        checkVictoryCondition();
    }
}

function syncNextMoveToOnlineHostIfNeeded() {
    if(game.isSpectator)return;
    if(game.extra&&game.myPlayerIndex>=0){game.extra.viewSelection=game.extra.viewSelection||{};game.extra.viewSelection[game.myPlayerIndex]=game.selectedTile;}
    if (game.mode !== 'online_client' || !clientToHostConn || !clientToHostConn.open) return;
    clientToHostConn.send({
        type: 'player_queue_sync',
        uid: localPlayerUid,
        focus: mistFocus(game.myPlayerIndex),
        selection: game.selectedTile,
        queue: game.moveQueue
    });
}

function broadcastHostTurnState(executedMeta){
    const latest=game.replayHistory.at(-1),frame=latest?.turn===game.turn?latest:captureFrame();
    const connections=Object.values(hostClientConns).filter(c=>c?.open);
    if(connections.length){const packet=createTurnPacket(frame,game.netHostFrame,executedMeta);connections.forEach(c=>c.send(packet));}
    game.netHostFrame=frame;
}

function enterRoomLobbyUI() {
    document.getElementById('onlineEntrySubView').classList.add('hidden');
    document.getElementById('onlineActiveRoomSubView').classList.remove('hidden');
    document.getElementById('lblActiveRoomCode').textContent = activeRoomCode || '----';
    document.getElementById('hostRoomControlsRow').classList.toggle('hidden', !isRoomHost);
    document.getElementById('btnHostStartOnlineMatch').classList.toggle('hidden', !isRoomHost);
    setConfigInputsDisabled(!isRoomHost);
    renderRoomSlotsUI();
}

function leaveOnlineRoom() {
    peerSetupToken++;clearTimeout(peerSetupTimer);setPeerSetupBusy(false);
    resetLatency();
    if (peerInstance) {
        peerInstance.destroy();
        peerInstance = null;
    }
    activeRoomCode = null;
    activeRoomRawData = null;
    isRoomHost = false;
    hostClientConns = {};
    clientToHostConn = null;
    setConfigInputsDisabled(false);
    document.getElementById('onlineActiveRoomSubView').classList.add('hidden');
    document.getElementById('onlineEntrySubView').classList.remove('hidden');
    renderLatency();
}

function broadcastRoomLobbyState() {
    if (!isRoomHost || !activeRoomRawData) return;
    const msg = { type: 'room_lobby_sync', roomData: activeRoomRawData };
    Object.values(hostClientConns).forEach(conn => {
        if (conn && conn.open) conn.send(msg);
    });
}

function syncRoomConfigIfHost() {
    if (isRoomHost && activeRoomRawData) {
        activeRoomRawData.config = { ...config };
        broadcastRoomLobbyState();
    }
}

function onCommanderProfileChange() {
    const myName = (document.getElementById('inpPlayerName').value || 'Commander').trim();
    if (!activeRoomRawData) return;

    if (isRoomHost) {
        const me = activeRoomRawData.slots.find(s => s.uid === localPlayerUid);
        if (me) {
            me.name = myName;
            me.colorIdx = config.myColorIdx;
        }
        broadcastRoomLobbyState();
        renderRoomSlotsUI();
    } else if (clientToHostConn && clientToHostConn.open) {
        clientToHostConn.send({
            type: 'profile_update',
            uid: localPlayerUid,
            name: myName,
            colorIdx: config.myColorIdx
        });
    }
}

function renderRoomSlotsUI() {
    const container = document.getElementById('roomSlotsContainer');
    if (!container || !activeRoomRawData) return;
    renderSpectatorLobby();
    container.innerHTML = '';

    document.getElementById('lblRoomSlotCount').textContent = `玩家 ${roomPlayers().length}/8 · 觀戰 ${activeRoomRawData.slots.filter(s=>s.isSpectator).length}`;
    const isTeam = !!activeRoomRawData.config.teamMode;

    activeRoomRawData.slots.forEach((sl, idx) => {
        const col = PLAYER_COLORS[sl.colorIdx % PLAYER_COLORS.length];
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800 text-xs';

        const canCycleTeam = isTeam && (isRoomHost || sl.uid === localPlayerUid);
        const teamBtnHtml = isTeam && !sl.isSpectator
            ? `<button onclick="cycleSlotTeam(${idx})" ${!canCycleTeam ? 'disabled' : ''} class="px-2 py-0.5 rounded bg-purple-950 border border-purple-700/60 text-purple-300 text-[10px] font-bold mr-1.5">${TEAM_LABELS[sl.team % 4]}</button>`
            : '';

        row.innerHTML = `
            <div class="flex items-center gap-2 truncate">
                <span class="w-3.5 h-3.5 rounded flex-shrink-0 border border-white/40" style="background:${col.hex}"></span>
                ${teamBtnHtml}
                <span class="font-bold text-white truncate">${sl.name}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded ${sl.isBot ? 'bg-slate-800 text-slate-400' : 'bg-emerald-950 text-emerald-300'}">${sl.isSpectator ? (sl.isHost?'房主／觀戰':'觀戰者') : sl.isBot ? 'AI' : (sl.isHost ? '房主' : '玩家')}</span>
            </div>
        `;
        container.appendChild(row);
    });
}

function cycleSlotTeam(slotIdx) {
    if (!activeRoomRawData) return;
    const sl = activeRoomRawData.slots[slotIdx];
    if (!sl) return;
    const nextTeam = ((sl.team || 0) + 1) % 4;
    if (isRoomHost) {
        sl.team = nextTeam;
        broadcastRoomLobbyState();
        renderRoomSlotsUI();
    } else if (sl.uid === localPlayerUid && clientToHostConn?.open) {
        clientToHostConn.send({
            type: 'profile_update',
            uid: localPlayerUid,
            team: nextTeam
        });
    }
}

function hostAddBotToRoom() {
    if (!isRoomHost || !activeRoomRawData || roomPlayers().length >= 8 || game.isRunning) return;
    const botNum = activeRoomRawData.slots.filter(s => s.isBot).length + 1;
    activeRoomRawData.slots.push({
        uid: 'bot_' + Date.now() + '_' + botNum,
        name: `AI 指揮官 #${botNum}`,
        colorIdx: activeRoomRawData.slots.length % PLAYER_COLORS.length,
        team: activeRoomRawData.slots.length % 2,
        isBot: true,
        isHost: false
    });
    broadcastRoomLobbyState();
    renderRoomSlotsUI();
}

function hostRemoveBotFromRoom() {
    if (!isRoomHost || !activeRoomRawData) return;
    for (let i = activeRoomRawData.slots.length - 1; i >= 0; i--) {
        if (activeRoomRawData.slots[i].isBot) {
            activeRoomRawData.slots.splice(i, 1);
            break;
        }
    }
    broadcastRoomLobbyState();
    renderRoomSlotsUI();
}

function applyRoomConfigToLobbyUI(rcfg) {
    if (!rcfg) return;
    config.rules=normalizeRules(rcfg.rules);renderRuleControls();
    config.width = rcfg.width;
    config.height = rcfg.height;
    config.mountainDensity = rcfg.mountainDensity;
    config.mountainStyle = rcfg.mountainStyle || 'random';
    document.getElementById('inpMountainStyle').value = config.mountainStyle;
    config.cityDensity = rcfg.cityDensity;
    config.portalPairs = rcfg.portalPairs || 0;
    config.lavaDensity = rcfg.lavaDensity || 0;
    config.speed = rcfg.speed;
    config.visionMode = rcfg.visionMode;
    config.allowRelocate = rcfg.allowRelocate;
    config.teamMode = rcfg.teamMode;

    document.getElementById('inpMapWidth').value = rcfg.width;
    document.getElementById('inpMapHeight').value = rcfg.height;
    document.getElementById('inpMountainDensity').value = rcfg.mountainDensity;
    document.getElementById('inpCityDensity').value = rcfg.cityDensity;
    if (document.getElementById('inpPortalPairs')) document.getElementById('inpPortalPairs').value = config.portalPairs;
    if (document.getElementById('inpLavaDensity')) document.getElementById('inpLavaDensity').value = config.lavaDensity;
    document.getElementById('chkAllowRelocate').checked = !!rcfg.allowRelocate;

    document.getElementById('lblMapWidth').textContent = `${rcfg.width} 格`;
    document.getElementById('lblMapHeight').textContent = `${rcfg.height} 格`;
    document.getElementById('lblMountainDensity').textContent = `${rcfg.mountainDensity}%`;
    document.getElementById('lblCityDensity').textContent = `${rcfg.cityDensity.toFixed(1)}%`;
    const lblPortal = document.getElementById('lblPortalPairs');
    if (lblPortal) lblPortal.textContent = config.portalPairs > 0 ? `${config.portalPairs} 對` : '關閉 (0 對)';
    const lblLava = document.getElementById('lblLavaDensity');
    if (lblLava) lblLava.textContent = config.lavaDensity > 0 ? `${config.lavaDensity}%` : '關閉 (0%)';
    document.getElementById('lblGameSpeed').textContent = `${rcfg.speed}x`;
}

function hostStartMultiplayerMatch() {
    if (!isRoomHost || !activeRoomRawData) return;
    if (game.isRunning)return;
    if (roomPlayers().length < 2) {
        showToast('至少需要 2 名參與者（玩家或 AI）才能開局！', 'rose');
        return;
    }

    const rcfg = activeRoomRawData.config;
    const players = roomPlayers().map((sl, idx) => ({
        index: idx,
        uid: sl.uid,
        name: sl.name,
        colorIdx: sl.colorIdx,
        team: sl.team || 0,
        isBot: !!sl.isBot,
        alive: true,
        generalIndex: -1,
        relocateLeft: rcfg.allowRelocate ? 1 : 0
    }));

    const mapData = generateBalancedMap(
        rcfg.width,
        rcfg.height,
        rcfg.mountainDensity,
        rcfg.cityDensity,
        players,
        rcfg.teamMode,
        rcfg.portalPairs || 0,
        rcfg.lavaDensity || 0,
        rcfg.mountainStyle || 'random'
    );

    prepareExtendedMap(mapData,players,rcfg);
    const startPayload = {
        type: 'match_start',
        config: rcfg,
        players: players,
        mapData: {
            extra: mapData.extra,
            terrain: Array.from(mapData.terrain),
            owner: Array.from(mapData.owner),
            army: Array.from(mapData.army),
            portalTarget: Array.from(mapData.portalTarget),
            portalPairId: Array.from(mapData.portalPairId)
        }
    };

    Object.values(hostClientConns).forEach(conn => {
        if (conn && conn.open) conn.send(startPayload);
    });

    const myIdx = players.findIndex(p => p.uid === localPlayerUid);
    initMatchSession('online_host', rcfg, players, mapData, myIdx);
}

function copyRoomInviteLink() {
    if (!activeRoomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${activeRoomCode}`;
    const temp = document.createElement('textarea');
    temp.value = url;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    temp.remove();
    showToast(`已複製房間 #${activeRoomCode} 邀請連結！`, 'emerald');
}
// Each endpoint times its own ping; wall-clock synchronization is unnecessary.
let latencySamples = new WeakMap();
let latencySequence = 0;
function resetLatency() {
    latencySamples = new WeakMap();
    renderLatency();
}
function latencyConnections() {
    return isRoomHost ? Object.values(hostClientConns).filter(c=>c?.open) : (clientToHostConn?.open ? [clientToHostConn] : []);
}
function handleLatencyPacket(conn, data) {
    if(data.type==='latency_ping') {
if(conn?.open) conn.send({type:'latency_pong',id:data.id});
return true;
    }
    if(data.type==='latency_pong') {
const sample=latencySamples.get(conn);
if(sample && sample.pending===data.id) {
    sample.rtt=Math.round(performance.now()-sample.sent);
    sample.received=performance.now();
    sample.pending=null;
    renderLatency();
}
return true;
    }
    return false;
}
function sampleLatency() {
    for(const conn of latencyConnections()) {
let sample=latencySamples.get(conn);
if(!sample) { sample={pending:null,rtt:null,received:0}; latencySamples.set(conn,sample); }
if(sample.pending!==null && performance.now()-sample.sent<6000) continue;
sample.pending=++latencySequence;
sample.sent=performance.now();
conn.send({type:'latency_ping',id:sample.pending});
    }
    renderLatency();
}
function renderLatency() {
    const conns=latencyConnections();
    const samples=conns.map(c=>latencySamples.get(c));
    const fresh=samples.filter(s=>s?.rtt!==null && s?.rtt!==undefined && performance.now()-s.received<6000);
    let label=!activeRoomCode ? '尚未連線' : isRoomHost ? '房主 · 等待玩家連線' : '連線中斷';
    if(conns.length) label=fresh.length!==conns.length ? 'RTT · 測量中／逾時' : `${isRoomHost ? '最高 ' : ''}RTT ${Math.max(...fresh.map(s=>s.rtt))} ms`;
    const lobby=document.getElementById('lobbyLatency');
    if(lobby) lobby.textContent=label;
    const hud=document.getElementById('hudLatency');
    if(hud) hud.textContent=replayState.active ? '回放 · 無即時延遲' : game.mode==='single' ? '單機 · 無網路延遲' : label;
}








let lastConnectionError=null;
function showConnectionError(error,stage){
 const type=error?.type||'unknown';
 const advice={network:'請確認網路可用，暫停 VPN／代理後重試；若多人同時失敗，可能是房間服務暫時異常。','socket-error':'房間服務的 WebSocket 連線失敗；可換網路或檢查防火牆是否阻擋。',timeout:'房間服務連線逾時，可換網路或稍後重試。','handshake-timeout':'已連上房主，但未收到房間資料。請確認房主網頁未休眠，雙方都使用同一新版。','peer-unavailable':'請確認四位房號正確、房主尚未關閉網頁，且雙方使用同一新版。','browser-incompatible':'請使用支援 WebRTC 的 Chrome、Edge 或 Firefox。','join-rejected':error?.message||'房主拒絕加入，請重新確認加入身分。'};
 const message=advice[type]||(type==='library-unavailable'?error.message:peerErrorMessage(error));
 lastConnectionError={stage,type,message,detail:String(error?.message||''),version:'2.10.0',time:new Date().toISOString(),online:navigator.onLine,protocol:location.protocol};
 let panel=document.getElementById('connectionErrorPanel');if(!panel){panel=document.createElement('div');panel.id='connectionErrorPanel';panel.setAttribute('role','alert');panel.style.cssText='padding:12px;border:1px solid #be405d;border-radius:10px;background:#301627;color:#fecdd3;font-size:12px;line-height:1.6';document.getElementById('onlineEntrySubView').append(panel);}
 panel.replaceChildren();const title=document.createElement('strong');title.textContent=stage+'失敗 ['+type+']';const text=document.createElement('p');text.textContent=message;const copy=document.createElement('button');copy.className='expansion-btn';copy.textContent='複製錯誤資訊';copy.onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(lastConnectionError,null,2));showToast('錯誤資訊已複製','sky');}catch{const detail=document.createElement('textarea');detail.value=JSON.stringify(lastConnectionError,null,2);detail.style.width='100%';panel.append(detail);detail.select();}};panel.append(title,text,copy);showToast(stage+'失敗 ['+type+']：'+message,'rose');
}




