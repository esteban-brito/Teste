/* LEITOR DE DIMENSÕES WebP, sem dependência.
   ══════════════════════════════════════════════════════════════════════════════

   Vivia dentro de `check-card-portraits.js` e saiu daqui quando `check-map-art`
   passou a precisar da mesma leitura. É a mesma lição de `bancada/lib/arrasto.js`
   e `bancada/lib/major.js`: o errado nunca foi haver dois consumidores, era haver
   duas implementações do mesmo percurso — e a segunda cópia é a que não recebe a
   correção.

   Por que não uma lib de imagem: o repositório não tem `sharp` nem `pngjs`, e
   ler quatro campos de cabeçalho não justifica uma dependência nativa. */
const assert=require("node:assert/strict");

function uint24le(buffer,offset){
  return buffer[offset]|(buffer[offset+1]<<8)|(buffer[offset+2]<<16);
}

/** Largura e altura de um WebP, nos três formatos de chunk que o Chromium
    escreve: VP8X (estendido), VP8 (lossy) e VP8L (lossless). */
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

module.exports={webpDimensions};
