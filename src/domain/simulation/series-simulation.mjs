/* PÓLVORA — série best-of sem repetição de mapas.
   O pool, o RNG e a simulação de mapa entram por parâmetro para preservar e
   provar a ordem forma A → forma B → sorteio do mapa → mapa completo. */
export function simularSerie(A,B,fdA,fdB,md,leve,deps){
  const {mapasPool,random,simularMapa}=deps;
  const need=Math.ceil(md/2);let wa=0,wb=0;const mapas=[],jogados=[];
  while(wa<need&&wb<need){
    const formaA=fdA(),formaB=fdB();
    const disponiveis=mapasPool.filter(m=>!jogados.includes(m));
    const mapa=disponiveis[Math.floor(random()*disponiveis.length)];
    jogados.push(mapa);
    const g=simularMapa(A,B,formaA,formaB,mapa,leve);
    mapas.push(g);g.vencedor===A?wa++:wb++;
  }
  return {vencedor:wa>wb?A:B,vencedorNome:wa>wb?A.nome:B.nome,placarSerie:[wa,wb],mapas};
}
