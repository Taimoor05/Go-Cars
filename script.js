window.__goCars=1;
/* ERRBOX: JS error aaye to screen ke neeche laal box me dikhao (phone pe console nahi hota) */
addEventListener('error',e=>{try{const d=document.createElement('div');d.style.cssText='position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#b00020;color:#fff;font:13px monospace;padding:8px;white-space:pre-wrap';d.textContent='ERROR: '+e.message+'  (line '+e.lineno+')';document.body.append(d)}catch(_){}});
const ACC={user:null}; // account state (must be declared before the first render)
const $=id=>document.getElementById(id);
const cv=$('c'),ctx=cv.getContext('2d');
let W,H;
function size(){const P=innerHeight>innerWidth;W=cv.width=P?innerHeight:innerWidth;H=cv.height=P?innerWidth:innerHeight}
size();addEventListener('resize',size);addEventListener('orientationchange',()=>setTimeout(size,200));
let paused=false,editing=false,mode='menu',G=null,marks=[],smoke=[],t=0,wa=0,grab=null;
const MAXW=110,car={x:0,y:0,a:0,vx:0,vy:0},cam={x:0,y:0},inp={},keys={};
const SDEF={steer:1,wheelTouch:1,center:1,power:1,top:1,brake:1,zoom:1,btnSize:1,wheelSize:1,uiOpacity:.9,swap:0,showSpd:1,unit:'kmh',autoDrift:0,fx:1,beam:1,hudText:1,sound:1,volume:.7,ghost:1,night:0,weather:0,shake:1,cdown:1,wrong:1,mmSolo:0};
let S=Object.assign({},SDEF),L={};
try{const j=JSON.parse(localStorage.getItem('gocars_v1')||'{}');Object.assign(S,j.S||{});L=j.L||{}}catch(e){}
function save(){try{localStorage.setItem('gocars_v1',JSON.stringify({S,L}))}catch(e){}ACC.push&&ACC.push()}

/* ---------- sound: sab kuch Web Audio se bana hai (koi audio file nahi) ---------- */
const SND=(()=>{
  let ac=null,master,noiseBuf,eng,scr,wal,gear=0,lastThud=0,beepT=0,pthr=0,ecar=-1;
  const prof=()=>ESND[(CARS[GAR.car]||CARS[0]).sn]||ESND.i6;
  const now=()=>ac.currentTime;
  const nsrc=()=>{const s=ac.createBufferSource();s.buffer=noiseBuf;s.loop=true;return s};
  function init(){
    if(ac){if(ac.state!=='running')ac.resume().catch(()=>{});return}
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    try{ac=new AC()}catch(e){ac=null;return}
    master=ac.createGain();master.gain.value=0;
    const comp=ac.createDynamicsCompressor();master.connect(comp);comp.connect(ac.destination);
    noiseBuf=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate);
    const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    // engine: 3 oscillators -> distortion -> lowpass -> gain
    const sh=ac.createWaveShaper(),cv=new Float32Array(257);
    for(let i=0;i<257;i++)cv[i]=Math.tanh((i/128-1)*2.2);sh.curve=cv;
    const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=500;lp.Q.value=2;
    const og=ac.createGain();og.gain.value=0;
    const o1=ac.createOscillator(),o2=ac.createOscillator(),o3=ac.createOscillator();
    o1.type='sawtooth';o2.type='square';o3.type='sawtooth';
    const mg=[o1,o2,o3].map(o=>{const g=ac.createGain();g.gain.value=.3;o.connect(g);g.connect(sh);o.start();return g});
    const wo=ac.createOscillator(),wng=ac.createGain();wo.type='sine';wo.frequency.value=1500;wng.gain.value=0;wo.connect(wng);wng.connect(master);wo.start(); // turbo / supercharger whine
    sh.connect(lp);lp.connect(og);og.connect(master);
    const lfo=ac.createOscillator(),lg=ac.createGain();lfo.frequency.value=20;lg.gain.value=0;lfo.connect(lg);lg.connect(og.gain);lfo.start(); // V8 burble
    eng={o1,o2,o3,lp,og,lfo,lg,mg,wo,wg:wng};
    // tyre screech
    const sb=ac.createBiquadFilter();sb.type='bandpass';sb.frequency.value=1500;sb.Q.value=7;
    const sg=ac.createGain();sg.gain.value=0;const sn=nsrc();sn.connect(sb);sb.connect(sg);sg.connect(master);sn.start();
    const so=ac.createOscillator(),sog=ac.createGain();so.type='triangle';so.frequency.value=900;sog.gain.value=0;so.connect(sog);sog.connect(master);so.start();
    scr={bp:sb,g:sg,so,sog};
    // wall scrape
    const wb=ac.createBiquadFilter();wb.type='lowpass';wb.frequency.value=1100;
    const wg=ac.createGain();wg.gain.value=0;const wn=nsrc();wn.connect(wb);wb.connect(wg);wg.connect(master);wn.start();
    wal={g:wg};
    apply();
  }
  function apply(){if(!ac)return;master.gain.setTargetAtTime(S.sound?Math.pow(S.volume,1.5):0,now(),.03)}
  function tone(type,f0,f1,dur,peak,delay){
    if(!ac)return;const t=now()+(delay||0),o=ac.createOscillator(),g=ac.createGain();
    o.type=type;o.frequency.setValueAtTime(f0,t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t+dur);
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(peak,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.05);
  }
  function burst(dur,f,q,peak,delay,type){
    if(!ac)return;const t=now()+(delay||0),s=nsrc(),fl=ac.createBiquadFilter(),g=ac.createGain();
    fl.type=type||'bandpass';fl.frequency.value=f;fl.Q.value=q;
    g.gain.setValueAtTime(peak,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(fl);fl.connect(g);g.connect(master);s.start(t,Math.random()*1.5);s.stop(t+dur+.05);
  }
  function drive(p){
    if(!ac)return;const t=now();
    if(!p){eng.og.gain.setTargetAtTime(0,t,.08);eng.wg.gain.setTargetAtTime(0,t,.08);eng.lg.gain.setTargetAtTime(0,t,.08);scr.g.gain.setTargetAtTime(0,t,.05);scr.sog.gain.setTargetAtTime(0,t,.05);wal.g.gain.setTargetAtTime(0,t,.05);beepT=0;return}
    const E=prof(),C0=CARS[GAR.car]||CARS[0],X=cm().x|0,thr=p.race?1:0,vn=p.v/p.top,GW=E.gw;
    if(ecar!==GAR.car){ecar=GAR.car;[eng.o1,eng.o2,eng.o3].forEach((o,i)=>{o.type=E.t[i]});E.mix.forEach((v,i)=>eng.mg[i].gain.setTargetAtTime(v,t,.05))}
    gear=Math.min(E.g-1,Math.floor(vn/GW));                  // each car has its own gear count
    const r=Math.max(0,Math.min(1,(vn-gear*GW)/GW));
    const rpm=p.v<.25?(thr?.45:0):.12+.88*r;
    const f=(E.f0+rpm*E.fs)*(C0.pf||1);
    eng.o1.frequency.setTargetAtTime(f,t,.14);eng.o2.frequency.setTargetAtTime(f*E.h[0],t,.14);eng.o3.frequency.setTargetAtTime(f*E.h[1],t,.14);
    eng.lp.frequency.setTargetAtTime((E.lp0+rpm*E.lpm+thr*450)*[1,1.18,1.4][X],t,.15);
    const lvl=((thr?.2:.09)+rpm*.07)*[1,1.08,1.2][X];
    eng.og.gain.setTargetAtTime(lvl,t,.18);
    eng.lfo.frequency.setTargetAtTime(f*E.lr,t,.1);eng.lg.gain.setTargetAtTime(lvl*E.ld,t,.1);
    eng.wo.frequency.setTargetAtTime(E.wf0+rpm*E.wfs,t,.08);eng.wg.gain.setTargetAtTime(E.wh?E.wh*(thr?1:.2)*(.25+rpm)*.05:0,t,.1);
    if(pthr&&!thr&&rpm>.5){if(E.bov)burst(.3,E.bov,1.3,.2,0,'bandpass');if((E.pop&&X>=1)||X>=2){burst(.05,260,1,.35,.02,'lowpass');burst(.05,300,1,.28,.12,'lowpass')}}
    pthr=thr;
    // tyre screech: drift / handbrake / hard braking
    const lat=Math.abs(p.lat);let sq=Math.max(0,Math.min(1,(lat-2.2)/5))*.9;
    if(p.hand&&p.sp>4)sq=Math.max(sq,.45);
    if(p.brake&&p.sp>7)sq=Math.max(sq,.18);
    const dd=p.dr||0;sq=Math.max(sq,dd*.85);
    scr.g.gain.setTargetAtTime(sq*.32,t,.04);
    scr.sog.gain.setTargetAtTime(dd>.2?dd*.04:0,t,.06);scr.so.frequency.setTargetAtTime(680+lat*55+p.v*18+Math.sin(performance.now()/90)*25,t,.05);
    scr.bp.frequency.setTargetAtTime(1300+Math.min(1,lat/8)*900,t,.1);
    // wall scrape + hit
    wal.g.gain.setTargetAtTime(p.wall&&p.v>1.5?Math.min(1,p.v/10)*.16:0,t,.04);
    if(p.hit>.12&&performance.now()-lastThud>220){lastThud=performance.now();thud(p.hit)}
    // reverse beeper
    if(p.rev&&p.sp<-.3){beepT-=p.dt;if(beepT<=0){tone('square',1000,1000,.14,.08);beepT=.6}}else beepT=0;
  }
  function thud(a){tone('sine',150,40,.32,Math.min(1,.4+a)*.9);burst(.2,500,.7,.55*Math.min(1,.3+a),0,'lowpass')}
  return{
    init,apply,drive,thud,
    click(){tone('square',620,420,.07,.1)},
    ratchet(){burst(.03,2600,2,.35,0);burst(.03,3200,2,.3,.05)},
    chime(){tone('triangle',880,880,.35,.25);tone('triangle',1320,1320,.5,.22,.09)},
    fanfare(){[523,659,784,1047].forEach((f,i)=>{tone('triangle',f,f,i===3?.9:.22,.28,i*.13);tone('square',f,f,i===3?.9:.22,.07,i*.13)})},
    startup(){tone('sawtooth',40,150,.5,.2);burst(.35,400,.6,.25,0,'lowpass')},
    suspend(){if(ac)ac.suspend().catch(()=>{})}
  };
})();
['pointerdown','pointerup','touchend','keydown','click'].forEach(n=>addEventListener(n,()=>SND.init(),{passive:true}));
document.addEventListener('visibilitychange',()=>{if(document.hidden)SND.suspend();else SND.init()});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button');if(b&&!b.classList.contains('pedal'))SND.click()},true);


/* ---------- garage: companies, cars, mods ---------- */
const D=(b,n,c,s,L,W,rw,fw,nose,cab,cl,x,pw,tp,gr,dr)=>Object.assign({b,n,c,s,L,W,rw,fw,nose,cab,cl,pw,tp,gr,dr},x);
const CARS=[
 D('BMW','M2','#1e6bff','#fff',96,21,.95,.9,14,-4,30,{kid:1},1,1,1.15,1.15),
 D('BMW','M4','#1c9a62','#fff',102,22,.95,.88,16,-5,30,{kid:1},1.12,1.08,1.1,1),
 D('BMW','M5','#17181c','#1e6bff',112,23,.95,.9,16,-6,36,{kid:1},1.25,1.2,.95,.9),
 D('Dodge','Charger','#f26a1b','#111',114,24,1,.92,14,-6,36,{ds:1,hood:1},1.15,1.05,.95,1.1),
 D('Dodge','Challenger Hellcat','#d4121f','#f2f2f2',108,24,1,.92,12,-6,32,{ds:1,hood:1},1.1,1.05,.95,1.2),
 D('Dodge','Viper','#f5f5f5','#1e6bff',110,21,.85,.7,30,-14,26,{ds:1},1.3,1.3,.9,1.05),
 D('Ferrari','F8 Tributo','#d4121f','#fff',106,21,.9,.75,26,-6,28,{},1.3,1.3,1.15,.9),
 D('Ferrari','F40','#b30f1d','#fff',104,22,1,.7,24,-8,26,{wing:1},1.25,1.35,.95,1.1),
 D('Ferrari','Roma','#ffd400','#111',112,21,.9,.8,30,-12,30,{},1.15,1.2,1.2,.95),
 D('Toyota','GR Supra','#ff6a00','#fff',104,22,.92,.85,20,-6,30,{},1.2,1.18,1.1,1.1),
 D('Toyota','GR86','#00a3a3','#fff',98,21,.95,.9,16,-4,28,{ds:1},1,1,1.2,1.3),
 D('Toyota','GR Corolla','#6b7280','#e63946',94,22,.95,.92,12,-2,32,{ds:1},1.1,1.05,1.2,1),
 D('Nissan','GT-R','#c0c0c8','#c3002f',108,23,.95,.9,15,-6,32,{hood:1},1.3,1.25,1.25,.95),
 D('Nissan','370Z','#7a1fa2','#fff',100,22,.92,.85,18,-6,28,{},1.1,1.1,1.1,1.15),
 D('Nissan','Silvia S15','#f2f2f2','#111',98,21,.95,.9,14,-4,28,{ds:1},.95,1,.9,1.5),
 D('Lamborghini','Huracan','#7ac943','#111',104,22,.9,.7,28,-8,26,{},1.3,1.3,1.15,.9),
 D('Lamborghini','Aventador','#ff7a00','#111',112,23,.9,.68,30,-10,28,{},1.45,1.4,1.05,.9),
 D('Lamborghini','Countach','#f5f5f5','#111',108,22,.95,.7,26,-8,26,{wing:1},1.3,1.35,.9,1.1)
],BRANDS=['BMW','Dodge','Ferrari','Toyota','Nissan','Lamborghini'],
SH='<path d="M10 6H38V28Q38 42 24 45Q10 42 10 28Z" ',
LOGO={
 BMW:'<circle cx="24" cy="24" r="22" fill="#222" stroke="#ccc" stroke-width="2"/><path d="M24 24V7A17 17 0 0 0 7 24Z" fill="#fff"/><path d="M24 24V7A17 17 0 0 1 41 24Z" fill="#1c69d4"/><path d="M24 24H41A17 17 0 0 1 24 41Z" fill="#fff"/><path d="M24 24V41A17 17 0 0 1 7 24Z" fill="#1c69d4"/>',
 Dodge:'<polygon points="6,36 24,10 31,10 13,36" fill="#d4121f"/><polygon points="19,36 37,10 44,10 26,36" fill="#d4121f"/>',
 Ferrari:SH+'fill="#ffd400" stroke="#111" stroke-width="2"/><rect x="11" y="7" width="8.6" height="4" fill="#009246"/><rect x="19.6" y="7" width="8.6" height="4" fill="#fff"/><rect x="28.2" y="7" width="8.6" height="4" fill="#ce2b37"/><path d="M17 38C18 34 20 32 20 29C19 26 21 23 24 22L25 18L24 14L27 16L29 13L30 16C31 19 29 22 28 25C30 27 33 29 34 33L36 32L36 34L33 36L30 33L27 32L26 35L28 39L25 39L23 35L22 38Z" fill="#111"/><path d="M17 38C13 37 12 32 15 28" stroke="#111" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
 Toyota:'<g fill="none" stroke="#eb0a1e" stroke-width="2.4"><ellipse cx="24" cy="24" rx="21" ry="14"/><ellipse cx="24" cy="26" rx="7.5" ry="12"/><ellipse cx="24" cy="18" rx="13" ry="5.5"/></g>',
 Nissan:'<circle cx="24" cy="24" r="17" fill="none" stroke="#ccc" stroke-width="3.5"/><rect x="3" y="19" width="42" height="10" rx="2" fill="#c3002f"/><text x="24" y="27" font-size="7.5" font-weight="bold" font-family="sans-serif" text-anchor="middle" fill="#fff">NISSAN</text>',
 Lamborghini:SH+'fill="#111" stroke="#c9a227" stroke-width="2.4"/><path d="M14 14L24 22L34 14L30 27L24 33L18 27Z" fill="#c9a227"/>'
},
PAINT=[null,'#d4121f','#1e6bff','#22b455','#ffc400','#9b30ff','#f5f5f5','#18181c','#ff4fa3','#ff6a00','#00e5ff','#8a8f98','#7a1f2b','#0e3b2e','#2a2f6b'],
PAINTN=['Stock','Red','Blue','Green','Yellow','Purple','White','Black','Pink','Orange','Cyan','Silver','Maroon','Dark green','Navy'],
SPOIL=['None','Small lip','Ducktail','Big wing','GT double','Carbon blade'],
STRP=['Stock','None','Wide','Side lines','Dual','Triple','Checker','Flames','Chevrons','Lightning','Diagonal','Dots','Two-tone','Hood+trunk','Number 7'],
LIV=[null,'#ffffff','#111111','#d4121f','#1e6bff','#22b455','#ffc400','#ff6a00','#9b30ff','#ff4fa3','#00e5ff'],
LIVN=['Stock','White','Black','Red','Blue','Green','Yellow','Orange','Purple','Pink','Cyan'],
NEON=[['Off',null],['Cyan','#00e5ff'],['Pink','#ff2fd0'],['Green','#39ff14'],['Red','#ff1744'],['Purple','#a64dff'],['Yellow','#ffe600'],['Blue','#2f6bff'],['White','#ffffff'],['Orange','#ff8a00'],['Rainbow','rb']],
NEONN=NEON.map(n=>n[0]),NSTY=['Full glow','Edge ring','Pulse','Strobe'],
HOOD=['Stock','Scoop','Carbon','Vents','Twin scoop'],TINT=['Dark','Light','Blue','Mirror'],TNTC=['#1b1b24','#4a5560','#17325a','#a9b4bf'],
LGT=[['Yellow','#ffe04a'],['White','#ffffff'],['Ice blue','#7fd0ff'],['Red','#ff3030'],['Green','#6dff6d'],['Pink','#ff7ad9']],LGTN=['Yellow','White','Ice blue','Red','Green','Pink'],
EXH=['Stock','Sport','Race'],
SPC=[['Black','#111'],['Body','body'],['White','#f2f2f2'],['Red','#d4121f'],['Blue','#1e6bff'],['Gold','#d4a017'],['Lime','#7ac943']],SPCN=['Black','Body','White','Red','Blue','Gold','Lime'],
SHAPES=[
 [[-1,.8],[-.92,.93],[-.6,1],[.1,1],[.6,.95],[.9,.82],[1,.68]],
 [[-1,.82],[-.9,.95],[-.55,1],[.2,.98],[.62,.9],[.92,.78],[1,.62]],
 [[-1,.9],[-.95,.98],[-.4,1],[.4,1],[.85,.96],[.97,.85],[1,.72]],
 [[-1,.96],[-.93,1],[.75,1],[.93,.97],[1,.85]],
 [[-1,.9],[-.8,1],[-.2,.94],[.2,.9],[.55,.97],[.92,.85],[1,.6]],
 [[-1,.78],[-.75,.98],[-.25,1],[.05,.8],[.45,.72],[.85,.5],[1,.28]],
 [[-1,.82],[-.7,.98],[-.3,1],[0,.85],[.5,.74],[.88,.55],[1,.38]],
 [[-1,.85],[-.65,1],[-.1,.95],[.3,.7],[.7,.5],[1,.2]],
 [[-1,.75],[-.85,.95],[-.5,1],[-.1,.9],[.4,.82],[.85,.62],[1,.45]],
 [[-1,.88],[-.8,1],[-.3,.97],[.2,.82],[.7,.66],[1,.4]],
 [[-1,.8],[-.88,.94],[-.5,.99],[.1,.95],[.6,.85],[.92,.7],[1,.55]],
 [[-1,.85],[-.85,.97],[-.4,1],[.15,.93],[.6,.88],[.92,.74],[1,.6]],
 [[-1,.95],[-.9,1],[.2,1],[.7,.95],[.95,.82],[1,.7]],
 [[-1,.95],[-.9,1],[-.3,1],[.4,.98],[.85,.92],[1,.8]],
 [[-1,.82],[-.9,.95],[-.45,1],[.25,.92],[.7,.84],[.95,.7],[1,.58]],
 [[-1,.9],[-.88,.98],[-.5,1],[-.05,.9],[.5,.84],[.9,.72],[1,.58]],
 [[-1,.9],[-.9,.97],[-.3,1],[.5,.94],[.9,.8],[1,.65]]
],
LOOK={
 'M2':{p:0,lt:0,tl:0,cs:0,sn:'i6',pf:1.06,wx:[-.58,.52]},
 'M4':{p:1,lt:2,tl:3,cs:1,sn:'i6',pf:1},
 'M5':{p:2,lt:2,tl:1,cs:0,sn:'v8tt',pf:1},
 'Charger':{p:13,lt:1,tl:1,cs:0,sn:'v8push',pf:1,wl:20},
 'Challenger Hellcat':{p:3,lt:3,tl:3,cs:0,sn:'v8sc',pf:1,wl:20},
 'Viper':{p:4,lt:2,tl:4,cs:2,sn:'v10',vt:1,wx:[-.6,.58]},
 'F8 Tributo':{p:8,lt:2,tl:2,cs:2,sn:'flat8',vt:1,wx:[-.6,.56]},
 'F40':{p:9,lt:0,tl:2,cs:2,sn:'f40',pf:.95,vt:1,wx:[-.62,.58]},
 'Roma':{p:10,lt:1,tl:4,cs:3,sn:'v8gt',pf:.92},
 'GR Supra':{p:11,lt:2,tl:1,cs:1,sn:'i6b',pf:.95},
 'GR86':{p:14,lt:2,tl:3,cs:1,sn:'boxer'},
 'GR Corolla':{p:12,lt:3,tl:4,cs:0,sn:'tri',wl:17},
 'GT-R':{p:13,lt:0,tl:2,cs:0,sn:'v6tt',wl:19},
 '370Z':{p:15,lt:2,tl:1,cs:3,sn:'v6na'},
 'Silvia S15':{p:16,lt:3,tl:0,cs:1,sn:'i4t',wl:17},
 'Huracan':{p:6,lt:2,tl:3,cs:2,sn:'v10na',pf:1.05,vt:1,wx:[-.6,.56]},
 'Aventador':{p:5,lt:2,tl:4,cs:2,sn:'v12',pf:.96,vt:1,wl:20,wx:[-.6,.58]},
 'Countach':{p:7,lt:0,tl:1,cs:2,sn:'v12raw',pf:.9,vt:1,wx:[-.62,.6]}
},
MD={e:0,t:0,y:0,b:0,p:0,s:0,st:0,n:0,nc:0,ns:0,sc:0,pc:0,h:0,w:0,l:0,x:0,v:2};
CARS.forEach(c=>Object.assign(c,LOOK[c.n]||{}));
/* engine sound profiles: t=oscillator types, mix, h=harmonic ratios, f0/fs=pitch, lp0/lpm=brightness, lr/ld=burble, g/gw=gears, wh=turbo/blower whine, bov=blow-off, pop=exhaust pops */
const ESND={
 i6:{t:['sawtooth','triangle','sawtooth'],mix:[.5,.35,.14],h:[.5,2.01],f0:44,fs:78,lp0:380,lpm:1250,lr:1.5,ld:.06,g:6,gw:2.9,wh:.5,wf0:1500,wfs:1800,bov:3200,pop:0},
 i6b:{t:['sawtooth','sawtooth','triangle'],mix:[.5,.3,.16],h:[.5,2.01],f0:41,fs:76,lp0:340,lpm:1200,lr:1.5,ld:.08,g:8,gw:2.1,wh:.65,wf0:1400,wfs:2000,bov:3400,pop:1},
 v8tt:{t:['sawtooth','square','sawtooth'],mix:[.5,.3,.14],h:[.5,2.01],f0:38,fs:72,lp0:330,lpm:1150,lr:.5,ld:.16,g:8,gw:2.1,wh:.35,wf0:1500,wfs:1600,bov:3000,pop:1},
 v8push:{t:['square','sawtooth','square'],mix:[.45,.4,.1],h:[.5,1.5],f0:31,fs:55,lp0:260,lpm:800,lr:.5,ld:.3,g:4,gw:3.8,wh:0,wf0:1000,wfs:1000,bov:0,pop:1},
 v8sc:{t:['square','sawtooth','square'],mix:[.45,.4,.1],h:[.5,1.5],f0:33,fs:58,lp0:270,lpm:850,lr:.5,ld:.28,g:6,gw:2.9,wh:.95,wf0:1200,wfs:3200,bov:0,pop:1},
 v10:{t:['sawtooth','square','sawtooth'],mix:[.5,.35,.18],h:[.5,2],f0:42,fs:82,lp0:420,lpm:1500,lr:.5,ld:.1,g:6,gw:2.9,wh:0,wf0:1000,wfs:1000,bov:0,pop:1},
 flat8:{t:['sawtooth','sawtooth','triangle'],mix:[.5,.25,.2],h:[1.01,2.02],f0:56,fs:95,lp0:600,lpm:1800,lr:1,ld:.05,g:7,gw:2.5,wh:.4,wf0:1700,wfs:2000,bov:3800,pop:0},
 f40:{t:['sawtooth','square','sawtooth'],mix:[.5,.28,.15],h:[.5,2.01],f0:50,fs:80,lp0:450,lpm:1400,lr:.5,ld:.18,g:5,gw:3.3,wh:.8,wf0:1800,wfs:2600,bov:2800,pop:1},
 v8gt:{t:['sawtooth','triangle','sawtooth'],mix:[.5,.3,.12],h:[.5,2.01],f0:42,fs:75,lp0:360,lpm:1150,lr:.5,ld:.1,g:8,gw:2.1,wh:.25,wf0:1500,wfs:1500,bov:3000,pop:0},
 boxer:{t:['square','sawtooth','triangle'],mix:[.4,.35,.15],h:[.5,2],f0:40,fs:66,lp0:350,lpm:950,lr:.5,ld:.22,g:6,gw:2.9,wh:0,wf0:1000,wfs:1000,bov:0,pop:0},
 tri:{t:['sawtooth','square','sawtooth'],mix:[.45,.35,.12],h:[.5,1.5],f0:54,fs:70,lp0:420,lpm:1000,lr:.75,ld:.3,g:6,gw:2.9,wh:.5,wf0:1700,wfs:2000,bov:3000,pop:1},
 v6tt:{t:['sawtooth','square','triangle'],mix:[.5,.3,.16],h:[.5,2.03],f0:46,fs:84,lp0:400,lpm:1300,lr:1.5,ld:.1,g:6,gw:2.9,wh:.55,wf0:1400,wfs:2200,bov:3400,pop:0},
 v6na:{t:['sawtooth','sawtooth','triangle'],mix:[.5,.2,.2],h:[1.5,2.02],f0:50,fs:92,lp0:520,lpm:1600,lr:1.5,ld:.05,g:6,gw:2.9,wh:0,wf0:1000,wfs:1000,bov:0,pop:0},
 i4t:{t:['sawtooth','square','sawtooth'],mix:[.45,.3,.2],h:[.5,2.5],f0:58,fs:88,lp0:480,lpm:1500,lr:2,ld:.12,g:5,gw:3.3,wh:.6,wf0:2000,wfs:2200,bov:3600,pop:1},
 v10na:{t:['sawtooth','sawtooth','square'],mix:[.5,.28,.12],h:[1.005,2],f0:60,fs:110,lp0:700,lpm:2200,lr:.5,ld:.04,g:7,gw:2.4,wh:0,wf0:1000,wfs:1000,bov:0,pop:0},
 v12:{t:['sawtooth','sawtooth','triangle'],mix:[.5,.3,.2],h:[1.005,3],f0:56,fs:118,lp0:650,lpm:2400,lr:1,ld:.03,g:7,gw:2.4,wh:0,wf0:1000,wfs:1000,bov:0,pop:0},
 v12raw:{t:['square','sawtooth','sawtooth'],mix:[.4,.4,.2],h:[.5,2.01],f0:52,fs:95,lp0:550,lpm:1700,lr:.5,ld:.2,g:5,gw:3.4,wh:0,wf0:1000,wfs:1000,bov:0,pop:1}
};
let GAR={car:4,mods:{}},MH='';
try{Object.assign(GAR,JSON.parse(localStorage.getItem('gocars_garage2')||'{}'))}catch(e){}
const saveG=()=>{try{localStorage.setItem('gocars_garage2',JSON.stringify(GAR))}catch(e){}ACC.push&&ACC.push()};
const cm=()=>{const o=GAR.mods[GAR.car]||(GAR.mods[GAR.car]={});if(o.v===undefined){if(o.s===2)o.s=3;if(o.nc===undefined&&o.n)o.nc=1;o.v=2}for(const k in MD)if(o[k]===undefined)o[k]=MD[k];return o};
function stats(){const c=CARS[GAR.car]||CARS[0],m=cm();return{pw:c.pw*(1+.08*m.e+.03*m.x),tp:c.tp*(1+.07*m.t),gr:c.gr*(1+.1*m.y+[0,.03,.05,.08,.1,.09][m.s]),brk:1+.12*m.b,dr:c.dr}}
function gstats(){const C=CARS[GAR.car],s=stats(),bar=(n,v,lo,hi)=>`<div class=r><span>${n}</span><i><u style="width:${Math.round(Math.max(.05,Math.min(1,(v-lo)/(hi-lo)))*100)}%"></u></i></div>`;
  $('gstats').innerHTML=`<b>${C.n}</b><small>${C.b}</small>`+bar('Power',s.pw,.9,1.7)+bar('Top speed',s.tp,.9,1.7)+bar('Grip',s.gr,.8,1.7)+bar('Brakes',s.brk,1,1.4)+bar('Drift',s.dr,.8,1.4)}

