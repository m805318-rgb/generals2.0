'use strict';

// ============================================================================
// ONLINE MULTIPLAYER ENGINE (ZERO-CONFIG WEBRTC PEERJS FOR GITHUB PAGES)
// ============================================================================
function getPeerRoomId(code) {
    return `generals-io-tw-terrain-rates-v15-${code.toUpperCase()}`;
}

function createOnlineRoom() {
    if (typeof Peer === 'undefined') {
        showToast('P2P 連線元件載入中，請稍候重試', 'rose');
        return;
    }
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const peerId = getPeerRoomId(code);

    if (peerInstance) peerInstance.destroy();
    peerInstance = new Peer(peerId);

    peerInstance.on('open', () => {
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

    peerInstance.on('connection', (conn) => {
        conn.on('data', (data) => handleHostReceivedPeerData(conn, data));
        conn.on('close', () => {
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

    peerInstance.on('error', () => {
        showToast('房間建立失敗或房號衝突，請重試', 'rose');
    });
}

function joinOnlineRoom() {
    const rawCode = (document.getElementById('inpJoinRoomCode').value || '').trim().toUpperCase();
    if (!rawCode) {
        showToast('請輸入 4 位數房間號碼', 'rose');
        return;
    }
    if (typeof Peer === 'undefined') {
        showToast('P2P 連線元件未就緒', 'rose');
        return;
    }

    if (peerInstance) peerInstance.destroy();
    peerInstance = new Peer();

    peerInstance.on('open', () => {
        const conn = peerInstance.connect(getPeerRoomId(rawCode), { reliable: true });
        clientToHostConn = conn;

        conn.on('open', () => {
            activeRoomCode = rawCode;
            isRoomHost = false;
            const myName = (document.getElementById('inpPlayerName').value || 'Commander').trim();
            conn.send({
                type: 'join_request',
                uid: localPlayerUid,
                name: myName,
                colorIdx: config.myColorIdx,
                isSpectator: config.myRole==='spectator'
            });
        });

        conn.on('data', (data) => handleClientReceivedPeerData(data));
        conn.on('close', () => {
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
    if(data.type==='join_rejected'){showToast(data.message,'rose');leaveOnlineRoom();return;}
    if (data.type === 'action_rejected') { showToast(data.message, 'rose'); return; }
    if(data.type==='turn_sync'){
        if(data.delta){
            if(!game.networkFrame||data.baseTurn!==game.networkFrame.turn){if(clientToHostConn?.open)clientToHostConn.send({type:'state_resync'});return;}
            data=expandTurnPacket(data,game.networkFrame);
        }
        game.networkFrame=frameFromPacket(data);
    }
    if (data.type === 'room_lobby_sync') {
        activeRoomRawData = data.roomData;
        enterRoomLobbyUI();
        applyRoomConfigToLobbyUI(activeRoomRawData.config);
        renderRoomSlotsUI();
    } else if (data.type === 'match_start') {
        const myIdx = data.players.findIndex(p => p.uid === localPlayerUid);
        initMatchSession('online_client', data.config, data.players, data.mapData, myIdx);
        if(data.turn){game.turn=data.turn;game.replayHistory=[];recordReplaySnapshot();updateHudAndLeaderboard();}
        game.networkFrame=captureFrame();
    } else if (data.type === 'turn_sync') {
        if(replayState.active){
            game.livePacket=data;game.replayHistory.push(frameFromPacket(data));
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
        recordReplaySnapshot();
        updateHudAndLeaderboard();
        checkVictoryCondition();
    }
}

function syncNextMoveToOnlineHostIfNeeded() {
    if(game.isSpectator)return;
    if (game.mode !== 'online_client' || !clientToHostConn || !clientToHostConn.open) return;
    clientToHostConn.send({
        type: 'player_queue_sync',
        uid: localPlayerUid,
        focus: mistFocus(game.myPlayerIndex),
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






