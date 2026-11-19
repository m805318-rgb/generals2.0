'use strict';

// ============================================================================
// REPLAY RECORDING, VIEWER & JSON IMPORT/EXPORT
// ============================================================================
function captureFrame() {
 return {turn:game.turn,terrain:new Uint8Array(game.terrain),owner:new Int8Array(game.owner),army:new Int32Array(game.army),portalTarget:new Int32Array(game.portalTarget),portalPairId:new Int8Array(game.portalPairId),playersAlive:game.players.map(p=>p.alive),players:structuredClone(game.players),extra:snapshotExtra(game.extra),rules:structuredClone(game.rules)};
}
function frameFromPacket(packet){
 return {turn:packet.turn,terrain:new Uint8Array(packet.terrain),owner:new Int8Array(packet.owner),army:new Int32Array(packet.army),portalTarget:new Int32Array(packet.portalTarget||game.portalTarget),portalPairId:new Int8Array(packet.portalPairId||game.portalPairId),playersAlive:packet.players.map(p=>p.alive),players:structuredClone(packet.players),extra:snapshotExtra(packet.extra),rules:structuredClone(packet.rules||game.rules)};
}
function restoreFrame(frame){
 game.turn=frame.turn;game.terrain=new Uint8Array(frame.terrain);game.owner=new Int8Array(frame.owner);game.army=new Int32Array(frame.army);
 if(frame.portalTarget)game.portalTarget=new Int32Array(frame.portalTarget);
 if(frame.portalPairId)game.portalPairId=new Int8Array(frame.portalPairId);
 if(frame.players)game.players=structuredClone(frame.players);
 else if(frame.playersAlive)frame.playersAlive.forEach((v,i)=>{if(game.players[i])game.players[i].alive=v;});
 initExpansion({rules:frame.rules||replayState.currentRecord?.rules||{}},frame.extra);
}
function replayFrameLimit(){return Math.max(180,Math.min(1800,Math.floor(24*1024*1024/(game.width*game.height*24+8192))));}
function appendReplayFrame(frame){
 const history=game.replayHistory;history.push(frame);const limit=replayFrameLimit();
 if(history.length>limit){
  const selected=replayState.currentRecord?.frames===history?history[replayState.frameIndex]:null;
  const recent=Math.floor(limit/2),boundary=history.length-recent;
  const kept=history.filter((_,i)=>i>=boundary||i%2===0);history.splice(0,history.length,...kept);
  game.replaySampled=true;
  if(selected){const exact=history.indexOf(selected);replayState.frameIndex=exact>=0?exact:Math.max(0,history.findIndex(f=>f.turn>=selected.turn));}
 }
 if(replayState.currentRecord?.frames===history)document.getElementById('replayScrubber').max=String(history.length-1);
}
function recordReplaySnapshot(){appendReplayFrame(captureFrame());}

function saveCurrentMatchReplay(title) {
    if (game.replayHistory.length === 0) return;
    /* Saved frames stay typed until export, avoiding a second expanded map copy. */
    const serializedFrames = game.replayHistory.slice();
    const record = {
        id: 'rep_' + Date.now(),
        sampled:!!game.replaySampled,
        title: title || `Turn ${game.turn} 戰役`,
        timestamp: new Date().toLocaleString(),
        width: game.width,
        height: game.height,
        teamMode: game.teamMode,
        rules:structuredClone(game.rules),
        portalTarget: Array.from(game.portalTarget),
        portalPairId: Array.from(game.portalPairId),
        players: JSON.parse(JSON.stringify(game.players)),
        frames: serializedFrames
    };
    game.savedReplays.unshift(record);
    if (game.savedReplays.length > 15) game.savedReplays.pop();
    document.getElementById('lblSavedReplayCount').textContent = String(game.savedReplays.length);
}

function openLiveReplayFromMatch() {
    if(replayState.active)return;
    if (game.replayHistory.length === 0) return;
    replayState.liveBackup={frame:captureFrame(),paused:game.isPaused,visionMode:game.visionMode,memory:game.strategyMemory,topology:game.topologyVersion};
    if (game.mode === 'single') game.isPaused = true;
    const tempRecord = {
        id: 'live',
        title: '當前戰役即時回放',
        width: game.width,
        height: game.height,
        teamMode: game.teamMode,
        rules:structuredClone(game.rules),
        portalTarget: Array.from(game.portalTarget),
        portalPairId: Array.from(game.portalPairId),
        players: JSON.parse(JSON.stringify(game.players)),
        frames: game.replayHistory
    };
    launchReplayViewer(tempRecord);
}

function watchReplayFromGameOver() {
    document.getElementById('gameOverModal').classList.add('hidden');
    if (game.savedReplays.length > 0) {
        launchReplayViewer(game.savedReplays[0]);
    } else {
        openLiveReplayFromMatch();
    }
}

function launchReplayViewer(record) {
    if (!record || !record.frames || record.frames.length === 0) return;
    if (replayState.timer) clearInterval(replayState.timer);

    replayState.active = true;
    replayState.playing = false;
    replayState.frameIndex = 0;
    replayState.currentRecord = record;

    game.width = record.width;
    game.height = record.height;
    game.teamMode = !!record.teamMode;
    game.players = JSON.parse(JSON.stringify(record.players));
    game.portalTarget = record.portalTarget ? new Int32Array(record.portalTarget) : new Int32Array(record.width * record.height).fill(-1);
    game.portalPairId = record.portalPairId ? new Int8Array(record.portalPairId) : new Int8Array(record.width * record.height).fill(-1);

    document.getElementById('lobbyModal').classList.add('hidden');
    document.getElementById('hudBottomBar').classList.add('hidden');
    document.getElementById('hudTopLeft').classList.remove('hidden');
    document.getElementById('hudTopRight').classList.remove('hidden');
    document.getElementById('replayControllerBar').classList.remove('hidden');

    const scrubber = document.getElementById('replayScrubber');
    scrubber.max = String(record.frames.length - 1);
    scrubber.value = '0';

    applyReplayFrame(0);
}

