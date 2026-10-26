const cv=document.getElementById('c'),g=cv.getContext('2d'),$=id=>document.getElementById(id);
const W=800,H=500,M=40,GOAL=90,SPEEDS=[1,3,12],LV={1:'easy',3:'normal',12:'hard'},KEY='tearroom.v1';
let note='';
function defaults(){let rm=false;try{rm=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}return{speed:1,mute:false,rm,runs:[]}}
function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(raw===null)return defaults();
    const o=JSON.parse(raw);
    if(!o||typeof o!=='object'||Array.isArray(o))throw 0;
    const d=defaults();
    const runs=Array.isArray(o.runs)?o.runs.filter(r=>r&&SPEEDS.includes(r.speed)&&(r.result==='win'||r.result==='lose')&&Number.isFinite(r.sec)&&Number.isFinite(r.kills)).slice(-50):[];
    return{speed:SPEEDS.includes(o.speed)?o.speed:d.speed,mute:o.mute===true,rm:typeof o.rm==='boolean'?o.rm:d.rm,runs};
  }catch(e){note='저장값이 손상되어 기본값으로 시작했습니다.';return defaults()}
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
const S=load();

// ---- effects: only 3 declared events (hit, pickup, end) ----
let ac,master,shake=0;
function beep(f,d,type){
  if(S.mute)return;
  try{
    if(!ac){ac=new(window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.connect(ac.destination)}
    master.gain.value=0.15;
    const o=ac.createOscillator(),v=ac.createGain();o.type=type||'sine';o.frequency.value=f;
    v.gain.setValueAtTime(1,ac.currentTime);v.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+d);
    o.connect(v);v.connect(master);o.start();o.stop(ac.currentTime+d);
  }catch(e){}
}
function fx(ev){
  if(ev==='hit'){beep(140,.25,'sawtooth');if(!S.rm)shake=0.25}
  else if(ev==='pickup')beep(880,.15);
  else if(ev==='end')state==='win'?beep(660,.4):beep(110,.5,'sawtooth');
}

// ---- game ----
const IT={
 double:{g:'‖',n:'1타 2피',c:'#a8d8ff',w:2,f(){p.shots=Math.min(4,p.shots+1)}},
 cross:{g:'✚',n:'사방 발사',c:'#ffd479',w:1.5,f(){p.cross=true}},
 heart:{g:'♥',n:'생명 +1',c:'#e0364b',w:2,f(){p.max=Math.min(6,p.max+1);p.hp=Math.min(p.max,p.hp+1)}},
 //rate:{g:'»',n:'연사 속도 UP',c:'#9be37f',w:2,f(){p.rate=Math.max(0.12,p.rate*0.8)}},
 speed:{g:'↠',n:'이동 속도 UP',c:'#7fe0d4',w:2,f(){p.spd=Math.min(340,p.spd+30)}},
 //pierce:{g:'⇉',n:'관통 눈물',c:'#ffb36b',w:2,f(){p.pierce=Math.min(3,p.pierce+1)}}
};
function pickType(){const ks=Object.keys(IT);let r=Math.random()*ks.reduce((a,k)=>a+IT[k].w,0);for(const k of ks){r-=IT[k].w;if(r<=0)return k}return 'heart'}
function rnd(a,b){return a+Math.random()*(b-a)}

