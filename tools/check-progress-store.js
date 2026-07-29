/* Contrato da persistência de progresso sem depender de um navegador real. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

function progress(overrides={}){return {
  versao:1,titulos:[],recordes:{},contadores:{campanhas:0,titulos:0,invictos:0},
  ...overrides,
};}

async function main(){
  const moduleUrl=pathToFileURL(path.join(__dirname,"..","src","infrastructure","persistence","progress-store.mjs")).href;
  const previous={
    localStorage:Object.getOwnPropertyDescriptor(globalThis,"localStorage"),
    window:Object.getOwnPropertyDescriptor(globalThis,"window"),
    document:Object.getOwnPropertyDescriptor(globalThis,"document"),
  };
  try{
    delete globalThis.localStorage;delete globalThis.window;delete globalThis.document;
    const {PROGRESSO,createProgressStore}=await import(moduleUrl);
    assert.equal(PROGRESSO.dados,null,"importar o módulo carregou o storage antecipadamente");

    const store=createProgressStore();
    store.carregar();
    assert.deepEqual(store.dados,progress(),"storage indisponível não criou progresso vazio");

    const writes=[];
    globalThis.localStorage={
      value:"{json inválido",
      getItem(key){assert.equal(key,store.KEY);return this.value;},
      setItem(key,value){writes.push([key,value]);},
    };
    store.carregar();
    assert.deepEqual(store.dados,progress(),"JSON inválido não voltou ao progresso vazio");

    const saved=progress({titulos:[{data:"2026-07-29"}],contadores:{campanhas:2,titulos:1,invictos:0}});
    globalThis.localStorage.value=JSON.stringify(saved);
    store.carregar();
    assert.deepEqual(store.dados,saved,"progresso válido não foi carregado");
    store.salvar();
    assert.deepEqual(writes.at(-1),[store.KEY,JSON.stringify(saved)],"save mudou chave ou serialização");

    const beforeInvalid=store.dados;
    assert.equal(store.importar("{"),false,"importação aceitou JSON inválido");
    assert.equal(store.importar(JSON.stringify({...saved,versao:2})),false,"importação aceitou schema incompatível");
    assert.equal(store.dados,beforeInvalid,"importação inválida alterou o estado");

    const imported=progress({recordes:{kills:{v:31}},contadores:{campanhas:3,titulos:1,invictos:1}});
    assert.equal(store.importar(JSON.stringify(imported)),true,"importação válida foi recusada");
    assert.deepEqual(store.dados,imported,"importação válida não substituiu o progresso");
    assert.deepEqual(writes.at(-1),[store.KEY,JSON.stringify(imported)],"importação válida não persistiu");

    let appended=null,clicked=false,removed=false,revoked=null,blob=null;
    class BlobFake{constructor(parts,options){this.parts=parts;this.options=options;blob=this;}}
    const anchor={href:"",download:"",click(){clicked=true;},remove(){removed=true;}};
    globalThis.window={Blob:BlobFake,URL:{
      createObjectURL(value){assert.equal(value,blob);return "blob:progresso";},
      revokeObjectURL(value){revoked=value;},
    }};
    globalThis.document={createElement(tag){assert.equal(tag,"a");return anchor;},body:{appendChild(node){appended=node;}}};
    store.exportar();
    assert.deepEqual(blob.parts,[JSON.stringify(imported,null,1)],"backup mudou conteúdo ou indentação");
    assert.deepEqual(blob.options,{type:"application/json"},"backup mudou MIME type");
    assert.equal(anchor.download,"draft9-0-progresso.json","backup mudou nome do arquivo");
    assert.equal(appended,anchor);assert.equal(clicked,true);assert.equal(revoked,"blob:progresso");assert.equal(removed,true);

    globalThis.localStorage={getItem(){throw new Error("bloqueado");},setItem(){throw new Error("quota");}};
    assert.doesNotThrow(()=>store.carregar(),"leitura bloqueada interrompeu o jogo");
    assert.doesNotThrow(()=>store.salvar(),"quota cheia interrompeu o jogo");
    assert.deepEqual(store.dados,progress(),"falha de leitura não restaurou progresso vazio");

    const independent=createProgressStore();
    assert.notEqual(independent,store,"factory reutilizou o singleton");
    assert.equal(independent.dados,null,"instâncias compartilharam dados");
  }finally{
    for(const [key,descriptor] of Object.entries(previous)){
      if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
    }
  }
  console.log("progress store: ok (schema · fallback · save · import/export · isolamento)");
}

main().catch(error=>{console.error(error);process.exitCode=1;});
