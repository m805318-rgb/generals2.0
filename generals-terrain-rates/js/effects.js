'use strict';

let effectClockWorld=-1,effectClockWall=0;
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
function queueDisasterEffect(type,positions=[],radius=2,cells=[]){
 const e=game.extra;e.effects=(e.effects||[]).filter(f=>f.start+f.duration>e.elapsedMs);
 e.effectSeq=(e.effectSeq||0)+1;
 e.effects.push({id:e.effectSeq,type,cells:[...new Set(cells)],positions:positions.slice(0,24),radius,start:e.elapsedMs,duration:type==='mist'?game.rules.mistSeconds*1000:type==='sun'?game.rules.sunSeconds*1000:type==='volcano'?4500:2800});
 if(e.effects.length>8)e.effects.splice(0,e.effects.length-8);
 game.visualRevision=(game.visualRevision||0)+1;
}
function animationTime(){
 const world=game.extra?.elapsedMs||0;
 if(world!==effectClockWorld){effectClockWorld=world;effectClockWall=performance.now();}
 return world+((game.isPaused||replayState.active)?0:Math.min(turnLoopIntervalMs,performance.now()-effectClockWall));
}
function queueCannonShot(from,to){
 let dx=to%game.width-from%game.width,dy=Math.floor(to/game.width)-Math.floor(from/game.width);
 if(game.rules.wrap){if(Math.abs(dx)>game.width/2)dx-=Math.sign(dx)*game.width;if(Math.abs(dy)>game.height/2)dy-=Math.sign(dy)*game.height;}
 game.extra.turretAim=game.extra.turretAim||{};
 game.extra.turretAim[from]=Math.atan2(dy,dx);
 game.visualRevision=(game.visualRevision||0)+1;
 const e=game.extra;e.shots=(e.shots||[]).filter(f=>f.start+f.duration>e.elapsedMs);
 e.shots.push({type:'shot',positions:[from,to],start:e.elapsedMs,duration:2*Math.max(150,Math.min(450,turnLoopIntervalMs)),radius:0});
 if(e.shots.length>256)e.shots.splice(0,e.shots.length-256);
}
function activeDisasterEffects(){const time=animationTime();return [...(game.extra?.effects||[]),...(game.extra?.shots||[])].filter(f=>time>=f.start&&time<f.start+f.duration);}
function drawDisasterEffects(c,effects,visibility){
 const ts=camera.baseTileSize*camera.zoom,time=animationTime(),reduced=reduceMotion.matches;
 c.save();c.lineCap='round';
 for(const f of effects){
  const t=Math.max(0,Math.min(1,(time-f.start)/f.duration)),fade=Math.sin(Math.PI*t);
  if(f.type!=='shot')drawDisasterCellBorders(c,f,visibility,ts);
  if(f.type==='shot'){
   const [from,to]=f.positions;
   if(!visibility?.[from]||!visibility?.[to])continue;
   const fx=from%game.width,fy=Math.floor(from/game.width),tx=to%game.width,ty=Math.floor(to/game.width);
   c.fillStyle='#ffffff';c.beginPath();c.arc(camera.x+(fx+.5+(tx-fx)*t)*ts,camera.y+(fy+.5+(ty-fy)*t)*ts,Math.max(1.5,ts*.065),0,Math.PI*2);c.fill();continue;
  }
  if(f.type==='sun'){
   c.fillStyle=`rgba(255,230,130,${fade*0.09})`;c.fillRect(0,0,canvas.width,canvas.height);
   if(!reduced){c.strokeStyle=`rgba(253,224,71,${fade*0.13})`;c.lineWidth=22;for(let n=0;n<6;n++){c.beginPath();c.moveTo(canvas.width*0.6+n*45,-40);c.lineTo(canvas.width*0.15+n*120,canvas.height);c.stroke();}}
   continue;
  }
  if(f.type==='mist'){
   for(let n=0;n<5;n++){const y=(n+.4)*canvas.height/5;c.fillStyle=`rgba(186,210,230,${fade*0.05})`;c.beginPath();c.ellipse(canvas.width*(0.35+n*.1)+(reduced?0:Math.sin(t*3+n)*90),y,canvas.width*.6,75,0,0,Math.PI*2);c.fill();}continue;
  }
  for(const [k,index] of f.positions.entries()){
   if(!visibility?.[index])continue;
   const x=camera.x+(index%game.width+.5)*ts,y=camera.y+(Math.floor(index/game.width)+.5)*ts;
   if(x+f.radius*ts<0||x-f.radius*ts>canvas.width||y+f.radius*ts<0||y-f.radius*ts>canvas.height)continue;
   const color=f.type==='miracle'?'#fde68a':f.type==='warlord'?'#c4b5fd':f.type==='quake'?'#fcd34d':'#fb923c';
   c.globalAlpha=fade*.8;c.strokeStyle=color;c.lineWidth=Math.max(1.5,ts*.07);
   if(f.type==='meteor'){
    const impact=Math.min(1,t*2),fall=reduced?0:(1-impact)*160;
    c.beginPath();c.moveTo(x-fall-30,y-fall*1.7-50);c.lineTo(x-fall,y-fall*1.7);c.stroke();
    c.fillStyle='#fde68a';c.beginPath();c.arc(x-fall,y-fall*1.7,Math.max(3,ts*.16),0,Math.PI*2);c.fill();
   }
   if(f.type==='miracle'||f.type==='warlord'){
    c.fillStyle=f.type==='miracle'?`rgba(254,240,138,${fade*.2})`:`rgba(196,181,253,${fade*.2})`;
    c.fillRect(x-ts*.7,y-ts*(reduced?1:3*(1-t)+1),ts*1.4,ts*(reduced?1:3*(1-t)+1));
   }
   c.beginPath();c.arc(x,y,Math.max(3,f.radius*ts*(reduced?.65:.2+t*.8)),0,Math.PI*2);c.stroke();
   const particles=reduced?4:f.type==='volcano'?24:12;
   for(let n=0;n<particles;n++){
    const angle=n*2.399+k,travel=f.radius*ts*(.15+t*.75),px=x+Math.cos(angle)*travel,py=y+Math.sin(angle)*travel-(f.type==='volcano'?Math.sin(t*Math.PI)*ts*2:0);
    c.fillStyle=n%2?color:'#fff7ed';c.beginPath();c.arc(px,py,Math.max(1,ts*(n%3+1)*.035),0,Math.PI*2);c.fill();
   }
   if(f.type==='quake'){
    c.beginPath();for(let n=0;n<8;n++){const px=x+(n-3.5)*ts*f.radius/4,py=y+Math.sin(n*2.7)*ts*.4*fade;if(!n)c.moveTo(px,py);else c.lineTo(px,py);}c.stroke();
   }
   c.globalAlpha=1;
  }
 }
 c.restore();
}