const keys={};
let state='start',paused=false,t=0,endT=1,p,tears,en,items,toasts,el,spawnT,kills,volleys,runSpeed,runD;
function resetRun(){
  p={x:W/2,y:H/2,vx:0,vy:0,hp:3,max:3,inv:0,cd:0,r:14,shots:1,cross:false,rate:0.32,spd:220,pierce:0};
  tears=[];en=[];items=[];toasts=[];el=0;spawnT=0.8;kills=0;volleys=0;shake=0;runD=S.speed;runSpeed=70*Math.pow(runD,0.25);
}
resetRun();
function begin(){resetRun();paused=false;state='play';endT=0}
function finish(s){
  state=s;endT=0;paused=false;for(const k in keys)keys[k]=false;
  if(s==='win')el=GOAL;
  S.runs.push({speed:runD,result:s,sec:+el.toFixed(1),kills});
  S.runs=S.runs.slice(-50);save();renderLog();fx('end');
}
function togglePause(){if(state==='play'){paused=!paused;if(paused)shake=0}}
function lostFocus(){for(const k in keys)keys[k]=false;if(state==='play')paused=true}
function hurt(){p.hp--;p.inv=1.2;fx('hit')}

function spawnFly(){
  if(en.length>=45)return;
  const s=Math.floor(Math.random()*4),j=rnd(-35,35);
  const x=s===2?M+12:s===3?W-M-12:W/2+j,y=s===0?M+12:s===1?H-M-12:H/2+j;
  if(Math.hypot(x-p.x,y-p.y)<90){spawnT=0.2;return}
  en.push({x,y,hp:1,r:11,fl:0,ph:rnd(0,6)});
}
function aim(){return[(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0),(keys.ArrowDown?1:0)-(keys.ArrowUp?1:0)]}
function fire(dx,dy){
  const d=Math.hypot(dx,dy),dirs=p.cross?[[1,0],[-1,0],[0,-1],[0,1]]:[[dx/d,dy/d]];
  for(const[ux,uy]of dirs)for(let i=0;i<p.shots;i++){
    const o=(i-(p.shots-1)/2)*11;
    tears.push({x:p.x-uy*o,y:p.y+ux*o,vx:ux*380+p.vx*0.3,vy:uy*380+p.vy*0.3,life:0.9,pen:p.pierce});
  }
  volleys++;p.cd=p.rate;
}

addEventListener('keydown',e=>{
  if(e.code.startsWith('Arrow'))e.preventDefault();
  const ui=e.target.closest&&e.target.closest('button,input,select,summary');
  if(ui&&(e.code==='Enter'||e.code==='Space'))return;
  keys[e.code]=true;
  if(e.repeat)return;
  if(state==='play'){
    if(e.code==='KeyP'||e.code==='Escape')togglePause();
    else if(!paused&&e.code.startsWith('Arrow')){const[dx,dy]=aim();if(dx||dy)fire(dx,dy)}
  }else if(state==='start'&&/^(Digit|Numpad)[123]$/.test(e.code))setLevel(SPEEDS[+e.code.slice(-1)-1]);
  else if(endT>0.6&&(e.code==='Enter'||e.code==='KeyR'))begin();
});
addEventListener('keyup',e=>keys[e.code]=false);
addEventListener('blur',lostFocus);
document.addEventListener('visibilitychange',()=>{if(document.hidden)lostFocus()});
function setLevel(v){S.speed=v;$('spd').value=v;save()}
cv.addEventListener('pointerdown',e=>{
  if(state==='play'){if(paused)paused=false;return}
  if(state==='start'){
    const r=cv.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*W,y=(e.clientY-r.top)/r.height*H;
    const i=SPEEDS.findIndex((v,k)=>x>=219+k*126&&x<=329+k*126&&y>=368&&y<=402);
    if(i>=0){setLevel(SPEEDS[i]);return}
  }
  if(endT>0.6)begin();
});
$('bStart').onclick=e=>{begin();e.target.blur()};
$('bPause').onclick=e=>{togglePause();e.target.blur()};
function renderMute(){const b=$('bMute');b.textContent=S.mute?'🔇':'🔊';b.title=S.mute?'소리 켜기':'소리 끄기';b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(S.mute))}
$('bMute').onclick=e=>{S.mute=!S.mute;if(master)master.gain.value=S.mute?0:0.15;save();renderMute();e.currentTarget.blur()};
$('rm').onchange=e=>{S.rm=e.target.checked;if(S.rm)shake=0;save();e.target.blur()};
$('spd').onchange=e=>{S.speed=+e.target.value;save();e.target.blur()};
$('bClear').onclick=e=>{S.runs=[];save();renderLog();e.target.blur()};

