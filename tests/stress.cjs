const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const projectRoot=path.resolve(__dirname,'..');process.chdir(projectRoot);fs.mkdirSync('test-artifacts',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('file:///'+path.resolve('index.html').replaceAll('\\','/'));
 await page.waitForFunction(()=>document.querySelectorAll('[data-rule]').length>40);
 const result=await page.evaluate(()=>{
  const output=[];
  for(const [preset,size,turns] of [['classic',30,150],['chaos',40,150],['kingdoms',100,60]]){
   applyPreset(preset);config.width=size;config.height=size;config.rules.difficulty='expert';config.rules.disasters=true;config.rules.eventMinSeconds=5;config.rules.eventMaxSeconds=5;
   document.getElementById('inpMapWidth').value=size;document.getElementById('inpMapHeight').value=size;startLocalGame();clearTimeout(game.turnTimer);
   game.players.forEach(p=>p.isBot=true);
   let worst=0,total=0,completed=0;
   for(let t=0;t<turns&&game.isRunning;t++){
    const start=performance.now();advanceGameTurn(500);const duration=performance.now()-start;worst=Math.max(worst,duration);total+=duration;completed++;
    for(let i=0;i<game.terrain.length;i++){
     if(game.army[i]<0||!Number.isFinite(game.army[i]))throw Error('Invalid army');
     if(game.terrain[i]===TILE_PORTAL&&(game.owner[i]!==-1||game.army[i]!==0))throw Error('Transit tile occupied');
     if(game.owner[i]>=game.players.length)throw Error('Invalid owner');
    }
    for(const p of game.players)if(p.alive&&playerCapitals(p.index).length===0)throw Error('Alive without capital');
   }
   output.push({preset,size,completed,players:game.players.length,averageMs:Math.round(total/completed),worstMs:Math.round(worst)});game.isRunning=false;
  }
  return output;
 });
 await page.evaluate(()=>{exitMatchToLobby();applyPreset('rivers');startLocalGame();clearTimeout(game.turnTimer);game.isPaused=true;game.visionMode='full';document.getElementById('toastContainer').replaceChildren();camera.zoom=0.7;centerCameraOnMyGeneral();});
 await page.screenshot({path:'test-artifacts/preview.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-artifacts/mobile.png'});
 await page.evaluate(()=>{exitMatchToLobby();});await page.screenshot({path:'test-artifacts/mobile-lobby.png'});
 fs.writeFileSync('test-artifacts/stress-results.json',JSON.stringify({result,errors},null,2));console.log(JSON.stringify({result,errors}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
