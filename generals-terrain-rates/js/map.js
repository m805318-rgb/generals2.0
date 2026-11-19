'use strict';

// ============================================================================
// BALANCED MAP GENERATOR (WITH BFS CONNECTIVITY, PORTALS & LAVA)
// ============================================================================
// Rank cells by a spatial field, then fill to the requested density.
// Randomness varies orientation, phase, block centers and prefab rotations.
function placeMountains(terrain, w, h, count, style) {
    const angle = Math.random() * Math.PI;
    const phase = Math.random() * Math.PI * 2;
    const period = 5 + Math.random() * 6;
    const seeds = Array.from({length: Math.max(3, Math.ceil(w * h / 100))}, () => ({
        x: Math.random() * w, y: Math.random() * h, scale: 0.7 + Math.random()
    }));
    const templates = [
        ['110000','110000','111100','001100','000000','000000'],
        ['001100','001100','111100','110000','110000','000000'],
        ['000000','011110','010010','010000','011100','000000'],
        ['000000','001100','011110','011110','001100','000000'],
        ['100000','110000','011000','001100','000110','000011']
    ];
    const cols = Math.ceil(w / 6);
    const plates = Array.from({length: cols * Math.ceil(h / 6)}, () => ({
        cells: templates[Math.floor(Math.random() * templates.length)],
        rotation: Math.floor(Math.random() * 4), flip: Math.random() < 0.5,
        weight: Math.random() * 0.15
    }));
    const cells = [];
    for (let i = 0; i < terrain.length; i++) {
        if (terrain[i] !== TILE_EMPTY) continue;
        const x = i % w, y = Math.floor(i / w);
        let score = Math.random();
        if (style === 'stripes') {
            const along = x * Math.cos(angle) + y * Math.sin(angle);
            const across = -x * Math.sin(angle) + y * Math.cos(angle);
            score = Math.cos(along * Math.PI * 2 / period + phase + Math.sin(across / 7) * 0.7) + score * 0.15;
        } else if (style === 'blocks') {
            score = -Math.min(...seeds.map(s => Math.max(Math.abs(x-s.x), Math.abs(y-s.y)) / s.scale)) + score * 0.3;
        } else if (style === 'plates') {
            const plate = plates[Math.floor(y / 6) * cols + Math.floor(x / 6)];
            let px = x % 6, py = y % 6;
            if (plate.flip) px = 5-px;
            for(let r=0;r<plate.rotation;r++) [px,py]=[5-py,px];
            score = Number(plate.cells[py][px]) * 2 + plate.weight + score * 0.08;
        }
        cells.push({i,score});
    }
    cells.sort((a,b) => b.score-a.score);
    for(let n=0;n<Math.min(count,cells.length);n++) terrain[cells[n].i]=TILE_MOUNTAIN;
}

function connectGeneralCorridors(w, terrain, generals) {
    for (let n=1;n<generals.length;n++) {
        let x=generals[n-1]%w, y=Math.floor(generals[n-1]/w);
        const tx=generals[n]%w, ty=Math.floor(generals[n]/w);
        while(x!==tx || y!==ty) {
            if(x!==tx) x+=Math.sign(tx-x); else y+=Math.sign(ty-y);
            const i=y*w+x;
            if(terrain[i]===TILE_MOUNTAIN) terrain[i]=TILE_EMPTY;
        }
    }
}

function verifyGeneralsConnected(w, h, terrain, generalIndices) {
    if (generalIndices.length <= 1) return true;
    const total = w * h;
    const visited = new Uint8Array(total);
    const queue = [generalIndices[0]];
    visited[generalIndices[0]] = 1;
    let head = 0;

    while (head < queue.length) {
        const curr = queue[head++];
        const cx = curr % w, cy = Math.floor(curr / w);
        const nbs = [];
        if (cx > 0) nbs.push(curr - 1);
        if (cx < w - 1) nbs.push(curr + 1);
        if (cy > 0) nbs.push(curr - w);
        if (cy < h - 1) nbs.push(curr + w);

        for (const nb of nbs) {
            if (!visited[nb] && terrain[nb] !== TILE_MOUNTAIN) {
                visited[nb] = 1;
                queue.push(nb);
            }
        }
    }

    for (const gIdx of generalIndices) {
        if (!visited[gIdx]) return false;
    }
    return true;
}

