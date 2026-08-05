/* Preparação de um time para o mapa. Esta fronteira monta somente o estado de
   entrada do combate; as regras esportivas permanecem nas dependências recebidas. */
import {styleTraits} from "../evaluation/style-identity.mjs";

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const dot=(weights,player)=>{let sum=0;for(const key in weights)sum+=weights[key]*(player[key]||0);return sum;};

export const CFG_PADRAO={MAPA_SCALE:380,MAPA_CAP:.06,STYLE_LADO:{ct:5.9,t:5.2}};

/* Caráter de cada mapa em atributos: que jogador rende ali. Os pesos somam 1,00
   e são JULGAMENTO declarado, não medição — é a mesma natureza do resto desta
   tabela desde que ela nasceu.

   `Cache` entrou em 04/08/2026 com o pool: AWP de meio decide, duelo de abertura
   pesa e o resto é fogo. `Train` e `Overpass` saíram do pool ativo do CS real e
   por isso saíram daqui; as receitas ficam registradas no histórico do Git. */
export const MAP_PROFILES={
  Mirage:{fp:.34,op:.30,tr:.18,ut:.18},Inferno:{ut:.34,tr:.28,en:.20,cl:.18},
  Nuke:{sn:.30,cl:.26,ut:.24,tr:.20},Ancient:{cl:.30,op:.26,ut:.24,tr:.20},
  Anubis:{fp:.30,cl:.26,op:.26,ut:.18},Dust2:{fp:.34,sn:.30,op:.26,en:.10},
  Cache:{sn:.30,op:.28,fp:.24,ut:.18}
};

export const SIDE_ROLE_BONUS={
  Lurker:[5,1],Support:[4,0],AWPer:[2,2],IGL:[1,1],Rifler:[-1,3],Entry:[-4,5]
};

/** Multiplicador autocentrado do perfil individual no mapa. Muta `_mapBase`
    exatamente uma vez e preserva o cache usado durante todo o mapa. */
export function mapMultiplier(player,map,cfg=CFG_PADRAO,mapProfiles=MAP_PROFILES){
  const source=player._eng||player,profile=mapProfiles[map];
  if(!profile)return 1;
  if(source._mapBase===undefined){
    let sum=0,count=0;
    for(const mapName in mapProfiles){sum+=dot(mapProfiles[mapName],source);count++;}
    source._mapBase=sum/count;
  }
  const fit=dot(profile,source)-source._mapBase;
  return clamp(1+fit/cfg.MAPA_SCALE,1-cfg.MAPA_CAP,1+cfg.MAPA_CAP);
}

/** Afinidade absoluta de lado antes de subtrair a média da liga. */
export function sideAffinityRaw(player,cfg=CFG_PADRAO,roleBonus=SIDE_ROLE_BONUS){
  const source=player._eng||player,role=roleBonus[source.primario]||[0,0];
  const traits=styleTraits(source.playstyle),scale=cfg.STYLE_LADO;
  return [
    .08*((source.cl||45)-50)+.06*((source.ut||50)-50)+.05*((source.sn||0)-35)+role[0]+traits.ct*scale.ct,
    .08*((source.en||45)-50)+.07*((source.op||50)-50)+.05*((source.fp||60)-55)+role[1]+traits.t*scale.t
  ];
}

/** Média calculada na ordem recebida; a ordem dos 85 jogadores é contrato. */
export function computeSideMean(players,cfg=CFG_PADRAO,roleBonus=SIDE_ROLE_BONUS){
  let ct=0,t=0;
  players.forEach(player=>{const fit=sideAffinityRaw(player,cfg,roleBonus);ct+=fit[0];t+=fit[1];});
  return [ct/players.length,t/players.length];
}

/** Afinidade zero-centrada. Muta `_lado` para preservar a identidade do cache legado. */
export function sideAffinity(player,mean,cfg=CFG_PADRAO,roleBonus=SIDE_ROLE_BONUS){
  const source=player._eng||player;
  if(source._lado)return source._lado;
  const fit=sideAffinityRaw(source,cfg,roleBonus);
  return source._lado=[fit[0]-mean[0],fit[1]-mean[1]];
}

/** Monta os vetores consumidos pelo combate. `gaussian` entra explicitamente
    porque cada jogador deve consumir uma, e somente uma, amostra normal. */
export function prepareTeam(team,map,deps){
  const {gaussian,playerForm,duelSkill,fragWeight,mapMultiplier:mapMultiplierFor,
    sideAffinity:sideAffinityFor,styleAggression,exposureProfile,preservationValue,
    tradeContextProfile,assistContextProfile,combatProfile}=deps;
  let list=team.jogadores||(team.time&&team.time.jogadores)||[];
  let players=list.filter(Boolean).map(player=>player._eng||player);
  if(players.length<5){
    const base=players[0]||{fp:50,tr:50,en:50,op:50,cl:50,sn:0,ut:50,nick:team.nome||"—"};
    while(players.length<5)players.push(base);
  }
  players=players.slice(0,5);
  const forms=players.map(player=>playerForm(player,gaussian));
  return {nome:team.nome,meu:!!team.meu,js:players,
    skills:players.map((player,index)=>duelSkill(player)*Math.pow(forms[index],1.0)*mapMultiplierFor(player,map)),
    frags:players.map((player,index)=>fragWeight(player)*Math.pow(forms[index],1.0)*mapMultiplierFor(player,map)),
    ctEdge:players.reduce((sum,player)=>sum+sideAffinityFor(player)[0],0)/players.length,
    tEdge:players.reduce((sum,player)=>sum+sideAffinityFor(player)[1],0)/players.length,
    cls:players.map(player=>player.cl||40),agr:players.map(player=>styleAggression(player)),
    exposure:players.map(player=>exposureProfile(player)),
    preservation:players.map(player=>preservationValue(player)),
    tradeContext:players.map(player=>tradeContextProfile(player)),
    assistContext:players.map(player=>assistContextProfile(player)),
    ops:players.map(player=>player.op??50),trs:players.map(player=>player.tr??50),
    open:players.reduce((sum,player)=>sum+((player.op??50)*.35+(player.en??45)*.30+
      (player.sn??0)*.20+(player.ut??50)*.15),0)/players.length,
    stats:players.map(player=>{const profile=combatProfile(player);return {
      nick:player.nick||team.nome,impacto:profile.ratingImpact,prim:profile.primaryRole,
      ovr:player.ovr??16,ut:player.ut??50,k:0,d:0,a:0,dmg:0,tradeK:0,
      fa:{kills:[],mortes:[],assists:0,roundsKAST:0,multi:{},opK:0,opD:0},
      _kRound:0,_contribRound:false
    };})};
}
