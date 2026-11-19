'use strict';

// ============================================================================
// CONSTANTS, PALETTE, GLOBAL STATE & CANVAS INITIALIZATION
// ============================================================================
const TILE_EMPTY = 0;
const TILE_MOUNTAIN = 1;
const TILE_CITY = 2;
const TILE_GENERAL = 3;
const TILE_LAVA = 4;
const TILE_PORTAL = 5;

const PORTAL_PAIR_COLORS = [
    '#e879f9', // Fuchsia
    '#38bdf8', // Sky
    '#a3e635', // Lime
    '#fb923c', // Orange
    '#f43f5e', // Rose
    '#2dd4bf'  // Teal
];

const PLAYER_COLORS = [
    { name: '翠綠', hex: '#059669', border: '#34d399' },
    { name: '赤紅', hex: '#dc2626', border: '#f87171' },
    { name: '寶藍', hex: '#2563eb', border: '#60a5fa' },
    { name: '亮黃', hex: '#ca8a04', border: '#facc15' },
    { name: '羅蘭紫', hex: '#7c3aed', border: '#c084fc' },
    { name: '青色', hex: '#0891b2', border: '#22d3ee' },
    { name: '烈焰橘', hex: '#ea580c', border: '#fb923c' },
    { name: '桃粉', hex: '#db2777', border: '#f472b6' },
    { name: '螢光綠', hex: '#4d7c0f', border: '#a3e635' },
    { name: '深海藍', hex: '#1e40af', border: '#93c5fd' },
    { name: '暗酒紅', hex: '#881337', border: '#fda4af' },
    { name: '亮洋紅', hex: '#c026d3', border: '#f0abfc' }
];

const TEAM_LABELS = ['A隊', 'B隊', 'C隊', 'D隊'];

const canvas = document.getElementById('gameCanvas');
let ctx = canvas.getContext('2d');

// Camera pan & zoom state
const camera = {
    x: 0,
    y: 0,
    zoom: 1.0,
    baseTileSize: 38,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    camStartX: 0,
    camStartY: 0,
    pointerMovedDist: 0
};

// Replay viewer state
const replayState = {
    active: false,
    playing: false,
    frameIndex: 0,
    speed: 1,
    timer: null,
    currentRecord: null
};

// Lobby Configuration state
const config = {
    width: 80,
    height: 80,
    mountainDensity: 18,
    mountainStyle: 'random',
    cityDensity: 4.0,
    portalPairs: 0,
    lavaDensity: 0,
    speed: 1,
    botCount: 3,
    visionMode: 'standard', // 'standard' | 'blind' | 'full'
    allowRelocate: true,
    teamMode: false,
    myColorIdx: 0
};

// Active Game state
const game = {
    mode: 'lobby', // 'lobby' | 'single' | 'online_host' | 'online_client'
    isRunning: false,
    isPaused: false,
    turn: 1,
    turnTimer: null,
    width: 80,
    height: 80,
    allowRelocate: true,
    teamMode: false,
    visionMode: 'standard',
    players: [],
    myPlayerIndex: 0,
    terrain: new Uint8Array(0),
    owner: new Int8Array(0),
    army: new Int32Array(0),
    portalTarget: new Int32Array(0),
    portalPairId: new Int8Array(0),
    selectedTile: -1,
    split50Mode: false,
    relocateTargetingMode: false,
    moveQueue: [],
    botMemory: {},
    replayHistory: [],
    savedReplays: []
};

// Online Multiplayer (PeerJS WebRTC) state
const localPlayerUid = 'u_' + Math.random().toString(36).substring(2, 10);
let peerInstance = null;
let hostClientConns = {};
let clientToHostConn = null;
let activeRoomCode = null;
let isRoomHost = false;
let activeRoomRawData = null;
let pendingOnlineQueues = {};
let clientMoveSeq = 0;

// Drift-compensated turn loop state
let turnLoopIntervalMs = 500;
let nextTurnExpectedTime = 0;
