/* Contrato do efeito Web Audio sem navegador real. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

class AudioParamFake{
  constructor(){this.value=0;this.events=[];}
  setValueAtTime(...args){this.events.push(["set",...args]);}
  exponentialRampToValueAtTime(...args){this.events.push(["ramp",...args]);}
}

class AudioNodeFake{
  constructor(type,calls){
    this.type=type;this.calls=calls;this.gain=new AudioParamFake();
    this.frequency=new AudioParamFake();this.Q=new AudioParamFake();
  }
  connect(target){this.calls.push([this.type,"connect"]);return target;}
  start(...args){this.calls.push([this.type,"start",...args]);}
  stop(...args){this.calls.push([this.type,"stop",...args]);}
}

function fakeContext(){
  const calls=[];
  const context={state:"suspended",currentTime:2,sampleRate:1000,calls};
  context.destination=new AudioNodeFake("destination",calls);
  context.createGain=()=>new AudioNodeFake("gain",calls);
  context.createOscillator=()=>new AudioNodeFake("oscillator",calls);
  context.createBufferSource=()=>new AudioNodeFake("buffer-source",calls);
  context.createBiquadFilter=()=>new AudioNodeFake("filter",calls);
  context.createBuffer=(channels,length,rate)=>({channels,length,rate,
    getChannelData:()=>new Float32Array(length)});
  context.resume=()=>{calls.push(["context","resume"]);};
  return context;
}

async function main(){
  const moduleUrl=pathToFileURL(path.join(__dirname,"..","src","application","audio.mjs")).href;
  const previousWindow=globalThis.window;
  try{
    delete globalThis.window;
    const {Audio,createAudio}=await import(moduleUrl);
    assert.equal(Audio.ctx,null,"importar o módulo não deve inicializar Web Audio");

    const context=fakeContext();
    globalThis.window={AudioContext:class {constructor(){return context;}}};
    const audio=createAudio();
    audio.init();
    assert.equal(audio.ctx,context,"init não preservou o contexto criado");
    assert.equal(audio.master.gain.value,.65,"volume mestre mudou");
    assert.equal(audio._unlocked,true,"buffer mudo de desbloqueio não foi criado");
    assert.ok(context.calls.some(call=>call[0]==="context"&&call[1]==="resume"),
      "contexto suspenso não foi retomado");

    const beforeTick=context.calls.length;
    audio.tick(.5);
    assert.ok(context.calls.length>beforeTick,"tick não sintetizou áudio");
    const noise=audio._noise;
    audio.tick(.8);
    assert.equal(audio._noise,noise,"buffer de ruído deixou de ser reutilizado");

    audio.mudo=true;
    const beforeMute=context.calls.length;
    audio.fanfare();audio.derrota();audio.fimJogo(true);
    assert.equal(context.calls.length,beforeMute,"mute deixou efeitos produzirem nós de áudio");

    const independent=createAudio();
    assert.notEqual(independent,audio,"factory reutilizou o singleton");
    assert.equal(independent.ctx,null,"instâncias de áudio compartilharam contexto");
    assert.equal(independent.mudo,false,"instâncias de áudio compartilharam mute");
  }finally{
    if(previousWindow===undefined)delete globalThis.window;
    else globalThis.window=previousWindow;
  }
  console.log("audio module: ok (init · unlock · síntese · mute · isolamento)");
}

main().catch(error=>{console.error(error);process.exitCode=1;});
