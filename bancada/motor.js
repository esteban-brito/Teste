/* bancada/motor.js — carrega os MOTORES do game.js num sandbox Node (sem DOM).
   Fatia o arquivo até a primeira referência a DOM e expõe os símbolos dos motores.
   Uso: const {X,T}=require("./motor"); // X = motores · T = times prontos p/ simular */
const fs=require("fs"),vm=require("vm"),path=require("path");
const js=fs.readFileSync(path.join(__dirname,"..","game.js"),"utf8").split("\n");
const cut=js.findIndex(l=>l.includes("document.getElementById"));
const sb={Math,Object,Array,JSON,console};vm.createContext(sb);
vm.runInContext(js.slice(0,cut).join("\n")+
  ";globalThis.X={TEAMS,POOL,ATRIBUTOS,TIMES_DEF,forcaTime,simularMapa,simularSerie,forcaDoDia,sortearFormaCampanha,avaliarJogador,distribuirRoles,quimicaComposicao,fallenAngels,srand:typeof srand!=='undefined'?srand:null};",sb);
const X=sb.X;
// times prontos pro combate (mesma preparação da UI)
const T=X.TEAMS.map(t=>{const r=X.forcaTime(t.jogadores.map(j=>j._eng),t.treinador&&t.treinador.carac,t.treinador&&t.treinador.ovr);
  return {nome:t.nome,jogadores:t.jogadores,ef:r.efetiva,quim:r.quimica};});
module.exports={X,T};