/* ---------- car drawing: red Challenger Hellcat, white stripes ---------- */
function hexA(c,a){const n=parseInt(c.slice(1),16);return 'rgba('+(n>>16)+','+(n>>8&255)+','+(n&255)+','+a+')'}
function wAt(P,x){for(let i=1;i<P.length;i++)if(x<=P[i][0]){const a=P[i-1],b=P[i];return a[1]+(b[1]-a[1])*Math.max(0,Math.min(1,(x-a[0])/((b[0]-a[0])||1)))}return P[P.length-1][1]}
function drawCar(x,y,a){
  const C=CARS[GAR.car]||CARS[0],m=cm(),h=C.L/2,W=C.W,L2=C.L,col=PAINT[m.p]||C.c,P=SHAPES[C.p||0],now=performance.now(),
    lc=LIV[m.sc]||C.s,ww=u=>wAt(P,u)*W,lg=LGT[m.l][1],nc=NEON[m.nc];
  ctx.save();ctx.translate(x,y);ctx.rotate(a);
  if(S.beam){const yb=ww(.95)*.8,g=ctx.createLinearGradient(h,0,h+140,0);g.addColorStop(0,hexA(lg,.5));g.addColorStop(1,hexA(lg,0));
    ctx.fillStyle=g;[-1,1].forEach(q=>{ctx.beginPath();ctx.moveTo(h,q*yb);ctx.lineTo(h+140,q*yb+q*30);ctx.lineTo(h+140,q*yb-q*10);ctx.closePath();ctx.fill()})}
  if(nc&&nc[1]){const nk=nc[1]==='rb'?'hsl('+(now/5%360|0)+',100%,55%)':nc[1],st=m.ns;let al=.6;
    if(st===2)al=.25+.4*(.5+.5*Math.sin(now/230));if(st===3)al=(now/130|0)%2?.7:.08;
    ctx.save();ctx.shadowColor=nk;ctx.shadowBlur=30;ctx.globalAlpha=al;
    if(st===1){ctx.strokeStyle=nk;ctx.lineWidth=5;ctx.strokeRect(-h-2,-W-3,L2+4,W*2+6)}else{ctx.fillStyle=nk;ctx.fillRect(-h+6,-W+3,L2-12,W*2-6)}
    ctx.restore()}
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(-h+4,-W+4,L2,W*2);
  const wl=C.wl||18;ctx.fillStyle='#0a0a0a';
  (C.wx||[-.55,.5]).forEach(u=>[-1,1].forEach(s=>ctx.fillRect(u*h-wl/2,s*ww(u)-3,wl,6)));
  const bodyP=()=>{const pts=P.map(p=>[p[0]*h,-p[1]*W]).concat(P.slice().reverse().map(p=>[p[0]*h,p[1]*W])),n=pts.length;
    ctx.beginPath();ctx.moveTo((pts[n-1][0]+pts[0][0])/2,(pts[n-1][1]+pts[0][1])/2);
    for(let i=0;i<n;i++){const p=pts[i],q=pts[(i+1)%n];ctx.quadraticCurveTo(p[0],p[1],(p[0]+q[0])/2,(p[1]+q[1])/2)}ctx.closePath()};
  bodyP();ctx.fillStyle=col;ctx.fill();
  ctx.save();bodyP();ctx.clip();ctx.fillStyle=lc;ctx.strokeStyle=lc;
  const ds=m.st===0?(C.ds?4:1):m.st;
  if(ds===2)ctx.fillRect(-h,-9,L2,18);
  else if(ds===3){ctx.fillRect(-h,-W+3,L2,3);ctx.fillRect(-h,W-6,L2,3)}
  else if(ds===4){ctx.fillRect(-h,-8,L2,5);ctx.fillRect(-h,3,L2,5)}
  else if(ds===5){ctx.fillRect(-h,-11,L2,4);ctx.fillRect(-h,-2,L2,4);ctx.fillRect(-h,7,L2,4)}
  else if(ds===6){for(let i=0;i<L2/6;i++)for(let j=-2;j<2;j++)if((i+j)&1)ctx.fillRect(-h+i*6,j*6,6,6)}
  else if(ds===7){[-1,1].forEach(s=>{for(let i=0;i<5;i++){const bx=h*.85-i*17;ctx.beginPath();ctx.moveTo(bx,s*W);ctx.quadraticCurveTo(bx-6,s*W*.55,bx-26,s*(W*.35+i*2));ctx.quadraticCurveTo(bx-14,s*W*.75,bx-22,s*W);ctx.fill()}})}
  else if(ds===8){ctx.lineWidth=4;for(let i=0;i<6;i++){const bx=-h*.7+i*15;ctx.beginPath();ctx.moveTo(bx,-W);ctx.lineTo(bx+12,0);ctx.lineTo(bx,W);ctx.stroke()}}
  else if(ds===9){ctx.lineWidth=5;ctx.lineJoin='miter';ctx.beginPath();ctx.moveTo(-h*.8,-W*.5);ctx.lineTo(-h*.45,W*.5);ctx.lineTo(-h*.3,-W*.5);ctx.lineTo(h*.05,W*.5);ctx.lineTo(h*.2,-W*.5);ctx.lineTo(h*.55,W*.5);ctx.stroke()}
  else if(ds===10){for(let i=0;i<4;i++){const bx=-h*.9+i*34;ctx.beginPath();ctx.moveTo(bx,-W);ctx.lineTo(bx+12,-W);ctx.lineTo(bx+32,W);ctx.lineTo(bx+20,W);ctx.fill()}}
  else if(ds===11){for(let i=0;i<L2/12;i++)for(let j=-2;j<=2;j++){ctx.beginPath();ctx.arc(-h+6+i*12+(j&1)*6,j*W/2.4,3,0,7);ctx.fill()}}
  else if(ds===12)ctx.fillRect(-h,-W,L2,W);
  else if(ds===13){ctx.fillRect(h*.15,-7,h,14);ctx.fillRect(-h,-7,h*.6,14)}
  else if(ds===14){ctx.beginPath();ctx.arc(h*.45,0,10,0,7);ctx.fill();ctx.fillStyle='#111';ctx.font='900 13px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('7',h*.45,1)}
  const cx0=C.cab-C.cl/2,cx1=C.cab+C.cl/2,hk=m.h||(C.hood?1:0),hx=cx1+6,hl=Math.max(14,h-C.nose*.5-hx);
  if(hk===1){ctx.fillStyle='#111';ctx.fillRect(hx+hl*.3,-6,hl*.5,12);ctx.fillStyle='#2c2c33';ctx.fillRect(hx+hl*.3+2,-4,hl*.5-4,3)}
  else if(hk===2){ctx.fillStyle='#17181b';ctx.fillRect(hx,-W*.6,hl,W*1.2);ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<hl;i+=5){ctx.moveTo(hx+i,-W*.6);ctx.lineTo(hx+i,W*.6)}for(let j=-W*.6;j<W*.6;j+=5){ctx.moveTo(hx,j);ctx.lineTo(hx+hl,j)}ctx.stroke()}
  else if(hk===3){ctx.fillStyle='#111';for(let i=0;i<4;i++){ctx.fillRect(hx+hl*.25+i*6,-W*.55,3,W*.38);ctx.fillRect(hx+hl*.25+i*6,W*.17,3,W*.38)}}
  else if(hk===4){ctx.fillStyle='#111';[-1,1].forEach(s=>ctx.fillRect(hx+hl*.3,s*W*.35-4,hl*.5,8))}
  if(C.vt){ctx.fillStyle='#111';[-1,1].forEach(s=>ctx.fillRect(-h*.4,s*(ww(-.4)-5)-2,16,4))}
  ctx.restore();
  ctx.fillStyle='#111';
  if(C.kid){ctx.fillRect(h-9,-7,5,5);ctx.fillRect(h-9,2,5,5)}
  const cs=C.cs||0,fw=[.8,.62,.55,.7][cs],rw=[.8,.85,.78,.78][cs];
  ctx.fillStyle=TNTC[m.w];ctx.beginPath();ctx.moveTo(cx0,-W*rw);ctx.lineTo(cx1,-W*fw);ctx.lineTo(cx1,W*fw);ctx.lineTo(cx0,W*rw);ctx.closePath();ctx.fill();
  ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(cx0+6,-W*rw*.68);ctx.lineTo(cx1-7,-W*fw*.62);ctx.lineTo(cx1-7,W*fw*.62);ctx.lineTo(cx0+6,W*rw*.68);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.14)';ctx.fill();
  ctx.fillStyle=m.w===3?'#d6e6f2':'#7aa8c8';ctx.beginPath();ctx.moveTo(cx1-6,-W*fw*.9);ctx.lineTo(cx1,-W*fw);ctx.lineTo(cx1,W*fw);ctx.lineTo(cx1-6,W*fw*.9);ctx.closePath();ctx.fill();
  ctx.fillRect(cx0,-W*rw*.9,3,W*rw*1.8);
  ctx.fillStyle=col;[-1,1].forEach(s=>ctx.fillRect(cx1-3,s*(W*fw+2)-1.5,4,3));
  const sp=Math.max(m.s,C.wing?3:0),sc=SPC[m.pc][1]==='body'?col:SPC[m.pc][1];
  if(sp){ctx.fillStyle=sc;
    if(sp===1)ctx.fillRect(-h-1,-W*.7,4,W*1.4);
    else if(sp===2){ctx.beginPath();ctx.moveTo(-h+2,-W*.8);ctx.lineTo(-h-5,-W*.55);ctx.lineTo(-h-5,W*.55);ctx.lineTo(-h+2,W*.8);ctx.fill()}
    else if(sp===3){ctx.fillRect(-h-6,-W-1,9,W*2+2);ctx.fillStyle='#111';ctx.fillRect(-h-7,-W-2,11,2);ctx.fillRect(-h-7,W,11,2)}
    else if(sp===4){ctx.fillRect(-h-4,-W,5,W*2);ctx.fillRect(-h-11,-W,5,W*2);ctx.fillStyle='#111';ctx.fillRect(-h-12,-W-2,14,2);ctx.fillRect(-h-12,W,14,2);ctx.fillRect(-h-6,-3,2,6)}
    else if(sp===5){ctx.fillRect(-h-8,-W*.95,4,W*1.9);ctx.fillStyle='#111';ctx.fillRect(-h-9,-W*.95-2,8,3);ctx.fillRect(-h-9,W*.95-1,8,3)}}
  ctx.fillStyle=lg;ctx.shadowColor=lg;ctx.shadowBlur=18;
  const lt=C.lt|0,y1=ww(.95)*.3,y2=ww(.95)*.92,fy=ww(.92)*.8;
  [-1,1].forEach(s=>{
    if(lt===0)ctx.fillRect(h-6,s*fy-3,5,6);
    else if(lt===1)ctx.fillRect(h-5,s>0?y1:-y2,3,y2-y1);
    else if(lt===2){ctx.beginPath();ctx.moveTo(h-3,s*y1);ctx.lineTo(h-10,s*y2);ctx.lineTo(h-3,s*y2);ctx.fill()}
    else{ctx.fillRect(h-6,s*fy-2,4,4);ctx.fillRect(h-6,s*(fy-6)-2,4,4)}});
  ctx.shadowBlur=0;ctx.fillStyle='#ff2a2a';ctx.shadowColor='#ff2a2a';ctx.shadowBlur=8;
  const tl=C.tl|0,t1=ww(-.95);
  if(tl===1)ctx.fillRect(-h,-t1*.88,3,t1*1.76);
  else[-1,1].forEach(s=>{
    if(tl===0)ctx.fillRect(-h,s*t1*.9-(s>0?7:0),3,7);
    else if(tl===2){ctx.beginPath();ctx.arc(-h+2,s*t1*.72,2.8,0,7);ctx.arc(-h+2,s*t1*.45,2.8,0,7);ctx.fill()}
    else if(tl===3)ctx.fillRect(-h,s>0?t1*.3:-t1*.92,3,t1*.62);
    else{ctx.fillRect(-h,s*t1*.85-2,3,4);ctx.fillRect(-h,s*t1*.55-2,3,4)}});
  ctx.shadowBlur=0;
  const xr=[2,3,3.5][m.x];[-1,1].forEach(s=>{ctx.fillStyle=m.x?'#b8bec7':'#555';ctx.beginPath();ctx.arc(-h-1,s*W*.35,xr,0,7);ctx.fill();ctx.fillStyle='#111';ctx.beginPath();ctx.arc(-h-1,s*W*.35,xr*.55,0,7);ctx.fill()});
  ctx.restore();
}

/* ---------- drift particles (tyre marks + smoke) ---------- */
function emit(x,y,a,sm){
  const C=CARS[GAR.car]||CARS[0],fx=Math.cos(a),fy=Math.sin(a),back=C.L*.28,side=C.W*.8,rx=x-fx*back,ry=y-fy*back;
  marks.push({x:rx-fy*side,y:ry+fx*side,l:1},{x:rx+fy*side,y:ry-fx*side,l:1});
  if(marks.length>600)marks.splice(0,2);
  if(sm)smoke.push({x:rx+(Math.random()-.5)*8,y:ry+(Math.random()-.5)*8,r:7+Math.random()*4,l:1});
}
function drawFx(){
  ctx.fillStyle='#000';
  for(const m of marks){m.l-=0.004;ctx.globalAlpha=Math.max(m.l,0)*0.35;ctx.fillRect(m.x-3,m.y-3,6,6)}
  while(marks.length&&marks[0].l<=0)marks.shift();
  ctx.fillStyle='#ddd';
  for(const s of smoke){s.l-=0.02;s.r+=0.9;s.y-=0.3;ctx.globalAlpha=Math.max(s.l,0)*0.4;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,7);ctx.fill()}
  smoke=smoke.filter(s=>s.l>0);ctx.globalAlpha=1;
}

/* ---------- menu background ---------- */
function drawMenu(dt){
  if(GV.on){drawGarage(dt);return}
  t+=dt*1.08;ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='#2b2e36';ctx.fillRect(0,0,W,H);
  const cx=W/2,cy=H*0.55,r=Math.min(W,H)*0.3,rx=r*1.9;
  ctx.strokeStyle='#3a3e48';ctx.lineWidth=r*0.7;
  ctx.beginPath();ctx.ellipse(cx,cy,rx,r*0.8,0,0,7);ctx.stroke();
  ctx.setLineDash([22,26]);ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=4;
  ctx.beginPath();ctx.ellipse(cx,cy,rx,r*0.8,0,0,7);ctx.stroke();ctx.setLineDash([]);
  const x=cx+Math.cos(t)*rx,y=cy+Math.sin(t)*r*0.8;
  const a=Math.atan2(Math.cos(t)*r*0.8,-Math.sin(t)*rx)+0.7;
  emit(x,y,a,true);drawFx();drawCar(x,y,a);
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(0,0,W,H);
}

/* ---------- long twisty track (closed spline) ---------- */
S.bl=S.bl||{};S.bs=S.bs||{};S.bdc=S.bdc||{};if(S.bestLap2&&!S.bl.grand)S.bl.grand=S.bestLap2;
let TW=500,HW=250,TRK=[],PADS=[],BAR=[],POLE=[],PUD=[],TID='grand',GH=null;
const sup=(a,b,p,n,ph)=>Array.from({length:n},(_,i)=>{const t=ph+i*2*Math.PI/n,c=Math.cos(t),s=Math.sin(t);return[a*Math.sign(c)*Math.pow(Math.abs(c),2/p),b*Math.sign(s)*Math.pow(Math.abs(s),2/p)]});
const TRACKS={
 grand:{n:'Grand Circuit',w:500,pads:[.068,.233,.4,.563,.729,.894],cp:[
  [-900,-900],[200,-1500],[1600,-1750],[3100,-1250],[4500,-350],[5250,850],
  [5000,2100],[4100,3000],[2700,3250],[1400,2750],[500,3500],[-900,3700],
  [-2200,3150],[-3000,2050],[-3150,650],[-2500,-450],[-1800,-1100]].map(p=>[p[0]*1.6,p[1]*1.6])},
 oval:{n:'Speedway Oval',w:560,pads:[.12,.37,.62,.87],cp:sup(3300,1350,2.7,20,-Math.PI/2)},
 fig8:{n:'Figure-8',w:480,pads:[.08,.33,.58,.83],cp:Array.from({length:24},(_,i)=>{const t=i*2*Math.PI/24+.6,d=1+Math.sin(t)**2;return[3700*Math.cos(t)/d,3700*Math.sin(t)*Math.cos(t)/d]})},
 drift:{n:'Drift Park',w:460,pads:[.1,.3,.55,.8],cp:Array.from({length:30},(_,i)=>{const t=i*2*Math.PI/30,r=2800*(1+.24*Math.sin(3*t+.5)+.07*Math.sin(7*t));return[r*Math.cos(t),r*Math.sin(t)]})}
};
function setTrack(id){
  const T=TRACKS[id]||TRACKS.grand;TID=TRACKS[id]?id:'grand';TW=T.w;HW=TW/2;TRK=[];const CP=T.cp,n=CP.length;
  for(let i=0;i<n;i++){const a=CP[(i+n-1)%n],b=CP[i],c=CP[(i+1)%n],d=CP[(i+2)%n],m=Math.max(4,Math.round(Math.hypot(c[0]-b[0],c[1]-b[1])/92));
    for(let j=0;j<m;j++){const u=j/m,u2=u*u,u3=u2*u;TRK.push([0,1].map(k=>0.5*(2*b[k]+(-a[k]+c[k])*u+(2*a[k]-5*b[k]+4*c[k]-d[k])*u2+(-a[k]+3*b[k]-3*c[k]+d[k])*u3)))}}
  const N=TRK.length;
  PADS=T.pads.map((f,j)=>{const i=Math.floor(f*N)%N,p=TRK[i],q=TRK[(i+1)%N],a=Math.atan2(q[1]-p[1],q[0]-p[0]),o=(j%2?-1:1)*70;return{i,o,x:p[0]-Math.sin(a)*o,y:p[1]+Math.cos(a)*o,a}});
  BAR=[];POLE=[];PUD=[];
  for(let i=0;i<N;i+=3){const p=TRK[i],q=TRK[(i+2)%N],dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
    for(const sd of[-1,1]){const x=p[0]+nx*sd*(HW+47),y=p[1]+ny*sd*(HW+47);if(nearestTrack(x,y).d>=HW+35)BAR.push([x,y,(i/3&1)])}}
  for(let i=0;i<N;i+=18){const p=TRK[i],q=TRK[(i+2)%N],dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
    for(const sd of[-1,1]){const x=p[0]+nx*sd*(HW+26),y=p[1]+ny*sd*(HW+26);if(nearestTrack(x,y).d>=HW+12)POLE.push([x,y])}}
  for(let i=5;i<N;i+=11){const h=hash2(i*1.7,N),h2=hash2(i*3.3,9.1),p=TRK[i],q=TRK[(i+1)%N],a=Math.atan2(q[1]-p[1],q[0]-p[0]),o=(h-.5)*2*(HW-110);PUD.push({x:p[0]-Math.sin(a)*o,y:p[1]+Math.cos(a)*o,a,rx:90+h2*70,ry:55+h*35})}
  GH=null;try{const s=localStorage.getItem('gocars_ghost_'+TID)||(TID==='grand'?localStorage.getItem('gocars_ghost'):null);GH=s?JSON.parse(s):null;if(!(GH&&Array.isArray(GH.p)&&GH.p.length>5))GH=null}catch(e){GH=null}
}
setTrack('grand');
function trackPath(){ctx.beginPath();TRK.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath()}


