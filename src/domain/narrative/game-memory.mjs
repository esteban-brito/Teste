/* MEMÓRIA — marcos, recordes e narrativa derivados da saída do simulador.
   Funções puras: não leem relógio/DOM, não mutam a simulação e não consomem RNG. */
function mapPerspective(game){
  const mine=game.meuA?"A":game.meuB?"B":null;
  if(!mine)return null;
  const isA=mine==="A";
  return {mine,stats:isA?game.statsA:game.statsB,opponentName:isA?game.nomeB:game.nomeA,
    myScore:game.placar[isA?0:1],opponentScore:game.placar[isA?1:0],
    myHalf:game.half1?game.half1[isA?0:1]:null,
    opponentHalf:game.half1?game.half1[isA?1:0]:null};
}

function biggestClutch(rounds,side){
  let best=0;
  (rounds||[]).forEach(round=>{
    if(!round.clutchX||!round.clutchWon)return;
    const clutchSide=round.venceA?"A":"B";
    if(clutchSide===side&&round.clutchX>best)best=round.clutchX;
  });
  return best;
}

export function coletarMarcos(game){
  const perspective=mapPerspective(game);
  if(!perspective)return null;
  const won=perspective.myScore>perspective.opponentScore;
  let topKills=null,topRating=null,topAdr=null;
  perspective.stats.forEach(stat=>{
    if(!topKills||stat.k>topKills.v)topKills={v:stat.k,nick:stat.nick};
    if(!topRating||stat.rating>topRating.v)topRating={v:stat.rating,nick:stat.nick};
    if(!topAdr||(stat.adr||0)>topAdr.v)topAdr={v:stat.adr||0,nick:stat.nick};
  });
  const clutch=biggestClutch(game.rounds,perspective.mine);
  const comeback=(won&&perspective.myHalf!=null&&perspective.opponentHalf>perspective.myHalf)?
    perspective.opponentHalf-perspective.myHalf:0;
  return {adv:perspective.opponentName,mapa:game.mapa,venceu:won,
    kills:topKills,rating:topRating,adr:topAdr,
    clutch:clutch>=2?{v:clutch}:null,
    margem:won?{v:perspective.myScore-perspective.opponentScore}:null,
    comeback:comeback?{v:comeback}:null};
}

export const RECORD_LABELS={kills:"kills num mapa",rating:"rating num mapa",adr:"ADR num mapa",
  clutch:"clutch vencido",margem:"maior margem",comeback:"maior virada"};

export function atualizarRecordes(records,milestones,context){
  if(!milestones)return [];
  const news=[];
  for(const key of Object.keys(RECORD_LABELS)){
    const candidate=milestones[key];
    if(!candidate||!(candidate.v>0))continue;
    const current=records[key];
    if(!current||candidate.v>current.v){
      records[key]={v:candidate.v,nick:candidate.nick||null,adv:milestones.adv,
        mapa:milestones.mapa,data:context&&context.data||null};
      news.push({chave:key,label:RECORD_LABELS[key],v:candidate.v,nick:candidate.nick||null});
    }
  }
  return news;
}

export function manchete(game){
  const [scoreA,scoreB]=game.placar,wonA=scoreA>scoreB;
  const winnerName=wonA?game.nomeA:game.nomeB,loserName=wonA?game.nomeB:game.nomeA;
  const winnerScore=Math.max(scoreA,scoreB),loserScore=Math.min(scoreA,scoreB);
  const margin=winnerScore-loserScore,winnerStats=wonA?game.statsA:game.statsB;
  const carry=(winnerStats||[]).reduce((best,stat)=>!best||stat.rating>best.rating?stat:best,null);
  const clutch=biggestClutch(game.rounds,wonA?"A":"B");
  const winnerHalf=game.half1?game.half1[wonA?0:1]:null;
  const loserHalf=game.half1?game.half1[wonA?1:0]:null;
  const overtime=game.totalRounds>24;
  const hash=(scoreA*31+scoreB*7+(game.totalRounds||0)+(game.mapa||"").length)>>>0;
  const pick=options=>options[hash%options.length],score=`${winnerScore}-${loserScore}`;
  if(clutch>=3)return {tipo:"clutch",texto:pick([
    `INACREDITÁVEL: um 1v${clutch} sela o ${score} do ${winnerName} na ${game.mapa}`,
    `${winnerName} vence de ${score} na ${game.mapa} com um 1v${clutch} pra história`])};
  if(overtime)return {tipo:"ot",texto:pick([
    `${winnerName} sobrevive à prorrogação e arranca o ${score} na ${game.mapa}`,
    `Na base do coração: ${winnerName} leva a ${game.mapa} por ${score} no overtime`])};
  if(winnerHalf!=null&&loserHalf-winnerHalf>=4)return {tipo:"virada",texto:pick([
    `VIRADA: ${winnerName} estava ${winnerHalf}-${loserHalf} no intervalo e fechou em ${score} na ${game.mapa}`,
    `${loserName} abriu ${loserHalf}-${winnerHalf}, mas o ${winnerName} virou pra ${score} na ${game.mapa}`])};
  if(carry&&carry.rating>=1.45)return {tipo:"carry",texto:pick([
    `${carry.nick} carrega com ${carry.rating.toFixed(2)} e o ${winnerName} leva a ${game.mapa} (${score})`,
    `Noite de gala: ${carry.nick} crava ${carry.rating.toFixed(2)} no ${score} sobre o ${loserName}`])};
  if(margin>=10)return {tipo:"atropelo",texto:pick([
    `Atropelo: ${winnerName} passa por cima do ${loserName} por ${score} na ${game.mapa}`,
    `${winnerName} não toma conhecimento e faz ${score} na ${game.mapa}`])};
  if(margin<=2)return {tipo:"equilibrio",texto:pick([
    `No detalhe: ${winnerName} escapa com o ${score} na ${game.mapa}`,
    `${score}: ${winnerName} vence o duelo mais apertado da noite na ${game.mapa}`])};
  return {tipo:"padrao",texto:pick([
    `${winnerName} controla a ${game.mapa} e fecha em ${score}`,
    `${winnerName} confirma o favoritismo: ${score} na ${game.mapa}`])};
}

export function narrativaMVP(campaign){
  const entries=Object.entries((campaign&&campaign.ratings)||{});
  if(!entries.length)return null;
  const rows=entries.map(([nick,item])=>({nick,n:item.r.length,k:item.k,d:item.d,a:item.a||0,
    media:item.r.reduce((sum,value)=>sum+value,0)/Math.max(1,item.r.length),
    pico:item.r.reduce((best,value)=>value>best?value:best,0)}));
  const mvp=rows.reduce((best,row)=>!best||row.media>best.media?row:best,null);
  const kd=mvp.d?(mvp.k/mvp.d):mvp.k;
  const undefeated=campaign.mapasD===0&&campaign.mapasV>0;
  const hash=(Math.round(mvp.media*100)+mvp.k)>>>0;
  const opening=[`${mvp.nick} foi o coração da campanha`,
    `A campanha teve um dono: ${mvp.nick}`][hash%2];
  const text=`${opening} — média ${mvp.media.toFixed(2)} em ${mvp.n} mapa${mvp.n>1?"s":""}, com pico de `+
    `${mvp.pico.toFixed(2)}, ${mvp.k} kills e K/D ${kd.toFixed(2)}.`+
    (undefeated?" E o feito máximo: nenhum mapa perdido no caminho.":"");
  return {nick:mvp.nick,media:mvp.media,texto:text};
}
