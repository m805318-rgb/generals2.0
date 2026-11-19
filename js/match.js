'use strict';

// ============================================================================
// MATCH INITIALIZATION & HUD UPDATES
// ============================================================================
function startLocalGame() {
    updateConfigLabels();
    const watching=config.myRole==='spectator';
    if(watching&&config.botCount<2){showToast('觀戰對局至少需要 2 名 AI','rose');return;}
    const myName = (document.getElementById('inpPlayerName').value || 'Commander').trim();
    const usedColors = new Set([config.myColorIdx]);

    const players = watching ? [] : [{
        index: 0,
        uid: localPlayerUid,
        name: myName,
        colorIdx: config.myColorIdx,
        team: 0,
        isBot: false,
        alive: true,
        generalIndex: -1,
        relocateLeft: config.allowRelocate ? 1 : 0
    }];

    for (let b = 1; b <= config.botCount; b++) {
        let cIdx = b % PLAYER_COLORS.length;
        while (usedColors.has(cIdx)) cIdx = (cIdx + 1) % PLAYER_COLORS.length;
        usedColors.add(cIdx);

        players.push({
            index: players.length,
            uid: 'bot_' + b,
            name: `AI 指揮官 #${b}`,
            colorIdx: cIdx,
            team: config.teamMode ? (b % 2) : b,
            isBot: true,
            alive: true,
            generalIndex: -1,
            relocateLeft: config.allowRelocate ? 1 : 0
        });
    }

    const mapData = generateBalancedMap(
        config.width,
        config.height,
        config.mountainDensity,
        config.cityDensity,
        players,
        config.teamMode,
        config.portalPairs,
        config.lavaDensity,
        config.mountainStyle
    );

    prepareExtendedMap(mapData,players,config);
    initMatchSession('single', config, players, mapData, watching?-1:0);
}

function initMatchSession(mode, matchCfg, players, mapData, myIndex) {
    if (game.turnTimer) clearTimeout(game.turnTimer);
    if (replayState.timer) clearInterval(replayState.timer);
    replayState.active = false;
    replayState.playing = false;

    game.mode = mode;
    game.isRunning = true;
    game.isPaused = false;
    game.turn = 1;
    game.width = matchCfg.width;
    game.height = matchCfg.height;
    game.allowRelocate = !!matchCfg.allowRelocate;
    game.teamMode = !!matchCfg.teamMode;
    game.visionMode = matchCfg.visionMode || 'standard';
    game.players = players;
    game.myPlayerIndex = myIndex;
    game.isSpectator=myIndex<0;
    game.deathPromptShown=false;document.getElementById('eliminatedPrompt')?.remove();
    game.spectatorTarget=-1;
    game.terrain = new Uint8Array(mapData.terrain);
    game.owner = new Int8Array(mapData.owner);
    game.army = new Int32Array(mapData.army);
    game.portalTarget = mapData.portalTarget ? new Int32Array(mapData.portalTarget) : new Int32Array(game.width * game.height).fill(-1);
    game.portalPairId = mapData.portalPairId ? new Int8Array(mapData.portalPairId) : new Int8Array(game.width * game.height).fill(-1);
    game.selectedTile = -1;
    game.split50Mode = false;
    game.relocateTargetingMode = false;
    game.moveQueue = [];
    game.botMemory = {};
    game.replayHistory = [];
    pendingOnlineQueues = {};
    game.executedThrough={};
    game.netHostFrame=null;game.networkFrame=null;
    game.livePacket=null;
    initExpansion(matchCfg,mapData.extra);

    // UI transitions
    document.getElementById('lobbyModal').classList.add('hidden');
    document.getElementById('gameOverModal').classList.add('hidden');
    document.getElementById('replayControllerBar').classList.add('hidden');
    document.getElementById('hudTopLeft').classList.remove('hidden');
    document.getElementById('hudTopRight').classList.remove('hidden');
    document.getElementById('hudBottomBar').classList.remove('hidden');

    // Locked badges
    document.getElementById('hudSpeedBadge').innerHTML = `<i class="fa-solid fa-gauge-high mr-1"></i>速度 ${matchCfg.speed}x`;
    const vName = game.visionMode === 'blind' ? '全黑迷霧' : (game.visionMode === 'full' ? '全圖開放' : '標準模式');
    document.getElementById('hudVisionBadge').innerHTML = `<i class="fa-solid fa-eye mr-1"></i>${vName}`;
    document.getElementById('hudTeamBadge').classList.toggle('hidden', !game.teamMode);
    document.getElementById('btnRelocateCapital').classList.toggle('hidden', !game.allowRelocate);

    updateRelocateButtonUI();
    updateSplit50ButtonUI();
    updateQueueUI();
    recordReplaySnapshot();
    updateHudAndLeaderboard();
    centerCameraOnMyGeneral();

    // Start drift-compensated turn loop if singleplayer or online host
    if (mode === 'single' || mode === 'online_host') {
        turnLoopIntervalMs = Math.max(90, Math.round(500 / (matchCfg.speed || 1)));
        nextTurnExpectedTime = performance.now() + turnLoopIntervalMs;
        game.lastTickAt=performance.now();
        scheduleNextTurnTick();
    }
}

