const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
process.chdir(path.resolve(__dirname,'..'));fs.mkdirSync('test-artifacts',{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({viewport:{width:1280,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('file:///'+path.resolve('index.html').replaceAll('\\','/'));await page.waitForFunction(()=>typeof updateDisasterSummaries==='function');
 await page.locator('.rules-panel > summary').click();await page.locator('#rule-disasters').check();
 await page.locator('#options-eventSun > summary').click();await page.locator('#rule-sunSeconds').fill('17');await page.locator('#rule-sunSeconds').press('Tab');
 await page.locator('#options-eventMist > summary').click();await page.locator('#rule-mistSeconds').fill('42');await page.locator('#rule-mistSeconds').press('Tab');
 const results=await page.evaluate(()=>{
  const passed=[];function check(ok,label){if(!ok)throw Error(label);passed.push(label);}
  check(config.rules.sunSeconds===17&&config.rules.mistSeconds===42,'duration controls update rules');
  check(document.querySelector('#options-eventSun #rule-sunSeconds')&&document.querySelector('#options-eventMist #rule-mistSeconds'),'fields nested under respective weather checkbox');
  check(DISASTER_GROUPS.every(g=>g.fields.every(k=>document.querySelector(`#options-${g.key} #rule-${k}`))),'all disaster parameters grouped correctly');
  check(RULE_FIELDS.every(([key])=>document.querySelectorAll('#rule-'+key).length===1),'every setting has exactly one control');
  check(document.getElementById('summary-eventSun').textContent.includes('17')&&document.getElementById('summary-eventMist').textContent.includes('42'),'collapsed summaries reflect durations');
  const legacy=normalizeRules({eventRadius:6});check(legacy.sunSeconds===3&&legacy.mistSeconds===10&&legacy.volcanoRadius===6,'old configs preserve weather defaults and radius');
  check(normalizeRules({eventRadius:2,volcanoRadius:8}).volcanoRadius===8,'quake and volcano independently adjustable');
  check(normalizeRules({sunSeconds:0,mistSeconds:999}).sunSeconds===1&&normalizeRules({sunSeconds:0,mistSeconds:999}).mistSeconds===300,'duration limits enforced');
  return passed;
 });
 await page.locator('#rule-eventSun').uncheck();if(await page.locator('#options-eventSun').getAttribute('open')!==null)throw Error('Unchecked card remains open');
 await page.locator('#rule-eventSun').check();if(await page.locator('#rule-sunSeconds').inputValue()!=='17')throw Error('Toggle erased duration');results.push('checkbox expands/collapses settings without losing value');
 await page.locator('#card-eventSun').screenshot({path:'test-artifacts/sun-settings.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#rule-mistSeconds').scrollIntoViewIfNeeded();await page.screenshot({path:'test-artifacts/weather-mobile.png'});
 results.push(...await page.evaluate(()=>{
  const passed=[];function check(ok,label){if(!ok)throw Error(label);passed.push(label);}
  const oldRules={...config.rules};setConfigInputsDisabled(true);check(document.querySelectorAll('[data-rule]:not(:disabled)').length===0,'guest read-only includes nested parameters');setConfigInputsDisabled(false);
  const room={...config,rules:{...oldRules,sunSeconds:25,mistSeconds:55}};applyRoomConfigToLobbyUI(room);check(document.getElementById('rule-sunSeconds').value==='25'&&document.getElementById('summary-eventMist').textContent.includes('55'),'room updates fields and summaries');
  const rules=normalizeRules({...oldRules,disasters:false,sunSeconds:17,mistSeconds:42}),terrain=new Uint8Array(144),owner=new Int8Array(144).fill(-1),army=new Int32Array(144);
  const players=[0,1].map(i=>({index:i,uid:i?'enemy':localPlayerUid,name:'P'+i,colorIdx:i,team:i,alive:true,isBot:false,generalIndex:i?143:0}));
  for(const p of players){terrain[p.generalIndex]=TILE_GENERAL;owner[p.generalIndex]=p.index;army[p.generalIndex]=5;}
  initMatchSession('single',{width:12,height:12,speed:1,visionMode:'standard',rules},players,{terrain,owner,army},0);clearTimeout(game.turnTimer);
  triggerDisaster('sun');check(game.extra.sunUntil===17000&&game.extra.effects.at(-1).duration===17000,'sun mechanic and animation use configured duration');check(game.extra.eventLog.at(-1).message.includes('17'),'sun announcement uses configured duration');advanceWorldTime(16999);check(computeVisibilityMask(0).every(v=>v===1),'sun active before configured deadline');advanceWorldTime(1);check(computeVisibilityMask(0).some(v=>v===0),'sun expires at configured deadline');
  triggerDisaster('mist');check(game.extra.mistUntil===59000&&game.extra.effects.at(-1).duration===42000,'mist mechanic and animation use configured duration');check(game.extra.eventLog.at(-1).message.includes('42'),'mist announcement uses configured duration');
  game.isPaused=true;const before=game.extra.elapsedMs;advanceGameTurn(2000);check(game.extra.elapsedMs===before,'pause preserves countdown');game.isPaused=false;
  const frame=captureFrame();game.rules.sunSeconds=1;restoreFrame(frame);check(game.rules.sunSeconds===17&&game.rules.mistSeconds===42,'replay snapshot preserves duration rules');
  const packet=fullTurnPacket(frame,{});handleClientReceivedPeerData(packet);check(game.extra.mistUntil===59000&&game.extra.effects.at(-1).duration===42000,'network state preserves weather deadline and visual duration');
  exitMatchToLobby();resetDefaultSettings();check(config.rules.sunSeconds===3&&config.rules.mistSeconds===10,'reset restores original defaults');
  return passed;
 }));
 fs.writeFileSync('test-artifacts/weather-settings-results.json',JSON.stringify({checks:results.length,errors,results},null,2));console.log(JSON.stringify({checks:results.length,errors}));await browser.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
