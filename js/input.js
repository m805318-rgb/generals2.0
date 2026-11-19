'use strict';

// ============================================================================
// MOUSE, TOUCH & KEYBOARD EVENT LISTENERS
// ============================================================================
canvas.addEventListener('mousedown', (e) => {
    camera.isDragging = true;
    camera.dragStartX = e.clientX;
    camera.dragStartY = e.clientY;
    camera.camStartX = camera.x;
    camera.camStartY = camera.y;
    camera.pointerMovedDist = 0;
});

window.addEventListener('mousemove', (e) => {
    if (!camera.isDragging) return;
    const dx = e.clientX - camera.dragStartX;
    const dy = e.clientY - camera.dragStartY;
    camera.pointerMovedDist = Math.hypot(dx, dy);
    if (camera.pointerMovedDist > 5&&!camera.locked) {
        camera.x = camera.camStartX + dx;
        camera.y = camera.camStartY + dy;
    }
});

window.addEventListener('mouseup', (e) => {
    if (!camera.isDragging) return;
    camera.isDragging = false;
    if (camera.pointerMovedDist <= 6 && e.target === canvas) {
        const ts = camera.baseTileSize * camera.zoom;
        const col = Math.floor((e.clientX - camera.x) / ts);
        const row = Math.floor((e.clientY - camera.y) / ts);
        if (col >= 0 && col < game.width && row >= 0 && row < game.height) {
            handleTileClick(row * game.width + col);
        } else { handleBorderClick(col,row); }
    }
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 1/1.12;
    const newZoom = Math.max(0.28, Math.min(2.6, camera.zoom * zoomFactor));
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    camera.x = mouseX - (mouseX - camera.x) * (newZoom / camera.zoom);
    camera.y = mouseY - (mouseY - camera.y) * (newZoom / camera.zoom);
    camera.zoom = newZoom;
}, { passive: false });

window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (!game.isRunning) return;

    const key = e.key.toLowerCase();
    if (key === 'w' || e.key === 'ArrowUp') { e.preventDefault(); queueMoveDirection(0, -1); }
    else if (key === 's' || e.key === 'ArrowDown') { e.preventDefault(); queueMoveDirection(0, 1); }
    else if (key === 'a' || e.key === 'ArrowLeft') { e.preventDefault(); queueMoveDirection(-1, 0); }
    else if (key === 'd' || e.key === 'ArrowRight') { e.preventDefault(); queueMoveDirection(1, 0); }
    else if (key === 'z') { e.preventDefault(); toggleSplit50Mode(); }
    else if (key === 'h') { e.preventDefault(); centerCameraOnMyGeneral(); }
    else if (key === 'c'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey) { e.preventDefault(); toggleCameraLock(); }
    else if (key === 'b') { e.preventDefault(); queueRecruit(); }
    else if (key === 'x') { e.preventDefault(); toggleBombMode(); }
    else if (key === 'm') { e.preventDefault(); toggleRelocateCapitalMode(); }
    else if (key === ' ') { e.preventDefault(); togglePauseGame(); }
});

window.addEventListener('resize', resizeCanvas);

window.onload = function () {
    initRuleControls();
    resizeCanvas();
    setInterval(sampleLatency, 2000);
    sampleLatency();
    renderColorPicker();
    updateConfigLabels();
    requestAnimationFrame(renderGameLoop);

    // Auto-fill room code if URL contains ?room=XXXX
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
        switchLobbyTab('online');
        document.getElementById('inpJoinRoomCode').value = roomParam;
    }
};


