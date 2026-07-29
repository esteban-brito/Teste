/* Persistência do histórico do jogo no navegador. Falhas de storage são
   deliberadamente não fatais: a campanha continua, apenas sem memória local. */
export function createProgressStore(){return {
  KEY:"draft90.progresso.v1",
  dados:null,
  vazio(){return {versao:1,titulos:[],recordes:{},contadores:{campanhas:0,titulos:0,invictos:0}};},
  valido(d){return d&&d.versao===1&&Array.isArray(d.titulos)&&d.recordes&&d.contadores;},
  carregar(){let d;try{d=JSON.parse(globalThis.localStorage.getItem(this.KEY));}catch{d=null;}
    this.dados=this.valido(d)?d:this.vazio();},
  salvar(){try{globalThis.localStorage.setItem(this.KEY,JSON.stringify(this.dados));}catch{/* segue sem memória */}},
  exportar(){const blob=new globalThis.window.Blob([JSON.stringify(this.dados,null,1)],{type:"application/json"});
    const a=globalThis.document.createElement("a");a.href=globalThis.window.URL.createObjectURL(blob);a.download="draft9-0-progresso.json";
    globalThis.document.body.appendChild(a);a.click();globalThis.window.URL.revokeObjectURL(a.href);a.remove();},
  importar(texto){let d;try{d=JSON.parse(texto);}catch{return false;}
    if(!this.valido(d))return false;this.dados=d;this.salvar();return true;}
};}

export const PROGRESSO=createProgressStore();