const DISASTER_COLORS={quake:'#e5b879',volcano:'#ff7544',meteor:'#fb7185',miracle:'#fde047',warlord:'#c084fc',sun:'#ffe58a',mist:'#9dcde5'};
function drawDisasterCellBorders(c,f,visibility,ts){
 if(f.type==='sun'||f.type==='mist')return;
 c.save();c.strokeStyle=DISASTER_COLORS[f.type]||'#fff';c.lineWidth=Math.max(1,Math.min(3,ts*.055));c.globalAlpha=.8;
 const global=f.type==='sun'||f.type==='mist',cells=global?null:f.cells||[];
 const draw=i=>{if(!visibility?.[i])return;const x=camera.x+i%game.width*ts,y=camera.y+Math.floor(i/game.width)*ts;if(x+ts<0||y+ts<0||x>canvas.width||y>canvas.height)return;c.strokeRect(x+1,y+1,ts-2,ts-2);};
 if(global){const x0=Math.max(0,Math.floor(-camera.x/ts)),x1=Math.min(game.width-1,Math.floor((canvas.width-camera.x)/ts)),y0=Math.max(0,Math.floor(-camera.y/ts)),y1=Math.min(game.height-1,Math.floor((canvas.height-camera.y)/ts));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)draw(y*game.width+x);}
 else for(const i of cells)draw(i);
 c.restore();
}
function drawMistFringe(c){
 const e=game.extra,viewer=displayViewer();if(viewer<0||replayState.active||e?.sudden||e?.sunUntil>e?.elapsedMs||!(e?.mistUntil>e?.elapsedMs))return;
 const focus=mistFocus(viewer);if(focus<0)return;const ts=camera.baseTileSize*camera.zoom;
 c.save();
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(Math.max(Math.abs(dx),Math.abs(dy))===2){
  const i=neighborIndex(focus,dx,dy);if(i<0)continue;
  const x=camera.x+i%game.width*ts,y=camera.y+Math.floor(i/game.width)*ts;
  const shade=(horizontal,direction)=>{const g=c.createLinearGradient(horizontal?x+(direction<0?ts:0):x,horizontal?y:y+(direction<0?ts:0),horizontal?x+(direction<0?0:ts):x,horizontal?y:y+(direction<0?0:ts));g.addColorStop(0,'rgba(8,18,28,0)');g.addColorStop(1,'rgba(8,18,28,.88)');c.fillStyle=g;c.fillRect(x,y,ts,ts);};
  if(Math.abs(dx)===2)shade(true,dx);if(Math.abs(dy)===2)shade(false,dy);
 }
 c.restore();
}