/* ---------- track scenery + boundaries ---------- */
function distToSeg(px,py,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,q=dx*dx+dy*dy||1;
  const u=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/q));
  const x=ax+dx*u,y=ay+dy*u;
  return {d:Math.hypot(px-x,py-y),x,y};
}
function nearestTrack(px,py){
  let best={d:Infinity,x:px,y:py,idx:0};
  for(let i=0;i<TRK.length;i++){
    const a=TRK[i],b=TRK[(i+1)%TRK.length],q=distToSeg(px,py,a[0],a[1],b[0],b[1]);
    if(q.d<best.d)best={...q,idx:i};
  }
  return best;
}
function keepCarOnTrack(k){
  const q=nearestTrack(car.x,car.y),limit=HW-14;car.ti=q.idx;
  car.wall=0;car.hit=0;
  if(q.d<=limit)return;
  car.wall=1;                                              // tyres slide along the wall (update() keeps the speed)
  const dx=q.x-car.x,dy=q.y-car.y,len=Math.hypot(dx,dy)||1,nx=dx/len,ny=dy/len; // n = inward (towards track centre)
  car.x=q.x-nx*limit;car.y=q.y-ny*limit;                   // put the car exactly on the wall line
  const inward=car.vx*nx+car.vy*ny;
  if(inward<0){car.vx-=nx*inward;car.vy-=ny*inward;car.hit=Math.min(1,-inward/8)} // kill ONLY the speed going into the wall: zero bounce
  const fric=Math.pow(0.99,k)*(1-0.05*(car.hit||0));car.vx*=fric;car.vy*=fric;  // light scrape on the wall
  // gently swing the nose along the wall (smooth + capped, no snapping)
  const fx=Math.cos(car.a),fy=Math.sin(car.a),fwd=(car.vx*fx+car.vy*fy)>=0?1:-1;
  if(fwd*(fx*nx+fy*ny)<0){                                 // nose is pointing into the wall
    let tx=-ny,ty=nx;if(fwd*(tx*fx+ty*fy)<0){tx=-tx;ty=-ty}
    let da=Math.atan2(ty,tx)+(fwd<0?Math.PI:0)-car.a;
    while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
    car.a+=Math.max(-0.09*k,Math.min(0.09*k,da*0.25*k));
  }
}
function hash2(x,y){
  const n=Math.sin(x*12.9898+y*78.233)*43758.5453;
  return n-Math.floor(n);
}
function drawScenery(L,T,vw,vh){
  const step=260;
  for(let x=Math.floor(L/step)*step;x<L+vw;x+=step){
    for(let y=Math.floor(T/step)*step;y<T+vh;y+=step){
      const q=nearestTrack(x,y);
      if(q.d<HW+86)continue;
      const h=hash2(x,y);
      if(h<0.42){
        ctx.fillStyle='#214d2b';ctx.beginPath();
        ctx.arc(x+hash2(y,x)*100-50,y+hash2(x+5,y)*100-50,16+hash2(y+8,x)*16,0,7);ctx.fill();
        ctx.fillStyle='#2f6b3a';ctx.beginPath();
        ctx.arc(x+hash2(y+2,x)*90-45,y+hash2(x+9,y)*90-45,11+hash2(y+4,x)*12,0,7);ctx.fill();
      }else if(h<0.58){
        ctx.fillStyle='#777';ctx.fillRect(x-12,y-9,24,18);
        ctx.fillStyle='#aaa';ctx.fillRect(x-7,y-6,5,5);ctx.fillRect(x+2,y-6,5,5);
      }else if(h<0.68){
        ctx.fillStyle='#d7b85b';ctx.fillRect(x-20,y-7,40,14);
        ctx.strokeStyle='#7b6330';ctx.lineWidth=3;ctx.strokeRect(x-20,y-7,40,14);
      }
    }
  }
  for(const q of POLE){if(q[0]<L-30||q[0]>L+vw+30||q[1]<T-30||q[1]>T+vh+30)continue;ctx.fillStyle='#eee';ctx.fillRect(q[0]-7,q[1]-18,14,36);ctx.fillStyle='#d62828';ctx.fillRect(q[0]-7,q[1]-18,14,9)}
}

/* ---------- free mode detailing ---------- */
function drawTrackStart(){
  const p=TRK[0],n=TRK[8],ang=Math.atan2(n[1]-p[1],n[0]-p[0]),RW=TW,cols=Math.round(TW/28),cw=RW/cols,ch=16;
  ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(ang);
  ctx.fillStyle='#fff';ctx.fillRect(-ch-3,-RW/2,ch*2+6,RW);            // white base line
  for(let r=0;r<2;r++)for(let i=0;i<cols;i++){ctx.fillStyle=((i+r)&1)?'#fff':'#111';ctx.fillRect(-ch+r*ch,-RW/2+i*cw,ch,cw)}
  ctx.restore();
}

/* ---------- free mode detailing ---------- */
function tyreStack(x,y,c){
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.arc(x+3,y+4,12,0,7);ctx.fill();
  ctx.fillStyle='#17171a';ctx.beginPath();ctx.arc(x,y,12,0,7);ctx.fill();
  ctx.strokeStyle=c;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,8,0,7);ctx.stroke();
  ctx.fillStyle='#34343a';ctx.beginPath();ctx.arc(x,y,3.5,0,7);ctx.fill();
}
function drawBarriers(L,T,vw,vh){for(const b of BAR){if(b[0]<L-30||b[0]>L+vw+30||b[1]<T-30||b[1]>T+vh+30)continue;tyreStack(b[0],b[1],b[2]?'#f2f2f2':'#d62828')}}
function drawGantry(){ // START / FINISH banner over the line
  const p=TRK[0],n=TRK[8],ang=Math.atan2(n[1]-p[1],n[0]-p[0]),RW=TW;
  ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(ang);
  ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(48,-RW/2-14,30,RW+28);
  ctx.fillStyle='#202228';ctx.fillRect(38,-RW/2-18,22,22);ctx.fillRect(38,RW/2-4,22,22);
  ctx.fillStyle='#d62828';ctx.fillRect(34,-RW/2+4,18,RW-8);
  ctx.fillStyle='#fff';ctx.fillRect(34,-RW/2+4,4,RW-8);
  ctx.translate(44,0);ctx.rotate(-Math.PI/2);ctx.fillStyle='#fff';ctx.font='900 15px Arial';ctx.textAlign='center';ctx.fillText('START / FINISH',0,5);
  ctx.restore();
}
function drawGround(L,T,vw,vh){
  const st=150;
  ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=5;ctx.setLineDash([26,22]);
  ctx.beginPath();ctx.arc(0,0,130,0,7);ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(-20,0);ctx.lineTo(20,0);ctx.moveTo(0,-20);ctx.lineTo(0,20);ctx.stroke(); // spawn marker
  for(let x=Math.floor(L/st)*st-st;x<L+vw+st;x+=st)for(let y=Math.floor(T/st)*st-st;y<T+vh+st;y+=st){
    const h=hash2(x*1.3+7,y*0.7+3),ox=x+hash2(y,x)*st*.8,oy=y+hash2(x+3,y+1)*st*.8;
    if(Math.hypot(ox,oy)<150)continue;
    if(h<.22){ // darker dirt patch
      const r=40+hash2(x,y+9)*50;ctx.fillStyle='rgba(120,84,44,.32)';ctx.beginPath();ctx.ellipse(ox,oy,r,r*.6,hash2(y,x+2)*3,0,7);ctx.fill();
      ctx.fillStyle='rgba(235,205,150,.22)';ctx.beginPath();ctx.ellipse(ox-r*.15,oy-r*.1,r*.55,r*.3,hash2(y,x+2)*3,0,7);ctx.fill();
    }else if(h<.40){ // rocks
      for(let j=0;j<3;j++){const rx=ox+(hash2(x+j,y)-.5)*50,ry=oy+(hash2(x,y+j)-.5)*40,r=7+hash2(x+j,y+j)*11;
        ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.arc(rx+3,ry+4,r,0,7);ctx.fill();
        ctx.fillStyle='#7d7468';ctx.beginPath();ctx.arc(rx,ry,r,0,7);ctx.fill();
        ctx.fillStyle='#a69d90';ctx.beginPath();ctx.arc(rx-r*.3,ry-r*.3,r*.5,0,7);ctx.fill()}
    }else if(h<.52){ // dry bush
      for(let j=0;j<4;j++){ctx.fillStyle=j&1?'#6b6a36':'#555a2c';ctx.beginPath();ctx.arc(ox+(hash2(x+j,y+4)-.5)*30,oy+(hash2(x+4,y+j)-.5)*30,8+hash2(y+j,x)*8,0,7);ctx.fill()}
    }else if(h<.58){ // traffic cones
      for(let j=0;j<3;j++){const cx=ox+j*26,cy=oy+(j&1)*10;
        ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.arc(cx+2,cy+3,9,0,7);ctx.fill();
        ctx.fillStyle='#f26a1b';ctx.beginPath();ctx.arc(cx,cy,9,0,7);ctx.fill();
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(cx,cy,5.5,0,7);ctx.fill();
        ctx.fillStyle='#f26a1b';ctx.beginPath();ctx.arc(cx,cy,2.6,0,7);ctx.fill()}
    }else if(h<.63){tyreStack(ox,oy,'#f2f2f2');tyreStack(ox+24,oy+6,'#d62828')} // tyre pile
    else if(h<.66){ // wooden crate
      ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(ox-14,oy-10,32,32);
      ctx.fillStyle='#9a6a35';ctx.fillRect(ox-16,oy-16,32,32);ctx.strokeStyle='#5e3f1d';ctx.lineWidth=3;ctx.strokeRect(ox-16,oy-16,32,32);
      ctx.beginPath();ctx.moveTo(ox-16,oy-16);ctx.lineTo(ox+16,oy+16);ctx.moveTo(ox+16,oy-16);ctx.lineTo(ox-16,oy+16);ctx.stroke();
    }
  }
}
/* ---------- boost pads, ghost car, night mode, banners, respawn ---------- */
function drawPads(){const ph=(performance.now()/500)%1;
  for(const pd of PADS){if(Math.hypot(pd.x-cam.x,pd.y-cam.y)>1600)continue;
    ctx.save();ctx.translate(pd.x,pd.y);ctx.rotate(pd.a);
    ctx.fillStyle='rgba(20,22,28,.9)';ctx.fillRect(-60,-90,120,180);ctx.strokeStyle='#ffd400';ctx.lineWidth=5;ctx.strokeRect(-60,-90,120,180);
    ctx.lineWidth=13;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#ffd400';
    for(let i=0;i<3;i++){const x=-44+((i+ph)%3)*38;ctx.beginPath();ctx.moveTo(x-10,-42);ctx.lineTo(x+10,0);ctx.lineTo(x-10,42);ctx.stroke()}
    ctx.restore()}}
function drawGhost(){
  if(G.type!=='track'||G.mp||(!S.ghost&&!G.tt)||!GH||G.laps===undefined||G.lt>=GH.t||mode==='replay')return;
  const f=G.lt*10,i=Math.floor(f),u=f-i,p=GH.p[i],q=GH.p[i+1];if(!p||!q)return;
  let da=q[2]-p[2];da=Math.atan2(Math.sin(da),Math.cos(da));
  const x=p[0]+(q[0]-p[0])*u,y=p[1]+(q[1]-p[1])*u;
  ctx.globalAlpha=.42;drawCar(x,y,p[2]+da*u);ctx.globalAlpha=1;
  ctx.font='900 22px Arial';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='rgba(0,0,0,.8)';ctx.strokeText('BEST',x,y-55);ctx.fillStyle='#9fe8ff';ctx.fillText('BEST',x,y-55)}
const NC=document.createElement('canvas'),nctx=NC.getContext('2d');
function drawNight(z){ // 0 = day, 1 = dusk, 2 = night: headlights cut a hole in the darkness
  if(G.type!=='track'||!S.night)return;
  if(NC.width!==W||NC.height!==H){NC.width=W;NC.height=H}
  const g=nctx;g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);
  g.fillStyle=S.night===1?'rgba(24,12,44,.45)':'rgba(3,6,20,.84)';g.fillRect(0,0,W,H);
  g.globalCompositeOperation='destination-out';
  const lamp=(x,y,a,r,cone)=>{
    const X=W/2+(x-cam.x)*z,Y=H/2+(y-cam.y)*z;if(X<-r*z||Y<-r*z||X>W+r*z||Y>H+r*z)return;
    let gr=g.createRadialGradient(X,Y,0,X,Y,r*z);gr.addColorStop(0,'rgba(0,0,0,.95)');gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr;g.beginPath();g.arc(X,Y,r*z,0,7);g.fill();
    if(cone){const Ln=cone*z;gr=g.createLinearGradient(X,Y,X+Math.cos(a)*Ln,Y+Math.sin(a)*Ln);gr.addColorStop(0,'rgba(0,0,0,.95)');gr.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=gr;g.beginPath();g.moveTo(X,Y);g.lineTo(X+Math.cos(a-.33)*Ln,Y+Math.sin(a-.33)*Ln);g.lineTo(X+Math.cos(a+.33)*Ln,Y+Math.sin(a+.33)*Ln);g.closePath();g.fill()}};
  lamp(car.x,car.y,car.a,170,S.night===1?900:760);
  if(G.mp)for(const k in MP.rs){const d=MP.rs[k].d;if(d)lamp(d.x,d.y,d.a,150,560)}
  for(const pd of PADS)lamp(pd.x,pd.y,0,190,0);
  lamp(TRK[0][0],TRK[0][1],0,300,0);
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(NC,0,0)}
function drawBanners(){
  const chatOn=!!(G.mp&&!G.bots&&MPO.chat&&mode==='game');if(chatOn!==CHATV){CHATV=chatOn;$('cbtn').style.display=chatOn?'block':'none';if(!chatOn)$('cpan').style.display='none'}
  ctx.setTransform(1,0,0,1,0,0);if(mode==='replay')return;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  const txt=(t,x,y,fs,fill,al)=>{ctx.globalAlpha=al===undefined?1:al;ctx.font='900 '+Math.round(fs)+'px Arial';ctx.lineWidth=fs*.09;ctx.strokeStyle='rgba(0,0,0,.85)';ctx.fillStyle=fill;ctx.strokeText(t,x,y);ctx.fillText(t,x,y);ctx.globalAlpha=1};
  if(G.type==='track'&&G.cd>-.8){const go=G.cd<=.6,n=Math.ceil(G.cd-.6),fr=go?0:((G.cd-.6)%1||1),fs=H*.34*(go?1:.78+.4*fr);
    txt(go?'GO!':String(n),W/2,H*.4,fs,go?'#46d673':['#ffe14d','#ffb300','#ff3b30'][n-1]||'#fff',go?Math.max(0,Math.min(1,(G.cd+.8)/.7)):1)}
  if(G.type==='track'&&!G.done&&G.bm>0)txt('BOOST!',W/2,H*.3,H*.1,'#ffd400',Math.min(1,G.bm*2));
  if(G.tt&&G.type==='track'&&!G.done){
    const sc=[0,1,2].map(i=>G.spl&&G.spl[i]!==undefined?fmt(i?G.spl[i]-G.spl[i-1]:G.spl[0]):'--');if(G.spl&&G.spl.length===2)sc[2]=fmt(G.lt-G.spl[1]);
    txt('S1 '+sc[0]+'    S2 '+sc[1]+'    S3 '+sc[2],W/2,H*.115,H*.04,'#fff');
    if(G.dl!==undefined&&G.laps!==undefined)txt((G.dl>0?'+':'-')+Math.abs(G.dl).toFixed(2),W/2,H*.175,H*.085,G.dl>0?'#ff5a4d':'#46d673');
    if(G.sm&&G.sm.life>0)txt('S'+G.sm.n+'  '+(G.sm.d===null?fmt(G.sm.t):(G.sm.d>0?'+':'-')+Math.abs(G.sm.d).toFixed(2)),W/2,H*.245,H*.06,G.sm.d!==null&&G.sm.d<=0?'#46d673':'#ffd400',Math.min(1,G.sm.life))}
  if(S.wrong&&G.type==='track'&&!G.done&&G.ww>.6&&Math.floor(performance.now()/330)%2===0){const w=Math.min(W*.6,H*1.3),h=H*.13;ctx.fillStyle='rgba(200,20,30,.9)';ctx.fillRect(W/2-w/2,H*.4-h/2,w,h);txt('WRONG WAY!',W/2,H*.4,h*.52,'#fff')}
  ctx.textBaseline='alphabetic'}
function respawn(){
  const q=nearestTrack(car.x,car.y),a=TRK[q.idx],b=TRK[(q.idx+1)%TRK.length];
  Object.assign(car,{x:q.x,y:q.y,a:Math.atan2(b[1]-a[1],b[0]-a[0]),vx:0,vy:0,dp:0,dr:0,bt:0});
  wa=0;marks=[];smoke=[];cam.x=car.x;cam.y=car.y;G.ww=0;G.ps=undefined}
addEventListener('keydown',e=>{if(e.key.toLowerCase()==='t'&&mode==='game'&&G&&G.type==='track'&&!paused&&!G.done&&!editing)respawn()});

/* ---------- game ---------- */
let PR={u:1,b:{}};try{Object.assign(PR,JSON.parse(localStorage.getItem('gocars_prog')||'{}'))}catch(e){}
const saveP=()=>{try{localStorage.setItem('gocars_prog',JSON.stringify(PR))}catch(e){}ACC.push&&ACC.push()},NLV=15;
function cpsFor(n){const a=[];let x=0,y=0;for(let i=0;i<n+2;i++){const th=n*1.3+i*1.9,d=Math.min(2000,800+n*120);x+=Math.cos(th)*d;y+=Math.sin(th)*d;a.push({x,y})}return a}
const dsT=()=>{const d=Math.round((G.bank||0)+(car.dp||0));return (d?'  |  Drift '+d:'')+(S.bestDrift?'  |  Best drift '+S.bestDrift:'')};
const fmt=s=>Math.floor(s/60)+':'+(s%60).toFixed(1).padStart(4,'0');
function start(type,n){
  mode='game';paused=false;$('pause').style.display='none';marks=[];smoke=[];wa=0;grab=null;layout();
  G={type,level:n,time:0,next:0,done:false,cd:type==='track'&&S.cdown?3.6:-1,rtime:0,pads:1};RES={};REP={a:0,f:[],info:{}};BOTS=[];clearInterval(RIV);
  Object.assign(car,{x:0,y:0,a:-Math.PI/2,vx:0,vy:0,dp:0,dt:0,dr:0,nos:1,bt:0});
  if(type==='track'){const d=Math.atan2(TRK[8][1]-TRK[0][1],TRK[8][0]-TRK[0][0]);car.a=d;car.x=TRK[0][0]-Math.cos(d)*110;car.y=TRK[0][1]-Math.sin(d)*110}
  if(type==='level'){G.cps=cpsFor(n);G.r=Math.max(46,110-n*8)}
  cam.x=car.x;cam.y=car.y;
  $('menu').style.display='none';$('done').style.display='none';Object.assign($('done').style,{width:'',maxHeight:'',overflow:'',background:'',borderRadius:'',padding:''});$('ui').classList.add('on');
  SND.startup();
}
function toMenu(){mpClose();mode='menu';BOTS=[];clearInterval(RIV);RP=null;Object.assign($('done').style,{width:'',maxHeight:'',overflow:'',background:'',borderRadius:'',padding:''});$('rp').style.display='none';CHATV=false;$('cbtn').style.display='none';$('cpan').style.display='none';paused=false;$('pause').style.display='none';marks=[];smoke=[];$('ui').classList.remove('on');$('done').style.display='none';$('menu').style.display='flex';render('main')}
function toLobby(){ // game over -> everybody stays in the room, back to the waiting lobby
  MP.go=0;MP.rs={};RES={};BOTS=[];mode='menu';clearInterval(RIV);RP=null;
  Object.assign($('done').style,{width:'',maxHeight:'',overflow:'',background:'',borderRadius:'',padding:''});
  $('rp').style.display='none';CHATV=false;$('cbtn').style.display='none';$('cpan').style.display='none';$('settings').classList.remove('on');
  paused=false;$('pause').style.display='none';marks=[];smoke=[];$('ui').classList.remove('on');$('done').style.display='none';$('menu').style.display='flex';
  MP.gar=0;MP.sig='';render('mpf');mpLobby()}
