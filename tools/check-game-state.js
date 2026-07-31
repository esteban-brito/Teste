/* Contrato isolado dos quatro estados mutáveis que o entrypoint coordena. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

const moduleUrl=(...parts)=>pathToFileURL(path.join(__dirname,"..",...parts)).href;

async function main(){
  const [{createDraftState,resetDraftState},{createMajorState,resetMajorState},
    {createMapPlaybackState,createMatchState,resetMatchState}]=await Promise.all([
    import(moduleUrl("src","application","draft","draft-state.mjs")),
    import(moduleUrl("src","application","major","major-state.mjs")),
    import(moduleUrl("src","application","match","match-state.mjs")),
  ]);

  const draft=createDraftState(),otherDraft=createDraftState();
  assert.deepEqual(draft,{
    jogadores:[null,null,null,null,null],treinador:null,drawn:null,taken:new Set(),
    sel:null,spinning:false,justPlaced:null,
  },"shape inicial do draft mudou");
  assert.notEqual(draft,otherDraft,"factory do draft reutilizou o objeto");
  assert.notEqual(draft.jogadores,otherDraft.jogadores,"instâncias do draft compartilharam jogadores");
  assert.notEqual(draft.taken,otherDraft.taken,"instâncias do draft compartilharam o Set");
  const draftRef=draft,takenRef=draft.taken,playersRef=draft.jogadores;
  draft.jogadores[0]={id:"player"};draft.treinador={id:"coach"};draft.drawn={id:"team"};
  draft.taken.add("player");draft.sel={origem:"pick"};draft.spinning=true;
  draft.justPlaced="4";
  assert.equal(resetDraftState(draft),draftRef,"reset do draft substituiu o objeto");
  assert.equal(draft.taken,takenRef,"reset do draft substituiu o Set");
  assert.equal(draft.taken.size,0,"reset do draft não limpou o Set");
  assert.notEqual(draft.jogadores,playersRef,"reset do draft reutilizou o array antigo");
  assert.deepEqual(draft.jogadores,[null,null,null,null,null],"reset do draft mudou os cinco slots");
  assert.equal(draft.justPlaced,"4","reset do draft passou a tocar em justPlaced");
  assert.equal(draft.treinador,null);assert.equal(draft.drawn,null);
  assert.equal(draft.sel,null);assert.equal(draft.spinning,false);

  const major=createMajorState(),otherMajor=createMajorState();
  assert.deepEqual(major,{},"Major deixou de nascer vazio");
  assert.notEqual(major,otherMajor,"factory do Major reutilizou o objeto");
  const majorRef=major;
  major.times=[{id:"team"}];major.rodada=4;major.classificados=[1];
  major.eliminados=[2];major.playoffs={};major.campanha={};
  const classificadosRef=major.classificados,eliminadosRef=major.eliminados;
  assert.equal(resetMajorState(major),majorRef,"reset do Major substituiu o objeto");
  assert.notEqual(major.classificados,classificadosRef,"reset do Major reutilizou classificados");
  assert.notEqual(major.eliminados,eliminadosRef,"reset do Major reutilizou eliminados");
  assert.deepEqual(major,{
    times:null,rodada:0,classificados:[],eliminados:[],playoffs:null,campanha:null,
  },"reset do Major mudou shape ou valores");

  const playback=createMapPlaybackState(),otherPlayback=createMapPlaybackState();
  assert.deepEqual(playback,{
    ativo:false,timer:null,onFim:null,gen:0,jogo:null,ctx:"",
  },"shape inicial da reprodução mudou");
  assert.notEqual(playback,otherPlayback,"factory da reprodução reutilizou o objeto");
  assert.equal(Object.hasOwn(playback,"sb"),false,"scoreboard deixou de ser campo dinâmico");

  const match=createMatchState(),otherMatch=createMatchState();
  assert.deepEqual(match,{
    A:null,B:null,md:1,mapaIdx:0,vA:0,vB:0,contexto:"",onSerieFim:null,
  },"shape inicial da série mudou");
  assert.equal(Object.hasOwn(match,"rodando"),false,"rodando passou a existir no estado inicial");
  assert.notEqual(match,otherMatch,"factory da série reutilizou o objeto");
  const matchRef=match;
  Object.assign(match,{A:{},B:{},md:3,mapaIdx:2,vA:2,vB:1,contexto:"final",
    onSerieFim:()=>{},rodando:true});
  assert.equal(resetMatchState(match),matchRef,"reset da série substituiu o objeto");
  assert.deepEqual(match,{
    A:null,B:null,md:1,mapaIdx:0,vA:0,vB:0,contexto:"",onSerieFim:null,rodando:false,
  },"reset da série mudou shape ou valores");

  console.log("game state: ok (shape · isolamento · identidade · quirks de reset)");
}

main().catch(error=>{console.error(error);process.exitCode=1;});