function update(dt){
  el+=dt;
  spawnT-=dt;
  if(spawnT<=0){spawnT=Math.max(0.35,2.2-el*0.021)/Math.pow(runD,0.7);spawnFly()}
  let ax=(keys.KeyD?1:0)-(keys.KeyA?1:0),ay=(keys.KeyS?1:0)-(keys.KeyW?1:0);
  const l=Math.hypot(ax,ay)||1;ax/=l;ay/=l;
  const k=Math.min(1,dt*12);
  p.vx+=(ax*p.spd-p.vx)*k;p.vy+=(ay*p.spd-p.vy)*k;
  p.x=Math.max(M+p.r,Math.min(W-M-p.r,p.x+p.vx*dt));
  p.y=Math.max(M+p.r,Math.min(H-M-p.r,p.y+p.vy*dt));
  p.inv-=dt;p.cd-=dt;shake=Math.max(0,shake-dt);
  const[dx,dy]=aim();
  if((dx||dy)&&p.cd<=0)fire(dx,dy);
  for(const s of tears){
    s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;
    if(s.x<M||s.x>W-M||s.y<M||s.y>H-M)s.life=0;
    const mx=s.x-s.vx*dt/2,my=s.y-s.vy*dt/2;
    const px=s.x-s.vx*dt,py=s.y-s.vy*dt,hits=[];
    for(const e of en){
      const R=e.r+14;
      if(e.hp>0&&(Math.hypot(s.x-e.x,s.y-e.y)<R||Math.hypot(mx-e.x,my-e.y)<R))hits.push(e);
    }
    hits.sort((a,b)=>Math.hypot(a.x-px,a.y-py)-Math.hypot(b.x-px,b.y-py));
    for(const e of hits){if(s.life<=0)break;e.hp--;e.fl=0.1;if(s.pen>0)s.pen--;else s.life=0}
  }
  tears=tears.filter(s=>s.life>0);
  for(const e of en){
    e.fl-=dt;e.ph+=dt*4;
    const d=Math.hypot(p.x-e.x,p.y-e.y)||1,ux=(p.x-e.x)/d,uy=(p.y-e.y)/d;
    e.x+=(ux*runSpeed-uy*Math.sin(e.ph)*35)*dt;e.y+=(uy*runSpeed+ux*Math.sin(e.ph)*35)*dt;
    e.x=Math.max(M+e.r,Math.min(W-M-e.r,e.x));e.y=Math.max(M+e.r,Math.min(H-M-e.r,e.y));
    if(e.hp>0&&d<e.r+p.r&&p.inv<=0)hurt();
  }
  en=en.filter(e=>{
    if(e.hp>0)return true;
    kills++;
    if(Math.random()<0.1)items.push({type:pickType(),x:e.x,y:e.y,life:12});
    return false;
  });
  for(const it of items){
    it.life-=dt;
    if(Math.hypot(it.x-p.x,it.y-p.y)<p.r+13){it.life=0;IT[it.type].f();toasts.push({s:IT[it.type].n,c:IT[it.type].c,t:2});fx('pickup')}
  }
  items=items.filter(i=>i.life>0);
  for(const o of toasts)o.t-=dt;
  toasts=toasts.filter(o=>o.t>0);
  if(p.hp<=0)finish('lose');
  else if(el>=GOAL)finish('win');
}