function finish(){
  G.done=true;const d=$('done');d.innerHTML='';
  const h=document.createElement('div');
  const nb=!PR.b[G.level]||G.time<PR.b[G.level];if(nb)PR.b[G.level]=+G.time.toFixed(1);
  if(G.level>=PR.u&&G.level<NLV)PR.u=G.level+1;saveP();h.style.whiteSpace='pre-line';
  h.textContent=G.level<NLV?'Level '+G.level+' complete! '+fmt(G.time)+(nb?' (best!)':'')+'\nLevel '+(G.level+1)+' unlocked':'All '+NLV+' levels complete! 🏆 '+fmt(G.time);
  d.append(h);
  if(G.level<NLV)d.append(btn('Next level',()=>start('level',G.level+1)));
  d.append(btn('Menu',toMenu));d.style.display='flex';
}
function update(dt){
  const k=dt*60;
  if(G.cd>-.8){G.cd-=dt;const nn=G.cd>.6?Math.ceil(G.cd-.6):0;if(nn!==G.cdn){G.cdn=nn;SND.chime()}} // 3-2-1-GO
  const frozen=G.cd>.6,wx=wxNow(),WG=[1,.82,.7,.95][wx];
  if(car.bt>0)car.bt-=dt;if(G.bm>0)G.bm-=dt;if(G.sm&&G.sm.life>0)G.sm.life-=dt;
  if(G.cd<=.6)G.rtime+=dt;
  if(G.dc&&G.cd<=.6&&!G.done){G.dtl-=dt;if(G.dtl<=0)dcEnd()}
  if(!grab){
    const kl=keys.a||keys.arrowleft,kr=keys.d||keys.arrowright;
    if(kl)wa-=4*k;else if(kr)wa+=4*k;
    else{const st=Math.max(0.8*k,Math.abs(wa)*0.045*k)*S.center;wa=Math.abs(wa)<=st?0:wa-Math.sign(wa)*st} // wheel slowly goes straight
  }
  wa=Math.max(-MAXW,Math.min(MAXW,wa));
  $('wsvg').style.transform='rotate('+wa+'deg)';
  const s=wa/MAXW;
  const race=!frozen&&(inp.race||keys.w||keys.arrowup),brake=!frozen&&(inp.brake||keys.s||keys.arrowdown),hand=!frozen&&(inp.hand||keys[' ']),rev=!frozen&&(inp.rev||keys.r);
  let fx=Math.cos(car.a),fy=Math.sin(car.a);
  let sp=car.vx*fx+car.vy*fy;
  const CS=stats(),sA=Math.abs(s),RS=G.mp?MP.cfg.spd:1,PWR=G.mp&&MP.cfg.pw?MP.cfg.pw:S.power,TOP=G.mp&&MP.cfg.tp?MP.cfg.tp:S.top; // Online: host's accel/top speed apply to everyone
  if(G.mp&&MP.cfg.eq){CS.pw=1;CS.tp=1}
  if(car.nos===undefined)car.nos=1;
  const nit=!frozen&&(inp.nos||keys.shift||keys.n)&&car.nos>.02&&sp>-1&&(!G.mp||MP.cfg.nos);car.nos=Math.max(0,Math.min(1,car.nos+(nit?-.33:.06)*dt));
  // drift: brake/handbrake + steer = full drift, high-speed throttle + hard steer = power slide. car.dr eases in/out smoothly
  const tdr=sp>3&&sA>.15?((brake||hand)?(hand?1:.85):(S.autoDrift&&race&&sA>.4&&sp>7?Math.min(.85,.45*CS.dr+.2):0)):0;
  car.dr=(car.dr||0)+(tdr-(car.dr||0))*Math.min(1,(tdr>(car.dr||0)?.14:.07)*k); // eases in fast, out slowly
  const dr=car.dr;
  let w=s*0.06*S.steer*Math.max(-1,Math.min(1,sp/6))*(1-.3*Math.min(1,Math.abs(sp)/14)); // steering flips when reversing
  w*=1+.6*dr*CS.dr;
  car.a+=w*k;
  fx=Math.cos(car.a);fy=Math.sin(car.a);
  sp=car.vx*fx+car.vy*fy;let lat=-car.vx*fy+car.vy*fx;
  if(dr>.05&&sp>0)car.a+=Math.atan2(lat,sp)*.05*k*dr; // counter-steer assist: nose follows the slide, no spin-outs
  sp*=1-0.008*k;
  const bz=nit||car.bt>0; // NOS ya boost pad
  if(race||bz)sp+=0.3*k*PWR*CS.pw*(bz?1.8:1)*(1-sp/(14*TOP*RS*CS.tp*(bz?1.35:1)));
  if(brake)sp*=1-0.02*k*WG*S.brake*CS.brk*(1-.6*dr);                         // slows slowly
  if(hand){sp*=1-0.05*k*S.brake*CS.brk*(1-.4*dr);lat*=1-0.05*k}           // stops by speed, not instantly
  lat*=Math.pow(1-(car.wet?.6:1)*WG*(car.wall?0.04:Math.max(.01,(hand?.1:Math.min(.6,.3*CS.gr))+(.035/CS.dr-(hand?.1:Math.min(.6,.3*CS.gr)))*dr)),k); // car.wall: no grip-loss while scraping the wall
  {const ml=Math.abs(sp)*1.15+1;lat=Math.max(-ml,Math.min(ml,lat))}   // no sideways runaway
  if(dr>.3&&race&&sp>3)sp+=0.05*k*dr;                                   // keep speed while sliding
  if(rev&&!race){if(sp>0.2)sp*=1-0.05*k;else sp=Math.max(-5,sp-0.16*k*(1+sp/5))} // brakes first, then reverses
  if(sp<0&&!rev)sp=Math.min(0,sp+0.4*k);
  if(!race&&!rev&&Math.abs(sp)<0.15)sp=0;
  car.vx=fx*sp-fy*lat;car.vy=fy*sp+fx*lat;
  car.x+=car.vx*k;car.y+=car.vy*k;
  {const dv=Math.abs(lat)*Math.max(0,sp)/10;if(dr>.45&&sp>5&&dv>.3){car.dp=(car.dp||0)+dt*dv*10;car.dt=0}else{car.dt=(car.dt||0)+dt;if(car.dt>1&&car.dp){G.bank=(G.bank||0)+car.dp;car.dp=0;if(Math.round(G.bank)>(S.bestDrift||0)){S.bestDrift=Math.round(G.bank);save()}}}}
  if(G.type==='track'){keepCarOnTrack(k);
    if(G.dc&&car.hit>.35&&car.dp>40){car.dp=0;mpMsg('Crash! Drift combo lost')}
    const p=TRK[0],n=TRK[8],ln=Math.hypot(n[0]-p[0],n[1]-p[1])||1,ux=(n[0]-p[0])/ln,uy=(n[1]-p[1])/ln,sd=(car.x-p[0])*ux+(car.y-p[1])*uy,lt=Math.abs(-(car.x-p[0])*uy+(car.y-p[1])*ux);
    if(G.laps!==undefined)G.lt+=dt;
    if(G.ps!==undefined&&G.ps<0&&sd>=0&&sd<80&&lt<HW+31&&!G.dc){
      if(G.laps!==undefined){G.last=G.lt;G.blr=Math.min(G.blr||1e9,G.last);const bl=S.bl[TID],nb=!bl||G.lt<bl;
        if(nb){S.bl[TID]=G.lt;save();if(!G.mp&&G.rec&&G.rec.length>5){GH={t:G.lt,p:G.rec,s:G.spl};try{localStorage.setItem('gocars_ghost_'+TID,JSON.stringify(GH))}catch(e){}}}
        G.laps++;SND.chime();mpMsg('Lap '+fmt(G.last)+(nb?'  NEW BEST! \ud83c\udfc6':''))}else G.laps=0;
      G.lt=0;G.rec=[[Math.round(car.x),Math.round(car.y),+car.a.toFixed(2),car.ti]];G.rt=0;G.sec=0;G.spl=[];G.gpi=0;G.dl=undefined}
    G.ps=sd;
    if(G.laps!==undefined&&!G.mp&&G.rec){G.rt+=dt;if(G.rt>=.1){G.rt-=.1;G.rec.push([Math.round(car.x),Math.round(car.y),+car.a.toFixed(2),car.ti])}} // ghost recording
    {const i=car.ti,a=TRK[i],b=TRK[(i+1)%TRK.length],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,v=Math.hypot(car.vx,car.vy),d=v>3?(car.vx*dx+car.vy*dy)/(v*l):1;G.ww=d<-.45?(G.ww||0)+dt:0} // wrong way
    if(G.laps!==undefined&&!G.dc&&G.spl){const sc=Math.min(2,Math.floor(3*car.ti/TRK.length));
      if(sc===G.sec+1&&G.spl.length===G.sec){G.spl.push(G.lt);G.sec=sc;if(G.tt){const g=GH&&GH.s&&GH.s[G.sec-1];G.sm={n:G.sec,t:G.lt,d:g!==undefined?G.lt-g:null,life:3}}}
      if(G.tt&&GH&&GH.p[0]&&GH.p[0][3]!==undefined&&G.rec){let gi=G.gpi||0;const P=GH.p,mi=car.ti;while(gi+1<P.length&&P[gi+1][3]<=mi&&mi-P[gi][3]<60)gi++;G.gpi=gi;G.dl=G.lt-gi*.1}}
    car.wet=0;if(wx&&wx!==3)for(const q of PUD){const dx=car.x-q.x,dy=car.y-q.y;if(dx*dx+dy*dy<q.rx*q.rx*.7){car.wet=1;break}}
    if(car.wet&&sp>4&&Math.random()<.5)smoke.push({x:car.x,y:car.y,r:5,l:.7});
    if(G.pads)for(const pd of PADS){const dx=car.x-pd.x,dy=car.y-pd.y,al=dx*Math.cos(pd.a)+dy*Math.sin(pd.a),la=-dx*Math.sin(pd.a)+dy*Math.cos(pd.a);
      if(Math.abs(al)<60&&Math.abs(la)<90&&!(car.bt>.4)){car.bt=1.4;G.bm=1;car.vx+=Math.cos(car.a)*4;car.vy+=Math.sin(car.a)*4;SND.chime()}}} // boost pads
  if(G.mp){const now=performance.now();if(G.bots&&!frozen)botsStep(dt,k,now);MP.tk=(MP.tk||0)+dt;
    if(MP.tk>.05){MP.tk=0;mpSend({id:MP.id,x:car.x,y:car.y,a:car.a,vx:car.vx,vy:car.vy,c:GAR.car,m:cm(),l:G.laps,n:MPO.name,k:mpColIdx(MP.id)})}
    for(const k in MP.rs){const o=MP.rs[k],d=o.d,r=o.r;if(d&&r){const e=Math.min(.25,(now-r.t)/1000)*60;d.x+=(r.x+r.vx*e-d.x)*.3;d.y+=(r.y+r.vy*e-d.y)*.3;d.a+=Math.atan2(Math.sin(r.a-d.a),Math.cos(r.a-d.a))*.3;
      const dx=car.x-d.x,dy=car.y-d.y,ds=Math.hypot(dx,dy)||1;if(ds<64&&MP.cfg.coll&&!o.fin&&!G.fin){const nx=dx/ds,ny=dy/ds,o2=(64-ds)*.5;car.x+=nx*o2;car.y+=ny*o2;car.vx+=nx*.8;car.vy+=ny*.8}}}
    if(G.laps>=MP.cfg.laps&&!G.fin)mpFinish()}
  SND.drive({v:Math.hypot(car.vx,car.vy),sp,lat,race:!!race,brake:!!brake,hand:!!hand,rev:!!rev,wall:car.wall,hit:car.hit||0,top:TOP*CS.tp,dt,dr});
  G.sh=Math.min(1,(G.sh||0)*.88+((S.shake&&car.hit>.2)?car.hit*.5:0));
  if(G.type==='track'){REP.a+=dt;while(REP.a>=1/30){REP.a-=1/30;recFrame()}}
  if(S.fx&&(Math.abs(lat)>2.5||dr>.4||(hand&&sp>4)))emit(car.x,car.y,car.a,true);
  cam.x+=(car.x+car.vx*12-cam.x)*Math.min(1,0.1*k);cam.y+=(car.y+car.vy*12-cam.y)*Math.min(1,0.1*k);
  {const v=Math.hypot(car.vx,car.vy)*7;$('spd').textContent=(S.unit==='mph'?Math.round(v*0.621)+' mph':Math.round(v)+' km/h')+'  |  NOS '+Math.round(car.nos*100)+'%'}
  if(G.type==='level'){
    G.time+=dt;
    const c=G.cps[G.next];
    if(Math.hypot(car.x-c.x,car.y-c.y)<G.r+25){G.next++;if(G.next>=G.cps.length){finish();SND.fanfare()}else SND.chime()}
    $('hud').textContent='Level '+G.level+'  |  Checkpoint '+Math.min(G.next+1,G.cps.length)+'/'+G.cps.length+'  |  '+fmt(G.time)+dsT();
  }else $('hud').textContent=G.dc?dcHud():G.type==='track'?(G.mp?(G.bots?'Bots':'Online')+'  |  Pos '+mpRank()+'/'+MP.n:(G.tt?'Time trial':TRACKS[TID].n))+'  |  Lap '+(G.laps||0)+(G.mp?'/'+MP.cfg.laps:'')+' '+(G.laps===undefined?'(cross the line)':fmt(G.lt))+(G.mp?'':(S.bl[TID]?'  |  Best '+fmt(S.bl[TID]):''))+dsT():'Free mode: Ground'+dsT();
}
function drawGame(){
  const z=H/560*S.zoom*(mode==='replay'?RP.zm:1),vw=W/z,vh=H/z,L=cam.x-vw/2,T=cam.y-vh/2;
  const sk=G.sh>.03?G.sh*16:0;ctx.setTransform(z,0,0,z,W/2-cam.x*z+(Math.random()-.5)*sk,H/2-cam.y*z+(Math.random()-.5)*sk);
  ctx.fillStyle={track:'#2f6b3a',ground:'#b8935f',level:'#3a3e48'}[G.type];
  ctx.fillRect(L,T,vw,vh);
  ctx.strokeStyle='rgba(0,0,0,.14)';ctx.lineWidth=3;ctx.beginPath();
  for(let x=Math.floor(L/200)*200;x<L+vw;x+=200){ctx.moveTo(x,T);ctx.lineTo(x,T+vh)}
  for(let y=Math.floor(T/200)*200;y<T+vh;y+=200){ctx.moveTo(L,y);ctx.lineTo(L+vw,y)}
  ctx.stroke();
  if(G.type==='track'){
    drawScenery(L,T,vw,vh);
    ctx.lineJoin='round';trackPath();
    ctx.strokeStyle='#111';ctx.lineWidth=TW+72;ctx.stroke();
    ctx.strokeStyle='#fff';ctx.lineWidth=TW+32;ctx.stroke();
    ctx.setLineDash([46,46]);ctx.strokeStyle='#d62828';ctx.stroke();ctx.setLineDash([]); // red/white curbs
    ctx.strokeStyle='#3d4048';ctx.lineWidth=TW;ctx.stroke();
    ctx.setLineDash([55,60]);ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=5;ctx.stroke();ctx.setLineDash([]);
    drawTrackStart();if(G.pads)drawPads();drawPuddles(L,T,vw,vh);drawGantry();drawBarriers(L,T,vw,vh);
  }
  if(G.type==='ground')drawGround(L,T,vw,vh);
  if(G.type==='level'){
    G.cps.forEach((c,i)=>{if(i<G.next)return;const on=i===G.next;ctx.lineWidth=on?14:6;ctx.strokeStyle=on?'#ffd400':'rgba(255,255,255,.35)';ctx.beginPath();ctx.arc(c.x,c.y,G.r,0,7);ctx.stroke()});
  }
  drawFx();drawGhost();if(G.mp)for(const k in MP.rs)drawRemote(MP.rs[k]);drawCar(car.x,car.y,car.a);if(G.mp&&MPO.tags)drawTags();
  if(G.type==='level'&&!G.done){
    const c=G.cps[G.next],an=Math.atan2(c.y-car.y,c.x-car.x);
    ctx.save();ctx.translate(car.x+Math.cos(an)*90,car.y+Math.sin(an)*90);ctx.rotate(an);
    ctx.fillStyle='#ffd400';ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-8,-10);ctx.lineTo(-8,10);ctx.fill();ctx.restore();
  }
  drawNight(z);drawWeather(z);drawBanners();
  if(G.mp||(G.type==='track'&&S.mmSolo))drawMinimap();
}
let last=performance.now();
function loop(now){
  const dt=Math.min((now-last)/1000,0.05);last=now;
  if(mode==='menu'){drawMenu(dt);SND.drive(null)}else if(mode==='replay'){replayTick(dt);SND.drive(null);drawGame()}else{if(!G.done&&!paused)update(dt);else SND.drive(null);drawGame()}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---------- controls ---------- */
const wh=$('wheel');
const ang=e=>{const r=wh.getBoundingClientRect();return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))*180/Math.PI};
wh.addEventListener('pointerdown',e=>{if(editing)return;wh.setPointerCapture(e.pointerId);grab={id:e.pointerId,last:ang(e)}});
wh.addEventListener('pointermove',e=>{if(grab&&e.pointerId===grab.id){const a=ang(e);let d=a-grab.last;if(d>180)d-=360;if(d<-180)d+=360;grab.last=a;wa=Math.max(-MAXW,Math.min(MAXW,wa+d*S.wheelTouch))}});
['pointerup','pointercancel'].forEach(n=>wh.addEventListener(n,()=>grab=null));
function bind(id,key){
  const el=$(id),on=()=>{if(editing)return;inp[key]=1;el.classList.add('down')},off=()=>{inp[key]=0;el.classList.remove('down')};
  el.addEventListener('pointerdown',e=>{e.preventDefault();on()});
  ['pointerup','pointercancel','pointerleave'].forEach(n=>el.addEventListener(n,off));
}
$('hnd').addEventListener('pointerdown',()=>{if(!editing)SND.ratchet()});
bind('race','race');bind('nos','nos');bind('brk','brake');bind('hnd','hand');bind('rev','rev');
addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys[k]=1;if(mode==='game'&&[' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault()});
addEventListener('keyup',e=>delete keys[e.key.toLowerCase()]);
$('back').onclick=openPause;
addEventListener('keydown',e=>{if(e.key==='Escape'&&mode==='game'&&!editing&&!$('settings').classList.contains('on'))paused?resume():openPause()});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('pointerdown',()=>{try{screen.orientation.lock('landscape').catch(()=>{})}catch(e){}},{once:true});

/* ---------- layout, settings, pause, button editing ---------- */
const POS={},CTL={nos:$('nos'),wheel:$('wheel'),hnd:$('hnd'),rev:$('rev'),brk:$('brk'),race:$('race')};
function layout(){
  const st=$('stage'),SW=st.clientWidth,SH=st.clientHeight,h=SH/100,bs=S.btnSize,wsz=Math.min(38*h,180)*S.wheelSize;
  const sz={wheel:[wsz,wsz],race:[Math.min(26*h,130)*bs,Math.min(32*h,160)*bs],brk:[Math.min(20*h,100)*bs,Math.min(20*h,100)*bs],hnd:[Math.min(32*h,160)*bs,Math.min(16*h,80)*bs],rev:[Math.min(15*h,75)*bs,Math.min(15*h,75)*bs],nos:[Math.min(16*h,80)*bs,Math.min(16*h,80)*bs]};
  const mx=SW*.03,my=SH*.04,gap=SH*.02,R=SW-mx,B=SH-my,d={};
  d.wheel=[mx+sz.wheel[0]/2,B-sz.wheel[1]/2];
  d.brk=[R-sz.brk[0]/2,B-sz.brk[1]/2];                              // brake at the bottom...
  d.race=[R-sz.race[0]/2,B-sz.brk[1]-gap-sz.race[1]/2];             // ...race right above it
  d.hnd=[R-sz.brk[0]-gap-sz.hnd[0]/2,B-sz.hnd[1]/2];
  d.rev=[R-sz.brk[0]-gap-sz.hnd[0]-gap-sz.rev[0]/2,B-sz.rev[1]/2];
  d.nos=[R-sz.brk[0]-gap-sz.hnd[0]/2,B-sz.hnd[1]-gap-sz.nos[1]/2];
  for(const id in CTL){
    const [w,hh]=sz[id];let cx,cy;
    if(L[id]){cx=L[id].x*SW;cy=L[id].y*SH}else{[cx,cy]=d[id];if(S.swap)cx=SW-cx}
    cx=Math.max(w/2,Math.min(SW-w/2,cx));cy=Math.max(hh/2,Math.min(SH-hh/2,cy));
    const el=CTL[id];el.style.width=w+'px';el.style.height=hh+'px';el.style.left=(cx-w/2)+'px';el.style.top=(cy-hh/2)+'px';
    POS[id]={cx,cy,SW,SH};
  }
  $('ui').style.setProperty('--uo',S.uiOpacity);
  $('hud').style.display=S.hudText?'':'none';$('spd').style.display=S.showSpd?'':'none';
  SND.apply();
}
addEventListener('resize',layout);addEventListener('orientationchange',()=>setTimeout(layout,250));

const NUM=[
 ['Controls',[['steer','Steering sensitivity',.5,2,.1],['wheelTouch','Wheel touch sensitivity',.5,2,.1],['center','Wheel auto-center',0,2,.25]]],
 ['Car',[['power','Acceleration',.6,1.6,.1],['top','Top speed',.7,1.5,.1],['brake','Brake strength',.5,2,.1]]],
 ['Sound',[['volume','Volume',0,1,.1]]],
 ['Display & buttons',[['zoom','Camera zoom',.7,1.4,.1],['btnSize','Button size',.7,1.5,.1],['wheelSize','Steering wheel size',.7,1.5,.1],['uiOpacity','Button opacity',.3,1,.1]]]
];
const TOG=[['sound','Sound effects'],['swap','Swap sides (left-handed)'],['showSpd','Show speed'],['unit','Speed unit'],['autoDrift','Auto power-slide (throttle + full steer)'],['fx','Tyre marks & smoke'],['beam','Headlight beams'],['hudText','Top info text'],['ghost','Ghost car (your best lap)'],['night','Time of day (track)'],['weather','Weather (track)'],['shake','Camera shake'],['cdown','Race countdown'],['wrong','Wrong-way warning'],['mmSolo','Minimap in solo track']];
function mk(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
function sbtn(txt,fn){const b=mk('button','sb',txt);b.onclick=fn;return b}
const fmtV=(k,v)=>k==='center'&&v===0?'Off':Math.round(v*100)+'%';
function buildSettings(){
  const body=$('sbody');body.innerHTML='';
  NUM.forEach(([title,items])=>{
    body.append(mk('h3','',title));
    items.forEach(([key,label,mn,mx,stp])=>{
      const row=mk('div','row'),val=mk('span','val',fmtV(key,S[key]));
      const ch=dir=>{S[key]=Math.max(mn,Math.min(mx,Math.round((S[key]+dir*stp)*100)/100));val.textContent=fmtV(key,S[key]);save();layout()};
      const stp_=mk('div','step');stp_.append(sbtn('\u2212',()=>ch(-1)),val,sbtn('+',()=>ch(1)));
      row.append(mk('span','',label),stp_);body.append(row);
    });
  });
  body.append(mk('h3','','Options'));
  TOG.forEach(([key,label])=>{
    const row=mk('div','row'),show=()=>key==='unit'?(S.unit==='mph'?'mph':'km/h'):key==='night'?['Day','Dusk','Night'][S.night|0]:key==='weather'?['Clear','Rain','Storm','Fog'][S.weather|0]:(S[key]?'On':'Off');
    const b=sbtn(show(),()=>{if(key==='unit')S.unit=S.unit==='mph'?'kmh':'mph';else if(key==='night')S.night=((S.night|0)+1)%3;else if(key==='weather')S.weather=((S.weather|0)+1)%4;else{S[key]=S[key]?0:1;if(key==='swap')L={}}b.textContent=show();save();layout()});
    row.append(mk('span','',label),b);body.append(row);
  });
  body.append(mk('h3','','Button layout'));
  const a=mk('div','sacts');
  a.append(sbtn('Move buttons',startEdit),sbtn('Reset layout',()=>{L={};save();layout()}),sbtn('Delete best laps & ghosts',()=>{S.bl={};S.bdc={};GH=null;try{Object.keys(TRACKS).forEach(id=>localStorage.removeItem('gocars_ghost_'+id));localStorage.removeItem('gocars_ghost')}catch(e){}save();mpMsg('All best laps deleted')}),sbtn('Reset all settings',()=>{S=Object.assign({},SDEF);L={};save();layout();buildSettings()}));
  body.append(a);
}
let settingsBack=null;
function openSettings(back){settingsBack=back;buildSettings();$('settings').classList.add('on');$('sbody').scrollTop=0}
/* drag-to-scroll: settings me kahin bhi swipe/drag karo to scroll ho */
(function(){
  const sb=$('sbody');let d=null,moved=false,fling=0,raf=0;
  const portrait=()=>matchMedia('(orientation:portrait)').matches;
  // screen movement -> content-vertical movement (stage is rotated 90deg in portrait)
  const dv=(dx,dy)=>portrait()?-dx:dy;
  sb.addEventListener('pointerdown',e=>{cancelAnimationFrame(raf);d={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),drag:false};moved=false;fling=0});
  sb.addEventListener('pointermove',e=>{
    if(!d||e.pointerId!==d.id)return;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.drag){if(Math.hypot(dx,dy)<8)return;d.drag=true;moved=true;try{sb.setPointerCapture(e.pointerId)}catch(_){}}
    const now=performance.now(),step=dv(dx,dy);
    sb.scrollTop-=step;
    fling=step/Math.max(1,now-d.t);
    d.x=e.clientX;d.y=e.clientY;d.t=now;
    e.preventDefault();
  });
  const end=e=>{
    if(!d||e.pointerId!==d.id)return;
    const was=d.drag;d=null;
    if(was){let v=fling*16;const run=()=>{if(Math.abs(v)<.5)return;sb.scrollTop-=v;v*=.94;raf=requestAnimationFrame(run)};run()}
  };
  sb.addEventListener('pointerup',end);sb.addEventListener('pointercancel',end);
  // drag ke baad button accidentally click na ho
  sb.addEventListener('click',e=>{if(moved){e.stopPropagation();e.preventDefault();moved=false}},true);
})();
$('sback').onclick=()=>{$('settings').classList.remove('on');const f=settingsBack;settingsBack=null;if(f)f()};

/* pause menu: Resume / Settings / Main Menu */
function releaseInputs(){for(const k in keys)delete keys[k];['race','brake','hand','rev','nos'].forEach(k=>inp[k]=0);['race','brk','hnd','rev','nos'].forEach(i=>$(i).classList.remove('down'));grab=null}
function showPause(){
  const d=$('pause');d.innerHTML='';
  d.append(mk('div','','Paused'),btn('Resume',resume),...(G&&G.type==='track'?[btn('Respawn on track',()=>{respawn();resume()}),...(!G.mp||G.bots?[btn('Restart',()=>{d.style.display='none';paused=false;startMode(LASTK)})]:[]),btn('Watch replay',watchReplay)]:[]),btn('Settings',()=>{d.style.display='none';openSettings(showPause)}),btn(G&&G.mp&&!G.bots?'Leave room':'Main Menu',()=>{paused=false;d.style.display='none';toMenu()}));
  d.style.display='flex';
}
function openPause(){if(mode!=='game'||paused)return;paused=true;releaseInputs();showPause()}
function resume(){paused=false;$('pause').style.display='none'}

/* move the on-screen buttons by dragging */
function startEdit(){editing=true;$('settings').classList.remove('on');$('menu').style.display='none';$('ui').classList.add('on','edit');layout()}
function endEdit(){editing=false;drag=null;$('ui').classList.remove('edit');if(mode==='menu'){$('ui').classList.remove('on');$('menu').style.display='flex'}save();$('settings').classList.add('on')}
$('edone').onclick=endEdit;$('ereset').onclick=()=>{L={};save();layout()};
let drag=null;
Object.keys(CTL).forEach(id=>{
  const el=CTL[id];
  el.addEventListener('pointerdown',e=>{if(!editing)return;e.preventDefault();el.setPointerCapture(e.pointerId);drag={id,pid:e.pointerId,x:e.clientX,y:e.clientY}});
  el.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==id||e.pointerId!==drag.pid)return;
    const sx=e.clientX-drag.x,sy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
    const P=matchMedia('(orientation:portrait)').matches,dx=P?sy:sx,dy=P?-sx:sy,c=POS[id];
    L[id]={x:(c.cx+dx)/c.SW,y:(c.cy+dy)/c.SH};layout();
  });
  ['pointerup','pointercancel'].forEach(n=>el.addEventListener(n,()=>{if(drag&&drag.id===id){drag=null;save()}}));
});


/* ---------- Online multiplayer (2-4 players): WebRTC, no game server. Host = centre of a star ---------- */
const MP={n:2,max:2,id:0,host:0,p:[],rs:{},go:0,gar:0,cfg:{laps:3,coll:1,nos:1,spd:1,tr:'grand',wx:0,pads:1}};
let LT=0,MPK=null;
/* ---------- Online customization (naam, colour, minimap + host rules) ---------- */
const MPCOL=[['Red','#ff3b30'],['Blue','#3b82f6'],['Green','#22c55e'],['Yellow','#facc15'],['Orange','#fb923c'],['Purple','#a855f7'],['Pink','#ff5fa8'],['Cyan','#22d3ee']];
const MAPN=['Off','Small','Medium','Large'],LAPN=[1,3,5,10],SPDN=[.8,1,1.2],MPDEF={name:'',color:-1,map:2,tags:1,laps:3,coll:1,nos:1,spd:1,track:'grand',pads:1,chat:1,eq:0};
const MPO=Object.assign({},MPDEF);try{Object.assign(MPO,JSON.parse(localStorage.getItem('gocars_mp')||'{}'))}catch(e){}
if(!(MPO.color>=-1&&MPO.color<MPCOL.length))MPO.color=-1;if(!LAPN.includes(MPO.laps))MPO.laps=3;if(!SPDN.includes(MPO.spd))MPO.spd=1;if(!(MPO.map>=0&&MPO.map<=3))MPO.map=2;MPO.name=String(MPO.name||'').slice(0,10);if(!TRACKS[MPO.track])MPO.track='grand';
const saveMPO=()=>{try{localStorage.setItem('gocars_mp',JSON.stringify(MPO))}catch(e){}ACC.push&&ACC.push()};
const mpName=id=>{if(id===MP.id)return MPO.name||'Player '+(id+1);const o=MP.rs[id];return(o&&o.r&&o.r.n)||'Player '+(id+1)};
const mpColIdx=id=>{if(id===MP.id)return MPO.color>=0?MPO.color:id%MPCOL.length;const o=MP.rs[id];return o&&o.r&&MPCOL[o.r.k]?o.r.k:id%MPCOL.length};
function mpRank(){const pg=(x,y,l)=>(l===undefined?-1:l)+nearestTrack(x,y).idx/TRK.length,me=pg(car.x,car.y,G.laps);let r=1;for(const k in MP.rs){const o=MP.rs[k];if(o.d&&o.r&&pg(o.d.x,o.d.y,o.r.l)>me)r++}return r}
function drawTags(){ctx.textAlign='center';ctx.lineJoin='round';ctx.font='900 24px Arial';
  for(const k in MP.rs){const o=MP.rs[k],d=o.d;if(!d||!o.r)continue;const t=mpName(+k);ctx.lineWidth=5;ctx.strokeStyle='rgba(0,0,0,.85)';ctx.strokeText(t,d.x,d.y-62);ctx.fillStyle=MPCOL[mpColIdx(+k)][1];ctx.fillText(t,d.x,d.y-62)}}
