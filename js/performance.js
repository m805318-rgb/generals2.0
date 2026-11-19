'use strict';

// O(map size) distance field replaces repeated goal filtering/sorting for every move.
function frontierDistances(playerIdx,visibility,depth){
 const n=game.terrain.length,dist=new Int16Array(n).fill(-1),queue=new Int32Array(n);let head=0,tail=0;
 for(let i=0;i<n;i++)if(visibility[i]&&game.owner[i]!==playerIdx&&!arePlayersAllied(playerIdx,game.owner[i])&&![TILE_MOUNTAIN,TILE_PORTAL].includes(game.terrain[i])){dist[i]=0;queue[tail++]=i;}
 while(head<tail){const i=queue[head++];if(dist[i]>=depth)continue;
  for(const [dx,dy] of DIRECTIONS){const j=neighborIndex(i,dx,dy);if(j>=0&&dist[j]<0&&![TILE_MOUNTAIN,TILE_PORTAL].includes(game.terrain[j])){dist[j]=dist[i]+1;queue[tail++]=j;}}
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

let sceneCanvas=document.createElement('canvas'),stageCanvas=document.createElement('canvas');
let sceneKey='',sceneMask=null,hadEffects=false,renderErrorAt=-Infinity;
const sceneRefs=new WeakMap();let sceneRefSequence=0;
function sceneRef(value){if(!sceneRefs.has(value))sceneRefs.set(value,++sceneRefSequence);return sceneRefs.get(value);}
function renderGameLoop(){
 requestAnimationFrame(renderGameLoop);
 try{
  updateCameraTracking();
  const key=[canvas.width,canvas.height,camera.x,camera.y,camera.zoom,sceneRef(game.terrain),sceneRef(game.owner),sceneRef(game.army),game.turn,game.extra?.elapsedMs,game.extra?.eventLog?.length,game.visionMode,replayState.active,displayViewer(),game.selectedTile,game.extra?.focus?.[displayViewer()],game.extra?.viewSelection?.[displayViewer()],game.split50Mode,game.relocateTargetingMode,game.moveQueue.length,game.moveQueue.at(-1)?.seq,game.visualRevision||0].join(':');
  const dirty=key!==sceneKey;
  if(dirty){
   if(stageCanvas.width!==canvas.width||stageCanvas.height!==canvas.height){stageCanvas.width=canvas.width;stageCanvas.height=canvas.height;}
   const screen=ctx,mask=computeVisibilityMask(displayViewer(),true);ctx=stageCanvas.getContext('2d');
   try{drawGameScene(mask);}finally{ctx=screen;}
   const previous=sceneCanvas;sceneCanvas=stageCanvas;stageCanvas=previous;sceneMask=mask;sceneKey=key;
  }
  const effects=activeDisasterEffects();
  if(dirty||effects.length||hadEffects){ctx.drawImage(sceneCanvas,0,0);if(effects.length)drawDisasterEffects(ctx,effects,sceneMask);drawMistFringe(ctx);}
  hadEffects=effects.length>0;
 }catch(error){
  sceneKey='';stageCanvas.width=canvas.width;stageCanvas.height=canvas.height;
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  if(sceneCanvas.width&&sceneCanvas.height)ctx.drawImage(sceneCanvas,0,0);
  if(performance.now()-renderErrorAt>5000){renderErrorAt=performance.now();console.warn('Frame recovered:',error);}
 }
}

document.fonts?.ready.then(()=>game.visualRevision=(game.visualRevision||0)+1);


