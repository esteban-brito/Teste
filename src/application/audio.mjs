/* Efeito de navegador isolado da aplicação: áudio sintetizado sem assets, DOM,
   estado esportivo ou acesso ao Mulberry32 do simulador. */
export function createAudio(){return {ctx:null,mudo:false,master:null,VOL:.65,
  init(){if(!this.ctx){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.VOL;this.master.connect(this.ctx["destination"]);}catch{}}
    if(this.ctx&&this.ctx.state==="suspended")this.ctx.resume();
    // iOS só libera o áudio se um som tocar DENTRO do gesto do usuário — buffer mudo de 1 amostra
    if(this.ctx&&!this._unlocked){try{const s=this.ctx.createBufferSource();s.buffer=this.ctx.createBuffer(1,1,22050);s.connect(this.master);s.start(0);}catch{}this._unlocked=true;}},
  // tom curto e brilhante (moeda/crédito)
  _blip(f,t,vol=.1,dur=.08,type="square"){const ctx=this.ctx,o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+dur+.02);},
  // sino de cassino: parciais inarmônicas com cauda longa
  _bell(t,base,vol=.12){const ctx=this.ctx;[[1,1],[2.01,.5],[2.99,.32],[4.18,.2]].forEach(([m,a])=>{
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=base*m;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol*a,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.9);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.95);});},
  // cascata de moedas caindo: pings rápidos descendentes
  _coins(t,n=10,vol=.07){for(let i=0;i<n;i++){const f=2600-i*120+(Math.random()*200-100);
    this._blip(f,t+i*.045+Math.random()*.012,vol,.06,"triangle");}},
  // ka-CHUNK mecânico: reel travando (thunk grave + estalo do mecanismo)
  _clunk(t,vol=.13){const ctx=this.ctx;
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";
    o.frequency.setValueAtTime(118,t);o.frequency.exponentialRampToValueAtTime(46,t+.10);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+.14);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.16);
    const src=ctx.createBufferSource();src.buffer=this._nz();const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=1300;
    const ng=ctx.createGain();ng.gain.setValueAtTime(vol*.85,t);ng.gain.exponentialRampToValueAtTime(.0001,t+.05);
    src.connect(lp).connect(ng).connect(this.master);src.start(t);src.stop(t+.06);},
  // clink metálico: moeda batendo na bandeja (ruído por band-pass ressonante + parcial agudo)
  _clink(t,vol=.05,pitch=1){const ctx=this.ctx;
    const src=ctx.createBufferSource();src.buffer=this._nz();const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=3100*pitch;bp.Q.value=7;
    const g=ctx.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+.05);
    src.connect(bp).connect(g).connect(this.master);src.start(t);src.stop(t+.06);
    const o=ctx.createOscillator(),og=ctx.createGain();o.type="triangle";o.frequency.value=3500*pitch;
    og.gain.setValueAtTime(vol*.6,t);og.gain.exponentialRampToValueAtTime(.0001,t+.035);
    o.connect(og).connect(this.master);o.start(t);o.stop(t+.05);},
  // bandeja de moedas: chuva metálica irregular que rareia
  _coinTray(t,n=26,vol=.05){let dt=0;for(let i=0;i<n;i++){const prog=i/n;
    this._clink(t+dt,vol*(0.55+Math.random()*0.6)*(1-prog*0.4),0.8+Math.random()*0.75);
    dt+=(.026+prog*.04)*(0.6+Math.random()*0.9);}},
  // sino metálico de slot antigo (parciais inarmônicas = clang)
  _bellMetal(t,vol=.1){const ctx=this.ctx;[[1,1],[2.76,.55],[5.4,.28],[8.9,.13]].forEach(([m,a])=>{
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.value=640*m;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol*a,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.6);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.65);});},
  // ruído curto cacheado usado pelos impactos metálicos
  _nz(){if(!this._noise){const ctx=this.ctx,len=Math.floor(ctx.sampleRate*.03);const b=ctx.createBuffer(1,len,ctx.sampleRate);const d=b.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);this._noise=b;}return this._noise;},
  tick(pitch=1){if(this.mudo||!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;
    const src=ctx.createBufferSource();src.buffer=this._nz();
    const bp=ctx.createBiquadFilter();bp.type="bandpass";bp.frequency.value=1700+1700*pitch;bp.Q.value=1.4;
    const g=ctx.createGain();g.gain.setValueAtTime(.42,t);g.gain.exponentialRampToValueAtTime(.0001,t+.022);
    src.connect(bp).connect(g).connect(this.master);src.start(t);src.stop(t+.03);
    this._blip(2400+1400*pitch,t,.05,.035,"triangle");},
  // JACKPOT de máquina antiga: reels, sino metálico e chuva de moedas
  ding(){if(this.mudo||!this.ctx)return;const t=this.ctx.currentTime;
    this._clunk(t,.09);this._clunk(t+.14,.10);this._clunk(t+.29,.16);
    this._bellMetal(t+.34,.11);
    this._coinTray(t+.46,30,.055);},
  // campeão: arpejo de sinos, cascata de moedas e sino final
  fanfare(){if(this.mudo||!this.ctx)return;const t=this.ctx.currentTime;
    [523,659,784,1047].forEach((f,i)=>this._bell(t+i*.12,f,.12));
    this._coins(t+.25,14,.07);
    this._bell(t+.62,1047,.16);this._blip(1568,t+.62,.08,.5,"triangle");},
  // eliminado: descida abafada de cassino
  derrota(){if(this.mudo||!this.ctx)return;const t=this.ctx.currentTime;
    [466,392,311,247].forEach((f,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type="triangle";o.frequency.setValueAtTime(f,t+i*.16);o.frequency.exponentialRampToValueAtTime(f*.94,t+i*.16+.3);
      g.gain.setValueAtTime(.0001,t+i*.16);g.gain.exponentialRampToValueAtTime(.09,t+i*.16+.04);g.gain.exponentialRampToValueAtTime(.0001,t+i*.16+.5);
      o.connect(g).connect(this.master);o.start(t+i*.16);o.stop(t+i*.16+.55);});},
  // ponto marcado: pip curto, claro para o usuário e surdo para o adversário
  roundWin(meu){if(this.mudo||!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;
    const f=meu?720:380;const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";
    o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.5,t+.04);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(meu?.05:.038,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.12);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.14);},
  // destaque: swell curto de triangle
  impacto(meu){if(this.mudo||!this.ctx)return;const ctx=this.ctx,t=ctx.currentTime;
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="triangle";
    o.frequency.setValueAtTime(330,t);o.frequency.exponentialRampToValueAtTime(495,t+.12);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.06,t+.05);g.gain.exponentialRampToValueAtTime(.0001,t+.28);
    o.connect(g).connect(this.master);o.start(t);o.stop(t+.3);},
  // fim de jogo: vitória = mini-jackpot; derrota = descida menor
  fimJogo(venci){if(this.mudo||!this.ctx)return;const t=this.ctx.currentTime;
    if(venci){[659,784,1047].forEach((f,i)=>this._bell(t+i*.1,f,.11));this._coins(t+.2,8,.06);}
    else [440,370,294].forEach((f,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type="triangle";o.frequency.value=f;const d=t+i*.14;g.gain.setValueAtTime(.0001,d);g.gain.exponentialRampToValueAtTime(.1,d+.03);g.gain.exponentialRampToValueAtTime(.0001,d+.5);
      o.connect(g).connect(this.master);o.start(d);o.stop(d+.55);});}};}

export const Audio=createAudio();