/* minimap: track ek baar offscreen canvas pe bante hai, har frame sirf players ke arrows draw hote hain */
const MM={k:'',b:null,c:null};
function drawMinimap(){
  if(!MPO.map)return;
  if(!MM.b||MM.tid!==TID){let a=1e9,b=1e9,c=-1e9,d=-1e9;for(const p of TRK){a=Math.min(a,p[0]);b=Math.min(b,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1])}MM.b=[a-HW,b-HW,c+HW,d+HW];MM.tid=TID}
  const [x0,y0,x1,y1]=MM.b,bw=x1-x0,bh=y1-y0,pad=8,fr=[0,.26,.36,.46][MPO.map],sc=Math.min((W*.32-2*pad)/bw,(H*fr-2*pad)/bh),key=W+'|'+H+'|'+MPO.map+'|'+TID;
  if(MM.k!==key){
    MM.k=key;const mw=Math.ceil(bw*sc+2*pad),mh=Math.ceil(bh*sc+2*pad),c=document.createElement('canvas');c.width=mw;c.height=mh;const g=c.getContext('2d'),lw=Math.max(5,TW*sc*.5);
    g.fillStyle='rgba(8,10,14,.62)';g.fillRect(0,0,mw,mh);g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1.5;g.strokeRect(.75,.75,mw-1.5,mh-1.5);
    g.lineJoin='round';g.lineCap='round';g.beginPath();TRK.forEach((p,i)=>{const X=(p[0]-x0)*sc+pad,Y=(p[1]-y0)*sc+pad;i?g.lineTo(X,Y):g.moveTo(X,Y)});g.closePath();
    g.strokeStyle='#000';g.lineWidth=lw+3;g.stroke();g.strokeStyle='#8b93a1';g.lineWidth=lw;g.stroke();
    const p=TRK[0],n=TRK[8],an=Math.atan2(n[1]-p[1],n[0]-p[0]);g.save();g.translate((p[0]-x0)*sc+pad,(p[1]-y0)*sc+pad);g.rotate(an);g.fillStyle='#000';g.fillRect(-3,-lw/2-2,6,lw+4);g.fillStyle='#fff';g.fillRect(-2,-lw/2-1,4,lw+2);g.restore();
    MM.c=c;MM.w=mw;MM.h=mh}
  const px=S.swap?W-W*.03-MM.w:W*.03,py=H*.15,r=Math.max(5,MM.h*.04);
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=.94;ctx.drawImage(MM.c,px,py);ctx.globalAlpha=1;
  const arrow=(x,y,a,col,rr,lab)=>{
    const X=px+pad+(x-x0)*sc,Y=py+pad+(y-y0)*sc;
    ctx.save();ctx.translate(X,Y);ctx.rotate(a);ctx.beginPath();ctx.moveTo(rr*1.9,0);ctx.lineTo(-rr*.8,-rr*1.05);ctx.lineTo(-rr*.4,0);ctx.lineTo(-rr*.8,rr*1.05);ctx.closePath();
    ctx.fillStyle=col;ctx.fill();ctx.lineWidth=1.6;ctx.strokeStyle='#fff';ctx.lineJoin='round';ctx.stroke();ctx.restore();
    if(MPO.tags&&lab){ctx.font='800 '+Math.round(rr*1.5+3)+'px Arial';ctx.textAlign='center';ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.9)';ctx.strokeText(lab,X,Y-rr*1.7);ctx.fillStyle='#fff';ctx.fillText(lab,X,Y-rr*1.7)}};
  if(G.mp)for(const k in MP.rs){const o=MP.rs[k];if(o.d&&o.r)arrow(o.d.x,o.d.y,o.d.a,MPCOL[mpColIdx(+k)][1],r,mpName(+k))}
  arrow(car.x,car.y,car.a,MPCOL[mpColIdx(MP.id)][1],r*1.25,'YOU')}
function mpMsg(t){msg.textContent=t;msg.classList.add('show');clearTimeout(to);to=setTimeout(()=>msg.classList.remove('show'),2200)}
function mpClose(){clearInterval(LT);LT=0;MP.gar=0;MP.sig='';if(MPK){const k=MPK;MPK=null;try{k.destroy()}catch(e){}}MP.p.forEach(q=>{q.gone=1;try{q.dc&&q.dc.close();q.pc.close()}catch(e){}});MP.p=[];MP.rs={};MP.go=0}
function mpCancel(){mpClose();$('mp').style.display='none'}
function mpPanel(title,els){const d=$('mp');d.innerHTML='';d.className='';d.append(mk('div','',title),...els);d.style.display='flex'}
const mpCopy=t=>{const a=document.createElement('textarea');a.value=t;document.body.append(a);a.select();try{document.execCommand('copy')}catch(e){}a.remove();try{navigator.clipboard.writeText(t)}catch(e){}mpMsg('Code copied')};
const mpShare=t=>{if(navigator.share)navigator.share({text:t}).catch(()=>{});else mpCopy(t)};
/* ================= v3: weather, AI bots, results, chat, drift challenge, replay ================= */
let RES={},REP={a:0,f:[],info:{}},BOTS=[],LASTK='free',RIV=0,RP=null,CHATV=false;
const wrapA=a=>Math.atan2(Math.sin(a),Math.cos(a));
const CHATS=['GG','\ud83d\udc80','Wait!','Nice one!','Too slow \ud83d\ude0e','Rematch?','Oops!','Let\'s go!'];
const ord=n=>n+['th','st','nd','rd'][(n%100>10&&n%100<14)||n%10>3?0:n%10];

/* ---- weather: 0 clear, 1 rain, 2 storm, 3 fog ---- */
const RAIN=[];let wLast=performance.now(),wFlash=0,wNext=4;
const wxNow=()=>G&&G.mp&&!G.bots?(MP.cfg.wx|0):(S.weather|0);
function drawPuddles(L,T,vw,vh){const w=wxNow();if(!w||w===3)return;
  for(const q of PUD){if(q.x<L-200||q.x>L+vw+200||q.y<T-200||q.y>T+vh+200)continue;
    ctx.save();ctx.translate(q.x,q.y);ctx.rotate(q.a);ctx.fillStyle='rgba(60,95,150,.5)';ctx.beginPath();ctx.ellipse(0,0,q.rx,q.ry,0,0,7);ctx.fill();
    ctx.strokeStyle='rgba(200,225,255,.35)';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(-q.rx*.12,-q.ry*.15,q.rx*.6,q.ry*.5,0,.3,2.2);ctx.stroke();ctx.restore()}}
function drawWeather(z){
  const now=performance.now(),dt=Math.min(.05,(now-wLast)/1000);wLast=now;
  if(G.type!=='track')return;const w=wxNow();if(!w)return;
  ctx.setTransform(1,0,0,1,0,0);
  if(w===3){
    if(NC.width!==W||NC.height!==H){NC.width=W;NC.height=H}
    const g=nctx;g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);g.fillStyle='rgba(200,206,216,.9)';g.fillRect(0,0,W,H);g.globalCompositeOperation='destination-out';
    const clear=(x,y,r)=>{const X=W/2+(x-cam.x)*z,Y=H/2+(y-cam.y)*z,gr=g.createRadialGradient(X,Y,r*z*.25,X,Y,r*z);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.beginPath();g.arc(X,Y,r*z,0,7);g.fill()};
    clear(car.x,car.y,520);if(G.mp)for(const k in MP.rs){const d=MP.rs[k].d;if(d)clear(d.x,d.y,260)}
    ctx.drawImage(NC,0,0);return}
  const want=w===1?150:320,vy=H*(w===1?1.6:2.2),vx=-vy*.18;
  while(RAIN.length<want)RAIN.push({x:Math.random()*W,y:Math.random()*H,s:.75+Math.random()*.5});if(RAIN.length>want)RAIN.length=want;
  ctx.fillStyle=w===1?'rgba(14,24,44,.13)':'rgba(8,14,28,.3)';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(195,215,240,.5)';ctx.lineWidth=1.5;ctx.beginPath();
  for(const d of RAIN){d.x+=vx*d.s*dt;d.y+=vy*d.s*dt;if(d.y>H){d.y-=H+20;d.x=Math.random()*W}if(d.x<0)d.x+=W;ctx.moveTo(d.x,d.y);ctx.lineTo(d.x-vx*d.s*.022,d.y-vy*d.s*.022)}
  ctx.stroke();
  if(w===2){wNext-=dt;if(wNext<0){wFlash=1;wNext=4+Math.random()*8}if(wFlash>0){ctx.fillStyle='rgba(235,240,255,'+(wFlash*.55)+')';ctx.fillRect(0,0,W,H);wFlash-=dt*2.2}}}

/* ---- AI bots ---- */
const BO={n:3,diff:1,laps:3,rb:1,nos:1,col:1,pads:1,chat:1,track:'grand'};
try{Object.assign(BO,JSON.parse(localStorage.getItem('gocars_bots')||'{}'))}catch(e){}
if(!TRACKS[BO.track])BO.track='grand';BO.n=Math.max(1,Math.min(5,BO.n|0||3));BO.diff=Math.max(0,Math.min(3,BO.diff|0));if(!LAPN.includes(BO.laps))BO.laps=3;
const saveBO=()=>{try{localStorage.setItem('gocars_bots',JSON.stringify(BO))}catch(e){}ACC.push&&ACC.push()};
const DIFF=[{n:'Easy',v:9.4,pad:.2,nos:0,wob:110},{n:'Medium',v:11.4,pad:.5,nos:1,wob:55},{n:'Hard',v:13,pad:.8,nos:1,wob:22},{n:'Insane',v:14.4,pad:1,nos:1,wob:6}];
const BNAMES=['Ali','Usman','Bilal','Hamza','Zain','Rehan','Hassan','Faizan','Shahid','Daniyal'];
function gridXY(id,n){const p=TRK[0],q=TRK[8],d=Math.atan2(q[1]-p[1],q[0]-p[0]),s=n>4?72:90,o=id*s-(n-1)*s/2,b=110+(id%2)*70;return{x:p[0]-Math.cos(d)*b-Math.sin(d)*o,y:p[1]-Math.sin(d)*b+Math.cos(d)*o,a:d}}
function botSay(b,i){showChat(b.n,b.k,CHATS[i])}
function mkBots(){
  MP.rs={};BOTS=[];const pool=BNAMES.slice().sort(()=>Math.random()-.5),pc=mpColIdx(0);
  for(let i=1;i<=BO.n;i++){const g=gridXY(i,BO.n+1),m=Object.assign({},MD,{p:1+Math.floor(Math.random()*(PAINTN.length-1)),st:Math.floor(Math.random()*STRP.length),sc:Math.floor(Math.random()*LIVN.length)}),
    b={id:i,x:g.x,y:g.y,a:g.a,v:0,vx:0,vy:0,l:undefined,ps:undefined,lt:0,bl:1e9,nos:1,nit:0,bt:0,ti:nearestTrack(g.x,g.y).idx,lane:(Math.random()-.5)*160,ph:Math.random()*6,c:Math.floor(Math.random()*CARS.length),m,k:(pc+i)%MPCOL.length,n:pool[i-1],fin:0,vm:.97+Math.random()*.06,pw:{},chatT:-99};
    BOTS.push(b);MP.rs[i]={r:{x:b.x,y:b.y,a:b.a,vx:0,vy:0,c:b.c,m,l:undefined,n:b.n,k:b.k,t:performance.now()},d:{x:b.x,y:b.y,a:b.a}}}}
function botsStep(dt,k,now){
  const n=TRK.length,sk=DIFF[BO.diff],wxf=[1,.94,.88,.97][wxNow()],p0=TRK[0],p8=TRK[8],ln=Math.hypot(p8[0]-p0[0],p8[1]-p0[1])||1,ux=(p8[0]-p0[0])/ln,uy=(p8[1]-p0[1])/ln,pp=(G.laps===undefined?-1:G.laps)+(car.ti||0)/n;
  G.btm=(G.btm||0)+dt;
  for(const b of BOTS){
    let bd=1e18,bq=null,bi=b.ti;
    for(let j=-6;j<=14;j++){const i=(b.ti+j+n)%n,a=TRK[i],c=TRK[(i+1)%n],q=distToSeg(b.x,b.y,a[0],a[1],c[0],c[1]);if(q.d<bd){bd=q.d;bq=q;bi=i}}
    if(bd>HW*1.4){const q=nearestTrack(b.x,b.y);bd=q.d;bq=q;bi=q.idx}
    b.ti=bi;
    const L=Math.max(3,Math.round(b.v*.6)),t0=TRK[(bi+L)%n],t1=TRK[(bi+L+1)%n],ta=Math.atan2(t1[1]-t0[1],t1[0]-t0[0]);
    let lo=b.lane+Math.sin(b.ph+G.btm*.7)*sk.wob;
    if(G.pads)for(const pd of PADS){const ahead=(pd.i-bi+n)%n;if(ahead>2&&ahead<16){if(b.pw[pd.i]===undefined)b.pw[pd.i]=Math.random()<sk.pad;if(b.pw[pd.i])lo=pd.o}else if(ahead>=16&&ahead<30)delete b.pw[pd.i]}
    lo=Math.max(-(HW-95),Math.min(HW-95,lo));
    const tx=t0[0]-Math.sin(ta)*lo,ty=t0[1]+Math.cos(ta)*lo,want=Math.atan2(ty-b.y,tx-b.x);
    b.a+=Math.max(-.05*k,Math.min(.05*k,wrapA(want-b.a)*.25*k));
    const C=Math.round(4+b.v*1.8),a0=Math.atan2(TRK[(bi+1)%n][1]-TRK[bi][1],TRK[(bi+1)%n][0]-TRK[bi][0]),a1=Math.atan2(TRK[(bi+C+1)%n][1]-TRK[(bi+C)%n][1],TRK[(bi+C+1)%n][0]-TRK[(bi+C)%n][0]),cu=Math.abs(wrapA(a1-a0));
    let vt=sk.v*b.vm*(1-Math.min(.4,cu*.36))*wxf;
    if(BO.rb){const bp=(b.l===undefined?-1:b.l)+bi/n;vt*=1-Math.max(-.08,Math.min(.08,(bp-pp)*2))}
    if(b.bt>0){b.bt-=dt;vt*=1.28}
    if(BO.nos&&sk.nos){if(b.nit){b.nos-=.33*dt;if(b.nos<.03||cu>.3)b.nit=0}else{b.nos=Math.min(1,b.nos+.06*dt);if(b.nos>.85&&cu<.15&&b.v>sk.v*.8)b.nit=1}}
    if(b.nit)vt*=1.3;
    b.v+=(vt-b.v)*(vt>b.v?.03:.08)*k;
    b.vx=Math.cos(b.a)*b.v;b.vy=Math.sin(b.a)*b.v;b.x+=b.vx*k;b.y+=b.vy*k;
    if(bd>HW-30&&bq){const dx=bq.x-b.x,dy=bq.y-b.y,l=Math.hypot(dx,dy)||1;b.x=bq.x-dx/l*(HW-30);b.y=bq.y-dy/l*(HW-30);b.v*=.985}
    if(G.pads)for(const pd of PADS){const dx=b.x-pd.x,dy=b.y-pd.y,al=dx*Math.cos(pd.a)+dy*Math.sin(pd.a),la=-dx*Math.sin(pd.a)+dy*Math.cos(pd.a);if(Math.abs(al)<60&&Math.abs(la)<90&&!(b.bt>.4)){b.bt=1.4;b.v+=3}}
    if(BO.col){const es=[{x:car.x,y:car.y,pl:1}].concat(BOTS.filter(o=>o!==b));for(const e of es){const dx=b.x-e.x,dy=b.y-e.y,ds=Math.hypot(dx,dy)||1;if(ds<64){const nx=dx/ds,ny=dy/ds;b.x+=nx*(64-ds)*.5;b.y+=ny*(64-ds)*.5;b.v*=.99;if(e.pl&&BO.chat&&G.btm-b.chatT>8){b.chatT=G.btm;botSay(b,Math.random()<.5?1:6)}}}}
    const sd=(b.x-p0[0])*ux+(b.y-p0[1])*uy,lt=Math.abs(-(b.x-p0[0])*uy+(b.y-p0[1])*ux);
    if(b.l!==undefined)b.lt+=dt;
    if(b.ps!==undefined&&b.ps<0&&sd>=0&&sd<80&&lt<HW+31){if(b.l!==undefined){b.bl=Math.min(b.bl,b.lt);b.l++;if(b.l>=MP.cfg.laps&&!b.fin){b.fin=1;RES[b.id]={t:G.rtime,n:b.n,b:b.bl};if(BO.chat)botSay(b,0)}}else b.l=0;b.lt=0}
    b.ps=sd;
    const o=MP.rs[b.id];o.fin=b.fin;Object.assign(o.r,{x:b.x,y:b.y,a:b.a,vx:b.vx,vy:b.vy,l:b.l,t:now});o.d.x=b.x;o.d.y=b.y;o.d.a=b.a}}
function startBots(){
  setTrack(BO.track);LASTK='bots';
  MP.n=BO.n+1;MP.id=0;MP.rs={};MP.cfg={laps:BO.laps,coll:BO.col,nos:1,spd:1,tr:BO.track,wx:S.weather|0,pads:BO.pads};
  start('track');G.mp=1;G.bots=1;G.pads=BO.pads;Object.assign(car,gridXY(0,MP.n));cam.x=car.x;cam.y=car.y;mkBots()}
function startMode(kind,id){
  LASTK=kind;if(id)setTrack(id);
  if(kind==='bots'){startBots();return}
  start('track');
  if(kind==='tt')G.tt=1;
  if(kind==='dc'){G.dc=1;G.dtl=90;G.pads=0}}

/* ---- results table, finish, rematch ---- */
function pgOf(id){if(id===MP.id)return(G.laps===undefined?-1:G.laps)+(car.ti||0)/TRK.length;const o=MP.rs[id];if(!o||!o.d||!o.r)return-9;return(o.r.l===undefined?-1:o.r.l)+nearestTrack(o.d.x,o.d.y).idx/TRK.length}
function resRows(){const ids=[MP.id].concat(Object.keys(MP.rs).map(Number)),rows=ids.map(id=>({id,n:mpName(id),f:RES[id],pg:RES[id]?99:pgOf(id)}));
  rows.sort((a,b)=>a.f&&b.f?a.f.t-b.f.t:a.f?-1:b.f?1:b.pg-a.pg);return rows}
function resTable(rows){
  const g=document.createElement('div');g.id='rrows';g.style.cssText='display:grid;grid-template-columns:auto 1fr auto auto;gap:.5em 1.1em;text-align:left;font-size:min(3.6cqh,18px);align-items:center;margin:1em 0';
  const add=(t,op,bold,dot)=>{const e=document.createElement('span');if(dot){const s=document.createElement('i');s.style.cssText='display:inline-block;width:.8em;height:.8em;border-radius:50%;margin-right:.5em;background:'+dot;e.append(s)}e.append(document.createTextNode(t));if(bold)e.style.fontWeight='900';if(op)e.style.opacity=op;g.append(e)};
  ['#','Racer','Time','Best lap'].forEach(t=>add(t,.6,1));
  rows.forEach((r,i)=>{const lp=r.id===MP.id?G.laps:(MP.rs[r.id]&&MP.rs[r.id].r.l);
    add(String(i+1),0,1);add(r.n+(r.id===MP.id?' (You)':''),0,r.id===MP.id,MPCOL[mpColIdx(r.id)][1]);
    add(r.f?fmt(r.f.t):'Lap '+Math.max(0,lp||0)+'/'+MP.cfg.laps,r.f?0:.6);add(r.f&&r.f.b&&r.f.b<1e8?fmt(r.f.b):'--',0)});
  return g}
function showResults(live){
  const d=$('done'),rows=resRows(),all=rows.every(r=>r.f);
  if(live){const o=$('rrows');if(o&&d.style.display==='flex'){o.replaceWith(resTable(rows));const st=$('rstat');if(st)st.textContent=all?'Everyone finished!':'Waiting for the others...'}return}
  const me=rows.findIndex(r=>r.id===MP.id)+1;
  d.innerHTML='';Object.assign(d.style,{width:'min(620px,94cqw)',maxHeight:'96cqh',overflow:'auto',background:'rgba(12,14,20,.94)',borderRadius:'14px',padding:'10px 14px'});
  const t=mk('div','',me===1?'You won! \ud83c\udfc6':'You finished '+ord(me)),s=mk('div','',all?'Everyone finished!':'Waiting for the others...');s.id='rstat';s.style.cssText='font-size:min(3.2cqh,16px);opacity:.7';
  d.append(t,resTable(rows),s);
  if(G.bots)d.append(btn('Race again',()=>startMode('bots')));
  else if(MP.host)d.append(btn('New game (lobby)',mpNewGame,'pri'),btn('Rematch now',mpRematch));
  else d.append(mk('div','','Waiting for the host to start a new game...'));
  d.append(btn('Watch replay',watchReplay),btn(G.bots?'Menu':'Leave room',toMenu));d.style.display='flex';
  clearInterval(RIV);RIV=setInterval(()=>{if(mode==='game'&&G&&G.fin&&$('done').style.display==='flex'&&$('rrows'))showResults(true);else if(mode==='menu')clearInterval(RIV)},500)}
function mpFinish(){
  G.fin=1;G.ft=G.rtime;const me={t:G.ft,n:mpName(MP.id),b:G.blr};RES[MP.id]=me;
  if(!G.bots){const m={f:MP.id,t:G.ft,n:me.n,b:G.blr};for(let i=0;i<5;i++)setTimeout(()=>mpSend(m),i*150)}
  SND.fanfare();showResults()}
function mpRestart(){RES={};MP.rs={};start('track');G.mp=1;G.pads=MP.cfg.pads===0?0:1;Object.assign(car,gridXY(MP.id,MP.n));cam.x=car.x;cam.y=car.y}
function mpRematch(){MP.rmk=Date.now();const m={rm:MP.rmk};for(let i=0;i<5;i++)setTimeout(()=>mpSend(m),i*150);mpRestart()}

/* ---- quick chat ---- */
(()=>{const st=document.createElement('style');st.textContent=`
#cbtn{position:absolute;top:11cqh;right:3cqw;z-index:6;font-size:min(4.6cqh,24px);padding:.15em .6em;background:rgba(0,0,0,.55);border:2px solid rgba(255,255,255,.4);border-radius:12px;color:#fff;width:auto}
#cpan{display:none;position:absolute;top:22cqh;right:3cqw;z-index:6;grid-template-columns:repeat(2,auto);gap:6px;background:rgba(0,0,0,.78);padding:8px;border-radius:12px}
#cpan button{font-size:min(3.6cqh,18px);white-space:nowrap;width:auto}
#clog{position:absolute;top:9cqh;left:50%;transform:translateX(-50%);z-index:5;display:flex;flex-direction:column;align-items:center;gap:4px;pointer-events:none}
.cm{background:rgba(0,0,0,.65);color:#fff;padding:.25em .9em;border-radius:12px;font-weight:700;font-size:min(3.4cqh,17px);animation:cmf 4s forwards}
@keyframes cmf{0%,80%{opacity:1}100%{opacity:0}}
#rp{display:none;position:absolute;left:50%;transform:translateX(-50%);bottom:3cqh;z-index:7;flex-direction:column;align-items:center;gap:6px;width:min(94cqw,720px)}
#rpr{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
#rpr button{width:auto;font-size:min(3.8cqh,19px)}
#rpi{color:#fff;font-weight:800;text-shadow:0 1px 3px #000;font-size:min(3.6cqh,18px)}
#rpb{width:100%;height:8px;background:rgba(255,255,255,.25);border-radius:4px;overflow:hidden}#rpb i{display:block;height:100%;width:0;background:#ffd400}
#pause button{font-size:min(3.8cqh,21px);padding-top:min(1.4cqh,10px);padding-bottom:min(1.4cqh,10px)}`;document.head.append(st);
  const stg=$('stage'),clog=document.createElement('div');clog.id='clog';
  const cb=document.createElement('button');cb.id='cbtn';cb.textContent='\ud83d\udcac';cb.style.display='none';
  const cp=document.createElement('div');cp.id='cpan';
  CHATS.forEach((t,i)=>{const b=document.createElement('button');b.className='sb';b.textContent=t;b.onclick=()=>{cp.style.display='none';chatSend(i)};cp.append(b)});
  cb.onclick=()=>{cp.style.display=cp.style.display==='grid'?'none':'grid'};
  const rp=document.createElement('div');rp.id='rp';const row=document.createElement('div');row.id='rpr';
  const bt=(t,f)=>{const b=document.createElement('button');b.className='sb';b.textContent=t;b.onclick=f;row.append(b);return b},dur=()=>(REP.f.length-1)/30;
  bt('\u23ee',()=>{RP.t=0;RP.play=1});bt('-5s',()=>{RP.t=Math.max(0,RP.t-5)});
  bt('\u23ef',()=>{RP.play=RP.play?0:1;if(RP.play&&RP.t>=dur()-.05)RP.t=0});bt('+5s',()=>{RP.t=Math.min(dur(),RP.t+5)});
  const spb=bt('1x',()=>{const L=[.25,.5,1,2];RP.sp=L[(L.indexOf(RP.sp)+1)%L.length];spb.textContent=RP.sp+'x'}),CAMN=['Chase','Close','Wide','TV'],
    cmb=bt('Chase',()=>{RP.cam=(RP.cam+1)%4;RP.zm=[1,1.6,.55,.8][RP.cam];cmb.textContent=CAMN[RP.cam]});
  bt('\u2715 Exit',()=>exitReplay());
  const info=document.createElement('div');info.id='rpi';const bar=document.createElement('div');bar.id='rpb';bar.append(document.createElement('i'));
  rp.append(info,bar,row);stg.append(clog,cb,cp,rp);rp.reset=()=>{spb.textContent='1x';cmb.textContent='Chase'}})();
