const path=require('node:path'),{chromium}=require('playwright');
process.chdir(path.resolve(__dirname,'..'));
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('file:///'+path.resolve('index.html').replaceAll('\\','/'));await page.waitForFunction(()=>typeof triggerDisaster==='function');
const result=await page.evaluate(()=>{let checks=0,inner=0,outer=0,innerN=0,outerN=0;const check=(ok,msg)=>{if(!ok)throw Error(msg);checks++;};const original=Math.random;
for(let seed=1;seed<=30;seed++){
 const n=900,terrain=new Uint8Array(n),owner=new Int8Array(n).fill(-1),army=new Int32Array(n),players=[0,1].map(i=>({index:i,uid:i?'enemy':localPlayerUid,name:'P'+i,colorIdx:i,team:i,alive:true,isBot:false,generalIndex:i?899:0}));
 players.forEach((p,i)=>{terrain[p.generalIndex]=TILE_GENERAL;owner[p.generalIndex]=i;army[p.generalIndex]=50;});
 initMatchSession('single',{width:30,height:30,speed:1,visionMode:'full',rules:normalizeRules({})},players,{terrain,owner,army},0);clearTimeout(game.turnTimer);game.isPaused=true;
 const center=465,safe=Array.from({length:n},(_,i)=>i).filter(eventSafeCell);let first=true,state=seed;
 Math.random=()=>{if(first){first=false;return (safe.indexOf(center)+.1)/safe.length;}state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};triggerDisaster('volcano');
 let outerOpen=0;for(let dy=-7;dy<=7;dy++)for(let dx=-7;dx<=7;dx++){const d=Math.hypot(dx,dy),i=center+dy*30+dx,t=game.terrain[i];if(d<=2)check(t===TILE_LAVA,'round lava core preserved');else if(d<=4){innerN++;inner+=t===TILE_MOUNTAIN;}else if(d<=6){outerN++;outer+=t===TILE_MOUNTAIN;outerOpen+=[TILE_EMPTY,TILE_ROAD].includes(t);}else check(t===TILE_EMPTY,'plain ground outside circular footprint');}check(outerOpen>20,'foothills contain open passages');
}
for(const [dx,dy] of DIRECTIONS){const from=465+3*(dx+dy*30),entry=465+2*(dx+dy*30),route=resolveTransit(from,entry);check(route?.to===entry,'both passages enter capturable lava core');check(route.loss===game.rules.lavaLoss,'lava crossing pays per entered cell');}
check(!Array.from(game.terrain).includes(TILE_ROAD),'volcano never creates accelerated road tiles');check(stepMovementCost(468)===1,'plain passage has normal movement cost');Math.random=original;check(outer/outerN<.4,'foothills are sparse');check(inner/innerN>outer/outerN,'mountain density falls toward edge');return {checks,innerDensity:inner/innerN,outerDensity:outer/outerN};});await browser.close();if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({...result,errors}));})().catch(e=>{console.error(e);process.exit(1)});


