/* CALLOUTS DOS MAPAS — o vocabulário de posição que um narrador usa.

   POR QUE ISTO EXISTE SEPARADO. O simulador não modela posição: ele decide
   duelos, economia, plant e clutch, não "quem foi pelo duto". A narração ao vivo
   pede esse chão — "segue pelo duto e vai até o bomb B" —, e ele é CENÁRIO, não
   resultado. A regra que separa uma coisa da outra:

     o que ACONTECE vem sempre do `registro` (quem fragou, quantos, clutch,
     bomba, placar); onde acontece vem daqui.

   Nada aqui pode contradizer o motor. Por isso o módulo só oferece nomes de
   lugar — nunca decide vencedor, número de kills ou se a bomba foi plantada.

   Os nomes são os do mapa real, na gíria brasileira de CS, porque é assim que a
   transmissão fala. Um mapa fora do pool cai no vocabulário neutro, que serve
   para qualquer planta sem soar errado. */

const NEUTRO={
  rotas:["o meio","a lateral","o fundo"],
  bomb:["o A","o B"],
  agressivo:["a entrada","o corredor"],
};

export const CALLOUTS={
  Mirage:{rotas:["o meio","o apartamento","a rampa","o conector","o palace","a janela"],
    bomb:["o A","o B"],agressivo:["o meio pelo underpass","o palace","a rampa do B"]},
  Inferno:{rotas:["a banana","o apartamento","a biblioteca","o arco","o pátio"],
    bomb:["o A","o B"],agressivo:["a banana","o apartamento","a biblioteca"]},
  Nuke:{rotas:["o outside","a rampa","o duto","o lobby","o secret","a garagem"],
    bomb:["o bomb A","o bomb B"],agressivo:["a rampa","o duto","o outside"]},
  Ancient:{rotas:["o meio","o donut","a caverna","a rampa","o túnel"],
    bomb:["o A","o B"],agressivo:["o donut","a caverna","o meio"]},
  Anubis:{rotas:["o meio","o palácio","a água","o conector","a ponte"],
    bomb:["o A","o B"],agressivo:["a água","o palácio","o meio"]},
  Dust2:{rotas:["o túnel","o meio","o longo","o curto","a catwalk"],
    bomb:["o A","o B"],agressivo:["o longo","o túnel","o curto"]},
  Cache:{rotas:["o meio","a garagem","a highway","o quadrado","a sala"],
    bomb:["o A","o B"],agressivo:["a highway","a garagem","o meio"]},
};

export const calloutsDe=mapa=>CALLOUTS[mapa]||NEUTRO;

/* CONTRAÇÃO DE PREPOSIÇÃO — sem isto sai "por a garagem" e "no o A".
   Os callouts guardam o artigo junto ("a garagem", "o meio") porque o gênero é
   do LUGAR, não da frase: quem escreve a fala não deveria ter de lembrar se
   banana é feminino. Então a frase pede a preposição e estes helpers resolvem a
   contração, que é o que o português exige e o que faz a narração soar de gente.

   Nomes sem artigo — um callout futuro como "heaven" — caem na forma solta
   ("por heaven"), que continua correta. */
const artigoDe=l=>(l.startsWith("a ")?"a":l.startsWith("o ")?"o":null);
const semArtigo=l=>(artigoDe(l)?l.slice(2):l);

/** "por" + lugar → "pela banana" / "pelo meio" / "por heaven" */
export const pelo=l=>{const a=artigoDe(l);return a?`pel${a} ${semArtigo(l)}`:`por ${l}`;};
/** "em" + lugar → "na banana" / "no meio" / "em heaven" */
export const no=l=>{const a=artigoDe(l);return a?`n${a} ${semArtigo(l)}`:`em ${l}`;};
/** "para" + lugar → "pra banana" / "pro meio" / "pra heaven" */
export const pro=l=>{const a=artigoDe(l);return a?`pr${a} ${semArtigo(l)}`:`pra ${l}`;};
/** "de" + lugar → "da banana" / "do meio" / "de heaven" */
export const da=l=>{const a=artigoDe(l);return a?`d${a} ${semArtigo(l)}`:`de ${l}`;};