function showChat(n,ci,t){const l=$('clog'),e=document.createElement('div'),s=document.createElement('b');e.className='cm';s.textContent=n+': ';s.style.color=MPCOL[ci%MPCOL.length][1];e.append(s,document.createTextNode(t));l.append(e);while(l.children.length>4)l.firstChild.remove();setTimeout(()=>e.remove(),4000)}
function chatSend(i){if(!MPO.chat||!G||!G.mp)return;showChat(mpName(MP.id),mpColIdx(MP.id),CHATS[i]);if(!G.bots){const m={q:i,id:MP.id,u:Date.now()};for(let j=0;j<2;j++)setTimeout(()=>mpSend(m),j*120)}}
addEventListener('keydown',e=>{if(!CHATV||editing)return;const k=e.key.toLowerCase();if(k==='c')$('cpan').style.display=$('cpan').style.display==='grid'?'none':'grid';else if($('cpan').style.display==='grid'&&k>='1'&&k<='8'){$('cpan').style.display='none';chatSend(+k-1)}});

/* ---- drift challenge ---- */
const dcHud=()=>'Drift Challenge  |  '+fmt(Math.max(0,G.dtl))+'  |  Score '+Math.round((G.bank||0)+(car.dp||0))+'  |  Best '+Math.round(S.bdc[TID]||0);
function dcEnd(){
  if(G.done)return;G.bank=(G.bank||0)+(car.dp||0);car.dp=0;G.done=true;
  const sc=Math.round(G.bank),nb=sc>(S.bdc[TID]||0);if(nb)S.bdc[TID]=sc;if(sc>(S.bestDrift||0))S.bestDrift=sc;save();
  const d=$('done');d.innerHTML='';const h=mk('div','',"Time's up!\nDrift score: "+sc+(nb?'  NEW BEST! \ud83c\udfc6':'  (best '+Math.round(S.bdc[TID])+')'));h.style.whiteSpace='pre-line';
  d.append(h,btn('Try again',()=>startMode('dc')),btn('Watch replay',watchReplay),btn('Menu',toMenu));d.style.display='flex';SND.fanfare()}

/* ---- replay ---- */
function recFrame(){const o=[];for(const k in MP.rs){const d=MP.rs[k].d,r=MP.rs[k].r;if(d&&r){o.push([+k,Math.round(d.x),Math.round(d.y),+d.a.toFixed(2)]);if(!REP.info[k])REP.info[k]={c:r.c,m:r.m,n:r.n,k:r.k}}}
  REP.f.push({m:[Math.round(car.x),Math.round(car.y),+car.a.toFixed(2)],o});if(REP.f.length>7200)REP.f.splice(0,900)}
function watchReplay(){
  if(REP.f.length<30){mpMsg('Replay is not ready yet');return}
  RP={t:0,sp:1,cam:0,zm:1,play:1,sv:{car:Object.assign({},car),cam:{x:cam.x,y:cam.y},rs:MP.rs,wa,paused},vis:{done:$('done').style.display,pause:$('pause').style.display},rs:{}};
  MP.rs=RP.rs;$('done').style.display='none';$('pause').style.display='none';$('ui').classList.remove('on');$('rp').style.display='flex';$('rp').reset();
  $('cpan').style.display='none';mode='replay';paused=false;releaseInputs()}
function exitReplay(){
  if(!RP)return;const s=RP.sv;MP.rs=s.rs;Object.assign(car,s.car);cam.x=s.cam.x;cam.y=s.cam.y;wa=s.wa;mode='game';paused=s.paused;
  $('rp').style.display='none';$('ui').classList.add('on');$('done').style.display=RP.vis.done;$('pause').style.display=RP.vis.pause;RP=null}
function replayTick(dt){
  const R=RP,F=REP.f,N=F.length,dur=(N-1)/30;
  if(R.play){R.t+=dt*R.sp;if(R.t>=dur){R.t=dur;R.play=0}}
  const fi=Math.max(0,Math.min(N-2,Math.floor(R.t*30))),u=Math.max(0,Math.min(1,R.t*30-fi)),a=F[fi],b=F[fi+1],lp=(p,q)=>p+(q-p)*u,la=(p,q)=>p+wrapA(q-p)*u;
  car.x=lp(a.m[0],b.m[0]);car.y=lp(a.m[1],b.m[1]);car.a=la(a.m[2],b.m[2]);car.vx=(b.m[0]-a.m[0])*.5;car.vy=(b.m[1]-a.m[1])*.5;
  const rs=R.rs,seen={};
  for(const e of a.o){const f=b.o.find(x=>x[0]===e[0])||e;seen[e[0]]=1;let o=rs[e[0]];
    if(!o){const inf=REP.info[e[0]]||{c:0,m:{}};o=rs[e[0]]={r:{vx:0,vy:0,c:inf.c,m:inf.m,l:0,n:inf.n,k:inf.k,t:0},d:{x:0,y:0,a:0}}}
    o.d.x=lp(e[1],f[1]);o.d.y=lp(e[2],f[2]);o.d.a=la(e[3],f[3]);o.r.x=o.d.x;o.r.y=o.d.y;o.r.a=o.d.a}
  for(const k in rs)if(!seen[k])delete rs[k];
  if(R.cam===3){const q=nearestTrack(car.x,car.y),bk=Math.floor(q.idx/22),p=TRK[(bk*22+11)%TRK.length],p2=TRK[(bk*22+12)%TRK.length],an=Math.atan2(p2[1]-p[1],p2[0]-p[0]),sd=bk%2?1:-1,
      tx=p[0]-Math.sin(an)*sd*(HW+170),ty=p[1]+Math.cos(an)*sd*(HW+170);
    cam.x+=(tx+(car.x-tx)*.45-cam.x)*.12;cam.y+=(ty+(car.y-ty)*.45-cam.y)*.12}
  else{cam.x+=(car.x+car.vx*12-cam.x)*.12;cam.y+=(car.y+car.vy*12-cam.y)*.12}
  $('rpi').textContent='Replay  '+fmt(R.t)+' / '+fmt(dur)+(R.play?'':'  (paused)');$('rpb').firstChild.style.width=(R.t/dur*100)+'%'}

function mpSend(o,skip){const s=JSON.stringify(o);MP.p.forEach(q=>{if(q!==skip&&q.dc&&q.dc.readyState==='open')try{q.dc.send(s)}catch(e){}})}
function mpWire(q,dc){q.dc=dc;dc.onopen=()=>{q.up=1;if(MP.host)mpRoster();else mpMyInfo();mpLobby()};dc.onclose=()=>mpLost(q);
  dc.onmessage=e=>{try{const m=JSON.parse(e.data);
    if(m.li){if(MP.host)q.info=mpInfoIn(m.li),mpRoster(),mpLobby()}
    else if(m.lr){if(!MP.host&&Array.isArray(m.lr)){MP.id=m.i|0;MP.max=Math.max(2,Math.min(6,m.n|0||2));MP.ro=m.lr.slice(0,6).map(e=>Object.assign(mpInfoIn(e),{id:e.id|0}));if(m.cf)MP.cfgL=mpCfgIn(m.cf);mpLobby()}}
    else if(m.bl){if(!MP.host&&m.bl!==MP.blk){MP.blk=m.bl;toLobby()}}
    else if(m.s){if(m.t&&m.t===MP.stk)return;MP.stk=m.t;MP.go=0;MP.n=m.n;MP.id=m.i;MP.cfg=mpCfgIn(m.f||{});mpGo()}
    else if(m.w!==undefined){if(MP.host)mpSend(m,q);if(G&&G.mp&&!G.done)mpEnd(false,m.w)}
    else if(m.f!==undefined){if(MP.host)mpSend(m,q);RES[m.f]={t:+m.t||0,n:String(m.n||'').slice(0,12),b:+m.b||0};const o=MP.rs[m.f];if(o)o.fin=1;if(G&&G.fin)showResults(true)}
    else if(m.rm){if(!MP.host&&m.rm!==MP.rmk&&mode==='game'){MP.rmk=m.rm;mpRestart()}}
    else if(m.q!==undefined){if(MP.host)mpSend(m,q);MP.cu=MP.cu||{};if(MP.cu[m.id]!==m.u){MP.cu[m.id]=m.u;if(MPO.chat&&CHATS[m.q])showChat(mpName(m.id),mpColIdx(m.id),CHATS[m.q])}}
    else if(CARS[m.c]){if(MP.host)mpSend(m,q);m.t=performance.now();m.n=String(m.n||'').slice(0,12);const o=MP.rs[m.id]||(MP.rs[m.id]={});o.r=m;if(!o.d)o.d={x:m.x,y:m.y,a:m.a}}}catch(_){}};
  if(dc.readyState==='open')dc.onopen()}
function mpGo(){if(MP.go++)return;clearInterval(LT);LT=0;$('mp').style.display='none';MP.rs={};launch(()=>{setTrack(MP.cfg.tr);start('track');G.mp=1;G.pads=MP.cfg.pads===0?0:1;Object.assign(car,gridXY(MP.id,MP.n));cam.x=car.x;cam.y=car.y})}
function mpStart(){ // host presses Start manually
  const up=MP.p.filter(q=>q.up&&!q.gone);
  if(!up.length)return mpMsg('Wait for at least one player to join');
  MP.p.filter(q=>!up.includes(q)).forEach(q=>{q.gone=1;try{q.pc.close()}catch(e){}});
  MP.p=up;up.forEach((q,i)=>q.id=i+1);MP.n=up.length+1;MP.cfg=mpCfg();const t=Date.now();
  for(let i=0;i<5;i++)setTimeout(()=>up.forEach(q=>{try{q.dc.send(JSON.stringify({s:1,t,n:MP.n,i:q.id,f:MP.cfg}))}catch(e){}}),i*150);
  MP.stk=t;mpGo()}
function mpNewGame(){const m={bl:Date.now()};MP.blk=m.bl;for(let i=0;i<5;i++)setTimeout(()=>mpSend(m),i*150);toLobby()}
function mpDone(t){const d=$('done');d.innerHTML='';d.append(mk('div','',t));if(MP.host)d.append(btn('New game (lobby)',mpNewGame,'pri'));d.append(btn('Leave room',toMenu));d.style.display='flex'}
function mpLost(q){if(q.gone)return;q.gone=1;const nm=(q.info&&q.info.n)||mpName(q.id);delete MP.rs[q.id];mpMsg(nm+' left');
  if(mode==='game'&&G&&G.mp&&!G.done){if(!MP.host||!MP.p.some(x=>!x.gone&&x.up)){G.done=true;mpDone('Everyone disconnected')}}
  else if(mode!=='game'){if(MP.host)mpRoster();if($('mp').style.display==='flex')mpLobby()}}
function mpEnd(win,w){G.done=true;if(win){const m={w:MP.id};for(let i=0;i<5;i++)setTimeout(()=>mpSend(m),i*150)}mpDone(win?'You win! 🏆':mpName(w)+' finished first')}
/* ---------- room code (Firebase Realtime Database) + lobby ---------- */
const CODE_LEN=6,FBL=90; // FBL = max players per server (free plan = 100 connections)
// ====== YAHAN APNE FIREBASE PROJECTS PASTE KARO. Room code ka pehla digit = server number (0 = Server 1, 1 = Server 2 ...) ======
const FB_SERVERS=[
  {name:'Server 1',cfg:{apiKey:'AIzaSyDwUuGvFZFbc3p1K65FWQ9So211AJRptCE',authDomain:'go-cars-212c6.firebaseapp.com',databaseURL:'https://go-cars-212c6-default-rtdb.asia-southeast1.firebasedatabase.app',projectId:'go-cars-212c6',storageBucket:'go-cars-212c6.firebasestorage.app',messagingSenderId:'535412101480',appId:'1:535412101480:web:4eed1a6cc3033f666ac6dd'}}
  // ,{name:'Server 2',cfg:{...}}   <- limit hit ho to naya Google account + naya project, config yahan add karo
];
const FBA=[];
function fbDb(i){const s=FB_SERVERS[i];if(!s||!window.firebase||/YOUR-PROJECT/.test(s.cfg.databaseURL))return null;
  try{if(!FBA[i])FBA[i]=firebase.initializeApp(s.cfg,'gc'+i).database();const db=FBA[i];clearTimeout(db._t);db.goOnline();return db}catch(e){return null}}
async function fbPick(){ // first server that still has room for players
  const to=(p,ms)=>Promise.race([p,new Promise((_,j)=>setTimeout(j,ms))]);
  for(let i=0;i<FB_SERVERS.length;i++){const db=fbDb(i);if(!db)continue;
    try{const sn=await to(db.ref('presence').once('value'),6000);if(sn.numChildren()<FBL)return i}catch(e){}
    try{db.goOffline()}catch(e){}}
  return -1}
function fbKit(host){const k={db:null,base:'',slot:0,off:[],
  destroy(){k.off.forEach(f=>{try{f()}catch(e){}});const db=k.db;if(!db)return;
    try{if(k.base)(host?db.ref(k.base):db.ref(k.base+'/slots/'+k.slot)).remove();if(k.pr)k.pr.remove()}catch(e){}
    db._t=setTimeout(()=>{try{db.goOffline()}catch(e){}},1500)}};return k}
