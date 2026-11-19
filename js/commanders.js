'use strict';

const AI_LEVELS={easy:{interval:2,budget:1,depth:1},normal:{interval:1,budget:1,depth:2},hard:{interval:1,budget:2,depth:4},expert:{interval:1,budget:3,depth:6}};
function getAILevel(player){return AI_LEVELS[player.difficulty||game.rules.difficulty]||AI_LEVELS.normal;}
function stepMovementCost(from){return 1/Math.max(game.extra.carts[from]>0?game.rules.cartSteps:1,game.terrain[from]===TILE_ROAD?1+game.rules.roadBonus:1);}
function commanderAction(playerIdx,officer=false,reserved=new Set(),forcedFrom=-1) {
 const player=game.players[playerIdx];if(!player?.alive)return null;
 if(officer)reserved=new Set([...reserved,...officerProtectedCells(playerIdx)]);
 const level=officer?{depth:2}:getAILevel(player),vis=computeVisibilityMask(playerIdx);
 let best=null,bestScore=-Infinity;
 let movable=[];
 for(let i=0;i<game.terrain.length;i++)if(game.owner[i]===playerIdx&&game.army[i]>1&&!reserved.has(i)&&(!officer||game.terrain[i]!==TILE_GENERAL)&&(forcedFrom<0||i===forcedFrom))movable.push(i);
 // Human commands take precedence; officers never move the human's queued sources.
 if(!officer)for(const from of movable){
  const type=game.terrain[from];
  if((type===TILE_OFFICER&&game.army[from]>game.rules.officerCost+5&&game.extra.officers.filter(o=>o.owner===playerIdx).length<game.rules.officerLimit)||(type===TILE_GOBLIN&&game.army[from]>game.rules.goblinCost+5))return {type:'recruit',targetIndex:from};
 }
 if(!officer){const strategic=strategicCommanderAction(playerIdx,movable,vis,level);if(strategic)return strategic;}
 movable=limitAICandidates(movable,playerIdx,level.depth);
 const distances=frontierDistances(playerIdx,vis,level.depth+3);
 for(const from of movable){
  const available=game.army[from]-1;
  for(const [dx,dy] of DIRECTIONS){
   const to=neighborIndex(from,dx,dy);if(to<0)continue;
   if(canBomb(from,to)&&game.terrain[to]===TILE_MOUNTAIN&&level.depth>=2)return {type:'bomb',from,to};
   const route=resolveTransit(from,to);if(!route||route.to===from)continue;
   const dest=route.to,own=vis[dest]?game.owner[dest]:-1;
   // Do not let an officer gather into or take troops from any capital.
   if(officer&&game.terrain[dest]===TILE_GENERAL&&arePlayersAllied(playerIdx,own))continue;
   const visible=vis[dest],defense=visible?game.army[dest]:0;
   const enemy=own>=0&&!arePlayersAllied(playerIdx,own);
   const ownLand=own===playerIdx||arePlayersAllied(playerIdx,own);
   if(visible&&!ownLand&&available-route.loss<=defense)continue;
   let score=ownLand?-8:15;
   if(visible&&enemy)score+=12;
   if(visible&&game.terrain[dest]===TILE_GENERAL&&enemy)score+=500;
   if(visible&&isChurch(game.terrain[dest])&&!ownLand)score+=70;
   if(visible&&[TILE_WATCH,TILE_TURRET,TILE_OFFICER,TILE_GOBLIN].includes(game.terrain[dest])&&!ownLand)score+=28;
   score-=route.loss*3;
   if(game.terrain[dest]===TILE_CASINO)score-=20;
   if(ownLand){
    if(distances[dest]>=0&&distances[from]>distances[dest])score+=20+Math.min(10,available/10);
   }
   if(level.depth>=4){
    for(const near of squareArea(dest,level.depth*2+1))if(vis[near]&&game.owner[near]>=0&&!arePlayersAllied(playerIdx,game.owner[near])){
     const d=tileDistance(dest,near);if(d<=level.depth){score+=game.terrain[near]===TILE_GENERAL?40/(d+1):0;if(game.army[near]>available+defense)score-=12/(d+1);}
    }
   }
   score+=Math.random()*(level.depth===1?25:2)+Math.min(8,available/15);
   if(score>bestScore){bestScore=score;best={type:'move',from,to,isHalf:game.terrain[from]===TILE_GENERAL&&available>8};}
  }
 }
 return best;
}
function officerProtectedCells(playerIdx){
 const queue=playerIdx===game.myPlayerIndex?game.moveQueue:pendingOnlineQueues[game.players[playerIdx].uid]||[];
 const centers=[game.extra.focus[playerIdx],playerIdx===game.myPlayerIndex?game.selectedTile:-1,...queue.map(a=>a.from)];
 const protectedCells=new Set();for(const center of centers)if(Number.isInteger(center)&&center>=0&&center<game.terrain.length)for(const i of squareArea(center,5))protectedCells.add(i);
 return protectedCells;
}
function runOfficers(){
 game.extra.officers=game.extra.officers.filter(o=>game.players[o.owner]?.alive);
 const used=new Set();
 for(const officer of game.extra.officers){
  const queue=officer.owner===game.myPlayerIndex?game.moveQueue:pendingOnlineQueues[game.players[officer.owner].uid]||[];
  const reserved=new Set([...used,...queue.map(a=>a.from)]);
  let budget=(officer.moveCredit||0)+game.rules.moveRate,previousTo=-1;
  for(let step=0;step<64&&budget>0.0001;step++){
   const action=commanderAction(officer.owner,true,reserved,previousTo);
   if(!action){budget=0;break;}
   const cost=action.type==='move'?stepMovementCost(action.from):1;
   if(cost>budget+.0001)break;
   const route=action.type==='move'?resolveTransit(action.from,action.to):null;
   if(game.terrain[action.from]!==TILE_GENERAL){executeAction(officer.owner,action);used.add(action.from);officer.lastFrom=action.from;}
   budget-=cost;previousTo=route?.to??-1;
   if(previousTo<0)break;
  }
  officer.moveCredit=Math.max(0,Math.min(1,budget));
 }
}
