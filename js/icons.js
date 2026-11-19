'use strict';

const tileSpriteCache=new Map(),tileAssets={};
const tileAssetNames={[TILE_SHRINE]:'shrine',[TILE_GENERAL]:'general',[TILE_CITY]:'church',[TILE_OFFICER]:'officer',[TILE_GOBLIN]:'camp',[TILE_WATCH]:'watch',[TILE_TURRET]:'turret',[TILE_CASINO]:'casino',[TILE_ROAD]:'road',[TILE_RIVER]:'river',100:'bomb',101:'cart'};
for(const name of [...Object.values(tileAssetNames),'arrow','mountain','turret-barrel',...Array.from({length:16},(_,i)=>'road-'+i)]){const img=new Image();tileAssets[name]=img;img.onload=()=>{tileSpriteCache.clear();game.visualRevision=(game.visualRevision||0)+1;};img.src='assets/'+name+'.svg';}
function tileSprite(type,variant=0){
 const key=type+':'+variant;if(tileSpriteCache.has(key))return tileSpriteCache.get(key);
 const sprite=document.createElement('canvas');sprite.width=128;sprite.height=128;
 const c=sprite.getContext('2d');c.scale(1.28,1.28);c.lineJoin='round';c.lineCap='round';
 const asset=type===TILE_ROAD?'road-'+variant:tileAssetNames[type];
 if(asset){
  const img=tileAssets[asset];if(img?.complete&&img.naturalWidth)c.drawImage(img,0,0,100,100);
  if(type===TILE_TURRET){const barrel=tileAssets['turret-barrel'];c.save();c.translate(50,35);c.rotate(variant);if(barrel?.complete&&barrel.naturalWidth)c.drawImage(barrel,-50,-35,100,100);c.restore();}
  if(type===TILE_RIVER){const arrow=tileAssets.arrow;c.save();c.translate(50,34);c.rotate((variant&3)*Math.PI/2);if(arrow?.complete&&arrow.naturalWidth)c.drawImage(arrow,-50,-34,100,100);c.restore();}
 }
 tileSpriteCache.set(key,sprite);return sprite;
}
function drawReadableTile(c,x,y,size,index){
 const type=game.terrain[index],e=game.extra;
 if(type<TILE_RIVER&&!e?.engineers[index]&&!e?.carts[index])return;
 if(type>=TILE_RIVER){
  let variant=0;
  if(type===TILE_TURRET)variant=e?.turretAim?.[index]??0;
  if(type===TILE_RIVER||type===TILE_ROAD){for(let d=0;d<4;d++){const j=neighborIndex(index,...DIRECTIONS[d]);if(j>=0&&game.terrain[j]===type)variant|=1<<d;}if(type===TILE_RIVER)variant=(variant<<2)|Math.max(0,e.riverDir[index]);else if(!variant)variant=10;}
  const group=type===TILE_SHRINE?(e.shrines||[]).find(s=>s.tiles.includes(index)):null;
  if(group){
   const n=group.tiles.indexOf(index),source=tileSprite(type);c.save();c.fillStyle='rgba(251,191,36,.12)';c.fillRect(x,y,size,size);
   c.strokeStyle='#fbbf24';c.lineWidth=Math.max(1.5,size*.035);c.beginPath();
   if(n%2===0){c.moveTo(x+1,y);c.lineTo(x+1,y+size);}else{c.moveTo(x+size-1,y);c.lineTo(x+size-1,y+size);}
   if(n<2){c.moveTo(x,y+1);c.lineTo(x+size,y+1);}else{c.moveTo(x,y+size-1);c.lineTo(x+size,y+size-1);}
   c.stroke();c.drawImage(source,(n%2)*64,Math.floor(n/2)*64,64,64,x,y,size,size);c.restore();
  }
  else c.drawImage(tileSprite(type,variant),x,y,size,size);
  if((type===TILE_RIVER||type===TILE_ROAD)&&game.owner[index]>=0){
   const color=PLAYER_COLORS[game.players[game.owner[index]].colorIdx%PLAYER_COLORS.length];
   c.save();
   // Keep terrain readable while making faction ownership visible at a glance.
   c.globalAlpha=.16;c.fillStyle=color.hex;c.fillRect(x,y,size,size);c.globalAlpha=1;
   c.fillStyle=color.hex;c.fillRect(x,y+size*.60,size,size*.40);
   const border=Math.max(1.5,size*.075),inset=border/2;
   c.strokeStyle='#101827';c.lineWidth=Math.max(1,size*.025);c.strokeRect(x+border,y+border,size-border*2,size-border*2);
   c.strokeStyle=color.border;c.lineWidth=border;c.strokeRect(x+inset,y+inset,size-border,size-border);
   c.restore();
  }
 }
 // Vehicles are primary tile occupants, not tiny corner badges.
 if(e?.carts[index]){
  c.save();c.fillStyle='rgba(12,20,30,.78)';c.beginPath();c.ellipse(x+size*.5,y+size*.35,size*.36,size*.34,0,0,Math.PI*2);c.fill();
  c.drawImage(tileSprite(101),x-size*.08,y-size*.04,size*1.16,size*1.16);c.restore();
 }
 if(e?.engineers[index]){
  const scale=e.carts[index] ? .48 : 1;
  c.drawImage(tileSprite(100),x+(e.carts[index]?size*.58:0),y,size*scale,size*scale);
 }
}
function openTileLegend(){
 let panel=document.getElementById('tileLegend');
 if(!panel){
  panel=document.createElement('div');panel.id='tileLegend';panel.className='glass-panel';panel.style.cssText='position:fixed;z-index:80;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,94vw);max-height:80vh;overflow:auto;padding:20px;border-radius:18px;color:#e2e8f0;background:#0f172a';
  const close=document.createElement('button');close.textContent='關閉圖例 ✕';close.className='expansion-btn';close.onclick=()=>panel.remove();panel.append(close);
  const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px';
  for(const type of [TILE_GENERAL,TILE_CITY,TILE_RIVER,TILE_OFFICER,TILE_WATCH,TILE_GOBLIN,TILE_TURRET,TILE_CASINO,TILE_ROAD,TILE_SHRINE,100,101]){
   const item=document.createElement('div'),preview=document.createElement('canvas');preview.width=90;preview.height=70;const c=preview.getContext('2d');
   if(type===TILE_GENERAL)drawGeneralIcon(c,10,0,65);else if(type===TILE_CITY)drawCityIcon(c,10,0,65,true);else c.drawImage(tileSprite(type,type===TILE_RIVER?22:type===TILE_ROAD?10:0),0,0,90,90);
   item.append(preview);const name=document.createElement('div');name.textContent=type===100?'工兵炸彈':type===101?'馬車':type===TILE_SHRINE?'超級教堂 2×2':TILE_LABELS[type];name.style.fontSize='12px';item.append(name);grid.append(item);
  }
  panel.append(grid);document.body.append(panel);
 }
}