function generateBalancedMap(w, h, mountainPct, cityPct, players, isTeamMode, portalPairsCount = 0, lavaPct = 0, mountainStyle = 'random') {
    const total = w * h;
    const terrain = new Uint8Array(total);
    const owner = new Int8Array(total).fill(-1);
    const army = new Int32Array(total);
    const portalTarget = new Int32Array(total).fill(-1);
    const portalPairId = new Int8Array(total).fill(-1);

    for (let attempt = 0; attempt < 25; attempt++) {
        terrain.fill(TILE_EMPTY);
        owner.fill(-1);
        army.fill(0);
        portalTarget.fill(-1);
        portalPairId.fill(-1);

        // 1. Place Generals (Farthest-point sampling for enemies, moderate proximity for teammates)
        const placedGenerals = [];
        const idealTeamMin = Math.max(4, Math.floor((w + h) * 0.12));
        const idealTeamMax = Math.max(7, Math.floor((w + h) * 0.28));

        for (let pIdx = 0; pIdx < players.length; pIdx++) {
            const pl = players[pIdx];
            let bestIdx = -1;
            let bestScore = -999999;

            for (let c = 0; c < 120; c++) {
                const rx = 1 + Math.floor(Math.random() * (w - 2));
                const ry = 1 + Math.floor(Math.random() * (h - 2));
                const cand = ry * w + rx;
                if (terrain[cand] !== TILE_EMPTY) continue;

                if (placedGenerals.length === 0) {
                    bestIdx = cand;
                    break;
                }

                let minEnemyDist = 999999;
                let minAlliedDist = 999999;
                let tooClose = false;

                for (const pg of placedGenerals) {
                    const gx = pg.idx % w, gy = Math.floor(pg.idx / w);
                    const d = Math.abs(rx - gx) + Math.abs(ry - gy);
                    if (d < 4) { tooClose = true; break; }
                    if (isTeamMode && pg.team === pl.team) {
                        if (d < minAlliedDist) minAlliedDist = d;
                    } else {
                        if (d < minEnemyDist) minEnemyDist = d;
                    }
                }
                if (tooClose) continue;

                let score = minEnemyDist * 2.5;
                if (isTeamMode && minAlliedDist < 999999) {
                    if (minAlliedDist >= idealTeamMin && minAlliedDist <= idealTeamMax) {
                        score += 60;
                    } else {
                        score -= Math.abs(minAlliedDist - idealTeamMin) * 3.5;
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestIdx = cand;
                }
            }

            if (bestIdx === -1) {
                bestIdx = Math.floor(Math.random() * total);
            }

            terrain[bestIdx] = TILE_GENERAL;
            owner[bestIdx] = pIdx;
            army[bestIdx] = 1;
            pl.generalIndex = bestIdx;
            placedGenerals.push({ idx: bestIdx, team: pl.team });
        }

        // 2. Place Mountains & Cities
        const numMountains = Math.floor(total * (mountainPct / 100));
        const numCities = Math.floor(total * (cityPct / 100));

        placeMountains(terrain, w, h, numMountains, mountainStyle);
        let guard = 0;

        let cPlaced = 0;
        guard = 0;
        while (cPlaced < numCities && guard < total * 4) {
            guard++;
            const idx = Math.floor(Math.random() * total);
            if (terrain[idx] !== TILE_EMPTY) continue;
            terrain[idx] = TILE_CITY;
            army[idx] = 40 + Math.floor(Math.random() * 11);
            cPlaced++;
        }

        // 2b. Place Paired Portals (if enabled, away from map outer edges so exit in any direction is valid)
        let pPlaced = 0;
        guard = 0;
        while (pPlaced < portalPairsCount && guard < total * 4) {
            guard++;
            const ax = 1 + Math.floor(Math.random() * Math.max(1, w - 2));
            const ay = 1 + Math.floor(Math.random() * Math.max(1, h - 2));
            const bx = 1 + Math.floor(Math.random() * Math.max(1, w - 2));
            const by = 1 + Math.floor(Math.random() * Math.max(1, h - 2));
            const idxA = ay * w + ax;
            const idxB = by * w + bx;
            if (idxA === idxB) continue;
            if (Math.abs(ax - bx) + Math.abs(ay - by) < 5) continue;
            if (terrain[idxA] !== TILE_EMPTY || terrain[idxB] !== TILE_EMPTY) continue;

            terrain[idxA] = TILE_PORTAL;
            terrain[idxB] = TILE_PORTAL;
            portalTarget[idxA] = idxB;
            portalTarget[idxB] = idxA;
            portalPairId[idxA] = pPlaced;
            portalPairId[idxB] = pPlaced;

            const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            for (const [dx, dy] of dirs) {
                const nA = (ay + dy) * w + (ax + dx);
                const nB = (by + dy) * w + (bx + dx);
                if (terrain[nA] === TILE_MOUNTAIN) terrain[nA] = TILE_EMPTY;
                if (terrain[nB] === TILE_MOUNTAIN) terrain[nB] = TILE_EMPTY;
            }
            pPlaced++;
        }

        // 2c. Place Lava tiles (if enabled)
        const numLava = Math.floor(total * (lavaPct / 100));
        let lPlaced = 0;
        guard = 0;
        while (lPlaced < numLava && guard < total * 4) {
            guard++;
            const idx = Math.floor(Math.random() * total);
            if (terrain[idx] !== TILE_EMPTY) continue;
            terrain[idx] = TILE_LAVA;
            lPlaced++;
        }

        // Ensure each General has at least 2 passable adjacent tiles
        for (const pg of placedGenerals) {
            const gx = pg.idx % w, gy = Math.floor(pg.idx / w);
            const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            for (let i = 0; i < 2; i++) {
                const [dx, dy] = dirs[i];
                const nx = gx + dx, ny = gy + dy;
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                    const nIdx = ny * w + nx;
                    if (terrain[nIdx] === TILE_MOUNTAIN || terrain[nIdx] === TILE_LAVA) {
                        terrain[nIdx] = TILE_EMPTY;
                    }
                }
            }
        }

        if (verifyGeneralsConnected(w, h, terrain, placedGenerals.map(g => g.idx))) {
            return { terrain, owner, army, portalTarget, portalPairId };
        }
    }
    // A dense preset must never strand a capital after the retry limit.
    connectGeneralCorridors(w, terrain, players.map(p => p.generalIndex));
    return { terrain, owner, army, portalTarget, portalPairId };
}
