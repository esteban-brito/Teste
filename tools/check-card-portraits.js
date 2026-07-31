/* Prova o contrato executável dos retratos usados nas cartas.
   O runtime recebe somente um asset-id; recorte, proporção e formato precisam
   estar resolvidos antes de o arquivo entrar no repositório. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

const ROOT=path.join(__dirname,"..");
const PHOTO_DIR=path.join(ROOT,"fotos");
const MIN_WIDTH=500;
const MIN_HEIGHT=700;
const MAX_BYTES=500_000;

function uint24le(buffer,offset){
  return buffer[offset]|(buffer[offset+1]<<8)|(buffer[offset+2]<<16);
}

function webpDimensions(buffer){
  assert.ok(buffer.length>=30&&buffer.toString("ascii",0,4)==="RIFF"&&
    buffer.toString("ascii",8,12)==="WEBP","asset não é um WebP RIFF válido");
  let offset=12;
  while(offset+8<=buffer.length){
    const type=buffer.toString("ascii",offset,offset+4);
    const size=buffer.readUInt32LE(offset+4);
    const data=offset+8;
    assert.ok(data+size<=buffer.length,`chunk ${type} ultrapassa o arquivo`);
    if(type==="VP8X"){
      assert.ok(size>=10,"chunk VP8X truncado");
      return {width:uint24le(buffer,data+4)+1,height:uint24le(buffer,data+7)+1};
    }
    if(type==="VP8 "){
      assert.ok(size>=10,"chunk VP8 truncado");
      assert.equal(buffer.toString("hex",data+3,data+6),"9d012a","frame VP8 sem assinatura");
      return {width:buffer.readUInt16LE(data+6)&0x3fff,height:buffer.readUInt16LE(data+8)&0x3fff};
    }
    if(type==="VP8L"){
      assert.ok(size>=5,"chunk VP8L truncado");
      assert.equal(buffer[data],0x2f,"frame VP8L sem assinatura");
      const bits=buffer.readUInt32LE(data+1);
      return {width:(bits&0x3fff)+1,height:((bits>>14)&0x3fff)+1};
    }
    offset=data+size+(size%2);
  }
  throw new Error("WebP sem chunk de imagem suportado");
}

/** Formato, proporção, resolução e peso de um asset declarado. */
function conferirAsset(assetId,quem){
  const file=path.join(PHOTO_DIR,`${assetId}.webp`);
  assert.ok(fs.existsSync(file),`foto declarada por ${quem} não existe: fotos/${assetId}.webp`);
  const buffer=fs.readFileSync(file);
  const {width,height}=webpDimensions(buffer);
  assert.equal(width*7,height*5,
    `${assetId}.webp precisa ter proporção exata 5:7 (viu ${width}×${height})`);
  assert.ok(width>=MIN_WIDTH&&height>=MIN_HEIGHT,
    `${assetId}.webp abaixo do piso ${MIN_WIDTH}×${MIN_HEIGHT} (viu ${width}×${height})`);
  assert.ok(buffer.length<=MAX_BYTES,
    `${assetId}.webp excede ${Math.round(MAX_BYTES/1000)} kB (${Math.round(buffer.length/1000)} kB)`);
}

async function main(){
  const playersUrl=pathToFileURL(path.join(ROOT,"src","data","players.mjs")).href;
  const teamsUrl=pathToFileURL(path.join(ROOT,"src","data","teams.mjs")).href;
  const {ATRIBUTOS}=await import(playersUrl);
  const {TIMES_DEF}=await import(teamsUrl);

  const retratos=ATRIBUTOS.filter(player=>player.foto);
  const ids=new Set();
  for(const player of retratos){
    const idCru=player.id||player.nome;
    assert.match(player.foto,/^[a-zA-Z0-9_-]+$/,
      `foto inválida em ${idCru}: use somente asset-id seguro`);
    /* REGRA QUE IMPEDE TROCAR ERAS. O asset-id de jogador tem de ser IDÊNTICO ao ID
       cru. O ID cru já é único por era — `donk` (Budapest 2025) e `donk_kato24`
       (Katowice 2024) são registros distintos —, então o arquivo herda essa
       unicidade e colar a foto errada deixa de ser possível, não apenas
       improvável. Isso é o que sustenta o acervo quando existirem dez Spirits e
       quinze eras do mesmo nick. */
    assert.equal(player.foto,idCru,
      `asset-id precisa ser igual ao ID cru: ${idCru} declara foto "${player.foto}". `+
      `Sem isso, duas eras do mesmo nick podem apontar para o mesmo arquivo.`);
    assert.ok(!ids.has(player.foto),`asset de foto duplicado: ${player.foto}`);
    ids.add(player.foto);
    conferirAsset(player.foto,idCru);
  }

  /* Treinador: `coachFoto` vive no ELENCO, porque o mesmo nome treina eras
     diferentes. O asset precisa começar pelo nome do treinador, para o arquivo
     ficar preso à PESSOA, e o sufixo distingue a era. */
  const comCoach=TIMES_DEF.filter(team=>team.coachFoto);
  for(const team of comCoach){
    const quem=`${team.nome} · ${team.camp}`;
    assert.ok(team.coach,`${quem} declara coachFoto sem ter treinador`);
    assert.match(team.coachFoto,/^[a-zA-Z0-9_-]+$/,
      `coachFoto inválida em ${quem}: use somente asset-id seguro`);
    const prefixo=team.coach.toLowerCase().replace(/[^a-z0-9]/g,"");
    assert.ok(team.coachFoto.toLowerCase().startsWith(prefixo),
      `coachFoto "${team.coachFoto}" em ${quem} não começa pelo treinador "${team.coach}". `+
      `O asset precisa ficar preso à pessoa; use o sufixo para a era.`);
    assert.ok(!ids.has(team.coachFoto),`asset de foto duplicado: ${team.coachFoto}`);
    ids.add(team.coachFoto);
    conferirAsset(team.coachFoto,quem);
  }

  const assets=fs.readdirSync(PHOTO_DIR).filter(name=>name.toLowerCase().endsWith(".webp"));
  const orfaos=assets.filter(name=>!ids.has(name.slice(0,-5)));
  assert.deepEqual(orfaos,[],`retratos órfãos em fotos/: ${orfaos.join(", ")}`);
  console.log(`card portraits: ok (${retratos.length} jogador(es) + ${comCoach.length} treinador(es) · `+
    `5:7 · WebP · ≤500 kB · asset-id preso ao ID cru)`);
}

main().catch(error=>{console.error(error);process.exitCode=1;});
