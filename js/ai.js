'use strict';

// Compatibility entry point; all active commanders now share expansion-aware rules.
function computeSmartBotMove(playerIdx){return commanderAction(playerIdx);}

function getPassableNeighbors(index){
 return DIRECTIONS.map(d=>neighborIndex(index,...d)).filter(to=>to>=0&&resolveTransit(index,to));
}

function findShortestStepBFS(start,goal,playerIdx,preferOwnLand=false){
 if(start===goal)return -1;
 const visited=new Uint8Array(game.terrain.length),first=new Int32Array(game.terrain.length).fill(-1),queue=[start];
 visited[start]=1;
 for(let head=0;head<queue.length;head++){
  const current=queue[head];if(current===goal)return first[current];
  const neighbors=getPassableNeighbors(current);
  if(preferOwnLand)neighbors.sort((a,b)=>(game.owner[b]===playerIdx?game.army[b]:-1)-(game.owner[a]===playerIdx?game.army[a]:-1));
  for(const raw of neighbors){
   const route=resolveTransit(current,raw),to=route.to;if(visited[to])continue;
   if(to!==goal&&game.owner[to]<0&&game.army[to]>0)continue;
   visited[to]=1;first[to]=current===start?raw:first[current];queue.push(to);
  }
 }
 return -1;
}
