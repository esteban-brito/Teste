/* COFRE — decisão e aplicação da compra por jogador.
   ==================================================

   Cópia de migração de game.js enquanto ele for a fonte executável; a paridade
   é provada por tools/check-economy-parity.js.

   A decisão é coletiva no nível (eco, force ou full) e individual no loadout:
   cada carteira considera a arma carregada, o AWPer tenta comprar AWP e quem
   tem sobra pode pagar um rifle para o companheiro. A leitura do adversário
   usa somente a compra e o resultado do round anterior.

   O gerador, a configuração e as tabelas entram por parâmetro. Além de manter
   o calibrador capaz de injetar valores, isso permite provar que a regra
   consome exatamente a mesma quantidade de RNG que o motor legado. */

/** Poder relativo por classe de compra, consumido futuramente por simularMapa. */
export const BUY={pistol:.5,eco:.12,force:.62,full:1.0,awp:1.06};

/** Custo de um loadout novo por jogador. */
export const CUSTO={pistol:0,eco:200,force:2500,full:4300,awp:6050};

/** Custo de reposição quando o jogador carrega a arma do round anterior. */
export const CUSTO_REPOR={pistol:0,eco:0,force:1000,full:1800,awp:1800};

/** Recompensa individual por kill segundo a classe da arma. */
export const RECOMPENSA_ARMA={pistol:300,eco:300,force:600,full:300,awp:100};

export const PREMIO_VITORIA=3250;
export const PREMIO_OBJETIVO=3500;
export const LOSS_BONUS=[1400,1900,2400,2900,3400];
export const TETO_GRANA=16000;
export const PRECO_RIFLE=2700;

/** Campo de CFG_SIM consumido pela leitura de compra. */
export const CFG_PADRAO={BUY_LE_FULL:1};

/** Tabelas consumidas pelas funções de decisão e pagamento. */
export const TABELAS_PADRAO={CUSTO,CUSTO_REPOR,PRECO_RIFLE};

export function leituraDoInimigo(leitura){
  if(!leitura||!leitura.compra)return {armado:false,quebrado:false};
  const c=leitura.compra;
  return {armado:(c==="full"||c==="awp")&&leitura.venceu};
}

/** Decide as cinco compras. `random` só é consumido no force ocasional. */
export function decidirCompra(
  dinheiro,
  armado,
  pistol,
  lossStreak,
  ehAwper,
  leitura,
  random,
  cfg=CFG_PADRAO,
  tabelas=TABELAS_PADRAO
){
  const {CUSTO:preco,CUSTO_REPOR:reposicao,PRECO_RIFLE:precoRifle}=tabelas;
  if(pistol)return {compras:dinheiro.map(()=>"pistol"),extra:[0,0,0,0,0]};
  const custoDe=(classe,i)=>armado[i]?reposicao[classe]:preco[classe];
  const quantosPodem=classe=>dinheiro.reduce((n,m,i)=>n+(m>=custoDe(classe,i)?1:0),0);
  const caixa=dinheiro.reduce((soma,m)=>soma+m,0);

  let nivel="eco";
  if(quantosPodem("full")>=4)nivel="full";
  else if(quantosPodem("full")>=2&&caixa>=5*preco.full*.85)nivel="full";
  else if((lossStreak||0)>=3&&quantosPodem("force")>=4)nivel="force";
  else if((lossStreak||0)<=1&&quantosPodem("force")>=4&&random()<.30)nivel="force";

  const inim=leituraDoInimigo(leitura);
  if(cfg.BUY_LE_FULL&&nivel==="force"&&inim.armado)nivel="eco";

  const compras=dinheiro.map((m,i)=>{
    if(nivel==="eco")return m>=custoDe("eco",i)?"eco":"pistol";
    if(nivel==="force")return m>=custoDe("force",i)?"force":"eco";
    if(ehAwper[i]&&m>=custoDe("awp",i))return "awp";
    if(m>=custoDe("full",i))return "full";
    return null;
  });

  const extra=[0,0,0,0,0];
  if(nivel==="full"){
    const sobra=i=>compras[i]?dinheiro[i]-custoDe(compras[i],i)-extra[i]:0;
    for(let i=0;i<5;i++){
      if(compras[i])continue;
      let pagador=-1,melhor=precoRifle;
      for(let k=0;k<5;k++){
        if(k!==i&&compras[k]&&sobra(k)>=melhor){melhor=sobra(k);pagador=k;}
      }
      if(pagador>=0){extra[pagador]+=precoRifle;compras[i]="full";}
      else{
        const m=dinheiro[i];
        compras[i]=m>=custoDe("force",i)?"force":m>=custoDe("eco",i)?"eco":"pistol";
      }
    }
  }
  return {compras,extra};
}

/** Desconta as compras nas carteiras recebidas e preserva a identidade do array. */
export function pagarCompra(dinheiro,armado,compras,extra,tabelas=TABELAS_PADRAO){
  const {CUSTO:preco,CUSTO_REPOR:reposicao}=tabelas;
  compras.forEach((classe,i)=>{
    const custo=(armado[i]?reposicao[classe]:preco[classe])+((extra&&extra[i])||0);
    dinheiro[i]=Math.max(0,dinheiro[i]-custo);
  });
}

/** Classe representativa do time: moda, com desempate pela compra mais cara. */
export function compraDoTime(compras,tabelas=TABELAS_PADRAO){
  const contagem={};
  compras.forEach(c=>contagem[c]=(contagem[c]||0)+1);
  return Object.entries(contagem)
    .sort((x,y)=>y[1]-x[1]||tabelas.CUSTO[y[0]]-tabelas.CUSTO[x[0]])[0][0];
}
