'use strict';

// ============================================================================
// CAMERA & CANVAS RENDERING (GENERALS.IO VECTOR GRAPHICS + FRUSTUM CULLING)
// ============================================================================
function resizeCanvas() {
    camera.x+=(window.innerWidth-canvas.width)/2;
    camera.y+=(window.innerHeight-canvas.height)/2;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function centerCameraOnMyGeneral() {
    const me = game.players[displayViewer()];
    const ts = camera.baseTileSize * camera.zoom;
    if (me && me.generalIndex >= 0) {
        const gx = me.generalIndex % game.width;
        const gy = Math.floor(me.generalIndex / game.width);
        camera.x = canvas.width / 2 - (gx + 0.5) * ts;
        camera.y = canvas.height / 2 - (gy + 0.5) * ts;
    } else {
        camera.x = (canvas.width - game.width * ts) / 2;
        camera.y = (canvas.height - game.height * ts) / 2;
    }
}

function drawGameScene() {
    const isBlindFog = !(game.isSpectator&&displayViewer()<0) && !replayState.active && !game.extra?.sudden && !(game.extra?.sunUntil>game.extra?.elapsedMs) && (game.visionMode==='blind'||game.extra?.mistUntil>game.extra?.elapsedMs);
    ctx.fillStyle = isBlindFog ? '#000000' : '#070b14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (game.width > 0 && game.height > 0 && game.terrain.length > 0) {
        const ts = camera.baseTileSize * camera.zoom;
        const visMask = computeVisibilityMask(displayViewer());

        // Frustum culling bounds
        const startCol = Math.max(0, Math.floor(-camera.x / ts));
        const endCol = Math.min(game.width - 1, Math.ceil((canvas.width - camera.x) / ts));
        const startRow = Math.max(0, Math.floor(-camera.y / ts));
        const endRow = Math.min(game.height - 1, Math.ceil((canvas.height - camera.y) / ts));

        // Draw outer map border only if NOT in blind fog mode
        if (!isBlindFog) {
            ctx.strokeStyle = 'rgba(71, 85, 105, 0.55)';
            ctx.lineWidth = 2;
            ctx.strokeRect(camera.x - 1, camera.y - 1, game.width * ts + 2, game.height * ts + 2);
        }

        if(!isBlindFog)drawWrapBorder(ctx,ts);
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const idx = r * game.width + c;
                const x = camera.x + c * ts;
                const y = camera.y + r * ts;
                const isVisible = (visMask[idx] === 1);
                const terr = game.terrain[idx];
                const own = game.owner[idx];
                const arm = game.army[idx];

                if (!isVisible && isBlindFog) {
                    // True Blind Fog: completely black outside FOV
                    continue;
                }

                if (isVisible) {
                    // VISIBLE TILE (Classic Generals.io clean grid + custom tactical terrains)
                    if (terr === TILE_PORTAL) {
                        ctx.fillStyle = '#1e1b4b';
                    } else if (terr === TILE_LAVA) {
                        ctx.fillStyle = '#450a0a';
                    } else if (own >= 0 && game.players[own]) {
                        const pCol = PLAYER_COLORS[game.players[own].colorIdx % PLAYER_COLORS.length];
                        ctx.fillStyle = pCol.hex;
                    } else if (terr === TILE_MOUNTAIN) {
                        ctx.fillStyle = '#eee2c6';
                    } else if (terr === TILE_CITY) {
                        ctx.fillStyle = '#475569';
                    } else {
                        ctx.fillStyle = '#263349';
                    }
                    ctx.fillRect(x, y, ts, ts);

                    if (terr === TILE_LAVA && own >= 0 && game.players[own]) {
                        ctx.fillStyle = PLAYER_COLORS[game.players[own].colorIdx % PLAYER_COLORS.length].hex;
                        ctx.globalAlpha = 0.42;
                        ctx.fillRect(x + 2, y + 2, ts - 4, ts - 4);
                        ctx.globalAlpha = 1.0;
                    }

                    ctx.strokeStyle = (own >= 0 && game.players[own] && terr !== TILE_LAVA)
                        ? PLAYER_COLORS[game.players[own].colorIdx % PLAYER_COLORS.length].border
                        : 'rgba(15, 23, 42, 0.55)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1);

                    if (terr === TILE_MOUNTAIN) {
                        drawMountainIcon(ctx, x, y, ts, true);
                    } else if (terr === TILE_CITY) {
                        drawCityIcon(ctx, x, y, ts, own >= 0);
                    } else if (terr === TILE_GENERAL) {
                        drawGeneralIcon(ctx, x, y, ts);
                    } else if (terr === TILE_LAVA) {
                        drawLavaIcon(ctx, x, y, ts, true);
                    } else if (terr === TILE_PORTAL) {
                        drawPortalIcon(ctx, x, y, ts, idx, true);
                    }

                    drawExpansionTile(ctx,x,y,ts,idx);
                    if (terr !== TILE_PORTAL && (arm > 0 || terr === TILE_CITY || terr === TILE_GENERAL)) {
                        drawArmyNumber(ctx, x, y, ts, arm, own >= 0, terr === TILE_CITY || terr === TILE_GENERAL || terr>=TILE_RIVER);
                    }

                    if (game.relocateTargetingMode && own === game.myPlayerIndex && terr === TILE_CITY) {
                        ctx.strokeStyle = '#fbbf24';
                        ctx.lineWidth = Math.max(2, ts * 0.09);
                        ctx.strokeRect(x + 2, y + 2, ts - 4, ts - 4);
                    }
                } else {
                    // FOG OF WAR (Standard Mode Unseen Shadow)
                    ctx.fillStyle = '#090d16';
                    ctx.fillRect(x, y, ts, ts);
                    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, ts, ts);

                    if (terr === TILE_MOUNTAIN || terr === TILE_CITY) {
                        drawMountainIcon(ctx, x, y, ts, false);
                    } else if (terr === TILE_LAVA) {
                        drawLavaIcon(ctx, x, y, ts, false);
                    } else if (terr === TILE_PORTAL) {
                        drawPortalIcon(ctx, x, y, ts, idx, false);
                    }
                }
            }
        }

        // Draw Selected Tile Frame & 50% Badge
        if (game.selectedTile >= 0 && !replayState.active) {
            const sc = game.selectedTile % game.width;
            const sr = Math.floor(game.selectedTile / game.width);
            const sx = camera.x + sc * ts;
            const sy = camera.y + sr * ts;

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(2.5, ts * 0.08);
            ctx.strokeRect(sx + 1.5, sy + 1.5, ts - 3, ts - 3);

            if (game.split50Mode) {
                ctx.fillStyle = '#f59e0b';
                const bw = Math.max(26, ts * 0.72);
                const bh = Math.max(13, ts * 0.34);
                ctx.fillRect(sx + (ts - bw) / 2, sy - bh * 0.55, bw, bh);
                ctx.fillStyle = '#000000';
                ctx.font = `800 ${Math.max(9, Math.floor(ts * 0.24))}px "JetBrains Mono", monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('50%', sx + ts / 2, sy - bh * 0.05);
            }
        }

        // Draw Queued Move Arrows
        if (game.moveQueue.length > 0 && !replayState.active) {
            drawQueuedMoveArrows(ctx, ts);
        }
    }


}

function drawQueuedMoveArrows(ctx, ts) {
    ctx.save();
    for (let i = 0; i < game.moveQueue.length; i++) {
        const mv = game.moveQueue[i];
        if (mv.type !== 'move') continue;
        const fx = (mv.from % game.width) * ts + camera.x + ts / 2;
        const fy = Math.floor(mv.from / game.width) * ts + camera.y + ts / 2;
        const direction=moveDirection(mv.from,mv.to);
        if(!direction)continue;
        const tx=fx+direction[0]*ts;
        const ty=fy+direction[1]*ts;

        const mx = (fx + tx) / 2;
        const my = (fy + ty) / 2;
        const angle = Math.atan2(ty - fy, tx - fx);

        ctx.strokeStyle = mv.isHalf ? '#fbbf24' : 'rgba(255, 255, 255, 0.92)';
        ctx.lineWidth = Math.max(2, ts * 0.08);
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(fx + (tx - fx) * 0.2, fy + (ty - fy) * 0.2);
        ctx.lineTo(tx - (tx - fx) * 0.2, ty - (ty - fy) * 0.2);
        ctx.stroke();

        const headLen = Math.max(5, ts * 0.18);
        ctx.beginPath();
        ctx.moveTo(mx + Math.cos(angle) * headLen * 0.5, my + Math.sin(angle) * headLen * 0.5);
        ctx.lineTo(mx - headLen * Math.cos(angle - Math.PI / 6), my - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(mx + Math.cos(angle) * headLen * 0.5, my + Math.sin(angle) * headLen * 0.5);
        ctx.lineTo(mx - headLen * Math.cos(angle + Math.PI / 6), my - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
    }
    ctx.restore();
}

function drawMountainIcon(ctx, x, y, ts, isVisible) {
    if(isVisible&&tileAssets.mountain?.complete&&tileAssets.mountain.naturalWidth){ctx.drawImage(tileAssets.mountain,x,y,ts,ts);return;}
    ctx.save();
    const pad = ts * 0.16;
    const left = x + pad;
    const right = x + ts - pad;
    const bottom = y + ts - pad * 0.95;
    const top = y + pad * 1.05;
    const midX = x + ts * 0.46;

    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(midX, top);
    ctx.lineTo(x + ts * 0.63, y + ts * 0.48);
    ctx.lineTo(x + ts * 0.74, y + ts * 0.34);
    ctx.lineTo(right, bottom);
    ctx.closePath();

    ctx.fillStyle = isVisible ? '#d6c49d' : 'rgba(15, 23, 42, 0.75)';
    ctx.fill();
    ctx.strokeStyle = isVisible ? '#fff3d7' : 'rgba(100, 116, 139, 0.45)';
    ctx.lineWidth = Math.max(1.2, ts * 0.055);
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(midX, top);
    ctx.lineTo(x + ts * 0.54, bottom);
    ctx.strokeStyle = isVisible ? 'rgba(226, 232, 240, 0.45)' : 'rgba(100, 116, 139, 0.28)';
    ctx.lineWidth = Math.max(1, ts * 0.04);
    ctx.stroke();
    ctx.restore();
}

function drawCityIcon(ctx,x,y,ts,isOwned){ctx.drawImage(tileSprite(TILE_CITY),x,y,ts,ts);}
function drawGeneralIcon(ctx,x,y,ts){ctx.drawImage(tileSprite(TILE_GENERAL),x,y,ts,ts);}

function drawLavaIcon(ctx, x, y, ts, isVisible) {
    ctx.save();
    const cx = x + ts / 2;
    const cy = y + ts / 2;
    ctx.strokeStyle = isVisible ? '#f97316' : '#7c2d12';
    ctx.lineWidth = Math.max(1.5, ts * 0.06);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x + ts * 0.2, y + ts * 0.72);
    ctx.lineTo(cx, y + ts * 0.45);
    ctx.lineTo(x + ts * 0.8, y + ts * 0.68);
    ctx.moveTo(cx, y + ts * 0.45);
    ctx.lineTo(x + ts * 0.55, y + ts * 0.22);
    ctx.stroke();

    if (isVisible && ts >= 22) {
        ctx.fillStyle = 'rgba(251, 146, 60, 0.22)';
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.30, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawPortalIcon(ctx, x, y, ts, idx, isVisible) {
    ctx.save();
    const cx = x + ts / 2;
    const cy = y + ts / 2;
    const pairId = (game.portalPairId && game.portalPairId[idx] >= 0) ? game.portalPairId[idx] : 0;
    const col = PORTAL_PAIR_COLORS[pairId % PORTAL_PAIR_COLORS.length];

    ctx.strokeStyle = isVisible ? col : '#475569';
    ctx.lineWidth = Math.max(2, ts * 0.08);
    ctx.beginPath();
    ctx.arc(cx, cy, ts * 0.34, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = isVisible ? '#ffffff' : '#64748b';
    ctx.lineWidth = Math.max(1.2, ts * 0.045);
    ctx.beginPath();
    ctx.arc(cx, cy, ts * 0.18, 0.4, Math.PI * 1.75);
    ctx.stroke();

    if (isVisible && ts >= 18) {
        const pairChar = String.fromCharCode(65 + (pairId % 26));
        ctx.fillStyle = col;
        ctx.font = `800 ${Math.max(9, Math.floor(ts * 0.28))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pairChar, cx, cy);
    }
    ctx.restore();
}

function drawArmyNumber(ctx, x, y, ts, armyVal, isOwned, hasBuilding = false) {
    if (ts < 14) return;
    ctx.save();
    const str = String(armyVal);
    const fontSize = Math.max(10, Math.floor(ts * (str.length >= 4 ? 0.31 : str.length === 3 ? 0.36 : 0.42)));
    ctx.font = `700 ${fontSize}px "Inter", "JetBrains Mono", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cx = x + ts / 2;
    const cy = y + ts * (hasBuilding ? 0.76 : 0.5);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.lineWidth = Math.max(2, ts * 0.08);
    ctx.strokeText(str, cx, cy);

    ctx.fillStyle = isOwned ? '#ffffff' : '#e2e8f0';
    ctx.fillText(str, cx, cy);
    ctx.restore();
}
