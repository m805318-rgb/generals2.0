const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
process.chdir(path.resolve(__dirname,'..'));fs.mkdirSync('test-artifacts',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('file:///'+path.resolve('index.html').replaceAll('\\','/'));await page.waitForFunction(()=>typeof queueDisasterEffect==='function');
 const results=await page.evaluate(()=>{
  const checks=[];function check(ok,name){if(!ok)throw Error(name);checks.push(name);}
  function fixture(rules={},size=30){
   const n=size*size,players=[0,1].map(i=>({index:i,uid:i? 'enemy':localPlayerUid,name:'P'+i,colorIdx:i,team:i,alive:true,isBot:false,generalIndex:i?n-1:0,difficulty:'expert'}));
   const map={terrain:new Uint8Array(n),owner:new Int8Array(n).fill(-1),army:new Int32Array(n)};
   for(let p=0;p<2;p++){const i=players[p].generalIndex;map.terrain[i]=TILE_GENERAL;map.owner[i]=p;map.army[i]=5;}
   initMatchSession('single',{width:size,height:size,speed:1,visionMode:'full',rules:normalizeRules(rules)},players,map,0);clearTimeout(game.turnTimer);game.isPaused=false;
  }
  const random=Math.random;let seed=74253;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  fixture({warlordLimit:2,warlordMax:5});for(let n=0;n<5;n++)triggerDisaster('warlord');check(game.players.filter(p=>p.isWarlord).length===2,'cumulative warlord cap');game.players[2].alive=false;triggerDisaster('warlord');check(game.players.length===4,'dead warlord does not reopen cumulative quota');
  fixture({warlordLimit:0});triggerDisaster('warlord');check(game.players.length===2,'zero cap disables warlord spawns');
  fixture({eventRadius:4},100);const safe=Array.from({length:10000},(_,i)=>i).filter(eventSafeCell),center=5050;let call=0;Math.random=()=>call++===0?(safe.indexOf(center)+.1)/safe.length:.1;triggerDisaster('volcano');Math.random=random;
  check(game.terrain[center+2]===TILE_LAVA&&game.terrain[center+200]===TILE_LAVA&&game.terrain[center+101]===TILE_LAVA,'circular lava core spans multiple tiles');
  check(game.terrain[center+202]===TILE_MOUNTAIN&&game.terrain[center+7]===TILE_EMPTY,'core corners and crossing exit remain distinct');
  check(game.extra.effects.at(-1).radius===6,'volcano radius halved from previous size');
  check(game.terrain[center]===TILE_LAVA&&game.terrain[center+4]===TILE_EMPTY,'plain ground passes through mountain ring');
  check(Array.from(game.terrain).filter(t=>t===TILE_MOUNTAIN||t===TILE_LAVA).length<=113,'volcano remains inside reduced circular footprint');
  fixture();game.terrain[310]=TILE_TURRET;game.owner[310]=0;game.army[310]=50;game.owner[372]=1;game.army[372]=80;game.owner[313]=1;game.army[313]=80;processTerrainTurn();
  check(game.army[310]===25&&game.army[372]===55,'turret fires 50 percent into 5x5 corner');check(game.army[313]===80,'outside 5x5 remains unharmed');
  for(const victim of [0,1]){
   fixture();game.turn=1;game.terrain[310]=TILE_TURRET;game.owner[310]=-1;game.army[310]=30;game.owner[311]=victim;game.army[311]=80;
   processTerrainTurn();check(game.army[310]===15&&game.army[311]===65,'neutral turret attacks player '+victim);check(game.extra.shots.at(-1).positions[1]===311,'neutral turret emits projectile');
  }
  fixture();game.turn=1;game.teamMode=true;game.players[0].team=game.players[1].team=0;game.terrain[310]=TILE_TURRET;game.owner[310]=0;game.army[310]=30;game.owner[311]=1;game.army[311]=80;processTerrainTurn();check(game.army[310]===30&&game.army[311]===80,'owned turret never attacks allies');
  game.owner[310]=-1;game.owner[311]=-1;processTerrainTurn();check(game.army[310]===30,'neutral turret ignores neutral armies');
  game.owner[311]=0;game.army[310]=1;processTerrainTurn();check(game.army[310]===1&&game.army[311]===80,'one remaining defender cannot fire');
  fixture({shrineGuard:200});triggerDisaster('miracle');const shrine=game.extra.shrines[0];
  check(shrine.tiles.length===4&&new Set(shrine.tiles.map(i=>i%30)).size===2&&new Set(shrine.tiles.map(i=>Math.floor(i/30))).size===2,'shrine is actual 2x2 footprint');
  check(shrine.turrets.length>=8&&shrine.turrets.every(i=>game.terrain[i]===TILE_TURRET),'eight surrounding turrets');
  check(shrine.tiles.reduce((n,i)=>n+game.army[i],0)===200,'shrine guard shared across four tiles');
  // Isolate shrine production from surrounding neutral defensive fire.
  shrine.turrets.forEach(i=>game.army[i]=1);game.turn=1;
  const church=1;game.terrain[church]=TILE_CITY;game.owner[church]=0;game.army[church]=10;
  for(const i of shrine.tiles.slice(0,3))game.owner[i]=0;processTerrainTurn();check(game.army[church]===11,'partial occupation gives no faction blessing');
  game.owner[shrine.tiles[3]]=0;const before=shrine.tiles.reduce((n,i)=>n+game.army[i],0);processTerrainTurn();check(game.army[church]===13&&shrine.tiles.reduce((n,i)=>n+game.army[i],0)===before+8,'full occupation gives total eight growth and faction blessing');
  for(const size of [30,100])for(const density of [1,7,15]){
   const map={terrain:new Uint8Array(size*size),owner:new Int8Array(size*size).fill(-1),army:new Int32Array(size*size)},directions=new Int8Array(size*size).fill(-1);
   generateGreatRivers(map,size,size,density,directions);
   const water=Array.from(map.terrain).flatMap((v,i)=>v===TILE_RIVER?[i]:[]),visited=new Set([water[0]]),queue=[water[0]];
   for(let head=0;head<queue.length;head++)for(const [dx,dy] of DIRECTIONS){const i=queue[head],x=i%size+dx,y=Math.floor(i/size)+dy,j=y*size+x;if(x>=0&&x<size&&y>=0&&y<size&&map.terrain[j]===TILE_RIVER&&!visited.has(j)){visited.add(j);queue.push(j);}}
   if(size===100&&density>=7)check(water.some(i=>[-2,-1,0,1,2].every(dy=>[-2,-1,0,1,2].every(dx=>map.terrain[i+dy*size+dx]===TILE_RIVER))),'main river includes a broad five-tile channel');
   check(visited.size===water.length,`${size} density ${density}: one connected main river`);
   check(water.length===Math.floor(size*size*density/100),`${size} density ${density}: density target`);
   for(const start of water.filter((_,n)=>n%Math.max(1,Math.floor(water.length/10))===0)){
    let i=start;const seen=new Set();while(map.terrain[i]===TILE_RIVER){if(seen.has(i))throw Error('River flow cycle');seen.add(i);const [dx,dy]=DIRECTIONS[directions[i]];i+=dx+dy*size;}
   }
  }
  check(true,'sampled tributary flow has no cycles');
  fixture({},100);game.players[0].isBot=true;game.terrain.fill(TILE_EMPTY);game.owner.fill(-1);game.army.fill(0);
  for(const [p,i,army] of [[0,2000,1000],[1,2090,20]]){game.players[p].generalIndex=i;game.terrain[i]=TILE_GENERAL;game.owner[i]=p;game.army[i]=army;refreshCapitals(p);}
  for(let y=0;y<=60;y++)game.terrain[y*100+45]=TILE_MOUNTAIN;game.topologyVersion++;
  let turns=0;while(game.players[1].alive&&turns++<110)advanceGameTurn(500);
  check(!game.players[1].alive&&game.terrain[2090]===TILE_CITY,'AI routes around long wall and captures distant capital');
  fixture({},100);game.terrain.fill(TILE_MOUNTAIN);game.army.fill(0);game.owner.fill(-1);
  for(const i of [0,5009,5010,5011,5012,5013])game.terrain[i]=TILE_EMPTY;
  game.terrain[0]=TILE_GENERAL;game.owner[0]=0;game.army[0]=1;game.players[0].generalIndex=0;
  game.terrain[5013]=TILE_GENERAL;game.owner[5013]=1;game.army[5013]=150;game.players[1].generalIndex=5013;
  for(const [i,n] of [[5009,90],[5010,80],[5011,1],[5012,1]]){game.owner[i]=0;game.army[i]=n;}
  const action=commanderAction(0);executeAction(0,action);check(game.army[5010]===169,'AI merges rear and forward armies before attack');
  for(let n=0;n<4&&game.players[1].alive;n++){const a=commanderAction(0);if(a)executeAction(0,a);}
  check(!game.players[1].alive,'combined army captures defended capital');
  fixture({},100);const base=captureFrame();game.turn++;game.army[25]=99;game.owner[25]=0;game.extra.carts[25]=1;triggerDisaster('sun');const current=captureFrame(),packet=createTurnPacket(current,base,{[localPlayerUid]:7});
  check(packet.delta&&JSON.stringify(packet).length<JSON.stringify(fullTurnPacket(current,{})).length*.1,'large-map delta is substantially smaller');
  const expanded=expandTurnPacket(packet,base);check(expanded.army[25]===99&&expanded.owner[25]===0&&expanded.extra.carts[25]===1&&expanded.extra.effects[0].type==='sun','delta preserves units vehicles and effects');
  check(base.army[25]===0&&base.extra.carts[25]===0,'delta application never mutates base replay frame');
  game.networkFrame=base;handleClientReceivedPeerData(packet);check(game.turn===current.turn&&game.extra.carts[25]===1,'client applies incremental turn');
  const sent=[];clientToHostConn={open:true,send:p=>sent.push(p)};handleClientReceivedPeerData({...packet,baseTurn:-100});check(sent[0]?.type==='state_resync','missing baseline requests full resync');clientToHostConn=null;
  activeRoomRawData={config,slots:[]};const recovered=[],conn={peerUid:'viewer',open:true,send:p=>recovered.push(p)};hostClientConns={viewer:conn};handleHostReceivedPeerData(conn,{type:'state_resync'});check(recovered[0]?.type==='turn_sync'&&!recovered[0].delta,'resync returns full state without restarting match');activeRoomRawData=null;hostClientConns={};
  for(const type of ['quake','volcano','sun','meteor','mist','miracle','warlord']){queueDisasterEffect(type,[5050],3);check(game.extra.effects.at(-1).type===type,'effect descriptor: '+type);}
  check(game.extra.effects.length<=8,'animation list is bounded');
  const frame=captureFrame();game.extra.effects=[];restoreFrame(frame);check(game.extra.effects.length>0,'animation descriptors survive replay');
  game.extra.elapsedMs+=10000;check(activeDisasterEffects().length===0,'expired effects stop drawing');
  game.extra.effects=[];queueDisasterEffect('volcano',[5050],12);game.extra.elapsedMs+=1500;game.isPaused=true;game.visionMode='full';game.isSpectator=true;game.spectatorTarget=-1;camera.zoom=.6;camera.x=720-50.5*38*.6;camera.y=500-50.5*38*.6;game.visualRevision++;
  Math.random=random;return checks;
 });
 await page.screenshot({path:'test-artifacts/disaster-animation.png'});
 await page.evaluate(()=>openTileLegend());await page.locator('#tileLegend').screenshot({path:'test-artifacts/tile-icons.png'});
 fs.writeFileSync('test-artifacts/balance-results.json',JSON.stringify({checks:results.length,errors,results},null,2));console.log(JSON.stringify({checks:results.length,errors}));await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});



