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

async function main(){
  const playersUrl=pathToFileURL(path.join(ROOT,"src","data","players.mjs")).href;
  const {ATRIBUTOS}=await import(playersUrl);
  const retratos=ATRIBUTOS.filter(player=>player.foto);
  const ids=new Set();
  for(const player of retratos){
    assert.match(player.foto,/^[a-zA-Z0-9_-]+$/,
      `foto inválida em ${player.id||player.nome}: use somente asset-id seguro`);
    assert.ok(!ids.has(player.foto),`asset de foto duplicado: ${player.foto}`);
    ids.add(player.foto);
    const file=path.join(PHOTO_DIR,`${player.foto}.webp`);
    assert.ok(fs.existsSync(file),`foto declarada não existe: fotos/${player.foto}.webp`);
    const buffer=fs.readFileSync(file);
    const {width,height}=webpDimensions(buffer);
    assert.equal(width*7,height*5,
      `${player.foto}.webp precisa ter proporção exata 5:7 (viu ${width}×${height})`);
    assert.ok(width>=MIN_WIDTH&&height>=MIN_HEIGHT,
      `${player.foto}.webp abaixo do piso ${MIN_WIDTH}×${MIN_HEIGHT} (viu ${width}×${height})`);
    assert.ok(buffer.length<=MAX_BYTES,
      `${player.foto}.webp excede ${Math.round(MAX_BYTES/1000)} kB (${Math.round(buffer.length/1000)} kB)`);
  }
  const assets=fs.readdirSync(PHOTO_DIR).filter(name=>name.toLowerCase().endsWith(".webp"));
  const orfaos=assets.filter(name=>!ids.has(name.slice(0,-5)));
  assert.deepEqual(orfaos,[],`retratos órfãos em fotos/: ${orfaos.join(", ")}`);
  console.log(`card portraits: ok (${retratos.length} asset${retratos.length===1?"":"s"} · 5:7 · WebP · ≤500 kB)`);
}

main().catch(error=>{console.error(error);process.exitCode=1;});