function scheduleNextTurnTick() {
    if (game.turnTimer) clearTimeout(game.turnTimer);
    if (!game.isRunning) return;

    const now = performance.now();
    const delay = Math.max(8, nextTurnExpectedTime - now);

    game.turnTimer = setTimeout(() => {
        if (!game.isRunning) return;
        const tickNow = performance.now();
        const dt = tickNow - (game.lastTickAt || (tickNow-turnLoopIntervalMs));
        game.lastTickAt=tickNow;
        // Prevent spiral of death if tab was backgrounded, otherwise keep exact cadence
        if (tickNow - nextTurnExpectedTime > turnLoopIntervalMs * 2.5) {
            nextTurnExpectedTime = tickNow + turnLoopIntervalMs;
        } else {
            nextTurnExpectedTime += turnLoopIntervalMs;
        }
        advanceGameTurn(dt);
        scheduleNextTurnTick();
    }, delay);
}

function updateHudAndLeaderboard() {
    updateSpectatorUI();
    renderLatency();
    updateExpansionHud();
    const turnEl = document.getElementById('hudTurnText');
    if (turnEl) turnEl.textContent = `Turn ${game.turn}`;

    const rem = 25 - (game.turn % 25);
    const cycleTxt = document.getElementById('hudLandCycleText');
    const cycleBar = document.getElementById('hudLandProgressBar');
    if (cycleTxt) cycleTxt.textContent = `${rem} 回合後`;
    if (cycleBar) cycleBar.style.width = `${Math.max(4, ((25 - rem) / 25) * 100)}%`;

    // Show City Header only in Replay mode
    const cityHeader = document.getElementById('lbHeaderCities');
    if (cityHeader) cityHeader.classList.toggle('hidden', !replayState.active);

    const stats = game.players.map(p => ({
        player: p,
        army: 0,
        land: 0,
        cities: 0
    }));

    const total = game.width * game.height;
    for (let i = 0; i < total; i++) {
        const own = game.owner[i];
        if (own >= 0 && stats[own]) {
            stats[own].army += game.army[i];
            if (game.terrain[i] !== TILE_LAVA && game.terrain[i] !== TILE_PORTAL) {
                stats[own].land += 1;
            }
            if (isChurch(game.terrain[i]) || game.terrain[i] === TILE_GENERAL) {
                stats[own].cities += 1;
            }
        }
    }

    stats.sort((a, b) => b.army - a.army);

    const lbBody = document.getElementById('leaderboardBody');
    if (!lbBody) return;
    lbBody.innerHTML = '';

    stats.forEach(st => {
        const p = st.player;
        const col = PLAYER_COLORS[p.colorIdx % PLAYER_COLORS.length];
        const row = document.createElement('div');
        row.className = `px-3 py-1.5 flex items-center justify-between ${!p.alive ? 'opacity-40 line-through' : ''}`;

        const teamTag = game.teamMode ? `<span class="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] text-purple-300 font-bold mr-1">${TEAM_LABELS[p.team]||('軍閥 '+p.team)}</span>` : '';
        const cityColHtml = replayState.active ? `<span class="w-8 text-right text-amber-300 font-bold">${st.cities}</span>` : '';

        row.innerHTML = `
            <div class="flex items-center gap-2 truncate pr-2">
                <span class="w-3 h-3 rounded-sm flex-shrink-0 border border-white/40" style="background:${col.hex}"></span>
                ${teamTag}
                <span class="font-bold text-white truncate">${p.name} <small>♛${playerCapitals(p.index).length}</small></span>
            </div>
            <div class="flex items-center gap-3 mono font-semibold">
                <span class="w-12 text-right text-emerald-300">${st.army}</span>
                <span class="w-10 text-right text-slate-300">${st.land}</span>
                ${cityColHtml}
            </div>
        `;
        lbBody.appendChild(row);
    });
}
