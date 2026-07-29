/* Prova que o COFRE extraído reproduz decisão, mutação e CONSUMO DE AZAR
   do motor legado. O próximo rndF precisa coincidir depois dos dois caminhos,
   inclusive quando um caso não deve consumir sorteio. */
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {X}=require("../bancada/motor");
const {ROOT}=require("../bancada/common");

const SEMENTE=20260728;
const plain=value=>JSON.parse(JSON.stringify(value));

async function main(){
  const url=pathToFileURL(path.join(ROOT,"src","domain","simulation","economy.mjs")).href;
  const M=await import(url);

  ["BUY","CUSTO","CUSTO_REPOR","RECOMPENSA_ARMA","LOSS_BONUS"].forEach(nome=>{
    assert.deepEqual(plain(M[nome]),plain(X[nome]),`${nome} divergiu do motor legado`);
  });
  ["PREMIO_VITORIA","PREMIO_OBJETIVO","TETO_GRANA","PRECO_RIFLE"].forEach(nome=>{
    assert.equal(M[nome],X[nome],`${nome} divergiu do motor legado`);
  });

  const casos=[
    {rotulo:"pistol",dinheiro:[800,800,800,800,800],armado:[false,false,false,false,false],pistol:true,loss:0,awp:[false,false,false,false,false],leitura:null},
    {rotulo:"eco sem sorteio",dinheiro:[100,200,300,400,500],armado:[false,false,false,false,false],pistol:false,loss:2,awp:[false,false,false,false,false],leitura:null},
    {rotulo:"force por derrotas",dinheiro:[2600,2700,2800,2900,3000],armado:[false,false,false,false,false],pistol:false,loss:3,awp:[false,false,false,false,false],leitura:null},
    {rotulo:"force ocasional",dinheiro:[2600,2700,2800,2900,3000],armado:[false,false,false,false,false],pistol:false,loss:0,awp:[false,false,false,false,false],leitura:{compra:"eco",venceu:false}},
    {rotulo:"leitura cancela force",dinheiro:[2600,2700,2800,2900,3000],armado:[false,false,false,false,false],pistol:false,loss:0,awp:[false,false,false,false,false],leitura:{compra:"full",venceu:true}},
    {rotulo:"full com AWP",dinheiro:[7000,5000,5000,5000,5000],armado:[false,false,false,false,false],pistol:false,loss:0,awp:[true,false,false,false,false],leitura:null},
    {rotulo:"full com carrego",dinheiro:[1900,1900,1900,1900,1900],armado:[true,true,true,true,false],pistol:false,loss:1,awp:[false,false,false,false,false],leitura:null},
    {rotulo:"full com drop",dinheiro:[8000,8000,4300,4300,1000],armado:[false,false,false,false,false],pistol:false,loss:1,awp:[false,false,false,false,false],leitura:null}
  ];

  X.srand(SEMENTE);
  const legado=casos.map(c=>plain(X.decidirCompra(
    [...c.dinheiro],[...c.armado],c.pistol,c.loss,[...c.awp],c.leitura&&{...c.leitura}
  )));
  const estadoLegado=X.rndF();

  X.srand(SEMENTE);
  const extraido=casos.map(c=>M.decidirCompra(
    [...c.dinheiro],[...c.armado],c.pistol,c.loss,[...c.awp],c.leitura&&{...c.leitura},X.rndF
  ));
  const estadoExtraido=X.rndF();

  casos.forEach((caso,i)=>{
    assert.deepEqual(plain(extraido[i]),legado[i],`decidirCompra: ${caso.rotulo}`);
  });
  assert.equal(estadoExtraido,estadoLegado,
    "CONSUMO DE AZAR divergiu em decidirCompra");

  const leituras=[null,{},
    {compra:"full",venceu:true},{compra:"awp",venceu:true},
    {compra:"full",venceu:false},{compra:"force",venceu:true}];
  leituras.forEach((leitura,i)=>{
    assert.deepEqual(plain(M.leituraDoInimigo(leitura)),plain(X.leituraDoInimigo(leitura)),
      `leituraDoInimigo: caso ${i}`);
  });

  const dinheiroLegado=[8000,5000,4300,1800,200];
  const dinheiroExtraido=[...dinheiroLegado];
  const armado=[false,true,false,true,false];
  const compras=["awp","full","full","full","eco"];
  const extra=[2700,0,0,0,0];
  const refExtraido=dinheiroExtraido;
  X.pagarCompra(dinheiroLegado,[...armado],[...compras],[...extra]);
  M.pagarCompra(dinheiroExtraido,[...armado],[...compras],[...extra]);
  assert.deepEqual(dinheiroExtraido,plain(dinheiroLegado),"pagarCompra divergiu");
  assert.equal(dinheiroExtraido,refExtraido,"pagarCompra precisa mutar a carteira recebida");

  const modas=[
    ["full","full","eco","eco","force"],
    ["awp","full","force","eco","pistol"],
    ["pistol","pistol","eco","eco","eco"]
  ];
  modas.forEach((comprasDoTime,i)=>{
    assert.equal(M.compraDoTime(comprasDoTime),X.compraDoTime(comprasDoTime),
      `compraDoTime: caso ${i}`);
  });

  let chamadas=0;
  const forceSemLeitura=M.decidirCompra(
    [2600,2600,2600,2600,2600],[false,false,false,false,false],false,0,
    [false,false,false,false,false],{compra:"full",venceu:true},
    ()=>{chamadas++;return 0;},{BUY_LE_FULL:0}
  );
  assert.deepEqual(forceSemLeitura.compras,["force","force","force","force","force"],
    "configuração injetada precisa desligar a leitura de full");
  assert.equal(chamadas,1,"force ocasional precisa consumir exatamente uma amostra uniforme");

  const tabelas={
    CUSTO:{pistol:0,eco:20,force:250,full:430,awp:605},
    CUSTO_REPOR:{pistol:0,eco:0,force:100,full:180,awp:180},
    PRECO_RIFLE:270
  };
  const comTabela=M.decidirCompra(
    [700,500,500,500,500],[false,false,false,false,false],false,0,
    [true,false,false,false,false],null,()=>1,M.CFG_PADRAO,tabelas
  );
  assert.deepEqual(comTabela.compras,["awp","full","full","full","full"],
    "decidirCompra precisa honrar tabelas injetadas");

  console.log(`economy parity: ok (${casos.length} decisões · ${leituras.length} leituras · consumo de azar conferido)`);
}

main().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
