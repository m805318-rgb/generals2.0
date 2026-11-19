'use strict';

function fullTurnPacket(frame,executedMeta){
 return {type:'turn_sync',turn:frame.turn,terrain:Array.from(frame.terrain),owner:Array.from(frame.owner),army:Array.from(frame.army),portalTarget:Array.from(frame.portalTarget),portalPairId:Array.from(frame.portalPairId),players:frame.players,extra:frame.extra,rules:frame.rules,executedMeta};
}
function createTurnPacket(frame,previous,executedMeta){
 const n=frame.terrain.length;
 if(n<2500||!previous||previous.terrain.length!==n||frame.turn%20===0)return fullTurnPacket(frame,executedMeta);
 const cells=[],objects=[];
 for(let i=0;i<n;i++){
  if(frame.terrain[i]!==previous.terrain[i]||frame.owner[i]!==previous.owner[i]||frame.army[i]!==previous.army[i]||frame.portalTarget[i]!==previous.portalTarget[i]||frame.portalPairId[i]!==previous.portalPairId[i])cells.push([i,frame.terrain[i],frame.owner[i],frame.army[i],frame.portalTarget[i],frame.portalPairId[i]]);
  if(frame.extra.riverDir[i]!==previous.extra.riverDir[i]||frame.extra.engineers[i]!==previous.extra.engineers[i]||frame.extra.carts[i]!==previous.extra.carts[i])objects.push([i,frame.extra.riverDir[i],frame.extra.engineers[i],frame.extra.carts[i]]);
 }
 if(cells.length>n*.45)return fullTurnPacket(frame,executedMeta);
 const {riverDir,engineers,carts,...extra}=frame.extra;
 return {type:'turn_sync',delta:true,baseTurn:previous.turn,turn:frame.turn,cells,objects,extra,players:frame.players,rules:frame.rules,executedMeta};
}
function expandTurnPacket(packet,base){
 const full={...packet,delta:false,terrain:Array.from(base.terrain),owner:Array.from(base.owner),army:Array.from(base.army),portalTarget:Array.from(base.portalTarget),portalPairId:Array.from(base.portalPairId),extra:{...packet.extra,riverDir:Array.from(base.extra.riverDir),engineers:Array.from(base.extra.engineers),carts:Array.from(base.extra.carts)}};
 for(const [i,t,o,a,p,pair] of packet.cells){full.terrain[i]=t;full.owner[i]=o;full.army[i]=a;full.portalTarget[i]=p;full.portalPairId[i]=pair;}
 for(const [i,d,e,c] of packet.objects){full.extra.riverDir[i]=d;full.extra.engineers[i]=e;full.extra.carts[i]=c;}
 return full;
}
