'use strict';

// Random branching tree: each added road joins exactly one existing road.
function generateWebRoads(map,w,h,density){
 const target=Math.floor(w*h*density/100);if(!target)return;
 const available=i=>map.owner[i]<0&&[TILE_EMPTY,TILE_MOUNTAIN].includes(map.terrain[i]);
 const neighbors=i=>DIRECTIONS.map(([dx,dy])=>{const x=i%w+dx,y=Math.floor(i/w)+dy;return x>0&&x<w-1&&y>0&&y<h-1?y*w+x:-1;}).filter(i=>i>=0);
 const starts=Array.from({length:w*h},(_,i)=>i).filter(i=>available(i)&&i%w>w*.25&&i%w<w*.75&&Math.floor(i/w)>h*.25&&Math.floor(i/w)<h*.75);
 if(!starts.length)return;
 const frontier=[];let count=0,tip=chooseRandom(starts),heading=-1,segment=0;
 const add=i=>{map.terrain[i]=TILE_ROAD;count++;for(const j of neighbors(i))if(available(j))frontier.push([i,j]);};
 const valid=i=>available(i)&&neighbors(i).filter(j=>map.terrain[j]===TILE_ROAD).length===1;
 add(tip);
 while(count<target&&frontier.length){
  const continuations=neighbors(tip).filter(valid);let next;
  if(segment<3+Math.random()*8&&continuations.length){
   const straight=continuations.find(i=>i-tip===heading);next=straight!==undefined&&Math.random()<.7?straight:chooseRandom(continuations);segment++;
  }else{
   while(frontier.length){const pick=Math.floor(Math.random()*frontier.length),edge=frontier[pick];frontier[pick]=frontier.at(-1);frontier.pop();if(valid(edge[1])){tip=edge[0];next=edge[1];break;}}segment=0;
  }
  if(next===undefined)break;heading=next-tip;tip=next;add(tip);
 }
}

function riverProtection(map,w,h,wrap=false){
 const blocked=new Uint8Array(w*h);
 for(let i=0;i<w*h;i++)if(map.terrain[i]===TILE_GENERAL)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
  let x=i%w+dx,y=Math.floor(i/w)+dy;if(wrap){x=(x+w)%w;y=(y+h)%h;}if(x>=0&&x<w&&y>=0&&y<h)blocked[y*w+x]=1;
 }
 return blocked;
}
function generateRivers(map,w,h,rules,riverDir){
 const blocked=riverProtection(map,w,h,rules.wrap),mode=rules.riverPattern;
 if(mode==='whirlpool')generateWhirlpoolRivers(map,w,h,rules.riverDensity,riverDir,blocked);
 else if(mode==='mixed'){
  generateWhirlpoolRivers(map,w,h,rules.riverDensity/2,riverDir,blocked);
  // Keep each system's arrows independent.
  const protectedWater=blocked.slice();for(let i=0;i<w*h;i++)if(map.terrain[i]===TILE_RIVER){protectedWater[i]=1;for(const [dx,dy] of DIRECTIONS){const x=i%w+dx,y=Math.floor(i/w)+dy;if(x>=0&&x<w&&y>=0&&y<h)protectedWater[y*w+x]=1;}}
  generateGreatRivers(map,w,h,rules.riverDensity/2,riverDir,protectedWater);
 }else generateGreatRivers(map,w,h,rules.riverDensity,riverDir,blocked);
}
function generateWhirlpoolRivers(map,w,h,density,riverDir,blocked=riverProtection(map,w,h)){
 const target=Math.floor(w*h*density/100);if(target<4)return;
 const allowed=i=>i>=0&&i<w*h&&!blocked[i]&&i%w>0&&i%w<w-1&&Math.floor(i/w)>0&&Math.floor(i/w)<h-1&&!blocked[i]&&map.owner[i]<0&&[TILE_EMPTY,TILE_MOUNTAIN].includes(map.terrain[i]);
 const candidates=shuffle(Array.from({length:w*h},(_,i)=>i).filter(allowed));let ring=null;
 for(let side=Math.min(Math.floor(target/4)+1,Math.floor(Math.sqrt(target)/1.4),w-2,h-2);side>=2&&!ring;side--){
  for(const origin of candidates){const x=origin%w,y=Math.floor(origin/w);if(x+side>=w||y+side>=h)continue;const cells=[];
   for(let a=0;a<side;a++)cells.push(y*w+x+a);
   for(let a=1;a<side;a++)cells.push((y+a)*w+x+side-1);
   for(let a=side-2;a>=0;a--)cells.push((y+side-1)*w+x+a);
   for(let a=side-2;a>0;a--)cells.push((y+a)*w+x);
   if(cells.length<=target&&cells.every(allowed)){ring=cells;break;}
  }
 }
 if(!ring)return;if(Math.random()<.5)ring.reverse();
 const direction=(a,b)=>DIRECTIONS.findIndex(([dx,dy])=>a+dx+dy*w===b);
 for(let k=0;k<ring.length;k++){const i=ring[k];map.terrain[i]=TILE_RIVER;riverDir[i]=direction(i,ring[(k+1)%ring.length]);}
 const water=ring.slice();
 // Wider banks feed the closed ring, so every arrow eventually keeps circulating.
 for(let head=0;head<water.length&&water.length<target;head++)for(const [dx,dy] of shuffle(DIRECTIONS.slice())){
  const i=water[head],x=i%w+dx,y=Math.floor(i/w)+dy,j=y*w+x;
  if(x>0&&x<w-1&&y>0&&y<h-1&&allowed(j)&&water.length<target){map.terrain[j]=TILE_RIVER;riverDir[j]=direction(j,i);water.push(j);}
 }
}

