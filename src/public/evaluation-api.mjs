/* API pública de avaliação — composição explícita de dados, PRISMA, ZÊNITE e SINAPSE. */
import {ATRIBUTOS} from "../data/players.mjs";
import {TIMES_DEF} from "../data/teams.mjs";
import {PAIS_JOGADOR,PAIS_TREINADOR} from "../data/countries.mjs";
import {avaliarJogador,aplicarAvaliacaoContextual,ovrUnificado,nmOVR,
  CFG_PADRAO as CFG_OVR} from "../domain/evaluation/player-evaluation.mjs";
import {distribuirRoles} from "../domain/evaluation/role-distribution.mjs";
import {STYLE_TRAITS,styleId} from "../domain/evaluation/style-identity.mjs";
import {NM_DEF,NM_COR,STYLE_CONTRA,STYLE_KEYS,PLAYSTYLE_IDS,NM_AXES,styleScoreTable,
  CFG_PADRAO as CFG_ESTILO} from "../domain/evaluation/style-score.mjs";
import {ROLE_PERFIL,ROLE_CONTRA,IGL_ROLE_AFIN,ROLE_RULES,roleAfinidade,afinidades,
  CFG_PADRAO as CFG_AFINIDADE} from "../domain/evaluation/role-affinity.mjs";
import {CFG_PADRAO as CFG_CLASSIFICACAO} from "../domain/evaluation/role-classification.mjs";
import {rolePairReality} from "../domain/evaluation/role-pair-reality.mjs";
import {roleStyleReality} from "../domain/evaluation/role-style-reality.mjs";
import {secondaryScore} from "../domain/evaluation/secondary-score.mjs";
import {ovrTreinador,derivaCaracteristica,forcaTime} from "../domain/chemistry/team-chemistry.mjs";

const CARAC_SLUG={Gestor:"gestor",Estrategista:"estrategista",Desenvolvedor:"desenvolvedor",Motivador:"motivador"};
const CARAC_COR={Gestor:"var(--c-gestor)",Estrategista:"var(--c-estrategista)",Desenvolvedor:"var(--c-desenvolvedor)",Motivador:"var(--c-motivador)"};

// Compatibilidade calibrável: cada propriedade aponta para o objeto realmente
// consumido pelo módulo correspondente; atribuir aqui não cria cópia divergente.
export const CFG_AVALIACAO={};
for(const cfg of [CFG_OVR,CFG_AFINIDADE,CFG_ESTILO,CFG_CLASSIFICACAO]){
  for(const key of Object.keys(cfg))Object.defineProperty(CFG_AVALIACAO,key,{enumerable:true,
    get:()=>cfg[key],set:value=>{cfg[key]=value;}});
}

export {ATRIBUTOS,TIMES_DEF,PAIS_JOGADOR,PAIS_TREINADOR,
  avaliarJogador,aplicarAvaliacaoContextual,ovrUnificado,nmOVR,distribuirRoles,
  forcaTime,rolePairReality,roleStyleReality,roleAfinidade,afinidades,secondaryScore,styleScoreTable,
  NM_DEF,NM_COR,STYLE_CONTRA,STYLE_KEYS,PLAYSTYLE_IDS,NM_AXES,
  ROLE_PERFIL,ROLE_CONTRA,IGL_ROLE_AFIN,ROLE_RULES};

export const PLAYSTYLES=Object.fromEntries(PLAYSTYLE_IDS.map(id=>
  [id,{label:STYLE_KEYS[id],traits:STYLE_TRAITS[id]}]));
export {styleId};
export const STYLE_ID=styleId;
export const STYLE_RECIPE=id=>NM_DEF[STYLE_KEYS[id]];

export function styleLabel(value){const id=styleId(value);return id==="joker"?"Coringa":(STYLE_KEYS[id]||id);}
// Alias temporário para o contrato do sandbox durante a migração da Fase 5.
export const STYLE_LABEL=styleLabel;

export function buildEvaluationState({atributos=ATRIBUTOS,timesDef=TIMES_DEF,
  paisJogador=PAIS_JOGADOR,paisTreinador=PAIS_TREINADOR}={}){
  const pool={};
  atributos.forEach(p=>{const id=p.id||p.nome;
    pool[id]={...p,id,nick:p.nick||p.nome,pais:p.pais||paisJogador[id]||"—",...avaliarJogador(p)};});
  let pid=0;
  const teams=timesDef.map((t,i)=>{
    distribuirRoles(t.jogadores.map(id=>pool[id]));
    const carac=t.coach?derivaCaracteristica(t,pool):null;
    const somaOVR=t.jogadores.reduce((s,id)=>s+pool[id].ovr,0);
    return {id:`t${i}`,nome:t.nome,cor:t.cor,camp:t.camp,coloc:t.colocacao,
      // `camp` e `coloc` são projeção do elenco na carta, como `time` já era: a
      // carta precisa deles no verso e é o que distingue duas eras do mesmo nick.
      jogadores:t.jogadores.map(id=>{const j=pool[id];return {id:`p${pid++}`,nick:j.nick,pais:j.pais,foto:j.foto||"",
        time:t.nome,camp:t.camp,coloc:t.colocacao,tipo:"player",ovr:j.ovr,prim:j.primario,sec:j.secundario,
        secForte:!!j.secForte,estrela:j.estrela,_eng:j};}),
      // `coachFoto` vive no ELENCO, não no treinador, pelo mesmo motivo que
      // `coachPais`: o mesmo nome treina eras diferentes — hally aparece na Spirit
      // de Katowice 2024 e na de Budapest 2025. Preso ao elenco, cada era declara
      // (ou não) o seu retrato, e nenhuma herda o da outra por acidente.
      treinador:t.coach?{id:`c${i}`,nick:t.coach,pais:t.coachPais||paisTreinador[t.coach]||"—",
        foto:t.coachFoto||"",
        // A era pertence ao elenco e é projetada nas duas categorias de carta.
        // Isso padroniza o rodapé sem duplicar ou transformar o dado cru `camp`.
        time:t.nome,camp:t.camp,coloc:t.colocacao,tipo:"coach",ovr:ovrTreinador(somaOVR,t.colocacao),carac,
        caracCor:CARAC_COR[carac],caracSlug:CARAC_SLUG[carac]}:null};
  });
  return {POOL:pool,TEAMS:teams};
}
const DEFAULT_STATE=buildEvaluationState();
export const POOL=DEFAULT_STATE.POOL;
export const TEAMS=DEFAULT_STATE.TEAMS;
