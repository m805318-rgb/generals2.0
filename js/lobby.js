'use strict';

// ============================================================================
// TOAST & UI HELPERS
// ============================================================================
function showToast(message, color = 'emerald') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    const colorMap = {
        emerald: 'bg-emerald-950/95 border-emerald-500/60 text-emerald-200',
        amber: 'bg-amber-950/95 border-amber-500/60 text-amber-200',
        rose: 'bg-rose-950/95 border-rose-500/60 text-rose-200',
        sky: 'bg-sky-950/95 border-sky-500/60 text-sky-200'
    };
    el.className = `px-4 py-2 rounded-xl border text-xs font-bold shadow-2xl transition-all duration-300 ${colorMap[color] || colorMap.emerald}`;
    el.textContent = message;
    container.appendChild(el);
    while(container.children.length>4)container.firstElementChild.remove();
    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    }, 2600);
}

function renderColorPicker() {
    const grid = document.getElementById('colorPickerGrid');
    if (!grid) return;
    grid.innerHTML = '';
    PLAYER_COLORS.forEach((col, idx) => {
        const btn = document.createElement('button');
        const selected = (idx === config.myColorIdx);
        btn.className = `h-7 rounded-lg border-2 transition transform ${selected ? 'scale-110 border-white ring-2 ring-emerald-400/60' : 'border-slate-800 opacity-80 hover:opacity-100'}`;
        btn.style.backgroundColor = col.hex;
        btn.title = col.name;
        btn.onclick = () => selectMyColor(idx);
        grid.appendChild(btn);
    });
    const lbl = document.getElementById('lblSelectedColorName');
    if (lbl) lbl.textContent = PLAYER_COLORS[config.myColorIdx].name;
}

function selectMyColor(idx) {
    config.myColorIdx = idx;
    renderColorPicker();
    onCommanderProfileChange();
}

function switchLobbyTab(tab) {
    document.getElementById('panelSingleMode').classList.toggle('hidden', tab !== 'single');
    document.getElementById('panelOnlineMode').classList.toggle('hidden', tab !== 'online');
    document.getElementById('panelReplayMode').classList.toggle('hidden', tab !== 'replays');

    document.getElementById('tabBtnSingle').className = `px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${tab === 'single' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`;
    document.getElementById('tabBtnOnline').className = `px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${tab === 'online' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`;
    document.getElementById('tabBtnReplay').className = `px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${tab === 'replays' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`;

    if (tab === 'replays') renderSavedReplaysList();
}

function updateConfigLabels() {
    config.width = parseInt(document.getElementById('inpMapWidth').value, 10) || 80;
    config.height = parseInt(document.getElementById('inpMapHeight').value, 10) || 80;
    config.mountainDensity = parseInt(document.getElementById('inpMountainDensity').value, 10) || 0;
    config.mountainStyle = document.getElementById('inpMountainStyle').value;
    config.cityDensity = parseFloat(document.getElementById('inpCityDensity').value) || 0;
    config.portalPairs = parseInt(document.getElementById('inpPortalPairs')?.value || '0', 10) || 0;
    config.lavaDensity = parseInt(document.getElementById('inpLavaDensity')?.value || '0', 10) || 0;
    config.botCount = parseInt(document.getElementById('inpBotCount').value, 10) || 1;
    config.allowRelocate = !!document.getElementById('chkAllowRelocate').checked;

    document.getElementById('lblMapWidth').textContent = `${config.width} 格`;
    document.getElementById('lblMapHeight').textContent = `${config.height} 格`;
    document.getElementById('lblMountainDensity').textContent = `${config.mountainDensity}%`;
    document.getElementById('lblCityDensity').textContent = `${config.cityDensity.toFixed(1)}%`;
    const lblPortal = document.getElementById('lblPortalPairs');
    if (lblPortal) lblPortal.textContent = config.portalPairs > 0 ? `${config.portalPairs} 對` : '關閉 (0 對)';
    const lblLava = document.getElementById('lblLavaDensity');
    if (lblLava) lblLava.textContent = config.lavaDensity > 0 ? `${config.lavaDensity}%` : '關閉 (0%)';
    document.getElementById('lblBotCount').textContent = `${config.botCount} 名 AI`;

    syncRoomConfigIfHost();
}

function setLobbySpeed(spd) {
    config.speed = spd;
    document.getElementById('lblGameSpeed').textContent = `${spd}x`;
    document.querySelectorAll('.speed-opt-btn').forEach(btn => {
        const active = parseFloat(btn.dataset.speed) === spd;
        btn.className = `speed-opt-btn py-1.5 rounded-lg text-xs font-bold mono transition ${active ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`;
    });
    syncRoomConfigIfHost();
}

function setLobbyVisionMode(vmode) {
    config.visionMode = vmode;
    document.querySelectorAll('.vmode-opt-btn').forEach(btn => {
        const active = btn.dataset.vmode === vmode;
        btn.className = `vmode-opt-btn py-1.5 rounded-lg text-xs font-bold transition ${active ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`;
    });
    syncRoomConfigIfHost();
}

function setLobbyTeamMode(isTeam) {
    config.teamMode = !!isTeam;
    document.getElementById('btnTeamFFA').className = `px-2.5 py-1 rounded text-xs font-bold transition ${!config.teamMode ? 'bg-emerald-600 text-white' : 'text-slate-400'}`;
    document.getElementById('btnTeamAlliance').className = `px-2.5 py-1 rounded text-xs font-bold transition ${config.teamMode ? 'bg-purple-600 text-white' : 'text-slate-400'}`;
    syncRoomConfigIfHost();
    if (activeRoomRawData) renderRoomSlotsUI();
}

function setConfigInputsDisabled(disabled) {
    document.querySelectorAll('[data-rule], #presetSelect').forEach(el=>el.disabled=disabled);
    ['inpMapWidth', 'inpMapHeight', 'inpMountainDensity', 'inpMountainStyle', 'inpCityDensity', 'inpPortalPairs', 'inpLavaDensity', 'inpBotCount', 'chkAllowRelocate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = disabled;
    });
    document.querySelectorAll('.speed-opt-btn, .vmode-opt-btn').forEach(btn => {
        btn.disabled = disabled;
    });
}

function resetDefaultSettings() {
    if (activeRoomCode && !isRoomHost) return;
    config.rules=normalizeRules();renderRuleControls();
    document.getElementById('inpMapWidth').value = 80;
    document.getElementById('inpMapHeight').value = 80;
    document.getElementById('inpMountainDensity').value = 18;
    document.getElementById('inpMountainStyle').value = 'random';
    document.getElementById('inpCityDensity').value = 4;
    if (document.getElementById('inpPortalPairs')) document.getElementById('inpPortalPairs').value = 0;
    if (document.getElementById('inpLavaDensity')) document.getElementById('inpLavaDensity').value = 0;
    document.getElementById('inpBotCount').value = 3;
    document.getElementById('chkAllowRelocate').checked = true;
    setLobbySpeed(1);
    setLobbyVisionMode('standard');
    setLobbyTeamMode(false);
    updateConfigLabels();
}
