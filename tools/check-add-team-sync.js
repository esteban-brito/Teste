/* Caracteriza a projeção modular e o rollback de tools/add-team.js sem
   modificar os arquivos do repositório. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const {ROOT}=require("../bancada/lib/common");
const {
  assignPlayerKeys,parse,projectSources,transactionalWrite,validateInput
}=require("./add-team");

const PLAYER_ANCHOR="  //@jogadores";
const TEAM_ANCHOR="  //@times";
const FIXTURE=`Projeto Teste | Evento Teste | Colocacao: Top 8 | Treinador: Coach Teste | Pais (Treinador): BRA | Cor: #123456
SyncOne — Pais: BRA | Rating: 1.10 | IGL: Sim | Stats: FP: 50, EN: 51, TR: 52, OP: 53, CL: 54, SN: 55, UT: 56
SyncTwo — Pais: USA | Rating: 1.09 | IGL: Nao | Stats: FP: 49, EN: 48, TR: 47, OP: 46, CL: 45, SN: 44, UT: 43
SyncThree — Pais: CAN | Rating: 1.08 | IGL: Nao | Stats: FP: 40, EN: 41, TR: 42, OP: 43, CL: 44, SN: 45, UT: 46
SyncFour — Pais: ARG | Rating: 1.07 | IGL: Nao | Stats: FP: 60, EN: 61, TR: 62, OP: 63, CL: 64, SN: 65, UT: 66
SyncFive — Pais: CHL | Rating: 1.06 | IGL: Nao | Stats: FP: 30, EN: 31, TR: 32, OP: 33, CL: 34, SN: 35, UT: 36`;

function projectionText(source,fragment,anchor){
  const newline=source.includes("\r\n")?"\r\n":"\n";
  return `${fragment.replace(/\r?\n/g,newline)}${newline}${anchor}`;
}

function testProjection(){
  const sources={
    players:fs.readFileSync(path.join(ROOT,"src","data","players.mjs"),"utf8"),
    teams:fs.readFileSync(path.join(ROOT,"src","data","teams.mjs"),"utf8")
  };
  const {time,jogadores}=parse(FIXTURE),warnings=[];
  validateInput(time,jogadores,warnings);
  const keys=assignPlayerKeys(jogadores,time.nome,sources.players,warnings);
  const projected=projectSources(sources,time,jogadores,keys);

  assert.equal(warnings.length,0,"fixture de sincronização não deveria gerar avisos");
  assert.ok(projected.players.includes(projectionText(sources.players,projected.fragments.players,PLAYER_ANCHOR)),"jogadores ausentes do módulo");
  assert.ok(projected.teams.includes(projectionText(sources.teams,projected.fragments.team,TEAM_ANCHOR)),"elenco ausente do módulo");
  assert.equal(keys.length,5);

  const duplicate=[{nick:"s1mple"}],duplicateWarnings=[];
  assert.equal(assignPlayerKeys(duplicate,"Projeto Teste",sources.players,duplicateWarnings)[0],"s1mple_projetoteste");
  assert.equal(duplicateWarnings.length,1,"nick repetido precisa produzir aviso");

  const cliOutput=execFileSync(process.execPath,[path.join(ROOT,"tools","add-team.js"),"--dry-run","-"],{input:FIXTURE,encoding:"utf8"});
  assert.match(cliOutput,/nenhum arquivo alterado/);
}

function testRollback(){
  const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),"draft9-add-team-"));
  const sourceA=path.join(tempRoot,"a.txt"),sourceB=path.join(tempRoot,"b.txt"),artifact=path.join(tempRoot,"artifact.txt");
  try{
    fs.writeFileSync(sourceA,"original-a");
    fs.writeFileSync(sourceB,"original-b");
    fs.writeFileSync(artifact,"original-artifact");

    assert.throws(()=>transactionalWrite([
      {path:sourceA,content:"new-a"},
      {path:sourceB,content:"new-b"}
    ],()=>{
      fs.writeFileSync(artifact,"new-artifact");
      throw new Error("falha induzida");
    },[artifact]),/fontes e artefato restaurados/);

    assert.equal(fs.readFileSync(sourceA,"utf8"),"original-a");
    assert.equal(fs.readFileSync(sourceB,"utf8"),"original-b");
    assert.equal(fs.readFileSync(artifact,"utf8"),"original-artifact");
  }finally{
    fs.rmSync(tempRoot,{recursive:true,force:true});
  }
}

testProjection();
testRollback();
console.log("add-team sync check: ok");
