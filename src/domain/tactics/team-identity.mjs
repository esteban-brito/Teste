/* TÁTICA — identidade de um time, DERIVADA do elenco.
   ══════════════════════════════════════════════════════════════════════════════

   POR QUE ISTO EXISTE. A simulação de hoje é uma política estocástica: ninguém
   decide nada, tudo é sorteado de distribuições moduladas por estado. Para que um
   time possa ter INTENÇÃO — jogar rápido, comprometer utilitária, ler o
   adversário — alguém precisa dizer que time é esse. Este módulo é esse alguém.

   A REGRA QUE GOVERNA O ARQUIVO INTEIRO: nada aqui pode ser escrito à mão por
   time, nick ou era. Cada eixo é função pura dos atributos, funções e playstyles
   que o elenco já carrega. "Esse time é agressivo" é uma CONCLUSÃO, nunca uma
   entrada — é a mesma proibição que tirou TIER_LENDA e TIER_STAR do motor, e o
   motivo é o mesmo: curadoria disfarçada de modelo.

   ZERO-CENTRADO, como o resto do domínio. `computeIdentityMeans` tira a média da
   liga e os eixos passam a valer como DESVIO. Sem isso, "estrutura 0.62" não
   significa nada; com isso, significa "acima da liga". É a mesma disciplina de
   `computeSideMean` e `computeCombatMeans`.

   ESTADO: NENHUM CONSUMIDOR. Este módulo não é importado por lugar nenhum ainda,
   de propósito. A Fase 0 do plano constrói o cérebro inteiro e não o liga, para
   que o golden continue byte a byte idêntico enquanto o desenho é revisado. */
import {styleTraits,styleAggression} from "../evaluation/style-identity.mjs";

/** Pesos dos eixos. Vivem aqui, mutáveis, para o calibrador poder tunar depois —
    mesma razão de `CFG_SIM` existir num lugar só. */
export const CFG_PADRAO={
  RITMO_PACE:.65,RITMO_EN:.35,
  ESTRUTURA_STYLE:.70,ESTRUTURA_IGL:.30,
  LEITURA_IGL_OVR:.45,LEITURA_IGL_UT:.30,LEITURA_IGL_CL:.25,
  OVR_REF:17.5,OVR_SPAN:8
};

const media=valores=>valores.reduce((soma,v)=>soma+v,0)/Math.max(1,valores.length);
const norm=(valor,centro,escala)=>((valor??centro)-centro)/escala;

/** Desvio-padrão populacional — mede CONCENTRAÇÃO, não nível. */
function desvio(valores){
  if(valores.length<2)return 0;
  const m=media(valores);
  return Math.sqrt(media(valores.map(v=>(v-m)**2)));
}

const cru=jogador=>jogador?._eng||jogador||{};

/** O IGL do elenco, se houver. `isIGL` é intenção declarada no dado cru; a função
    classificada pelo PRISMA pode divergir dela, e aqui vale a declarada — quem
    chama o jogo é quem se diz capitão, não quem o motor achou parecido com um. */
function iglDoElenco(jogadores){
  return jogadores.map(cru).find(j=>j.isIGL||j.primario==="IGL")||null;
}

/** Os cinco eixos ABSOLUTOS de um elenco, antes de subtrair a média da liga. */
export function teamIdentityRaw(jogadores,cfg=CFG_PADRAO){
  const js=(jogadores||[]).filter(Boolean).map(cru);
  if(!js.length)return {ritmo:0,estrutura:0,utilitaria:0,leitura:0,dependencia:0};

  const traits=js.map(j=>styleTraits(j.playstyle));

  /* RITMO — com que velocidade o time quer contato. `pace` do playstyle dá a
     intenção; `en` dá a capacidade de sustentá-la. Um time que QUER correr e não
     tem entrada corre para a morte, e os dois termos juntos dizem isso. */
  const ritmo=cfg.RITMO_PACE*media(traits.map(t=>t.pace))+
    cfg.RITMO_EN*media(js.map(j=>norm(j.en,45,50)));

  /* ESTRUTURA — o quanto o time joga por sistema em vez de por talento solto.
     Sai do `structure` dos playstyles mais a simples existência de um IGL: sem
     capitão não há plano a ser executado com fidelidade. */
  const igl=iglDoElenco(js);
  const estrutura=cfg.ESTRUTURA_STYLE*media(traits.map(t=>t.structure))+
    cfg.ESTRUTURA_IGL*(igl?1:0);

  /* UTILITÁRIA — o único eixo que o motor JÁ trata como coletivo: `utilityLoad`
     alimenta UTIL_PLANT e UTIL_RETAKE. Por isso ele entra cru, sem tradução. */
  const utilitaria=media(js.map(j=>norm(j.ut,50,50)));

  /* LEITURA — com que velocidade e confiança o time se adapta ao adversário ao
     longo do mapa. É o eixo mais importante do modelo, e o mais delicado: ele
     precisa sair do IGL, senão "adaptar-se" viraria mais um bônus de time forte.
     Um elenco de cinco estrelas sem capitão não lê ninguém, e é isso que o CS
     real mostra. Sem IGL, leitura é zero — não negativa: o time não é PIOR que a
     média em ler, ele simplesmente não tem quem leia. */
  const leitura=igl
    ?cfg.LEITURA_IGL_OVR*norm(igl.ovr,cfg.OVR_REF,cfg.OVR_SPAN)+
     cfg.LEITURA_IGL_UT*norm(igl.ut,50,50)+
     cfg.LEITURA_IGL_CL*norm(igl.cl,50,50)
    :0;

  /* DEPENDÊNCIA — o quanto o time depende de um jogador só. Mede CONCENTRAÇÃO de
     poder de fogo, não nível: um time de cinco 90 e um de cinco 40 têm a mesma
     dependência, que é baixa. Alta dependência não é fraqueza — é VARIÂNCIA: o
     plano rende mais quando a estrela aparece e desaba quando ela cai cedo. */
  const dependencia=desvio(js.map(j=>j.fp??60))/50;

  return {ritmo,estrutura,utilitaria,leitura,dependencia};
}

/** Média da liga por eixo, na ORDEM RECEBIDA. A ordem dos 85 é contrato do
    projeto: mudá-la muda a média na última casa e move tudo o que depende dela. */
export function computeIdentityMeans(elencos,cfg=CFG_PADRAO){
  const perfis=(elencos||[]).map(elenco=>teamIdentityRaw(elenco,cfg));
  const eixos=["ritmo","estrutura","utilitaria","leitura","dependencia"];
  const saida={};
  for(const eixo of eixos)saida[eixo]=media(perfis.map(p=>p[eixo]));
  return saida;
}

/** Identidade zero-centrada: o que o time é EM RELAÇÃO À LIGA. É esta que a
    decisão de round deve consumir; a absoluta serve para diagnóstico. */
export function teamIdentity(jogadores,medias,cfg=CFG_PADRAO){
  const bruto=teamIdentityRaw(jogadores,cfg);
  if(!medias)return bruto;
  const saida={};
  for(const eixo in bruto)saida[eixo]=bruto[eixo]-(medias[eixo]??0);
  return saida;
}

/** Agressão do elenco pela fonte que a simulação JÁ usa, para que a camada
    tática não crie uma segunda definição de "agressivo" divergente da do motor. */
export function teamAggression(jogadores,escala){
  const js=(jogadores||[]).filter(Boolean);
  if(!js.length)return 0;
  return media(js.map(j=>styleAggression(j,escala)));
}