function generateGreatRivers(map,w,h,density,riverDir,blocked=riverProtection(map,w,h)){
 const target=Math.floor(w*h*density/100);if(!target)return;
 const vertical=h>=w?Math.random()<0.8:Math.random()<0.2;
 const length=vertical?h:w,cross=vertical?w:h,phase=Math.random()*6.28;
 const allowed=i=>i>=0&&i<w*h&&!blocked[i]&&i%w>0&&i%w<w-1&&Math.floor(i/w)>0&&Math.floor(i/w)<h-1&&[TILE_EMPTY,TILE_MOUNTAIN,TILE_RIVER].includes(map.terrain[i])&&map.owner[i]<0;
 const index=(along,side)=>vertical?along*w+side:side*w+along;
 const all=Array.from({length:w*h},(_,i)=>i).filter(allowed);
 if(!all.length)return;
 function nearest(desired){return all.reduce((best,i)=>Math.abs(i%w-desired%w)+Math.abs(Math.floor(i/w)-Math.floor(desired/w))<Math.abs(best%w-desired%w)+Math.abs(Math.floor(best/w)-Math.floor(desired/w))?i:best,all[0]);}
 function route(start,end){
  const parent=new Int32Array(w*h).fill(-1),queue=[start];parent[start]=start;
  for(let head=0;head<queue.length&&parent[end]<0;head++){
   const i=queue[head],neighbors=[];
   for(const [dx,dy] of DIRECTIONS){const x=i%w+dx,y=Math.floor(i/w)+dy,j=y*w+x;if(x>=0&&x<w&&y>=0&&y<h&&allowed(j)&&parent[j]<0)neighbors.push(j);}
   neighbors.sort((a,b)=>(Math.abs(a%w-end%w)+Math.abs(Math.floor(a/w)-Math.floor(end/w)))-(Math.abs(b%w-end%w)+Math.abs(Math.floor(b/w)-Math.floor(end/w))));
   for(const j of neighbors){parent[j]=i;queue.push(j);}
  }
  if(parent[end]<0)return [];
  const path=[];for(let i=end;i!==start;i=parent[i])path.push(i);path.push(start);return path.reverse();
 }
 let current=nearest(index(1,Math.floor(cross/2))),mouth=current;
 const spine=[current];
 for(let along=7;along<length+5;along+=6){
  const a=Math.min(length-2,along),side=Math.max(2,Math.min(cross-3,Math.round(cross/2+Math.sin(a/length*6.28+phase)*cross*0.19)));
  const goal=nearest(index(a,side)),segment=route(current,goal);
  if(segment.length){spine.push(...segment.slice(1));current=goal;}
 }
 const water=[];let count=0;
 function place(i){
  if(count>=target||!allowed(i)||map.terrain[i]===TILE_RIVER)return;
  if(count&&!DIRECTIONS.some(([dx,dy])=>map.terrain[i+dx+dy*w]===TILE_RIVER))return;
  map.terrain[i]=TILE_RIVER;water.push(i);count++;
 }
 for(const i of spine){place(i);if(map.terrain[i]===TILE_RIVER)mouth=i;}
 // A wide main channel receives the first allocation; tributaries grow outward from it.
 const halfWidth=target>spine.length?Math.min(3,Math.max(2,Math.ceil(target/Math.max(1,spine.length)/2))):0;
 const centerFirst=spine.map((i,n)=>({i,n})).sort((a,b)=>Math.abs(a.n-spine.length/2)-Math.abs(b.n-spine.length/2));
 // Widen each central stretch fully before extending it: broad main channels
 // get the budget before thin branches, while the original spine stays connected.
 for(const {i} of centerFirst)for(let radius=1;radius<=halfWidth;radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  const x=i%w+dx,y=Math.floor(i/w)+dy;if(x>0&&x<w-1&&y>0&&y<h-1)place(y*w+x);
 }
 for(let branch=0;count<target&&branch<12;branch++){
  const source=chooseRandom(all.filter(i=>map.terrain[i]!==TILE_RIVER));if(source===undefined)break;
  const junction=water.reduce((best,i)=>Math.abs(i%w-source%w)+Math.abs(Math.floor(i/w)-Math.floor(source/w))<Math.abs(best%w-source%w)+Math.abs(Math.floor(best/w)-Math.floor(source/w))?i:best,water[0]);
  for(const i of route(junction,source))place(i);
 }
 // Finish by widening connected banks, never scattering isolated river dots.
 for(let head=0;head<water.length&&count<target;head++)for(const [dx,dy] of shuffle(DIRECTIONS.slice())){
  const i=water[head],x=i%w+dx,y=Math.floor(i/w)+dy;if(x>0&&x<w-1&&y>0&&y<h-1)place(y*w+x);
 }
 // All channels descend a distance gradient toward the same mouth: no flow cycles.
 const distance=new Int32Array(w*h).fill(-1),queue=[mouth];distance[mouth]=0;
 for(let head=0;head<queue.length;head++)for(let d=0;d<4;d++){
  const i=queue[head],[dx,dy]=DIRECTIONS[d],x=i%w+dx,y=Math.floor(i/w)+dy,j=y*w+x;
  if(x>=0&&x<w&&y>=0&&y<h&&map.terrain[j]===TILE_RIVER&&distance[j]<0){distance[j]=distance[i]+1;riverDir[j]=(d+2)%4;queue.push(j);}
 }
 const outDirection=vertical?2:1;riverDir[mouth]=outDirection;
 const [dx,dy]=DIRECTIONS[outDirection],out=mouth+dx+dy*w;
 if(out>=0&&out<w*h&&map.terrain[out]===TILE_MOUNTAIN)map.terrain[out]=TILE_EMPTY;
}