function fbPres(k){k.pr=k.db.ref('presence').push(1);k.pr.onDisconnect().remove()}
// makes a Firebase message queue look like an RTCDataChannel, so mpWire() works unchanged. Sends are batched every 100ms.
function fbShim(k,rd,wr,slot,q){
  const R=k.db.ref(k.base+'/'+rd),W=k.db.ref(k.base+'/'+wr),S=k.db.ref(k.base+'/slots/'+slot);let buf=[],open=1,seen=0,t=0;
  const d={onopen:null,onclose:null,onmessage:null,get readyState(){return open?'open':'closed'},
    send:s=>{const m=/^\{"id":(\d+),"x":/.exec(s);if(m)buf=buf.filter(x=>x.k!==m[1]);buf.push({k:m&&m[1],s})}, // newest position per car wins
    stop:()=>{open=0;clearInterval(t);R.off();S.off()},
    close:()=>{if(!open)return;d.stop();try{S.remove()}catch(e){}}};
  t=setInterval(()=>{if(buf.length){const s=buf.map(x=>x.s).join('\n');buf=[];W.push(s)}},100);
  R.on('child_added',sn=>{const v=sn.val();sn.ref.remove();if(typeof v==='string')v.split('\n').forEach(x=>d.onmessage&&d.onmessage({data:x}))});
  S.on('value',sn=>{if(sn.exists())seen=1;else if(seen&&open){d.stop();d.onclose&&d.onclose()}});
  k.off.push(d.stop);q.pc={close:d.close};return d}
const clampN=(v,a,b,d)=>{v=+v;return isFinite(v)&&v>0?Math.max(a,Math.min(b,v)):d};
// host rules that are sent to everybody (accel + top speed are locked to the host's Settings)
const mpCfg=()=>({laps:MPO.laps,coll:MPO.coll,nos:MPO.nos,spd:MPO.spd,tr:MPO.track,wx:S.weather|0,pads:MPO.pads,pw:S.power,tp:S.top,eq:MPO.eq?1:0});
const mpCfgIn=f=>({laps:Math.max(1,Math.min(20,f.laps|0||3)),coll:f.coll?1:0,nos:f.nos?1:0,spd:Math.max(.5,Math.min(2,+f.spd||1)),tr:TRACKS[f.tr]?f.tr:'grand',wx:Math.max(0,Math.min(3,f.wx|0)),pads:f.pads===0?0:1,pw:clampN(f.pw,.3,3,1),tp:clampN(f.tp,.3,3,1),eq:f.eq?1:0});
const mpInfoIn=e=>({n:String(e.n||'').slice(0,10),k:(e.k>=0&&e.k<MPCOL.length)?e.k|0:-1,c:CARS[e.c]?e.c|0:-1,p:/^#[0-9a-f]{6}$/i.test(e.p)?e.p:'#888888'});
function mpMe(){const m=cm(),C=CARS[GAR.car]||CARS[0];return{n:MPO.name,k:MPO.color,c:GAR.car,p:PAINT[m.p]||C.c}}
function mpRosterList(){const me=mpMe();me.id=0;me.k=mpColIdx(0);
  return[me].concat(MP.p.filter(q=>!q.gone&&q.up).map(q=>{const e=Object.assign({n:'',k:-1,c:-1,p:'#888888'},q.info||{});e.id=q.id;if(e.k<0)e.k=q.id%MPCOL.length;return e}))}
function mpRoster(){ // host -> everybody: who is in the room + the locked rules
  const ro=MP.ro=mpRosterList(),cf=mpCfg();
  MP.p.forEach(q=>{if(q.gone||!q.dc||q.dc.readyState!=='open')return;try{q.dc.send(JSON.stringify({lr:ro,i:q.id,n:MP.max,cf}))}catch(e){}})}
function mpMyInfo(){ // joiner -> host: my name / colour / car
  if(MP.host)return mpRoster();const q=MP.p[0];if(!q||!q.dc||q.dc.readyState!=='open')return;try{q.dc.send(JSON.stringify({li:mpMe()}))}catch(e){}}
function mpGarage(){MP.gar=1;$('mp').style.display='none';go('garage')}
function mpGarBack(){MP.gar=0;MP.sig='';render('mpf');mpMyInfo();mpLobby()}
function mpLobby(){
  if(mode==='game'||MP.go||MP.gar)return;
  if(!MP.host){const q=MP.p[0];
    if(!q||q.gone){clearInterval(LT);LT=0;return mpPanel('Disconnected (room full or host left)',[btn('Back',()=>{mpClose();mpJoin()})])}}
  if(!LT)LT=setInterval(()=>{if(mode==='game'||MP.go||!MPK)return;MP.host?mpRoster():mpMyInfo()},1500); // udp-like channel: keep re-sending
  const host=MP.host,ro=host?mpRosterList():(MP.ro||[]),cf=host?mpCfg():MP.cfgL,max=MP.max||2,P=$('mp'),sig=JSON.stringify([ro,cf,max,host]);
  if(sig===MP.sig&&P.style.display==='flex'&&P.classList.contains('lobby'))return;
  MP.sig=sig;
  const list=mk('div','lob');
  for(let i=0;i<max;i++){const e=ro[i],r=mk('div','pl'+(e?(e.id===MP.id?' me':''):' em'));
    if(!e){r.textContent='Waiting for player...';list.append(r);continue}
    const dot=mk('i');dot.style.background=dot.style.color=MPCOL[e.k%MPCOL.length][1];
    const nm=mk('span','nm',(e.n||'Player '+(e.id+1))+(e.id===0?'  \u{1F451}':'')+(e.id===MP.id?' (You)':''));
    const cr=mk('span','cr'),sw=mk('b','sw');sw.style.background=e.p;cr.append(sw,document.createTextNode(CARS[e.c]?CARS[e.c].b+' '+CARS[e.c].n:'...'));
    r.append(dot,nm,cr);list.append(r)}
  const sub=mk('div','lsub',host?(ro.length<2?'Waiting for players to join...':'Press Start when everyone is ready'):'Waiting for the host to start...');
  const rl=mk('div','lrules',cf?'Host rules (locked):  '+[cf.laps+' laps','Accel '+Math.round(cf.pw*100)+'%','Top speed '+Math.round(cf.tp*cf.spd*100)+'%',TRACKS[cf.tr].n,cf.eq?'Equal cars':'Own cars'].join('  \u2022  '):'');
  const bb=mk('div','lbtn');bb.append(btn('Garage',mpGarage));
  if(host)bb.append(btn('Start game',mpStart,ro.length<2?'pri dis':'pri'));
  bb.append(btn('Leave',mpCancel,'dng'));
  const rc=mk('div','rc');rc.append(mk('small','','ROOM CODE'),mk('b','',MP.code||'...'));
  mpPanel('Lobby  \u2022  '+ro.length+'/'+max+' players',[sub,list,rl,bb,rc]);P.className='lobby'}
function mpHost(n){
  if(!window.firebase)return mpMsg('Firebase failed to load - check your internet and reload the page');
  mpClose();MP.host=1;MP.id=0;MP.n=n;MP.max=n;MP.ro=null;mpPanel('Creating room...',[btn('Cancel',mpCancel)]);
  const K=MPK=fbKit(1),bad=t=>{if(MPK===K){mpMsg(t);mpCancel()}};
  fbPick().then(async si=>{
    if(MPK!==K)return;if(si<0)return bad('No server reachable - check your internet / Firebase config');
    const db=K.db=fbDb(si);fbPres(K);let code='';
    for(let i=0;i<8&&!code;i++){const c=si+String(Math.floor(Math.random()*1e5)).padStart(5,'0');
      const r=await db.ref('rooms/'+c+'/meta').transaction(v=>v===null?{max:n,t:Date.now()}:undefined);if(MPK!==K)return;if(r.committed)code=c}
    if(!code)return bad('Could not create room');
    K.base='rooms/'+code;MP.code=code;db.ref(K.base).onDisconnect().remove();
    const sl=db.ref(K.base+'/slots');K.off.push(()=>sl.off());
    sl.on('child_added',sn=>{if(MPK!==K)return;const s=sn.key;
      const used=MP.p.filter(q=>!q.gone).map(q=>q.id);let id=0;
      for(let i=1;i<MP.max;i++)if(!used.includes(i)){id=i;break}
      if(!id||mode==='game'||MP.go){sn.ref.remove();return}   // room full or game already started
      db.ref(K.base+'/up/'+s).remove();db.ref(K.base+'/dn/'+s).remove();
      const q={id,pc:null,dc:null,info:null};MP.p.push(q);const d=fbShim(K,'up/'+s,'dn/'+s,s,q);mpWire(q,d);d.onopen()});
    mpLobby()}).catch(()=>bad('Could not create room'))
}
function mpJoin(){
  if(!window.firebase)return mpMsg('Firebase failed to load - check your internet and reload the page');
  mpClose();MP.host=0;MP.ro=null;MP.cfgL=null;
  const inp=document.createElement('input');inp.inputMode='numeric';inp.maxLength=CODE_LEN;inp.placeholder='Room code';
  const doJoin=()=>{
    const code=inp.value.replace(/\D/g,'');if(code.length!==CODE_LEN)return mpMsg('Enter the '+CODE_LEN+'-digit code');
    const db=fbDb(+code[0]);if(!db)return mpMsg('Room not found');
    mpPanel('Joining...',[btn('Cancel',mpCancel)]);MP.code=code;
    const K=MPK=fbKit(0);K.db=db;K.base='rooms/'+code;let tm=0;
    const fail=t=>{clearTimeout(tm);if(MPK!==K)return;mpClose();mpMsg(t);mpJoin()};
    tm=setTimeout(()=>fail('Room not found / timeout'),15000);
    db.ref(K.base+'/meta').once('value').then(async sn=>{
      const m=sn.val();if(MPK!==K)return;if(!m)return fail('Room not found');
      let s=0;for(let i=1;i<(m.max|0)&&!s;i++){const r=await db.ref(K.base+'/slots/'+i).transaction(v=>v===null?{t:Date.now()}:undefined);if(MPK!==K)return;if(r.committed)s=i}
      if(!s)return fail('Room is full');
      clearTimeout(tm);K.slot=s;fbPres(K);db.ref(K.base+'/slots/'+s).onDisconnect().remove();
      const q={id:0,pc:null,dc:null};MP.p.push(q);const d=fbShim(K,'dn/'+s,'up/'+s,s,q);mpWire(q,d);d.onopen()
    }).catch(()=>fail('Room not found'))};
  mpPanel('Join a game',[mk('div','','Type the room code'),inp,btn('Join',doJoin,'pri'),btn('Cancel',mpCancel)]);
  setTimeout(()=>{try{inp.focus()}catch(e){}},50)
}
function drawRemote(o){const r=o.r,d=o.d;if(!r||!d)return;const sc=GAR.car,sm=GAR.mods[r.c];GAR.car=r.c;GAR.mods[r.c]=r.m;if(!MP.cfg.coll)ctx.globalAlpha=.6;try{drawCar(d.x,d.y,d.a)}finally{ctx.globalAlpha=1;GAR.car=sc;if(sm)GAR.mods[r.c]=sm;else delete GAR.mods[r.c]}}

/* ---------- menus ---------- */
const msg=$('msg');let to;
function soon(n){msg.textContent=n+' is coming soon';msg.classList.add('show');clearTimeout(to);to=setTimeout(()=>msg.classList.remove('show'),1800)}
function btn(text,fn,cls){const b=document.createElement('button');if(text.startsWith('<svg')){b.innerHTML=text;b.className='lg'}else b.textContent=text;b.onclick=fn;if(cls)b.className=(b.className?b.className+' ':'')+cls;return b}
const pip=v=>v>=3?'MAX':'\u25cf'.repeat(v)+'\u25cb'.repeat(3-v);
const up=(k,mx,msg,scr)=>()=>{const m=cm();if(m[k]>=3)MH=mx;else{m[k]++;MH=msg+' (level '+m[k]+')'}saveG();render(scr)};
const cyc=(k,names,lab,scr)=>()=>{const m=cm();m[k]=(m[k]+1)%names.length;MH=lab+': '+names[m[k]];saveG();render(scr)};
/*GARAGE-START*/
/* ---------- garage showroom: car seen from the side, zoom + move left/right ---------- */
const GV={on:0,zoom:1,tz:1,pan:0,fv:0,wu:0,pa:0,pv:0,s:4,bl:300,ptr:new Map(),pd:0};
const GZ_MIN=.6,GZ_MAX=2.4,gclamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function gvSet(on){
  if(on&&!GV.on){GV.zoom=GV.tz=1;GV.pan=0;GV.fv=0;GV.pv=0;GV.pa=0}
  GV.on=on?1:0;const z=$('gzoom');if(z)z.style.display=on?'flex':'none';if(!on)GV.ptr.clear()}
function gvReset(){GV.tz=1;GV.pan=0;GV.fv=0}
function gvZoomBy(f){GV.tz=gclamp(GV.tz*f,GZ_MIN,GZ_MAX);GV.zoom=gclamp(GV.zoom*f,GZ_MIN*.9,GZ_MAX*1.05)}
function gvLim(){return Math.max(W*.2,GV.bl*GV.zoom*.55)}
function gvMove(dx){ // only left / right, never up / down
  const lim=gvLim(),np=gclamp(GV.pan+dx,-lim,lim),real=np-GV.pan;GV.pan=np;GV.wu+=real/(GV.s||4);
  GV.fv=GV.fv*.5+real*60*.5}
(function(){
  const z=document.createElement('div');z.id='gzoom';
  [['−',()=>gvZoomBy(1/1.25)],['+',()=>gvZoomBy(1.25)],['Center',gvReset]].forEach(([t,f])=>z.append(btn(t,f,'sb')));
  $('stage').append(z);
  const m=$('menu'),port=()=>matchMedia('(orientation:portrait)').matches;
  const pt=e=>port()?{x:e.clientY,y:-e.clientX}:{x:e.clientX,y:e.clientY}; // stage is rotated 90deg in portrait
  const dist=()=>{const a=[...GV.ptr.values()];return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)};
  m.addEventListener('pointerdown',e=>{if(!GV.on||e.target.closest('button,#gstats'))return;try{m.setPointerCapture(e.pointerId)}catch(_){}
    GV.ptr.set(e.pointerId,pt(e));GV.pd=GV.ptr.size===2?dist():0;GV.fv=0});
  m.addEventListener('pointermove',e=>{if(!GV.ptr.has(e.pointerId))return;const q=pt(e),o=GV.ptr.get(e.pointerId);GV.ptr.set(e.pointerId,q);
    if(GV.ptr.size===1)gvMove(q.x-o.x);else if(GV.ptr.size===2){const d=dist();if(GV.pd>0)gvZoomBy(d/GV.pd);GV.pd=d}
    e.preventDefault()});
  const up=e=>{GV.ptr.delete(e.pointerId);GV.pd=GV.ptr.size===2?dist():0};
  ['pointerup','pointercancel','lostpointercapture'].forEach(n=>m.addEventListener(n,up));
  m.addEventListener('wheel',e=>{if(!GV.on)return;e.preventDefault();gvZoomBy(Math.exp(-e.deltaY*.0015))},{passive:false});
  m.addEventListener('dblclick',e=>{if(GV.on&&!e.target.closest('button,#gstats'))gvReset()});
})();

/* side-on car, drawn from the same data as the top-down car. Units: car length ~100, ground y=0, y grows upward. */
function sideWheel(cx,R,ang){
  ctx.fillStyle='#09090b';ctx.beginPath();ctx.arc(cx,R,R,0,7);ctx.fill();
  ctx.strokeStyle='#26272c';ctx.lineWidth=R*.07;ctx.beginPath();ctx.arc(cx,R,R*.9,0,7);ctx.stroke();
  const g=ctx.createRadialGradient(cx-R*.25,R+R*.25,R*.05,cx,R,R*.7);g.addColorStop(0,'#f6f8fa');g.addColorStop(.55,'#9aa1ab');g.addColorStop(1,'#4b5059');
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,R,R*.68,0,7);ctx.fill();
  ctx.fillStyle='#1d2025';ctx.beginPath();ctx.arc(cx,R,R*.5,0,7);ctx.fill();
  ctx.strokeStyle='#d4121f';ctx.lineWidth=R*.15;ctx.beginPath();ctx.arc(cx,R,R*.49,.35,1.1);ctx.stroke();
  ctx.save();ctx.translate(cx,R);ctx.rotate(-ang);
  for(let i=0;i<5;i++){ctx.rotate(Math.PI*2/5);ctx.fillStyle='#c9ced5';ctx.beginPath();ctx.moveTo(0,-R*.09);ctx.lineTo(R*.64,-R*.14);ctx.lineTo(R*.64,R*.14);ctx.lineTo(0,R*.09);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(R*.1,-R*.02,R*.5,R*.05)}
  ctx.restore();
  ctx.strokeStyle='#e4e7ec';ctx.lineWidth=R*.05;ctx.beginPath();ctx.arc(cx,R,R*.68,0,7);ctx.stroke();
  ctx.fillStyle='#2b2e34';ctx.beginPath();ctx.arc(cx,R,R*.16,0,7);ctx.fill();ctx.fillStyle='#c8ccd2';ctx.beginPath();ctx.arc(cx,R,R*.1,0,7);ctx.fill()}
function sideCar(C,m,now,s,refl){
  const h=C.L/2,cs=C.cs|0,TB=[22,21,18.5,20][cs],R=Math.min((C.wl||18)*.41,(TB-3.9)/2),Ra=R+1.7,gc=R*.62,col=PAINT[m.p]||C.c,lc=LIV[m.sc]||C.s,lg=LGT[m.l][1],nc=NEON[m.nc],wx=C.wx||[-.55,.5];
  const xr=wx[0]*h*1.07,xf=wx[1]*h*1.15,ax=Math.sqrt(Ra*Ra-(R-gc)*(R-gc)),th=Math.asin((gc-R)/Ra);
  const RF=[31,28.5,26,27][cs],tipH=TB-[3.5,4.5,8,5][cs],deckH=[TB-.5,TB-1,TB+.5,TB-.5][cs];
  const x1=C.cab+C.cl/2,x0=C.cab-C.cl/2,xw=x1+5,xrb=x0-7,rkF=[9,12,18,14][cs],rkR=[6,9,11,12][cs],xrf=xw-rkF,xrr=xrb+rkR;
  const sf=[.26,.24,.1,.2][cs],ti=[2.8,2.6,1.7,2.3][cs],sillY=TB+(RF-TB)*sf,tF=(sillY-TB)/(RF-TB),tR=Math.max(.05,(sillY-deckH)/(RF-deckH)),xgF=xw-tF*rkF-2.2,xgR=xrb+tR*rkR+2.4;
  const bs=v=>v*s,ang=GV.wu/R;
  const mx=(xrr+xrf)/2,roofTo=()=>{ctx.bezierCurveTo(xrb+(xrr-xrb)*.7,deckH+(RF-deckH)*.55,xrr,RF,mx,RF);ctx.bezierCurveTo(xrf,RF,xrf+(xw-xrf)*.5,RF-(RF-TB)*.62,xw,TB)};
  const body=()=>{ctx.beginPath();ctx.moveTo(h-2.5,gc+1);ctx.lineTo(xf+ax,gc);ctx.arc(xf,R,Ra,th,Math.PI-th,false);ctx.lineTo(xr+ax,gc);ctx.arc(xr,R,Ra,th,Math.PI-th,false);
    ctx.lineTo(-h+2,gc);ctx.quadraticCurveTo(-h,gc,-h,gc+3.5);ctx.lineTo(-h,deckH-3);ctx.quadraticCurveTo(-h,deckH,-h+3.5,deckH+.4);
    ctx.quadraticCurveTo((-h+xrb)/2,deckH+1.3,xrb,deckH+.8);roofTo();
    ctx.bezierCurveTo(xf-2,TB+.2,xf+3,TB-.6,h-6,tipH+1.2);ctx.quadraticCurveTo(h-.3,tipH+.2,h,tipH-3.5);
    ctx.lineTo(h,gc+4);ctx.quadraticCurveTo(h,gc+.6,h-2.5,gc+1);ctx.closePath()};
  const top=()=>{ctx.beginPath();ctx.moveTo(-h+3.5,deckH+.4);ctx.quadraticCurveTo((-h+xrb)/2,deckH+1.3,xrb,deckH+.8);roofTo();ctx.bezierCurveTo(xf-2,TB+.2,xf+3,TB-.6,h-6,tipH+1.2)};
  if(!refl){ // neon underglow + headlight beam
    if(nc&&nc[1]){const nk=nc[1]==='rb'?'hsl('+(now/5%360|0)+',100%,55%)':nc[1],st=m.ns;let al=.6;
      if(st===2)al=.25+.4*(.5+.5*Math.sin(now/230));if(st===3)al=(now/130|0)%2?.7:.08;
      ctx.save();ctx.globalAlpha=al;ctx.shadowColor=nk;ctx.shadowBlur=bs(7);
      if(st===1){ctx.strokeStyle=nk;ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(0,1.5,h*1.04,4.2,0,0,7);ctx.stroke()}
      else{ctx.fillStyle=nk;ctx.beginPath();ctx.ellipse(0,1.6,h*.96,3.4,0,0,7);ctx.fill();ctx.globalAlpha=al*.35;ctx.beginPath();ctx.ellipse(0,1.6,h*1.2,6,0,0,7);ctx.fill()}
      ctx.restore();ctx.strokeStyle=nk;ctx.globalAlpha=Math.min(1,al+.2);ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(xr+ax+1,gc+.3);ctx.lineTo(xf-ax-1,gc+.3);ctx.stroke();ctx.globalAlpha=1}
    if(S.beam){const g=ctx.createLinearGradient(h,0,h+110,0);g.addColorStop(0,hexA(lg,.38));g.addColorStop(1,hexA(lg,0));ctx.fillStyle=g;
      ctx.beginPath();ctx.moveTo(h-1,tipH-1.5);ctx.lineTo(h+110,tipH+8);ctx.lineTo(h+110,tipH-22);ctx.closePath();ctx.fill()}}
  // wheel wells
  ctx.fillStyle='#050506';[xf,xr].forEach(x=>{ctx.beginPath();ctx.arc(x,R,Ra+.3,0,7);ctx.fill()});
  body();ctx.fillStyle=col;ctx.fill();
  ctx.save();body();ctx.clip();
  let g=ctx.createLinearGradient(0,0,0,RF+2);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(.28,'rgba(0,0,0,.16)');g.addColorStop(.62,'rgba(255,255,255,0)');g.addColorStop(.86,'rgba(255,255,255,.2)');g.addColorStop(1,'rgba(255,255,255,.34)');
  ctx.fillStyle=g;ctx.fillRect(-h-6,0,C.L+12,RF+4);
  ctx.fillStyle='#0c0d10';ctx.fillRect(xr+ax*.8,gc-.2,xf-xr-ax*1.6,2.4);
  // stripes / livery
  ctx.fillStyle=lc;ctx.strokeStyle=lc;
  const ds=m.st===0?(C.ds?4:1):m.st,ly=TB-6.5;
  if(ds===2){ctx.save();ctx.translate(0,-1.5);ctx.lineWidth=2.6;top();ctx.stroke();ctx.restore()}
  else if(ds===13){ctx.save();ctx.translate(0,-1.4);ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(xw,TB);ctx.bezierCurveTo(xf-2,TB+.2,xf+3,TB-.6,h-6,tipH+1.2);ctx.moveTo(-h+3.5,deckH+.4);ctx.quadraticCurveTo((-h+xrb)/2,deckH+1.3,xrb,deckH+.8);ctx.stroke();ctx.restore()}
  else if(ds===3)ctx.fillRect(-h,ly,C.L,1.3);
  else if(ds===4){ctx.fillRect(-h,ly+2.2,C.L,1.4);ctx.fillRect(-h,ly-1,C.L,1.4)}
  else if(ds===5){ctx.fillRect(-h,ly+3.4,C.L,1.2);ctx.fillRect(-h,ly+.6,C.L,1.2);ctx.fillRect(-h,ly-2.2,C.L,1.2)}
  else if(ds===6){for(let i=0;i<C.L/3;i++)for(let j=0;j<3;j++)if((i+j)&1)ctx.fillRect(-h+i*3,ly-1.5+j*3,3,3)}
  else if(ds===7){for(let i=0;i<4;i++){const bx=h-6-i*11;ctx.beginPath();ctx.moveTo(bx+8,ly-3);ctx.quadraticCurveTo(bx+3,ly+1,bx-5,ly+4+i);ctx.quadraticCurveTo(bx,ly,bx-2,ly-3);ctx.closePath();ctx.fill()}}
  else if(ds===8){ctx.lineWidth=2.2;ctx.lineJoin='miter';for(let i=0;i<7;i++){const bx=-h*.75+i*9;ctx.beginPath();ctx.moveTo(bx,ly-4);ctx.lineTo(bx+5,ly);ctx.lineTo(bx,ly+4);ctx.stroke()}}
  else if(ds===9){ctx.lineWidth=2.4;ctx.lineJoin='miter';ctx.beginPath();ctx.moveTo(-h*.8,ly-3);ctx.lineTo(-h*.5,ly+3);ctx.lineTo(-h*.3,ly-3);ctx.lineTo(0,ly+3);ctx.lineTo(h*.2,ly-3);ctx.lineTo(h*.5,ly+3);ctx.stroke()}
  else if(ds===10){for(let i=0;i<5;i++){const bx=-h*.9+i*20;ctx.beginPath();ctx.moveTo(bx,gc+2);ctx.lineTo(bx+5,gc+2);ctx.lineTo(bx+15,TB);ctx.lineTo(bx+10,TB);ctx.fill()}}
  else if(ds===11){for(let i=0;i<C.L/6;i++)for(let j=0;j<3;j++){ctx.beginPath();ctx.arc(-h+3+i*6+(j&1)*3,ly-3+j*3,1.1,0,7);ctx.fill()}}
  else if(ds===12)ctx.fillRect(-h,0,C.L,TB-9.5);
  else if(ds===14){const nx=(xr+xf)/2-4;ctx.beginPath();ctx.arc(nx,ly,4.3,0,7);ctx.fill();ctx.save();ctx.translate(nx,ly-.2);ctx.scale(1,-1);ctx.fillStyle='#111';ctx.font='900 6.4px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('7',0,.4);ctx.restore()}
  // hood parts
  const hk=m.h||(C.hood?1:0),hx0=xw+4,hx1=h-10;
  if(hk===1){ctx.fillStyle='#101114';ctx.beginPath();ctx.moveTo(hx0+4,TB-.6);ctx.lineTo(hx0+7,TB+1.6);ctx.lineTo(hx0+16,TB+1.5);ctx.lineTo(hx0+19,TB-.8);ctx.fill();ctx.fillStyle='#2c2c33';ctx.fillRect(hx0+8,TB+.4,7,.5)}
  else if(hk===2){ctx.save();ctx.translate(0,-1.2);ctx.strokeStyle='#17181b';ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(xw+1,TB);ctx.bezierCurveTo(xf-2,TB+.2,xf+3,TB-.6,h-6,tipH+1.2);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.22)';ctx.lineWidth=.35;ctx.setLineDash([.9,1.1]);ctx.stroke();ctx.restore()}
  else if(hk===3){ctx.strokeStyle='#101114';ctx.lineWidth=.9;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(hx0+8+i*3.2,TB-.2);ctx.lineTo(hx0+10+i*3.2,TB+1.3);ctx.stroke()}}
  else if(hk===4){ctx.fillStyle='#101114';[hx0+3,hx0+14].forEach(x=>{ctx.beginPath();ctx.moveTo(x,TB-.4);ctx.lineTo(x+2,TB+1.3);ctx.lineTo(x+7,TB+1.2);ctx.lineTo(x+9,TB-.5);ctx.fill()})}
  if(C.vt){ctx.fillStyle='#08090b';for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(xr+ax+2+i*2.6,gc+8.4);ctx.lineTo(xr+ax+4+i*2.6,gc+8.4);ctx.lineTo(xr+ax+6.4+i*2.6,gc+3.4);ctx.lineTo(xr+ax+4.4+i*2.6,gc+3.4);ctx.fill()}}
  // door seams + handle
  ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=.35;ctx.beginPath();
  ctx.moveTo(xf-ax-2,gc+2.4);ctx.lineTo(xf-ax-2.6,sillY-.4);ctx.moveTo(xr+ax+3.5,gc+2.4);ctx.lineTo(xr+ax+3,sillY-.4);
  if(['M5','Charger','GR Corolla'].includes(C.n)){const bx=(xf+xr)/2+1;ctx.moveTo(bx,gc+2.4);ctx.lineTo(bx,sillY-.4)}
  ctx.stroke();
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect((xf+xr)/2-9,sillY-3.7,5.6,1);ctx.fillStyle='rgba(255,255,255,.45)';ctx.fillRect((xf+xr)/2-9,sillY-2.75,5.6,.3);
  ctx.restore();
  // glass
  ctx.save();body();ctx.clip();
  const gl=()=>{ctx.beginPath();ctx.moveTo(xgR,sillY);ctx.quadraticCurveTo((xgR+xrr+2.2)/2-.4,(sillY+RF-ti)/2+.6,xrr+2.2,RF-ti);ctx.quadraticCurveTo(mx,RF-ti+1.2,xrf-1.8,RF-ti);
    ctx.quadraticCurveTo((xrf+xgF)/2+.5,(sillY+RF-ti)/2+.5,xgF,sillY);ctx.closePath()};
  gl();g=ctx.createLinearGradient(0,sillY,0,RF);const tc=TNTC[m.w];g.addColorStop(0,tc);g.addColorStop(1,m.w===3?'#e8f0f6':'#2a3340');ctx.fillStyle=g;ctx.fill();
  ctx.save();gl();ctx.clip();ctx.fillStyle='rgba(255,255,255,.2)';
  ctx.beginPath();ctx.moveTo(xgR+3,sillY);ctx.lineTo(xgR+8,sillY);ctx.lineTo(xrr+9,RF-ti);ctx.lineTo(xrr+4,RF-ti);ctx.fill();
  ctx.beginPath();ctx.moveTo((xgR+xgF)/2,sillY);ctx.lineTo((xgR+xgF)/2+2.5,sillY);ctx.lineTo((xrr+xrf)/2+6.5,RF-ti);ctx.lineTo((xrr+xrf)/2+4,RF-ti);ctx.fill();ctx.restore();
  if(['M5','Charger','GR Corolla'].includes(C.n)){const bx=(xf+xr)/2+1;ctx.fillStyle=col;ctx.fillRect(bx-1.2,sillY-.2,2.4,RF-sillY-1.5);ctx.fillStyle='rgba(0,0,0,.35)';ctx.fillRect(bx-1.2,sillY-.2,2.4,RF-sillY-1.5)}
  gl();ctx.strokeStyle='rgba(0,0,0,.65)';ctx.lineWidth=.5;ctx.stroke();ctx.restore();
  // mirror
  ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(xgF+1.5,sillY+.4,2,1.2,0,0,7);ctx.fill();ctx.strokeStyle='rgba(0,0,0,.6)';ctx.lineWidth=.3;ctx.stroke();
  // lights (side view of the front / rear lamps)
  ctx.shadowColor=lg;ctx.shadowBlur=refl?0:bs(4);ctx.fillStyle=lg;const lt=C.lt|0,hy=tipH-2.1;
  if(lt===0){ctx.fillStyle='#0b0b0d';ctx.beginPath();ctx.ellipse(h-3.6,hy,4.2,2.5,-.1,0,7);ctx.fill();ctx.fillStyle=lg;ctx.beginPath();ctx.ellipse(h-3.2,hy,3,1.7,-.1,0,7);ctx.fill()}
  else if(lt===1){ctx.fillStyle='#0b0b0d';ctx.fillRect(h-10,hy-1.5,10,3);ctx.fillStyle=lg;ctx.fillRect(h-9.4,hy-.6,9.4,1.2)}
  else if(lt===2){ctx.fillStyle='#0b0b0d';ctx.beginPath();ctx.moveTo(h+.1,hy+1.6);ctx.lineTo(h-10.5,hy+.8);ctx.lineTo(h-3,hy-2.8);ctx.closePath();ctx.fill();
    ctx.fillStyle=lg;ctx.beginPath();ctx.moveTo(h-.2,hy+.9);ctx.lineTo(h-8.6,hy+.5);ctx.lineTo(h-3.2,hy-1.8);ctx.closePath();ctx.fill()}
  else{ctx.fillStyle='#0b0b0d';ctx.fillRect(h-9.6,hy-2.4,9.6,4.8);ctx.fillStyle=lg;[h-3.2,h-6.8].forEach(x=>{ctx.beginPath();ctx.arc(x,hy,1.5,0,7);ctx.fill()})}
  ctx.shadowColor='#ff2a2a';ctx.shadowBlur=refl?0:bs(4);ctx.fillStyle='#ff2a2a';const tl=C.tl|0,ty=deckH-3.2;
  if(tl===0)ctx.fillRect(-h,ty-1.6,3.2,3.6);else if(tl===1)ctx.fillRect(-h,ty-.6,8,1.3);
  else if(tl===2){[ty+1.4,ty-1.6].forEach(y=>{ctx.beginPath();ctx.arc(-h+1.6,y,1.5,0,7);ctx.fill()})}
  else if(tl===3)ctx.fillRect(-h,ty-2.4,3.4,4.8);else{ctx.fillRect(-h,ty+.6,3.2,1);ctx.fillRect(-h,ty-1.6,3.2,1)}
  ctx.shadowBlur=0;
  // front splitter / rear diffuser, exhaust tip
  ctx.fillStyle='#0b0b0d';ctx.fillRect(h-9,gc-.5,10.6,1.2);ctx.fillRect(-h-.2,gc-.4,9,2.2);
  const xrad=[2,3,3.5][m.x];ctx.fillStyle=m.x?'#c3c8d0':'#5a5c61';ctx.fillRect(-h-1.8,gc+1.7,2.6,xrad*.75);ctx.fillStyle='#050506';ctx.fillRect(-h-1.9,gc+1.9,.8,xrad*.75-.4);
  // spoiler
  const sp=Math.max(m.s,C.wing?3:0),sc=SPC[m.pc][1]==='body'?col:SPC[m.pc][1],dk=deckH+.4;
  if(sp){ctx.fillStyle=sc;
    if(sp===1){ctx.beginPath();ctx.moveTo(-h+1,dk);ctx.lineTo(-h-.8,dk+2);ctx.lineTo(-h+5,dk+.4);ctx.fill()}
    else if(sp===2){ctx.beginPath();ctx.moveTo(-h+13,dk);ctx.quadraticCurveTo(-h+4,dk+.4,-h-1.5,dk+3.8);ctx.lineTo(-h+.5,dk+.2);ctx.fill()}
    else if(sp===3){ctx.fillStyle='#17181b';ctx.fillRect(-h+6,dk,1.4,6.4);ctx.fillRect(-h+13,dk,1.4,5.8);ctx.fillStyle=sc;
      ctx.beginPath();ctx.moveTo(-h-2.5,dk+6.2);ctx.lineTo(-h+16,dk+7.4);ctx.lineTo(-h+16.2,dk+9);ctx.lineTo(-h-2.5,dk+7.8);ctx.fill();ctx.fillStyle='#111';ctx.fillRect(-h-2.5,dk+5.6,19,.9)}
    else if(sp===4){ctx.fillStyle='#17181b';ctx.fillRect(-h+5,dk,1.4,6);ctx.fillRect(-h+13,dk,1.4,6);ctx.fillStyle=sc;
      ctx.beginPath();ctx.moveTo(-h-3,dk+5.6);ctx.lineTo(-h+17,dk+6.4);ctx.lineTo(-h+17,dk+8);ctx.lineTo(-h-3,dk+7.2);ctx.fill();
      ctx.beginPath();ctx.moveTo(-h-2,dk+8.6);ctx.lineTo(-h+13,dk+9.6);ctx.lineTo(-h+13,dk+10.8);ctx.lineTo(-h-2,dk+9.8);ctx.fill();ctx.fillStyle='#111';ctx.fillRect(-h-3,dk+5,20,.8)}
    else{ctx.fillStyle='#17181b';ctx.fillRect(-h+8,dk,1.4,5.2);ctx.fillRect(-h+13,dk,1.4,4.8);ctx.fillStyle='#111';
      ctx.beginPath();ctx.moveTo(-h-3,dk+5);ctx.lineTo(-h+17,dk+5.8);ctx.lineTo(-h+17,dk+6.9);ctx.lineTo(-h-3,dk+6.1);ctx.fill();ctx.fillStyle=sc;ctx.fillRect(-h-3,dk+4.6,20,.7)}}
  // wheels on top
  sideWheel(xr,R,ang);sideWheel(xf,R,ang);
  ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=.45;[xf,xr].forEach(x=>{ctx.beginPath();ctx.arc(x,R,Ra,th+.15,Math.PI-th-.15,false);ctx.stroke()});
  ctx.lineWidth=.5;ctx.strokeStyle='rgba(0,0,0,.55)';body();ctx.stroke();
  ctx.lineWidth=.55;ctx.strokeStyle='rgba(255,255,255,.26)';top();ctx.stroke()}

