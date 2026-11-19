'use strict';

const TILE_RIVER=6, TILE_OFFICER=7, TILE_WATCH=8, TILE_GOBLIN=9;
const TILE_TURRET=10, TILE_CASINO=11, TILE_ROAD=12, TILE_SHRINE=13;
const DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
const TILE_LABELS=['平地','山脈','教堂','主城','岩漿','傳送門','河流','軍官營地','瞭望台','哥布林營地','砲台','賭場','道路','超級教堂'];
// One schema drives defaults, input bounds, room synchronization and saved rules.
const RULE_FIELDS=[
 ['churchGrowth','教堂產兵倍率',1,0,20,0.25],['plainGrowth','平地產兵倍率（基礎每25回合）',1,0,20,0.25],['moveRate','兵力移動速度倍率',1,0.1,4,0.05],
 ['capitals','每人主城數',1,1,4], ['wrap','關閉硬邊界（四邊互通）',false],
 ['difficulty','電腦強度','normal',{easy:'簡單 · 每 2 回合一步',normal:'普通 · 每回合一步',hard:'困難 · 每回合兩步',expert:'專家 · 每回合三步'}],
 ['suddenDeath','啟用驟死賽',false], ['suddenMinutes','驟死開始（分鐘）',10,0.1,60,0.1],
 ['riverDensity','河流密度 %',5,0,15],['riverPattern','河流生成模式','mixed',{normal:'一般河流（流向出口）',whirlpool:'漩渦（封閉循環）',mixed:'混合（一般＋漩渦）'}],['riverFlow','河流每次輸兵 n',10,1,100],['riverRate','河流輸兵頻率（次／回合）',1,0.1,4,0.05],
 ['roadDensity','道路密度 %',5,0,20],['roadBonus','道路額外移速（+1 = 2倍）',1,0,3,0.25],
 ['cartCount','馬車數量',1,0,30],['cartSteps','馬車速度倍率',2,2,4],
 ['officerCount','軍官營地數量',1,0,20],['officerCost','招募軍官花費 n',300,1,500],['officerLimit','每人軍官上限',3,1,8],
 ['watchCount','瞭望台數量',1,0,30],['watchGuard','瞭望台中立兵 n',20,0,500],['watchRadius','瞭望台視野 r',4,1,12],['watchDrain','瞭望台每回合損耗 k',1,0,30],
 ['goblinCount','哥布林營地數量',1,0,20],['goblinCost','工兵招募花費 n',20,1,500],['blastSize','工兵爆破邊長 n',5,1,9],
 ['turretCount','砲台數量',3,0,30],['turretGuard','砲台中立兵力',30,0,500],['turretRadius','砲台射程半徑（2 = 5×5）',2,1,12],['turretVision','砲台視野半徑',2,1,8],['turretPercent','砲台每回合射擊兵力 %',50,1,100],['turretShot','砲台固定射擊量（0 = 按比例）',0,0,100],
 ['casinoCount','賭場數量',1,0,20],['jackpotChance','賭場大獎機率 %',3,0,20],['jackpotMultiplier','大獎倍率',10,2,50],['lavaLoss','岩漿進入／每回合扣兵 n',3,0,100],
 ['disasters','啟用隨機天災',true],['eventMinSeconds','事件最短間隔（秒）',20,5,600],['eventMaxSeconds','事件最長間隔（秒）',20,5,1200],
 ['eventQuake','地震',true],['eventVolcano','火山',true],['eventSun','放晴',true],['eventMeteor','隕石雨',true],['eventMist','迷霧',true],['eventMiracle','神蹟',true],['eventWarlord','軍閥',true],
 ['eventRadius','地震基準半徑（實際 ×2）',4,2,8],['volcanoRadius','火山基準半徑（實際 ×1.5）',4,2,8],['sunSeconds','放晴持續時間（秒）',3,1,300],['mistSeconds','迷霧持續時間（秒）',10,1,300],['meteorCount','隕石顆數',5,1,20],['meteorSize','隕石擊中邊長 n',3,1,9],
 ['shrineGuard','超級教堂中立兵力',200,50,2000],['shrineLimit','超級教堂整局上限',2,0,30],['shrineTurretGuard','神蹟砲台中立兵力',300,0,2000],['warlordMax','軍閥每次最多降落數',3,1,5],['warlordLimit','軍閥整局累計上限 n',8,0,64]
];
const RULE_DEFAULTS=Object.fromEntries(RULE_FIELDS.map(f=>[f[0],f[2]]));
const PRESETS={
 classic:{name:'經典混戰',width:30,height:30,mountainStyle:'random',mountainDensity:18,cityDensity:4,botCount:3,speed:1,portalPairs:0,lavaDensity:0,visionMode:'standard',teamMode:false,allowRelocate:true,rules:{}},
 duel:{name:'經典單挑',width:24,height:24,mountainStyle:'random',mountainDensity:16,cityDensity:3,botCount:1,speed:1,portalPairs:0,lavaDensity:0,visionMode:'standard',teamMode:false,allowRelocate:false,rules:{}},
 rivers:{name:'河谷與商道',width:40,height:30,mountainStyle:'stripes',mountainDensity:16,cityDensity:4,botCount:3,speed:1,portalPairs:2,lavaDensity:2,visionMode:'standard',teamMode:false,allowRelocate:true,rules:{riverDensity:7,roadDensity:10,cartCount:8,watchCount:6,officerCount:4,goblinCount:4,turretCount:4,casinoCount:3}},
 kingdoms:{name:'多城列國',width:40,height:40,mountainStyle:'blocks',mountainDensity:20,cityDensity:5,botCount:3,speed:1,portalPairs:2,lavaDensity:0,visionMode:'standard',teamMode:true,allowRelocate:true,rules:{capitals:3,difficulty:'hard',roadDensity:8,watchCount:8,turretCount:8,officerCount:4,goblinCount:4,suddenDeath:true,suddenMinutes:8}},
 chaos:{name:'天災遊樂場',width:40,height:40,mountainStyle:'plates',mountainDensity:18,cityDensity:4,botCount:3,speed:1,portalPairs:3,lavaDensity:4,visionMode:'standard',teamMode:false,allowRelocate:true,rules:{capitals:2,wrap:true,disasters:true,eventMinSeconds:20,eventMaxSeconds:45,riverDensity:5,roadDensity:8,cartCount:8,officerCount:4,watchCount:6,goblinCount:6,turretCount:6,casinoCount:6,suddenDeath:true,suddenMinutes:5}}
};
function normalizeRules(raw={}) {
 const rules={};
 for(const [key,,def,min,max,step] of RULE_FIELDS) {
  const value=raw[key]??(key==='roadBonus'&&Number.isFinite(raw.roadSteps)?Math.max(0,raw.roadSteps-1):key==='volcanoRadius'?raw.eventRadius:undefined)??def;
  if(typeof def==='boolean') rules[key]=typeof value==='boolean'?value:def;
  else if(typeof def==='string') rules[key]=Object.hasOwn(min,value)?value:def;
  else {const n=Number(value);rules[key]=Math.min(max,Math.max(min,Number.isFinite(n)?(step?n:Math.round(n)):def));}
 }
 rules.eventMaxSeconds=Math.max(rules.eventMinSeconds,rules.eventMaxSeconds);
 return rules;
}
config.rules=normalizeRules();
game.rules=normalizeRules();
const DISASTER_GROUPS=[
 {key:'disasters',fields:['eventMinSeconds','eventMaxSeconds'],hint:'開啟後，從已勾選的天災中隨機抽取。',summary:r=>`${r.eventMinSeconds}–${r.eventMaxSeconds} 秒一次`},
 {key:'eventQuake',fields:['eventRadius'],hint:'作用半徑為基準值的 2 倍，保留既有部隊與建築。',summary:r=>`實際半徑 ${r.eventRadius*2} 格`},
 {key:'eventVolcano',fields:['volcanoRadius'],hint:'實際作用半徑為基準值的 1.5 倍；與地震分開設定。',summary:r=>`實際半徑 ${r.volcanoRadius*1.5} 格`},
 {key:'eventSun',fields:['sunSeconds'],hint:'暫時向所有玩家顯示全圖。時間範圍 1–300 秒。',summary:r=>`持續 ${r.sunSeconds} 秒`},
 {key:'eventMeteor',fields:['meteorCount','meteorSize'],hint:'隕石擊中區域兵力歸零，保留地形。',summary:r=>`${r.meteorCount} 顆 · ${r.meteorSize}×${r.meteorSize}`},
 {key:'eventMist',fields:['mistSeconds'],hint:'暫時只顯示目前操作格附近。時間範圍 1–300 秒。',summary:r=>`持續 ${r.mistSeconds} 秒`},
 {key:'eventMiracle',fields:['shrineLimit','shrineGuard','shrineTurretGuard'],hint:'達整局上限後不再抽取神蹟；0 表示停用。每座神蹟附帶 8 座砲台，兵力獨立設定。',summary:r=>`上限 ${r.shrineLimit} 座 · 砲台各 ${r.shrineTurretGuard} 兵`},
 {key:'eventWarlord',fields:['warlordMax','warlordLimit'],hint:'累計上限不計原本玩家；已淘汰軍閥仍占名額。',summary:r=>`每次最多 ${r.warlordMax} 名 · 全局 ${r.warlordLimit} 名`}
];
function ruleControlHTML(key){
 const [,label,def,min,max,step]=RULE_FIELDS.find(f=>f[0]===key);
 const attrs=`id="rule-${key}" data-rule="${key}" onchange="readRuleControls()"`;
 const control=typeof def==='boolean'?`<input ${attrs} type="checkbox">`:typeof def==='string'?`<select ${attrs}>${Object.entries(min).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>`:`<input ${attrs} type="number" min="${min}" max="${max}" step="${step||1}">`;
 return `<label class="rule-field ${typeof def==='boolean'?'rule-toggle':''}"><span>${label}</span>${control}</label>`;
}
const TILE_SETTING_GROUPS=[
 ['river','河流',['riverDensity','riverPattern','riverFlow','riverRate']],['road','道路',['roadDensity','roadBonus']],
 ['portal','傳送門',[]],['lava','岩漿',['lavaLoss']],
 ['cart','馬車',['cartCount','cartSteps']],['officer','軍官營地',['officerCount','officerCost','officerLimit']],
 ['watch','瞭望台',['watchCount','watchGuard','watchRadius','watchDrain']],
 ['goblin','工兵營地',['goblinCount','goblinCost','blastSize']],
 ['turret','砲台',['turretCount','turretGuard','turretRadius','turretVision','turretPercent','turretShot']],
 ['casino','賭場',['casinoCount','jackpotChance','jackpotMultiplier']]
];
function settingsGroupHTML(id,title,keys,extra=''){
 const hints={river:'主堡周圍 5×5 不生成河流。頻率 0.5 = 每 2 回合輸兵，0.25 = 每 4 回合；漩渦箭頭會持續循環。',road:'道路加成 +1 代表 2 倍移速；會再乘上整體兵力移動速度。',production:'移速 0.5 = 每 2 回合一步，0.25 = 每 4 回合一步；小數進度會保留。平地產兵以每 25 回合為基礎。',goblin:'爆破會清空範圍內所有陣營兵力，並將山格轉成平地。',officer:'軍官不能動用主堡兵力，也會避開玩家操作位置與排隊起點周圍 5×5。'};
 return '<fieldset class="setting-group" id="settings-'+id+'"><legend>'+title+'</legend>'+(hints[id]?'<p>'+hints[id]+'</p>':'')+'<div class="settings-grid">'+extra+keys.map(ruleControlHTML).join('')+'</div></fieldset>';
}
function initRuleControls() {
 const portalControl=document.getElementById('inpPortalPairs').parentElement;
 const lavaControl=document.getElementById('inpLavaDensity').parentElement;
 const modes=[['production','產兵與移動',['churchGrowth','plainGrowth','moveRate']],['capitals','主城',['capitals']],['boundary','地圖邊界',['wrap']],['ai','電腦強度',['difficulty']],['sudden','驟死賽',['suddenDeath','suddenMinutes']]];
 const modeHTML='<details class="settings-section"><summary>對局模式</summary><div class="setting-groups">'+modes.map(g=>settingsGroupHTML(...g)).join('')+'</div></details>';
 const tileHTML='<details class="settings-section" id="tileSettings" open><summary>特殊格子與兵力</summary><div class="setting-groups">'+TILE_SETTING_GROUPS.map(([id,title,keys])=>settingsGroupHTML(id,title,keys,id==='portal'?'<div id="portalSettingsSlot" class="legacy-setting-slot"></div>':id==='lava'?'<div id="lavaSettingsSlot" class="legacy-setting-slot"></div>':'')).join('')+'</div></details>';
 document.getElementById('expansionRules').innerHTML=modeHTML+tileHTML+`<section class="disaster-settings"><h3>天災設定</h3><p>勾選是否啟用，再展開下方的「調整參數」。取消勾選不會清除數值。</p>${DISASTER_GROUPS.map(g=>{
  const label=RULE_FIELDS.find(f=>f[0]===g.key)[1];
  return `<article class="disaster-card" id="card-${g.key}"><div class="disaster-heading"><label for="rule-${g.key}"><input id="rule-${g.key}" data-rule="${g.key}" type="checkbox" onchange="onDisasterToggle('${g.key}')"><span>${label}</span></label><span id="status-${g.key}" class="disaster-status"></span></div><details id="options-${g.key}" class="disaster-options"><summary>調整參數 <span id="summary-${g.key}"></span></summary><p>${g.hint}</p><div class="settings-grid">${g.fields.map(ruleControlHTML).join('')}</div></details></article>`;
 }).join('')}</section>`;
 document.getElementById('portalSettingsSlot').append(portalControl);
 document.getElementById('lavaSettingsSlot').append(lavaControl);
 document.getElementById('legacyOptionalTerrains')?.remove();
 document.getElementById('presetSelect').innerHTML='<option value="">選擇設定檔…</option>'+Object.entries(PRESETS).map(([id,p])=>`<option value="${id}">${p.name}</option>`).join('');
 renderRuleControls();
}
function onDisasterToggle(key){
 readRuleControls();
 document.getElementById('options-'+key).open=config.rules[key];
}
function updateDisasterSummaries(){
 for(const g of DISASTER_GROUPS){
  const card=document.getElementById('card-'+g.key);if(!card)continue;
  const enabled=config.rules[g.key],active=enabled&&(g.key==='disasters'||config.rules.disasters);
  card.classList.toggle('is-disabled',!enabled);
  document.getElementById('status-'+g.key).textContent=active?'已啟用':enabled?'待開啟天災總開關':'未啟用';
  document.getElementById('summary-'+g.key).textContent=g.summary(config.rules);
 }
}

