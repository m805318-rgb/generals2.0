'use strict';

// ============================================================================
// PLAYER CONTROLS, 50% SPLIT, CAPITAL RELOCATION & MOVE QUEUE
// ============================================================================
function handleTileClick(tileIdx) {
    if (!game.isRunning || replayState.active) return;
    const total = game.width * game.height;
    if (tileIdx < 0 || tileIdx >= total) return;

    if(game.bombMode&&game.selectedTile>=0){queueBomb(tileIdx);return;}
    if(game.isSpectator){game.selectedTile=tileIdx;updateExpansionHud();return;}
    // Check if in Capital Relocation mode
    if (game.relocateTargetingMode) {
        if (game.owner[tileIdx] === game.myPlayerIndex && game.terrain[tileIdx] === TILE_CITY) {
            // Host checks again at execution time; never disclose hidden enemy positions here.
            const error = getRelocationError(game.myPlayerIndex, tileIdx, true);
            if (error) { showToast(error, 'rose'); return; }
            clearMoveQueue();
            clientMoveSeq += 1;
            game.moveQueue.push({
                seq: clientMoveSeq,
                type: 'relocate',
                targetIndex: tileIdx
            });
            game.relocateTargetingMode = false;
            updateRelocateButtonUI();
            updateQueueUI();
            syncNextMoveToOnlineHostIfNeeded();
            showToast('已排入遷都指令，將於下一回合生效', 'amber');
        } else {
            showToast('請點擊一座您已經佔領的城市來遷都！', 'rose');
        }
        return;
    }

    // Clicking the currently selected tile toggles 50% split mode!
    if (game.selectedTile === tileIdx) {
        toggleSplit50Mode();
        return;
    }

    // If a tile is already selected and user clicks an orthogonal neighbor, queue move!
    if (game.selectedTile >= 0) {
        const sx = game.selectedTile % game.width;
        const sy = Math.floor(game.selectedTile / game.width);
        const tx = tileIdx % game.width;
        const ty = Math.floor(tileIdx / game.width);
        const direction=moveDirection(game.selectedTile,tileIdx);
        if(direction){
            if(canBomb(game.selectedTile,tileIdx)&&game.terrain[tileIdx]===TILE_MOUNTAIN){queueBomb(tileIdx);return;}
            queueMoveDirection(...direction);
            return;
        }
    }

    // Otherwise select the clicked tile
    game.selectedTile = tileIdx;
    if(game.owner[tileIdx]===game.myPlayerIndex)game.extra.focus[game.myPlayerIndex]=tileIdx;
    syncNextMoveToOnlineHostIfNeeded();
    updateExpansionHud();
    game.split50Mode = false;
    updateSplit50ButtonUI();
}

function queueMoveDirection(dx, dy) {
    if(!canCommand())return;
    if (!game.isRunning || replayState.active) return;
    if (game.selectedTile < 0) return;

    const w = game.width, h = game.height;
    const sx = game.selectedTile % w;
    const sy = Math.floor(game.selectedTile / w);
    const targetIdx=neighborIndex(game.selectedTile,dx,dy);
    if(targetIdx<0)return;
    if(canBomb(game.selectedTile,targetIdx)&&game.terrain[targetIdx]===TILE_MOUNTAIN){queueBomb(targetIdx);return;}
    if (game.terrain[targetIdx] === TILE_MOUNTAIN) return;

    let nextSelectedTile = targetIdx;
    if (game.terrain[targetIdx]===TILE_PORTAL) {
        const exitIdx = resolvePortalDestination(game.selectedTile, targetIdx);
        if (exitIdx < 0) {
            showToast('通道出口受阻，無法通行！', 'rose');
            return;
        }
        nextSelectedTile = exitIdx;
    }

    const isHalf = game.split50Mode;
    if(!game.moveQueue.length&&game.owner[game.selectedTile]===game.myPlayerIndex)game.extra.focus[game.myPlayerIndex]=game.selectedTile;
    clientMoveSeq += 1;
    game.moveQueue.push({
        seq: clientMoveSeq,
        type: 'move',
        from: game.selectedTile,
        to: targetIdx,
        isHalf: isHalf
    });

    game.selectedTile = nextSelectedTile;
    game.split50Mode = false;
    updateSplit50ButtonUI();
    updateQueueUI();
    syncNextMoveToOnlineHostIfNeeded();
}