// ---- drawing ----
function circle(x,y,r,c){g.fillStyle=c;g.beginPath();g.arc(x,y,r,0,7);g.fill()}
function text(s,x,y,size,color,weight,align){g.fillStyle=color||'#efe6da';g.font=(weight||'bold')+' '+size+'px system-ui,"Malgun Gothic",sans-serif';g.textAlign=align||'center';g.fillText(s,x,y)}
function dim(a){g.fillStyle='rgba(0,0,0,'+a+')';g.fillRect(M,M,W-2*M,H-2*M)}
function draw(){
  g.save();
  if(shake>0&&!S.rm&&!paused)g.translate(rnd(-5,5),rnd(-5,5));
  g.fillStyle='#2b211c';g.fillRect(-10,-10,W+20,H+20);
  g.fillStyle='#4a3a30';g.fillRect(M,M,W-2*M,H-2*M);
  g.strokeStyle='#5c4a3d';g.lineWidth=2;g.strokeRect(M,M,W-2*M,H-2*M);
  g.fillStyle='#0f0a08';
  g.fillRect(W/2-40,M-14,80,14);g.fillRect(W/2-40,H-M,80,14);g.fillRect(M-14,H/2-40,14,80);g.fillRect(W-M,H/2-40,14,80);
  if(state==='start')drawStart();else drawPlay();
  g.restore();
}
function drawPlay(){
  for(const it of items){
    g.globalAlpha=it.life<3?(S.rm?0.5:(Math.floor(t*8)%2?0.2:1)):1;
    circle(it.x,it.y,12+(S.rm?0:Math.sin(t*5)*1.5),IT[it.type].c);
    text(IT[it.type].g,it.x,it.y+6,16,'#1a120e');
    g.globalAlpha=1;
  }
  for(const e of en){
    circle(e.x,e.y,e.r,e.fl>0?'#fff':'#6a6a8a');
    circle(e.x-4,e.y-3,2.5,'#111');circle(e.x+4,e.y-3,2.5,'#111');
    g.fillStyle='rgba(200,200,255,.5)';g.fillRect(e.x-16,e.y-12,10,5);g.fillRect(e.x+6,e.y-12,10,5);
  }
  for(const s of tears)circle(s.x,s.y,6,'#a8d8ff');
  if(state!=='lose'){
    g.globalAlpha=p.inv>0?(S.rm?0.5:(Math.floor(t*14)%2?0.15:1)):1;
    circle(p.x,p.y,p.r,'#f2d3b8');
    circle(p.x-5,p.y-2,3,'#222');circle(p.x+5,p.y-2,3,'#222');
    g.fillStyle='#8ec9ff';g.fillRect(p.x-6,p.y+3,2,6);g.fillRect(p.x+4,p.y+3,2,6);
    g.globalAlpha=1;
  }
  for(let i=0;i<p.max;i++)text('♥',M+14+i*28,M-10,26,i<p.hp?'#e0364b':'#4a3a3a');
  text('생존 '+Math.max(0,Math.ceil(GOAL-el))+'초',W-M-100,M-12,18);
  toasts.forEach((o,i)=>text(o.s,W/2,M+34+i*24,20,o.c));
  if(state==='win')drawEnd('생존 성공!','#7fe08a');
  if(state==='lose')drawEnd('사망…','#e0364b');
  if(state==='play'&&paused){
    dim(0.65);
    text('일시정지',W/2,200,48,'#a8d8ff');
    text('이동 WASD · 발사 방향키',W/2,250,18,'#efe6da','normal');
    text('P / Esc / 클릭으로 재개',W/2,300,22,'#7fe08a');
  }
}
function drawStart(){
  dim(0.55);
  text('90초',W/2,130,48,'#a8d8ff');
  text('상하좌우 문에서 파리가 몰려옵니다. '+GOAL+'초간 버티세요',W/2,172,18,'#efe6da','normal');
  text('이동   W A S D',W/2,235,22);
  text('눈물 발사   ← ↑ ↓ → (방향키)',W/2,272,22);
  text('일시정지   P 또는 Esc',W/2,309,22);
  text('시간이 갈수록 파리가 빨리 나오고, 처치하면 아이템이 떨어집니다',W/2,345,15,'#c9bcae','normal');
  SPEEDS.forEach((v,k)=>{
    const x=219+k*126,on=v===S.speed;
    g.fillStyle=on?'#a8d8ff':'rgba(255,255,255,.12)';g.fillRect(x,368,110,34);
    text(LV[v],x+55,391,18,on?'#1a120e':'#efe6da');
  });
  text('난이도 선택: 클릭 또는 숫자 1·2·3',W/2,424,13,'#c9bcae','normal');
  if(Math.floor(t*2)%2)text('Enter / 클릭으로 시작',W/2,448,22,'#7fe08a');
}
function drawEnd(title,color){
  dim(0.6);
  text(title,W/2,215,56,color);
  text('버틴 시간 '+Math.floor(el)+'초 · 처치 '+kills,W/2,255,20);
  if(endT>0.6)text('다시 시작: Enter / 클릭',W/2,310,22);
}

