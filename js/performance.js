'use strict';

// O(map size) distance field replaces repeated goal filtering/sorting for every move.
function frontierDistances(playerIdx,visibility,depth){
 const n=game.terrain.length,dist=new Int16Array(n).fill(-1),queue=new Int32Array(n);let head=0,tail=0;
 for(let i=0;i<n;i++)if(visibility[i]&&game.owner[i]!==playerIdx&&!arePlayersAllied(playerIdx,game.owner[i])&&![TILE_MOUNTAIN,TILE_LAVA,TILE_PORTAL].includes(game.terrain[i])){dist[i]=0;queue[tail++]=i;}
 while(head<tail){const i=queue[head++];if(dist[i]>=depth)continue;
  for(const [dx,dy] of DIRECTIONS){const j=neighborIndex(i,dx,dy);if(j>=0&&dist[j]<0&&![TILE_MOUNTAIN,TILE_LAVA,TILE_PORTAL].includes(game.terrain[j])){dist[j]=dist[i]+1;queue[tail++]=j;}}
 }
 return dist;
}
function limitAICandidates(movable,playerIdx,depth){
 const limit=depth>=6?64:depth>=4?48:depth>=2?32:16;
 if(movable.length<=limit)return movable;
 const half=limit/2,largest=movable.slice().sort((a,b)=>game.army[b]-game.army[a]).slice(0,half);
 game.aiScanCursor=game.aiScanCursor||{};
 const cursor=game.aiScanCursor[playerIdx]||0,result=new Set(largest);
 for(let n=0;result.size<limit&&n<movable.length;n++)result.add(movable[(cursor+n)%movable.length]);
 game.aiScanCursor[playerIdx]=(cursor+half)%movable.length;
 return [...result];
}
const extraSnapshotCache={};
function snapshotExtra(extra){
 if(!extra)return extra;
 const {riverDir,engineers,carts,...metadata}=extra,result=structuredClone(metadata);
 for(const [key,values] of Object.entries({riverDir,engineers,carts})){
  const previous=extraSnapshotCache[key];
  const equal=previous&&previous.length===values.length&&values.every((v,i)=>v===previous[i]);
  result[key]=equal?previous:Array.from(values);extraSnapshotCache[key]=result[key];
 }
 return result;
}

const sceneCanvas=document.createElement('canvas');
let sceneKey='',sceneMask=null,hadEffects=false;
const sceneRefs=new WeakMap();let sceneRefSequence=0;
function sceneRef(value){if(!sceneRefs.has(value))sceneRefs.set(value,++sceneRefSequence);return sceneRefs.get(value);}
function renderGameLoop(){
 const key=[canvas.width,canvas.height,camera.x,camera.y,camera.zoom,sceneRef(game.terrain),sceneRef(game.owner),sceneRef(game.army),game.turn,game.extra?.elapsedMs,game.extra?.eventLog.length,game.visionMode,replayState.active,displayViewer(),game.selectedTile,game.extra?.focus?.[displayViewer()],game.split50Mode,game.relocateTargetingMode,game.moveQueue.length,game.moveQueue.at(-1)?.seq,game.visualRevision||0].join(':');
 const dirty=key!==sceneKey;
 if(dirty){
  if(sceneCanvas.width!==canvas.width||sceneCanvas.height!==canvas.height){sceneCanvas.width=canvas.width;sceneCanvas.height=canvas.height;}
  const screen=ctx;ctx=sceneCanvas.getContext('2d');
  try{drawGameScene();sceneMask=computeVisibilityMask(displayViewer());}finally{ctx=screen;}
  sceneKey=key;
 }
 const effects=activeDisasterEffects();
 if(dirty||effects.length||hadEffects){ctx.drawImage(sceneCanvas,0,0);if(effects.length)drawDisasterEffects(ctx,effects,sceneMask);drawMistFringe(ctx);}
 hadEffects=effects.length>0;
 requestAnimationFrame(renderGameLoop);
}
document.fonts?.ready.then(()=>game.visualRevision=(game.visualRevision||0)+1);