function toggleSplit50Mode() {
    if(!canCommand())return;
    game.split50Mode = !game.split50Mode;
    updateSplit50ButtonUI();
}

function updateSplit50ButtonUI() {
    const btn = document.getElementById('btnSplit50');
    const badge = document.getElementById('badgeSplitState');
    if (!btn || !badge) return;
    if (game.split50Mode) {
        btn.className = 'px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold transition flex items-center gap-1.5 border border-amber-400 shadow-lg';
        badge.textContent = '50%';
        badge.className = 'ml-1 px-1.5 py-0.5 rounded bg-amber-950 text-[10px] text-amber-300 mono';
    } else {
        btn.className = 'px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700';
        badge.textContent = 'OFF';
        badge.className = 'ml-1 px-1.5 py-0.5 rounded bg-slate-900 text-[10px] text-slate-400 mono';
    }
}

function toggleRelocateCapitalMode() {
    if(!canCommand())return;
    if (!game.isRunning || replayState.active || !game.allowRelocate) return;
    const me = game.players[game.myPlayerIndex];
    if (!me || me.relocateLeft <= 0) {
        showToast('本局遷都次數已用完！', 'rose');
        return;
    }
    game.relocateTargetingMode = !game.relocateTargetingMode;
    updateRelocateButtonUI();
    if (game.relocateTargetingMode) {
        showToast('選擇己方城市；兩地 2 格內不可有敵軍，舊主城駐軍將全數損失', 'amber');
    }
}

function updateRelocateButtonUI() {
    const btn = document.getElementById('btnRelocateCapital');
    const lbl = document.getElementById('lblRelocateBtn');
    if (!btn || !lbl) return;
    const me = game.players[game.myPlayerIndex];
    const left = me ? me.relocateLeft : 0;
    lbl.textContent = game.relocateTargetingMode ? '點擊己方城市確認遷都 (取消)' : `遷都 (M: 剩 ${left} 次)`;
    btn.disabled = (left <= 0);
    btn.classList.toggle('opacity-40', left <= 0);
    btn.classList.toggle('ring-2', game.relocateTargetingMode);
    btn.classList.toggle('ring-amber-400', game.relocateTargetingMode);
}

function popLastQueuedMove() {
    if (game.moveQueue.length > 0) {
        const popped = game.moveQueue.pop();
        if (popped.type === 'move') {
            game.selectedTile = popped.from;
        }
        updateQueueUI();
        syncNextMoveToOnlineHostIfNeeded();
    }
}

function clearMoveQueue() {
    game.moveQueue = [];
    updateQueueUI();
    syncNextMoveToOnlineHostIfNeeded();
}

function updateQueueUI() {
    const badge = document.getElementById('badgeQueueCount');
    if (badge) badge.textContent = String(game.moveQueue.length);
}

function togglePauseGame() {
    if (game.mode !== 'single') {
        showToast('線上多人對戰無法單方面暫停', 'amber');
        return;
    }
    game.isPaused = !game.isPaused;
    if (!game.isPaused) {
        nextTurnExpectedTime = performance.now() + turnLoopIntervalMs;
    }
    const btn = document.getElementById('btnPauseGame');
    if (btn) {
        btn.innerHTML = game.isPaused
            ? '<i class="fa-solid fa-play text-emerald-400"></i> 繼續'
            : '<i class="fa-solid fa-pause"></i> 暫停';
    }
}

function exitMatchToLobby() {
    if (game.turnTimer) clearTimeout(game.turnTimer);
    if (replayState.timer) clearInterval(replayState.timer);
    game.isRunning = false;
    replayState.active = false;
    document.getElementById('hudTopLeft').classList.add('hidden');
    document.getElementById('hudTopRight').classList.add('hidden');
    document.getElementById('hudBottomBar').classList.add('hidden');
    document.getElementById('replayControllerBar').classList.add('hidden');
    document.getElementById('gameOverModal').classList.add('hidden');
    document.getElementById('lobbyModal').classList.remove('hidden');
}

function returnToLobbyFromGameOver() {
    exitMatchToLobby();
}