function renderRuleControls() {
 for(const [key,,def] of RULE_FIELDS){const el=document.getElementById('rule-'+key);if(!el)continue;if(typeof def==='boolean')el.checked=config.rules[key];else el.value=config.rules[key];}
 updateDisasterSummaries();
}
function readRuleControls() {
 if(activeRoomCode&&!isRoomHost)return;
 const values={};
 for(const [key,,def] of RULE_FIELDS){const el=document.getElementById('rule-'+key);values[key]=typeof def==='boolean'?el.checked:el.value;}
 config.rules=normalizeRules(values);renderRuleControls();syncRoomConfigIfHost();
}
function applyPreset(id) {
 if(activeRoomCode&&!isRoomHost)return;
 const p=PRESETS[id];if(!p)return;
 Object.assign(config,p,{rules:normalizeRules(p.rules)});
 for(const [key,el] of Object.entries({width:'inpMapWidth',height:'inpMapHeight',mountainDensity:'inpMountainDensity',mountainStyle:'inpMountainStyle',cityDensity:'inpCityDensity',botCount:'inpBotCount',portalPairs:'inpPortalPairs',lavaDensity:'inpLavaDensity'})) document.getElementById(el).value=config[key];
 document.getElementById('chkAllowRelocate').checked=config.allowRelocate;
 renderRuleControls();setLobbySpeed(config.speed);setLobbyVisionMode(config.visionMode);setLobbyTeamMode(config.teamMode);updateConfigLabels();
 showToast('已套用「'+p.name+'」','sky');
}
function isChurch(terrain){return terrain===TILE_CITY||terrain===TILE_SHRINE;}
function neighborIndex(index,dx,dy) {
 let x=index%game.width+dx,y=Math.floor(index/game.width)+dy;
 if(game.rules.wrap){x=(x+game.width)%game.width;y=(y+game.height)%game.height;}
 return x<0||y<0||x>=game.width||y>=game.height?-1:y*game.width+x;
}
function moveDirection(from,to) {
 for(const [dx,dy] of DIRECTIONS)if(neighborIndex(from,dx,dy)===to)return [dx,dy];
 return null;
}
function tileDistance(a,b) {
 let dx=Math.abs(a%game.width-b%game.width),dy=Math.abs(Math.floor(a/game.width)-Math.floor(b/game.width));
 if(game.rules.wrap){dx=Math.min(dx,game.width-dx);dy=Math.min(dy,game.height-dy);}
 return dx+dy;
}
function playerCapitals(playerIdx) {
 const result=[];for(let i=0;i<game.terrain.length;i++)if(game.terrain[i]===TILE_GENERAL&&game.owner[i]===playerIdx)result.push(i);
 return result;
}
function refreshCapitals(playerIdx) {
 const p=game.players[playerIdx];p.generalIndices=playerCapitals(playerIdx);
 if(!p.generalIndices.includes(p.generalIndex))p.generalIndex=p.generalIndices[0]??-1;
}
function chooseRandom(list){return list.length?list[Math.floor(Math.random()*list.length)]:undefined;}
function shuffle(list){for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;}



