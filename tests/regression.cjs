const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const projectRoot=path.resolve(__dirname,'..');process.chdir(projectRoot);fs.mkdirSync('test-artifacts',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1500,height:1050}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url='file:///'+path.resolve('index.html').replaceAll('\\','/');
 await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('[data-rule]').length>40);
 await page.selectOption('#presetSelect','chaos');
 await page.locator('.rules-panel > summary').click();
 await page.screenshot({path:'test-artifacts/lobby.png',fullPage:true});
 const results=await page.evaluate(()=>{
  const results=[];function check(value,label){if(!value)throw Error(label);results.push(label);}
  function fixture(rules={}){
   if(game.turnTimer)clearTimeout(game.turnTimer);
   const players=[0,1].map(i=>({index:i,uid:i===0?localPlayerUid:'enemy',name:'P'+i,colorIdx:i,team:i,isBot:false,alive:true,generalIndex:i===0?0:143,relocateLeft:1}));
   const map={terrain:new Uint8Array(144),owner:new Int8Array(144).fill(-1),army:new Int32Array(144),portalTarget:new Int32Array(144).fill(-1),portalPairId:new Int8Array(144).fill(-1)};
   for(const [p,i] of [[0,0],[1,143]]){map.terrain[i]=TILE_GENERAL;map.owner[i]=p;map.army[i]=5;}
   initMatchSession('single',{width:12,height:12,speed:1,allowRelocate:true,visionMode:'standard',teamMode:false,rules:normalizeRules(rules)},players,map,0);clearTimeout(game.turnTimer);game.isPaused=false;
  }
  function tile(i,type,owner,army){game.terrain[i]=type;game.owner[i]=owner;game.army[i]=army;}
  const seeded=Math.random;let seed=927431;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const [id,preset] of Object.entries(PRESETS)){
   for(const [w,h] of [[12,12],[30,40],[100,100]]){
    const cfg={...preset,width:w,height:h,rules:normalizeRules(preset.rules)};
    const players=Array.from({length:4},(_,i)=>({team:i,index:i}));
    const m=generateBalancedMap(w,h,18,4,players,false,cfg.portalPairs,cfg.lavaDensity,cfg.mountainStyle);prepareExtendedMap(m,players,cfg);
    const capitals=Array.from(m.terrain).flatMap((v,i)=>v===TILE_GENERAL?[i]:[]);
    check(capitals.length===4*cfg.rules.capitals,`${id} ${w}x${h}: capital count`);
    check(verifyGeneralsConnected(w,h,m.terrain,capitals),`${id} ${w}x${h}: connectivity`);
    check(m.extra.engineers.length===w*h&&m.extra.riverDir.length===w*h,`${id} ${w}x${h}: extra arrays`);
   }
  }
  fixture({lavaLoss:3});tile(25,TILE_EMPTY,0,20);tile(26,TILE_LAVA,-1,0);tile(27,TILE_LAVA,-1,0);
  check(executeSingleMove(0,25,26,false),'lava passage executes');
  check(game.army[26]===16&&game.owner[26]===0&&game.army[25]===1,'lava entry damage');
  check(game.owner[26]===0&&game.owner[27]===-1,'lava captures first tile without skipping');
  tile(25,TILE_EMPTY,0,3);executeSingleMove(0,25,26,false);check(game.army[25]===1&&game.army[26]===16,'lava can consume entire moving army');
  fixture();tile(25,TILE_EMPTY,0,21);tile(26,TILE_PORTAL,-1,0);tile(80,TILE_PORTAL,-1,0);game.portalTarget[26]=80;game.portalTarget[80]=26;
  executeSingleMove(0,25,26,false);check(game.army[81]===20&&game.owner[81]===0&&game.army[26]===0&&game.army[80]===0,'portal direction and no garrison');
  fixture({riverFlow:3});tile(25,TILE_RIVER,0,10);tile(26,TILE_RIVER,0,1);game.extra.riverDir[25]=1;game.extra.riverDir[26]=1;
  processTerrainTurn();check(game.army[25]===7&&game.army[26]===4&&game.army[27]===0,'river flows n without same-turn cascade');
  fixture({watchRadius:4,watchDrain:2});tile(65,TILE_WATCH,0,3);check(computeVisibilityMask(0)[69]===1,'watch radius visibility');processTerrainTurn();check(game.army[65]===1,'watch k attrition');processTerrainTurn();check(game.army[65]===0&&game.owner[65]===-1,'watch loses occupation at zero');
  fixture({officerCost:10,goblinCost:7});tile(25,TILE_OFFICER,0,30);check(recruitAtCamp(0,25)&&game.army[25]===20&&game.extra.officers.length===1,'officer paid recruitment');
  const oldGeneral=game.army[0];runOfficers();check(game.army[0]===oldGeneral,'officer does not move capital garrison');
  tile(40,TILE_GOBLIN,0,20);check(recruitAtCamp(0,40)&&game.army[40]===13,'goblin paid recruitment');check(game.extra.engineers.reduce((a,b)=>a+b,0)===1,'engineer spawns adjacent');
  fixture({blastSize:3});tile(25,TILE_EMPTY,0,20);game.extra.engineers[25]=1;tile(26,TILE_MOUNTAIN,-1,0);tile(27,TILE_MOUNTAIN,-1,0);tile(39,TILE_MOUNTAIN,-1,0);
  check(explodeEngineer(0,25,26),'engineer explosion');check(game.terrain[26]===TILE_EMPTY&&game.terrain[27]===TILE_EMPTY&&game.terrain[39]===TILE_EMPTY&&game.extra.engineers[25]===0,'n by n explosion and consumption');
  fixture();tile(25,TILE_EMPTY,1,20);game.extra.engineers[25]=1;game.extra.carts[25]=1;executeSingleMove(1,25,26,false);check(game.extra.engineers[26]===1&&game.extra.carts[26]===1&&game.extra.engineers[25]===0,'any faction carries engineer/cart');
  fixture({turretRadius:3,turretShot:8});tile(25,TILE_TURRET,0,20);tile(28,TILE_EMPTY,1,15);tile(30,TILE_EMPTY,1,20);processTerrainTurn();check(game.army[25]===12&&game.army[28]===7&&game.army[30]===20,'turret range ammunition and hit');
  fixture({roadSteps:2});tile(25,TILE_ROAD,0,20);tile(26,TILE_ROAD,-1,0);tile(27,TILE_ROAD,-1,0);game.moveQueue=[{seq:1,type:'move',from:25,to:26},{seq:2,type:'move',from:26,to:27},{seq:3,type:'move',from:27,to:28}];advanceGameTurn();check(game.owner[27]===0&&game.owner[28]===-1&&game.moveQueue.length===1,'roads execute two steps');
  fixture({cartSteps:3});tile(25,TILE_EMPTY,0,20);game.extra.carts[25]=1;game.moveQueue=[25,26,27,28].map((from,i)=>({seq:i+1,type:'move',from,to:from+1}));advanceGameTurn();check(game.extra.carts[28]===1&&game.owner[28]===0&&game.owner[29]===-1,'cart accelerates moving stack');
  fixture({roadSteps:2});tile(25,TILE_ROAD,0,20);tile(50,TILE_ROAD,0,20);game.moveQueue=[{seq:1,type:'move',from:25,to:26},{seq:2,type:'move',from:50,to:51}];advanceGameTurn();check(game.owner[26]===0&&game.owner[51]===-1,'bonus cannot control separate army');
  fixture({jackpotChance:3,jackpotMultiplier:10});tile(25,TILE_EMPTY,0,11);tile(26,TILE_CASINO,-1,0);Math.random=()=>0;executeSingleMove(0,25,26,false);check(game.army[26]===100,'casino jackpot');
  tile(25,TILE_EMPTY,0,11);Math.random=()=>0.2;executeSingleMove(0,25,26,false);check(game.army[26]===120,'casino normal win');
  tile(25,TILE_EMPTY,0,11);Math.random=()=>0.8;executeSingleMove(0,25,26,false);check(game.army[26]===120&&game.army[25]===1,'casino loss');
  game.extra.engineers[25]=1;explodeEngineer(0,25,26);check(game.terrain[26]===TILE_EMPTY&&squareArea(26,game.rules.blastSize).every(i=>game.army[i]===0)&&squareArea(26,game.rules.blastSize+2).some(i=>game.army[i]>0),'casino blast clears area and scatters loot outside');Math.random=seeded;
  fixture({wrap:true});tile(24,TILE_EMPTY,0,11);check(isValidMoveStep(0,24,35),'wrap edge adjacency');executeSingleMove(0,24,35,false);check(game.army[35]===10,'wrap transfers army');game.selectedTile=24;handleBorderClick(-1,2);check(game.moveQueue.at(-1)?.to===35,'outside ring click queues wrap');
  fixture({wrap:false});tile(24,TILE_EMPTY,0,11);check(!isValidMoveStep(0,24,35),'hard boundary disallows wrap');
  fixture({capitals:2});tile(100,TILE_GENERAL,1,2);refreshCapitals(1);game.owner[100]=0;handleGeneralCaptured(0,1,100);check(game.players[1].alive&&game.terrain[100]===TILE_CITY,'capture one capital does not eliminate');game.owner[143]=0;handleGeneralCaptured(0,1,143);check(!game.players[1].alive&&game.terrain[143]===TILE_CITY,'last capital eliminates');
  fixture({suddenDeath:true,suddenMinutes:0.1});advanceWorldTime(5999);check(!game.extra.sudden,'sudden death waits');advanceWorldTime(1);check(game.extra.sudden&&computeVisibilityMask(0).every(v=>v===1),'sudden death unlocks all fog');triggerDisaster('mist');check(computeVisibilityMask(0).every(v=>v===1),'sudden death takes priority over mist');
  fixture();triggerDisaster('sun');check(computeVisibilityMask(0).every(v=>v===1),'sun reveals map');advanceWorldTime(3000);check(computeVisibilityMask(0).some(v=>v===0),'sun expires after 3 seconds');tile(65,TILE_EMPTY,0,5);game.selectedTile=65;triggerDisaster('mist');check(computeVisibilityMask(0)[65]===1&&computeVisibilityMask(0)[0]===0,'mist reveals current selected tile only');advanceWorldTime(10000);check(computeVisibilityMask(0)[0]===1,'mist expires');
  fixture({eventRadius:3});for(const i of [25,26,27,40,41])tile(i,TILE_MOUNTAIN,-1,0);triggerDisaster('quake');check(game.terrain[0]===TILE_GENERAL&&verifyGeneralsConnected(12,12,game.terrain,[0,143]),'quake preserves capitals and paths');triggerDisaster('volcano');check(game.terrain.includes(TILE_LAVA),'volcano creates lava');
  fixture({meteorCount:1,meteorSize:3});game.army.fill(10);const random=Math.random;Math.random=()=>0.5;triggerDisaster('meteor');Math.random=random;check(game.army.some(v=>v===0)&&game.terrain[0]===TILE_GENERAL,'meteor clears troops without erasing capitals');
  fixture({shrineGuard:200});triggerDisaster('miracle');const shrine=game.extra.shrines[0];check(shrine?.tiles.length===4&&shrine.tiles.reduce((n,i)=>n+game.army[i],0)===200&&shrine.turrets.length===8,'2x2 miracle shrine and eight turrets');for(const i of shrine.turrets)tile(i,TILE_TURRET,0,1);for(const i of shrine.tiles)tile(i,TILE_SHRINE,0,50);tile(120,TILE_CITY,0,10);processTerrainTurn();check(shrine.tiles.reduce((n,i)=>n+game.army[i],0)===208&&game.army[120]===12,'full shrine four churches and faction-wide production boost');
  fixture({warlordMax:2});triggerDisaster('warlord');check(game.players.length>2,'warlords join as new players');for(let p=2;p<game.players.length;p++)check(game.owner.reduce((n,v,i)=>n+(v===p&&game.terrain[i]===TILE_CITY?1:0),0)===2,'warlord starts with two churches');
  check(AI_LEVELS.easy.interval>AI_LEVELS.normal.interval&&AI_LEVELS.expert.budget>AI_LEVELS.hard.budget&&AI_LEVELS.expert.depth>AI_LEVELS.normal.depth,'AI speeds and strategy depth increase');
  fixture({wrap:true});tile(24,TILE_GENERAL,0,50);tile(100,TILE_CITY,0,30);game.players[0].generalIndex=24;tile(35,TILE_EMPTY,1,2);check(!executeCapitalRelocation(0,100),'relocation sees enemies across wrap boundary');tile(35,TILE_EMPTY,-1,0);check(executeCapitalRelocation(0,100)&&game.army[24]===0&&game.army[100]===30,'relocation keeps original loss rule');
  fixture();tile(25,TILE_GENERAL,0,100);game.extra.officers.push({owner:0});runOfficers();check(game.army[0]===5&&game.army[25]===100,'officers cannot draw from any capital in multi-capital mode');
  fixture();game.mode='online_host';activeRoomRawData={slots:[],config:{}};game.executedThrough.enemy=5;const fake={peerUid:'enemy',open:true,send:()=>{}};handleHostReceivedPeerData(fake,{type:'player_queue_sync',uid:'enemy',queue:[{seq:4,type:'move',from:143,to:142},{seq:6,type:'move',from:143,to:142}]});check(pendingOnlineQueues.enemy.length===1&&pendingOnlineQueues.enemy[0].seq===6,'acknowledged queue steps are not replayed');handleHostReceivedPeerData(fake,{type:'player_queue_sync',uid:localPlayerUid,queue:[{seq:10}]});check(!pendingOnlineQueues[localPlayerUid],'sender cannot submit another player queue');activeRoomRawData=null;
  fixture();const randomCap=Math.random;Math.random=()=>0;tile(25,TILE_EMPTY,0,1000000000);tile(26,TILE_CASINO,-1,0);executeSingleMove(0,25,26,false);Math.random=randomCap;check(game.army[26]===1000000000,'huge jackpot clamps before typed-array overflow');
  fixture();for(let y=0;y<12;y++)tile(y*12+6,TILE_LAVA,-1,0);ensureDryCapitalPaths(game,12,12,[0,143]);check(Array.from({length:12},(_,y)=>game.terrain[y*12+6]).some(t=>t===TILE_EMPTY),'connectivity repairs transit-only barrier');
  fixture({disasters:true,eventMinSeconds:5,eventMaxSeconds:5,eventQuake:false,eventVolcano:false,eventSun:true,eventMeteor:false,eventMist:false,eventMiracle:false,eventWarlord:false});advanceWorldTime(5000);check(game.extra.eventLog.at(-1)?.name==='放晴','automatic random event scheduling');game.isPaused=true;const elapsed=game.extra.elapsedMs;advanceGameTurn(1000);check(game.extra.elapsedMs===elapsed,'pause does not advance event time');
  fixture({roadDensity:5});tile(25,TILE_EMPTY,0,20);game.extra.engineers[25]=2;game.extra.carts[25]=1;triggerDisaster('warlord');recordReplaySnapshot();const saved=captureFrame();game.extra.engineers[25]=0;restoreFrame(saved);check(game.extra.engineers[25]===2&&game.players.length===saved.players.length,'frame restores vehicles engineers and spawned players');
  const before=JSON.stringify(captureFrame());openLiveReplayFromMatch();applyReplayFrame(0);closeReplayViewer();check(JSON.stringify(captureFrame())===before,'live replay restores actual current state');
  saveCurrentMatchReplay('test');const exported=JSON.parse(JSON.stringify(game.savedReplays[0]));check(Array.isArray(exported.frames.at(-1).extra.engineers),'JSON replay preserves extensions');
  clearTimeout(game.turnTimer);game.isRunning=false;exitMatchToLobby();applyPreset('chaos');startLocalGame();clearTimeout(game.turnTimer);game.isPaused=true;game.visionMode='full';
  const context=document.createElement('canvas').getContext('2d');for(let i=0;i<game.terrain.length;i++)if(game.terrain[i]>=TILE_RIVER)drawExpansionTile(context,0,0,38,i);
  check(true,'all terrain renderers execute');
  return results;
 });
 await page.screenshot({path:'test-artifacts/game.png'});
 const client=await browser.newPage();client.on('pageerror',e=>errors.push('client: '+e.message));await client.goto(url);await client.waitForFunction(()=>typeof initMatchSession==='function');
 const start=await page.evaluate(()=>{
  const cfg={...config,rules:game.rules,width:game.width,height:game.height};
  return {type:'match_start',config:cfg,players:game.players,mapData:{terrain:Array.from(game.terrain),owner:Array.from(game.owner),army:Array.from(game.army),portalTarget:Array.from(game.portalTarget),portalPairId:Array.from(game.portalPairId),extra:game.extra}};
 });
 await client.evaluate(data=>handleClientReceivedPeerData(data),start);
 let packets=await page.evaluate(()=>{
  game.mode='online_host';game.isPaused=false;const captured=[];hostClientConns={x:{open:true,send:p=>captured.push(p)}};
  triggerDisaster('warlord');advanceGameTurn(500);return captured;
 });
 const sync=packets.find(p=>p.type==='turn_sync');if(!sync)throw Error('No host sync');
 await client.evaluate(data=>handleClientReceivedPeerData(data),sync);
 const synced=await client.evaluate(()=>({extra:JSON.stringify(game.extra),players:game.players.length,turn:game.turn}));
 if(synced.extra!==JSON.stringify(sync.extra)||synced.players!==sync.players.length||synced.turn!==sync.turn)throw Error('Network extensions mismatch');results.push('host/client sync extensions and warlords');
 await client.evaluate(()=>openLiveReplayFromMatch());
 packets=await page.evaluate(()=>{const captured=[];hostClientConns={x:{open:true,send:p=>captured.push(p)}};advanceGameTurn(500);return captured;});
 const duringReplay=packets.find(p=>p.type==='turn_sync');await client.evaluate(data=>handleClientReceivedPeerData(data),duringReplay);
 await client.evaluate(()=>closeReplayViewer());
 if(await client.evaluate(()=>game.turn)!==duringReplay.turn)throw Error('Online replay loses live turn');results.push('online live replay buffers and restores newer turn');
 const hostReplay=await page.evaluate(()=>{
  const before=game.turn;openLiveReplayFromMatch();applyReplayFrame(0);const viewed=game.turn;
  advanceGameTurn(500);const continued=replayState.liveBackup.frame.turn===before+1&&game.turn===viewed;
  closeReplayViewer();return continued&&game.turn===before+1;
 });
 if(!hostReplay)throw Error('Host replay paused authoritative simulation');results.push('host live replay keeps authoritative simulation running');
 await page.evaluate(()=>{game.isPaused=true;clearTimeout(game.turnTimer);});
 fs.writeFileSync('test-artifacts/results.json',JSON.stringify({checks:results.length,errors,results},null,2));
 console.log(JSON.stringify({checks:results.length,errors}));await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});