function drawGarage(dt){
  const C=CARS[GAR.car]||CARS[0],m=cm(),now=performance.now(),k=Math.min(1,dt*10);
  GV.zoom+=(GV.tz-GV.zoom)*k;
  GV.bl=Math.min(W*.54,H*1.3);const s=GV.bl/(C.L+10)*GV.zoom;GV.s=s;
  const cy=H*(.34-.1*Math.max(0,GV.zoom-1)),yG=cy+14.5*s,cx=W*.37+GV.pan;
  if(!GV.ptr.size&&Math.abs(GV.fv)>.5){const lim=gvLim(),np=gclamp(GV.pan+GV.fv*dt,-lim,lim);GV.wu+=(np-GV.pan)/s;GV.pan=np;GV.fv*=Math.exp(-dt*9);if(np===-lim||np===lim)GV.fv=0}
  else if(!GV.ptr.size)GV.fv=0;
  const tp=gclamp(GV.fv*.00004,-.05,.05);GV.pv+=((tp-GV.pa)*60-GV.pv*7)*dt;GV.pa+=GV.pv*dt;
  ctx.setTransform(1,0,0,1,0,0);
  let g=ctx.createLinearGradient(0,0,0,yG);g.addColorStop(0,'#0c0e13');g.addColorStop(1,'#1b202b');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  g=ctx.createRadialGradient(cx,cy,10,cx,cy,W*.55);g.addColorStop(0,'rgba(255,170,70,.20)');g.addColorStop(1,'rgba(255,170,70,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,255,255,.035)';for(let i=-6;i<=6;i++)ctx.fillRect(W*.5+i*W*.16-1,0,2,yG);
  g=ctx.createLinearGradient(0,yG,0,H);g.addColorStop(0,'#232938');g.addColorStop(1,'#07080b');ctx.fillStyle=g;ctx.fillRect(0,yG,W,H-yG);
  ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(0,yG,W,1.5);
  g=ctx.createRadialGradient(cx,yG,5,cx,yG,C.L*s*.75);g.addColorStop(0,'rgba(255,214,150,.20)');g.addColorStop(1,'rgba(255,214,150,0)');
  ctx.save();ctx.translate(0,yG);ctx.scale(1,.22);ctx.translate(0,-yG);ctx.fillStyle=g;ctx.fillRect(cx-C.L*s,yG-C.L*s,C.L*s*2,C.L*s*2);ctx.restore();
  // car, with its reflection on the floor
  const place=()=>{ctx.translate(cx,yG);ctx.scale(s,-s);const R=(C.wl||18)*.41;ctx.translate(0,R);ctx.rotate(GV.pa);ctx.translate(0,-R)};
  ctx.save();place();ctx.scale(1,-1);ctx.globalAlpha=.2;sideCar(C,m,now,s,true);ctx.restore();
  g=ctx.createLinearGradient(0,yG,0,yG+30*s);g.addColorStop(0,'rgba(20,24,34,.35)');g.addColorStop(.55,'rgba(10,12,17,.96)');g.addColorStop(1,'#07080b');ctx.fillStyle=g;ctx.fillRect(0,yG+1.5,W,H-yG);
  ctx.save();ctx.translate(cx,yG);ctx.scale(1,.12);ctx.fillStyle='rgba(0,0,0,.65)';ctx.beginPath();ctx.ellipse(0,0,C.L*s*.56,C.L*s*.2,0,0,7);ctx.fill();ctx.restore();
  ctx.save();place();sideCar(C,m,now,s,false);ctx.restore();
  ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(0,0,W,H)}
/*GARAGE-END*/
const SCREENS={
  main:()=>[ACC.user?'Player: '+ACC.user+(ACC.st==='offline'?'  (offline - progress not saved yet)':''):'',[['Singleplayer',()=>go('single')],['Multiplayer',()=>go('mp')],['Garage',()=>go('garage')],['Settings',()=>openSettings(()=>{})],['Logout',()=>ACC.logout()]]],
  single:['Singleplayer',[['Free mode',()=>go('free')],['Time trial',()=>go('trk_tt')],['Drift challenge',()=>go('trk_dc')],['Levels',()=>go('levels')],['Back',()=>go('main'),'wide']]],
  free:['Free mode',[['Track',()=>go('trk_free')],['Ground',()=>launch(()=>start('ground'))],['Back',()=>go('single')]]],
  garage:()=>['Current car: '+CARS[GAR.car].b+' '+CARS[GAR.car].n,[['Select car',()=>go('sel')],['Modify car',()=>{MH='';go('mods')}],['Back',()=>MP.gar?mpGarBack():go('main'),'wide']]],
  sel:['Choose a company',[...BRANDS.map(b=>['<svg viewBox="0 0 48 48" aria-label="'+b+'">'+LOGO[b]+'</svg>',()=>go('b_'+b)]),['Back',()=>go('garage'),'wide']]],
  mods:()=>[MH||'Pick a category. Stats are on the right.',[['Performance',()=>go('mods_p')],['Body parts',()=>go('mods_b')],['Paint & design',()=>go('mods_d')],['Neon lights',()=>go('mods_n')],['Reset',()=>{GAR.mods[GAR.car]=Object.assign({},MD);MH='Car reset to stock';saveG();render('mods')}],['Back',()=>go('garage'),'wide']]],
  mods_p:()=>{const m=cm(),s='mods_p';return[MH||'Upgrade performance',[
    ['Engine '+pip(m.e),up('e','Engine is maxed','Engine: more acceleration',s)],['Turbo '+pip(m.t),up('t','Turbo is maxed','Turbo: higher top speed',s)],
    ['Tyres '+pip(m.y),up('y','Tyres are maxed','Tyres: more grip',s)],['Brakes '+pip(m.b),up('b','Brakes are maxed','Brakes: stop faster',s)],
    ['Exhaust: '+EXH[m.x],cyc('x',EXH,'Exhaust (louder, more pops)',s)],['Back',()=>{MH='';go('mods')},'wide']]]},
  mods_b:()=>{const m=cm(),s='mods_b';return[MH||'Change body parts',[
    ['Spoiler: '+SPOIL[m.s],cyc('s',SPOIL,'Spoiler (adds grip)',s)],['Spoiler colour: '+SPCN[m.pc],cyc('pc',SPCN,'Spoiler colour',s)],
    ['Hood: '+HOOD[m.h],cyc('h',HOOD,'Hood',s)],['Tint: '+TINT[m.w],cyc('w',TINT,'Window tint',s)],
    ['Lights: '+LGTN[m.l],cyc('l',LGTN,'Headlights',s)],['Back',()=>{MH='';go('mods')},'wide']]]},
  mods_d:()=>{const m=cm(),s='mods_d';return[MH||'Paint and designs',[
    ['Paint: '+PAINTN[m.p],cyc('p',PAINTN,'Paint',s)],['Design: '+STRP[m.st],cyc('st',STRP,'Design',s)],
    ['Design colour: '+LIVN[m.sc],cyc('sc',LIVN,'Design colour',s)],['Back',()=>{MH='';go('mods')},'wide']]]},
  mods_n:()=>{const m=cm(),s='mods_n';return[MH||'Neon underglow',[
    ['Neon: '+NEONN[m.nc],cyc('nc',NEONN,'Neon colour',s)],['Style: '+NSTY[m.ns],cyc('ns',NSTY,'Neon style',s)],
    ['Back',()=>{MH='';go('mods')},'wide']]]},
  mp:['Multiplayer',[['Play with friends',()=>go('mpf')],['Play with AI bots',()=>go('bots')],['Back',()=>go('main')]]],
  mpf:['Play with friends (room code)',[['Host a game',()=>go('mph')],['Join a game',()=>mpJoin()],['Customize',()=>go('mpo')],['Back',()=>go('mp')]]],
  bots:()=>{const T=f=>()=>{f();saveBO();render('bots')},oo=v=>v?'On':'Off',ids=Object.keys(TRACKS);return['Race against AI bots',[
    ['Start race',()=>launch(()=>startMode('bots')),'wide'],
    ['Track: '+TRACKS[BO.track].n,T(()=>{BO.track=ids[(ids.indexOf(BO.track)+1)%ids.length]})],
    ['Bots: '+BO.n,T(()=>{BO.n=BO.n%5+1})],['Level: '+DIFF[BO.diff].n,T(()=>{BO.diff=(BO.diff+1)%4})],
    ['Laps: '+BO.laps,T(()=>{BO.laps=LAPN[(LAPN.indexOf(BO.laps)+1)%LAPN.length]})],
    ['Catch-up: '+oo(BO.rb),T(()=>{BO.rb=BO.rb?0:1})],['Bot NOS: '+oo(BO.nos),T(()=>{BO.nos=BO.nos?0:1})],
    ['Collisions: '+oo(BO.col),T(()=>{BO.col=BO.col?0:1})],['Boost pads: '+oo(BO.pads),T(()=>{BO.pads=BO.pads?0:1})],
    ['Bot chat: '+oo(BO.chat),T(()=>{BO.chat=BO.chat?0:1})],['Back',()=>go('mp'),'wide']]]},
  mpo:()=>{const T=f=>()=>{f();saveMPO();render('mpo')},oo=v=>v?'On':'Off';return['Room rules (host decides; your Settings accel + top speed apply to all)',[
    ['Name: '+(MPO.name||'Auto'),()=>{const v=prompt('Your name (max 10 letters)',MPO.name);if(v!==null){MPO.name=v.trim().slice(0,10);saveMPO();render('mpo')}}],
    ['Colour: '+(MPO.color<0?'Auto':MPCOL[MPO.color][0]),T(()=>{MPO.color=(MPO.color+2)%(MPCOL.length+1)-1})],
    ['Minimap: '+MAPN[MPO.map],T(()=>{MPO.map=(MPO.map+1)%MAPN.length})],
    ['Name tags: '+oo(MPO.tags),T(()=>{MPO.tags=MPO.tags?0:1})],
    ['Laps: '+MPO.laps,T(()=>{MPO.laps=LAPN[(LAPN.indexOf(MPO.laps)+1)%LAPN.length]})],
    ['Collisions: '+oo(MPO.coll),T(()=>{MPO.coll=MPO.coll?0:1})],
    ['NOS: '+oo(MPO.nos),T(()=>{MPO.nos=MPO.nos?0:1})],
    ['Equal cars: '+oo(MPO.eq),T(()=>{MPO.eq=MPO.eq?0:1})],
    ['Top speed: '+Math.round(MPO.spd*100)+'%',T(()=>{MPO.spd=SPDN[(SPDN.indexOf(MPO.spd)+1)%SPDN.length]})],
    ['Track: '+TRACKS[MPO.track].n,T(()=>{const ids=Object.keys(TRACKS);MPO.track=ids[(ids.indexOf(MPO.track)+1)%ids.length]})],
    ['Boost pads: '+oo(MPO.pads),T(()=>{MPO.pads=MPO.pads?0:1})],['Chat: '+oo(MPO.chat),T(()=>{MPO.chat=MPO.chat?0:1})],
    ['Reset',T(()=>{Object.assign(MPO,MPDEF)})],
    ['Back',()=>go('mpf'),'wide']]]},
  mph:['Room size (max players)',[['2 Players',()=>mpHost(2)],['3 Players',()=>mpHost(3)],['4 Players',()=>mpHost(4)],['Back',()=>go('mpf')]]],
  ...Object.fromEntries(['free','tt','dc'].map(kd=>['trk_'+kd,()=>[({free:'Choose a track',tt:'Time trial: ghost + sector splits + live time difference',dc:'Drift challenge: 90 seconds, biggest drift score wins'})[kd],Object.keys(TRACKS).map(id=>[TRACKS[id].n+(kd==='dc'?(S.bdc[id]?'  \u2022 '+S.bdc[id]:''):(S.bl[id]?'  \u2022 '+fmt(S.bl[id]):'')),()=>launch(()=>startMode(kd,id))]).concat([['Back',()=>go(kd==='free'?'free':'single'),'wide']])]])),
  levels:()=>['Levels: '+PR.u+'/'+NLV+' unlocked',Array.from({length:NLV},(_,i)=>i+1).map(i=>i<=PR.u?['Level '+i+(PR.b[i]?' \u2713':''),()=>launch(()=>start('level',i))]:['\ud83d\udd12 '+i,()=>mpMsg('Complete Level '+(i-1)+' first')]).concat([['Back',()=>go('single'),'wide']])]
};
let busy=0;
function render(name){
  const [sub,items]=typeof SCREENS[name]==='function'?SCREENS[name]():SCREENS[name],b=$('btns'),sb=$('sub');
  sb.textContent=sub;sb.className='in';b.innerHTML='';b.className='buttons in'+(name==='levels'||name==='mpo'||name==='single'||name==='bots'||name.startsWith('trk_')||name.startsWith('mods')||name==='sel'||name.startsWith('b_')?' grid':'');
  items.forEach(i=>b.append(btn(i[0],i[1],i[2])));
  const g=name==='garage'||name.startsWith('mods')||name==='sel'||name.startsWith('b_');$('menu').classList.toggle('gar',g);$('gstats').style.display=g?'block':'none';if(g)gstats();gvSet(g);
  setTimeout(()=>{sb.className='';b.classList.remove('in')},300);
}
function go(name){ // slide out, then slide the next page in
  if(busy)return;busy=1;$('btns').classList.add('out');$('sub').classList.add('out');
  setTimeout(()=>{render(name);busy=0},180);
}
function launch(fn){ // fade the menu away, then start the game
  if(busy)return;busy=1;$('menu').classList.add('fade');
  setTimeout(()=>{fn();$('menu').classList.remove('fade');busy=0},260);
}
BRANDS.forEach(b=>SCREENS['b_'+b]=()=>[b+' \u2013 pick a car',CARS.map((c,i)=>[(i===GAR.car?'\u2713 ':'')+c.n,()=>{GAR.car=i;saveG();render('b_'+b)}]).filter((_,i)=>CARS[i].b===b).concat([['Back',()=>go('sel'),'wide']])]);
render('main');layout();

/*ACCOUNT-START*/
/* ================= ACCOUNT SYSTEM + CLOUD SAVE (Firebase Realtime Database) =================
   cloud layout:  accounts/<user>/salt            -> random salt, can only be created once
                  accounts/<user>/vault/<key>     -> {ts, d:{...saved game data}}
   <key> = SHA-256(salt + password). Only someone who knows the password can find (read / write) the vault. */
(function(){
  const box=document.createElement('div');box.id='auth';$('stage').append(box);
  const okName=u=>/^[a-z0-9_]{3,12}$/.test(u);
  const tmo=(p,ms)=>Promise.race([p,new Promise((_,j)=>setTimeout(()=>j(new Error('timeout')),ms))]);
  // pure-JS SHA-256: gives the same result in every browser / context (no crypto.subtle needed)
  function sha256(str){
    const ascii=unescape(encodeURIComponent(str)),rr=(v,a)=>(v>>>a)|(v<<(32-a)),mp=Math.pow,mw=mp(2,32),words=[],bl=ascii.length*8;
    const hash=[],k=[],comp={};let pc=0,i,j,res='',s2=ascii+'\x80';
    for(let c=2;pc<64;c++)if(!comp[c]){for(i=0;i<313;i+=c)comp[i]=c;hash[pc]=(mp(c,.5)*mw)|0;k[pc++]=(mp(c,1/3)*mw)|0}
    while(s2.length%64-56)s2+='\x00';
    for(i=0;i<s2.length;i++){j=s2.charCodeAt(i);words[i>>2]|=j<<((3-i)%4)*8}
    words[words.length]=(bl/mw)|0;words[words.length]=bl;
    let H=hash.slice(0,8);
    for(j=0;j<words.length;){
      const w=words.slice(j,j+=16),old=H;H=H.slice(0,8);
      for(i=0;i<64;i++){
        const w15=w[i-15],w2=w[i-2],a=H[0],e=H[4];
        const t1=H[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&H[5])^(~e&H[6]))+k[i]+(w[i]=(i<16)?w[i]:(w[i-16]+(rr(w15,7)^rr(w15,18)^(w15>>>3))+w[i-7]+(rr(w2,17)^rr(w2,19)^(w2>>>10)))|0);
        const t2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&H[1])^(a&H[2])^(H[1]&H[2]));
        H=[(t1+t2)|0].concat(H);H[4]=(H[4]+t1)|0}
      for(i=0;i<8;i++)H[i]=(H[i]+old[i])|0}
    for(i=0;i<8;i++)for(j=3;j+1;j--){const b=(H[i]>>(j*8))&255;res+=(b<16?'0':'')+b.toString(16)}
    return res}
  // what is saved to the account: settings + button layout + best laps, garage (selected car + all mods), level progress, multiplayer prefs, bot prefs
  const KEYS=['gocars_v1','gocars_garage2','gocars_prog','gocars_mp','gocars_bots'];
  const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}return null};
  const salt=()=>Array.from({length:16},()=>Math.floor(Math.random()*36).toString(36)).join('');
  const keyOf=(s,p)=>sha256('gocars1:'+s+':'+p);
  const vref=(db,u,key)=>db.ref('accounts/'+u+'/vault/'+key);
  const off=db=>{if(MPK)return;db._t=setTimeout(()=>{if(!MPK)try{db.goOffline()}catch(e){}},1500)}; // never cut a live multiplayer room
  const errTxt=e=>/PERMISSION/i.test(e&&(e.code||e.message))?'Server refused the request (Firebase rules must allow \"accounts\")':e&&e.message==='nofb'?'Firebase failed to load - check your internet':'Internet / server problem, please try again';
  let cred=null,pushT=0,retryT=0,pushing=0,dirty=0;
  const localDoc=()=>{const d={};KEYS.forEach(k=>{const v=ls(k);if(v!==null)d[k]=v});return d};
  const wipeLocal=()=>{KEYS.forEach(k=>ls(k,null));try{Object.keys(localStorage).filter(k=>k.indexOf('gocars_ghost')===0).forEach(k=>localStorage.removeItem(k))}catch(e){}};
  async function flush(){ // upload the current local game data
    clearTimeout(pushT);if(!cred||!dirty||pushing)return;
    pushing=1;dirty=0;let ok=false,db=null;
    try{db=fbDb(0);if(!db)throw new Error('nofb');
      await tmo(vref(db,cred.u,cred.key).set({ts:+ls('gocars_ts')||Date.now(),d:localDoc()}),10000);ok=true;ACC.st='saved'}
    catch(e){dirty=1;ACC.st='offline'}
    pushing=0;if(db)off(db);
    if(dirty){clearTimeout(retryT);retryT=setTimeout(()=>{if(dirty)flush()},ok?300:15000)}}
  ACC.push=()=>{if(!cred||!ACC.ready)return;ls('gocars_ts',String(Date.now()));ls('gocars_owner',cred.u);dirty=1;clearTimeout(pushT);pushT=setTimeout(flush,1200)};
  addEventListener('visibilitychange',()=>{if(document.hidden)flush()});addEventListener('pagehide',()=>{flush()});
  async function pull(u,key,ms){const db=fbDb(0);if(!db)throw new Error('nofb');try{return (await tmo(vref(db,u,key).once('value'),ms||10000)).val()}finally{off(db)}}
  // account data vs data on this device: the newer one wins; data of another player on this device never leaks into this account
  function decide(u,doc){
    const owner=ls('gocars_owner'),lts=+ls('gocars_ts')||0,has=!!(doc&&doc.d&&Object.keys(doc.d).length);
    if(has){
      if(owner!==u||(doc.ts||0)>lts){wipeLocal();KEYS.forEach(k=>{if(typeof doc.d[k]==='string')ls(k,doc.d[k])});ls('gocars_owner',u);ls('gocars_ts',String(doc.ts||0));return 'reload'}
      return lts>(doc.ts||0)?'push':'ok'}
    if(owner&&owner!==u){wipeLocal();ls('gocars_owner',u);ls('gocars_ts','0');return 'reload'}
    return 'push'}
  function enter(u){ACC.user=u;box.style.display='none';$('menu').style.display='flex';if(!MPO.name){MPO.name=u.slice(0,10);saveMPO()}render('main')}
  async function finish(u,key,doc){
    const r=decide(u,doc);cred={u,key};ls('gocars_user',u);ls('gocars_key',key);
    if(r==='reload'){location.reload();return} // game restarts with this account's data
    ACC.ready=true;if(r==='push')ACC.push();enter(u)}
  async function signUp(u,p){
    const db=fbDb(0);if(!db)throw new Error('nofb');
    try{const s=salt(),r=await tmo(db.ref('accounts/'+u+'/salt').transaction(v=>v===null?s:undefined),10000);
      if(!r.committed)throw new Error('taken');
      const key=keyOf(s,p);await tmo(vref(db,u,key).set({ts:0}),10000);return key}finally{off(db)}}
  async function logIn(u,p){
    const db=fbDb(0);if(!db)throw new Error('nofb');
    try{const s=(await tmo(db.ref('accounts/'+u+'/salt').once('value'),10000)).val();if(!s)throw new Error('none');
      const key=keyOf(s,p),v=await tmo(vref(db,u,key).once('value'),10000);if(!v.exists())throw new Error('wrong');
      return{key,doc:v.val()}}finally{off(db)}}
  function show(view,note){
    box.innerHTML='';box.style.display='flex';$('menu').style.display='none';if(typeof gvSet==='function')gvSet(0);
    const card=mk('div','acard'),msgE=mk('div','amsg',note||'');
    if(view==='loading'){card.append(mk('div','atitle','Account'),mk('div','asub','Loading your saved data...'))}
    else if(view==='home'){
      card.append(mk('div','atitle','Account'),mk('div','asub','Log in or create a new account'),btn('Login',()=>show('login'),'pri'),btn('Sign up',()=>show('signup')),msgE)}
    else{
      const su=view==='signup',un=document.createElement('input'),pw=document.createElement('input'),pw2=document.createElement('input');
      un.placeholder='Username';un.maxLength=12;un.autocapitalize='none';un.autocomplete='off';
      pw.placeholder='Password';pw.type='password';pw.maxLength=40;
      pw2.placeholder='Confirm password';pw2.type='password';pw2.maxLength=40;
      let busyF=0;
      const go_=async()=>{
        if(busyF)return;const u=un.value.trim().toLowerCase(),p=pw.value;
        if(!okName(u))return msgE.textContent='Username: 3-12 characters, only a-z, 0-9 and _';
        if(p.length<4)return msgE.textContent='Password must be at least 4 characters';
        if(su&&p!==pw2.value)return msgE.textContent='Passwords do not match';
        busyF=1;msgE.textContent='Please wait...';
        try{if(su)await finish(u,await signUp(u,p),{ts:0});else{const r=await logIn(u,p);await finish(u,r.key,r.doc)}}
        catch(e){busyF=0;msgE.textContent=e.message==='taken'?'This username is already taken':e.message==='none'?'Account not found - please sign up first':e.message==='wrong'?'Wrong password':errTxt(e)}};
      card.append(mk('div','atitle',su?'Sign up':'Login'),un,pw,...(su?[pw2]:[]),msgE,btn(su?'Create account':'Login',go_,'pri'),btn('Back',()=>show('home')));
      setTimeout(()=>{try{un.focus()}catch(e){}},50)}
    box.append(card)}
  ACC.show=show;
  ACC.logout=async()=>{
    if(cred&&dirty){mpMsg('Saving your progress...');try{await flush()}catch(e){}}
    clearTimeout(pushT);clearTimeout(retryT);ls('gocars_user',null);ls('gocars_key',null);cred=null;ACC.user=null;ACC.ready=false;dirty=0;show('home')};
  async function auto(u,key){ // already logged in on this device: sync with the account, then open the menu
    show('loading');let doc;
    try{doc=await pull(u,key,6000)}catch(e){cred={u,key};ACC.ready=true;ACC.st='offline';enter(u);return} // no internet: play offline, saves upload later
    if(doc===null||doc===undefined){ls('gocars_user',null);ls('gocars_key',null);show('home','Please log in again');return}
    await finish(u,key,doc)}
  const su0=ls('gocars_user'),sk0=ls('gocars_key');
  if(su0&&sk0&&okName(su0))auto(su0,sk0);else{if(su0)ls('gocars_user',null);show('home')}
})();
/*ACCOUNT-END*/