function applyReplayFrame(idx) {
    const rec = replayState.currentRecord;
    if (!rec || !rec.frames[idx]) return;
    replayState.frameIndex = idx;
    const fr = rec.frames[idx];

    restoreFrame(fr);

    document.getElementById('replayScrubber').value = String(idx);
    document.getElementById('replayTurnLabel').textContent = `Turn ${fr.turn} / ${rec.frames[rec.frames.length - 1].turn}`;

    // Calculate total cities on map for Replay badge
    let totalCities = 0, ownedCities = 0;
    const total = game.width * game.height;
    for (let i = 0; i < total; i++) {
        if (isChurch(game.terrain[i]) || game.terrain[i] === TILE_GENERAL) {
            totalCities++;
            if (game.owner[i] >= 0) ownedCities++;
        }
    }
    const cityBadge = document.getElementById('replayCityTotalBadge');
    if (cityBadge) {
        cityBadge.textContent = `全圖城市總數: ${totalCities} (已佔領 ${ownedCities} / 中立 ${totalCities - ownedCities})`;
    }

    updateHudAndLeaderboard();
}

function scrubReplayTo(val) {
    applyReplayFrame(parseInt(val, 10) || 0);
}

function stepReplayFrame(delta) {
    const rec = replayState.currentRecord;
    if (!rec) return;
    const next = Math.max(0, Math.min(rec.frames.length - 1, replayState.frameIndex + delta));
    applyReplayFrame(next);
}

function toggleReplayPlay() {
    replayState.playing = !replayState.playing;
    const btn = document.getElementById('btnReplayPlayPause');
    if (replayState.playing) {
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> 暫停';
        startReplayInterval();
    } else {
        btn.innerHTML = '<i class="fa-solid fa-play"></i> 播放';
        if (replayState.timer) clearInterval(replayState.timer);
    }
}

function startReplayInterval() {
    if (replayState.timer) clearInterval(replayState.timer);
    const ms = Math.max(50, Math.round(350 / replayState.speed));
    replayState.timer = setInterval(() => {
        const rec = replayState.currentRecord;
        if (!rec || replayState.frameIndex >= rec.frames.length - 1) {
            toggleReplayPlay();
            return;
        }
        applyReplayFrame(replayState.frameIndex + 1);
    }, ms);
}

function cycleReplayPlaybackSpeed() {
    const speeds = [1, 2, 4, 8];
    const nextIdx = (speeds.indexOf(replayState.speed) + 1) % speeds.length;
    replayState.speed = speeds[nextIdx];
    document.getElementById('btnReplaySpeed').textContent = `${replayState.speed}x`;
    if (replayState.playing) startReplayInterval();
}

function closeReplayViewer() {
    if (replayState.timer) clearInterval(replayState.timer);
    replayState.active = false;
    replayState.playing = false;
    document.getElementById('replayControllerBar').classList.add('hidden');

    if(game.isRunning&&replayState.liveBackup){
        const backup=replayState.liveBackup;
        restoreFrame(game.livePacket?frameFromPacket(game.livePacket):backup.frame);
        game.strategyMemory=backup.memory||{};game.topologyVersion=backup.topology||game.topologyVersion;
        game.livePacket=null;game.isPaused=backup.paused;game.visionMode=backup.visionMode;game.lastTickAt=performance.now();
        replayState.liveBackup=null;
        document.getElementById('hudBottomBar').classList.toggle('hidden',game.isSpectator);
        updateHudAndLeaderboard();checkVictoryCondition();
    }else exitMatchToLobby();
}

function renderSavedReplaysList() {
    const list = document.getElementById('savedReplaysList');
    if (!list) return;
    if (game.savedReplays.length === 0) {
        list.innerHTML = '<div class="text-center py-6 text-slate-500">尚無保存的戰役回放，完成對戰後將自動記錄於此。</div>';
        return;
    }
    list.innerHTML = '';
    game.savedReplays.forEach((rep, idx) => {
        const item = document.createElement('div');
        item.className = 'bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2';
        item.innerHTML = `
            <div>
                <div class="font-bold text-white text-xs">${rep.title}</div>
                <div class="text-[10px] text-slate-500 mono">${rep.width}x${rep.height}・${rep.frames.length} 個快照${rep.sampled?'（早期抽樣）':''}・${rep.timestamp}</div>
            </div>
            <div class="flex items-center gap-1.5">
                <button onclick="launchReplayViewer(game.savedReplays[${idx}])" class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold">觀看</button>
                <button onclick="exportReplayJson(${idx})" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]">匯出</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function exportReplayJson(idx) {
    const rep = game.savedReplays[idx];
    if (!rep) return;
    const blob = new Blob([JSON.stringify(rep,(_,value)=>ArrayBuffer.isView(value)?Array.from(value):value)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generals-replay-${rep.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importReplayJsonFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const rep = JSON.parse(e.target.result);
            if (rep && Array.isArray(rep.frames)) {
                game.savedReplays.unshift(rep);
                document.getElementById('lblSavedReplayCount').textContent = String(game.savedReplays.length);
                renderSavedReplaysList();
                showToast('回放檔案匯入成功！', 'emerald');
            }
        } catch (err) {
            showToast('無效的回放 JSON 檔案', 'rose');
        }
    };
    reader.readAsText(file);
}


