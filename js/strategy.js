'use strict';

// Long-range plans are not subject to the local tactical candidate budget.
// Targets are learned through the same visibility mask as the player's own view.
function strategicCommanderAction(playerIdx,movable,visibility,level){
 if(level.depth<2||!movable.length)return null;
 game.strategyMemory=game.strategyMemory||{};
 const memory=game.strategyMemory[playerIdx]||(game.strategyMemory[playerIdx]={known:{},target:-1,explore:-1});
 for(let i=0;i<game.terrain.length;i++)if(visibility[i]&&game.terrain[i]===TILE_GENERAL&&game.owner[i]>=0&&!arePlayersAllied(playerIdx,game.owner[i]))memory.known[i]=game.owner[i];
 for(const [index,owner] of Object.entries(memory.known))if(!game.players[owner]?.alive||(visibility[index]&&(game.terrain[index]!==TILE_GENERAL||game.owner[index]!==owner)))delete memory.known[index];
 const capitals=playerCapitals(playerIdx),largest=movable.reduce((best,i)=>game.army[i]>game.army[best]?i:best,movable[0]);
 let target=-1,defending=false;
 // Intercept or reinforce a threatened capital before continuing a distant attack.
 for(const capital of capitals){
  const threats=squareArea(capital,11).filter(i=>visibility[i]&&game.owner[i]>=0&&!arePlayersAllied(playerIdx,game.owner[i])&&game.army[i]>game.army[capital]&&tileDistance(i,capital)<=5);
  if(threats.length){target=capital;defending=true;break;}
 }
 if(target<0){
  const known=Object.keys(memory.known).map(Number);
  if(known.includes(memory.target))target=memory.target;
  else if(known.length)target=known.reduce((best,i)=>tileDistance(largest,i)+(visibility[i]?game.army[i]*.2:0)<tileDistance(largest,best)+(visibility[best]?game.army[best]*.2:0)?i:best,known[0]);
 }
 if(target<0){
  if(game.turn<35&&game.army[largest]<30)return null;
  if(memory.explore>=0&&!visibility[memory.explore])target=memory.explore;
  else {
   let score=-Infinity;
   for(let i=playerIdx%17;i<game.terrain.length;i+=17)if(!visibility[i]&&game.terrain[i]!==TILE_MOUNTAIN){
    const value=tileDistance(largest,i);if(value>score){score=value;target=i;}
   }
   memory.explore=target;
  }
 }
 if(target<0)return null;
 memory.target=defending?memory.target:target;
 const topology=game.topologyVersion||0;
 if(!memory.route||memory.routeTarget!==target||memory.topology!==topology||game.turn-(memory.plannedAt||0)>=12){
  memory.route=buildStrategicRoute(target,playerIdx,game.army[largest],visibility);
  memory.routeTarget=target;memory.topology=topology;memory.plannedAt=game.turn;
 }
 const {distance,next}=memory.route;let best=null,bestScore=-Infinity;
 for(const from of movable){
  if(from===target||distance[from]<1)continue;
  const to=next[from],route=to>=0?resolveTransit(from,to):null;if(!route)continue;
  const dest=route.to,isCapital=game.terrain[from]===TILE_GENERAL;
  const enemy=visibility[dest]&&game.owner[dest]!==playerIdx&&!arePlayersAllied(playerIdx,game.owner[dest]);
  const lethal=enemy&&game.terrain[dest]===TILE_GENERAL&&game.army[from]-1-route.loss>game.army[dest];
  const half=isCapital&&!lethal;
  const moving=(half?Math.floor(game.army[from]/2):game.army[from]-1)-route.loss;
  if(moving<2||(enemy&&moving<=game.army[dest]))continue;
  // Large rear armies follow the same target route and merge into the forward stack.
  const score=moving*.45-distance[from]+(enemy?35:0)+(lethal?10000:0)+(defending?25:0);
  if(score>bestScore){bestScore=score;best={type:'move',from,to,isHalf:half};}
 }
 if(!best&&memory.explore===target&&distance[largest]<0)memory.explore=-1;
 return best;
}
function buildStrategicRoute(target,playerIdx,largestArmy,visibility){
 const n=game.terrain.length,distance=new Int16Array(n).fill(-1),next=new Int32Array(n).fill(-1),queue=new Int32Array(n);let head=0,tail=0;
 let reverse=game.reverseNavigation?.version===game.topologyVersion?game.reverseNavigation.edges:null;
 if(!reverse){reverse=new Map();
 for(let i=0;i<n;i++)if(game.terrain[i]===TILE_PORTAL)for(const [dx,dy] of DIRECTIONS){
  const from=neighborIndex(i,-dx,-dy);
  if(from<0||[TILE_PORTAL,TILE_MOUNTAIN].includes(game.terrain[from]))continue;
  const route=resolveTransit(from,i);if(route){if(!reverse.has(route.to))reverse.set(route.to,[]);reverse.get(route.to).push({from,to:i});}
 }
 game.reverseNavigation={version:game.topologyVersion,edges:reverse};
 }
 distance[target]=0;queue[tail++]=target;
 const visit=(from,to,current)=>{
  if(from<0||distance[from]>=0||[TILE_MOUNTAIN,TILE_PORTAL].includes(game.terrain[from]))return;
  if(visibility[from]&&game.owner[from]<0&&game.army[from]>=largestArmy&&from!==target)return;
  distance[from]=distance[current]+1;next[from]=to;queue[tail++]=from;
 };
 while(head<tail){const current=queue[head++];for(const [dx,dy] of DIRECTIONS)visit(neighborIndex(current,dx,dy),current,current);for(const edge of reverse.get(current)||[])visit(edge.from,edge.to,current);}
 return {distance,next};
}
