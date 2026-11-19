const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
process.chdir(path.resolve(__dirname,'..'));fs.mkdirSync('test-artifacts',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),out={};
 for(const [label,folder] of [['current','.']]){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto('file:///'+path.resolve(folder+'/index.html').replaceAll('\\','/'));await page.waitForFunction(()=>typeof commanderAction==='function');
  out[label]=await page.evaluate(()=>{
   const n=10000,players=Array.from({length:16},(_,i)=>({index:i,uid:'bench'+i,name:'AI '+i,colorIdx:i%12,team:i,isBot:true,alive:true,generalIndex:i*600+10,relocateLeft:0,difficulty:'expert'}));
   const terrain=new Uint8Array(n),owner=new Int8Array(n),army=new Int32Array(n);
   for(let i=0;i<n;i++){owner[i]=Math.floor((i%100)/25)+4*Math.floor(Math.floor(i/100)/25);army[i]=10+i%90;}
   players.forEach((p,i)=>{p.generalIndex=Math.floor(i/4)*2500+(i%4)*25;terrain[p.generalIndex]=TILE_GENERAL;owner[p.generalIndex]=i;});
   initMatchSession('single',{width:100,height:100,speed:1,visionMode:'full',rules:normalizeRules({difficulty:'expert'})},players,{terrain,owner,army},-1);clearTimeout(game.turnTimer);game.isPaused=true;
   let seed=934;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   const measure=(f,count)=>{const times=[];for(let i=0;i<count;i++){const t=performance.now();f(i);times.push(performance.now()-t);}return {average:times.reduce((a,b)=>a+b,0)/times.length,max:Math.max(...times)};};
   const ai=measure(i=>commanderAction(i%16),16);
   const snapshots=measure(()=>recordReplaySnapshot(),30);
   camera.zoom=0.32;centerCameraOnMyGeneral();
   const raf=requestAnimationFrame;window.requestAnimationFrame=()=>0;
   const render=measure(()=>renderGameLoop(),12);window.requestAnimationFrame=raf;
   let bytes=0;hostClientConns={test:{open:true,send:p=>bytes=JSON.stringify(p).length}};broadcastHostTurnState({});game.turn++;game.army[2]++;recordReplaySnapshot();broadcastHostTurnState({});
   return {ai,snapshots,render,packetBytes:bytes};
  });await page.close();
 }
 fs.writeFileSync('test-artifacts/performance.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