// ---- panel ----
const cache={};
function setT(id,v){if(cache[id]!==v){cache[id]=v;$(id).textContent=v}}
function renderStatus(){
  setT('st',state==='start'?'대기 중':state==='win'?'성공':state==='lose'?'실패':paused?'일시정지':'진행 중');
  setT('hp','♥'.repeat(Math.max(0,p.hp))+'♡'.repeat(Math.max(0,p.max-p.hp))+' ('+Math.max(0,p.hp)+'/'+p.max+')');
  setT('tm',Math.max(0,Math.ceil(GOAL-el))+'초');
  setT('kl',kills+' / '+volleys+'회');
  setT('pw','발사 ×'+p.shots+(p.cross?' + 사방':'')+(p.pierce?' + 관통'+p.pierce:''));
  setT('bStart',state==='start'?'시작':'다시 시작');
  $('bPause').disabled=state!=='play';
  setT('bPause',paused?'재개':'일시정지');
  $('spd').disabled=state==='play';
  setT('note',note);
}
function med(a){const s=[...a].sort((x,y)=>x-y),n=s.length,m=n>>1;return n%2?s[m]:(s[m-1]+s[m])/2}
function renderLog(){
  const by={};S.runs.forEach(r=>(by[r.speed]=by[r.speed]||[]).push(r));
  let h='<tr><th>난이도</th><th>판</th><th>성공</th><th>중앙값(초)</th><th>범위(초)</th></tr>';
  for(const sp of SPEEDS){
    const a=by[sp];if(!a)continue;const sc=a.map(r=>r.sec);
    h+='<tr><td>'+LV[sp]+'</td><td>'+a.length+'</td><td>'+a.filter(r=>r.result==='win').length+'</td><td>'+med(sc).toFixed(1)+'</td><td>'+Math.min(...sc).toFixed(1)+'~'+Math.max(...sc).toFixed(1)+'</td></tr>';
  }
  $('sum').innerHTML=S.runs.length?h:'<tr><td>아직 기록이 없습니다</td></tr>';
  $('recent').textContent=S.runs.slice(-10).map(r=>LV[r.speed]+' · '+(r.result==='win'?'성공':'실패')+' · '+r.sec+'초 · 처치 '+r.kills).join('\n');
}
$('spd').innerHTML=SPEEDS.map(v=>'<option value="'+v+'">'+LV[v]+'</option>').join('');
$('spd').value=S.speed;renderMute();$('rm').checked=S.rm;
renderLog();

window.__tearroom={get:()=>({state,paused,hp:p.hp,max:p.max,remaining:Math.max(0,GOAL-el),kills,volleys,enemies:en.length,speed:runSpeed})};

let last=performance.now(),acc=0;
function loop(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;t+=dt;
  if(state==='play'){if(!paused)update(dt)}else endT+=dt;
  draw();
  acc+=dt;if(acc>0.1){acc=0;renderStatus()}
  requestAnimationFrame(loop);
}
renderStatus();
requestAnimationFrame(loop);