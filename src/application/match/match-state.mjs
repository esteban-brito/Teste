export function createMapPlaybackState(){
  return {
    ativo:false,
    timer:null,
    onFim:null,
    gen:0,
    jogo:null,
    ctx:"",
  };
}

/* `rodando` é criado apenas quando uma série é aberta; sua ausência inicial é
   parte do contrato observado pela ponte E2E. */
export function createMatchState(){
  return {
    A:null,
    B:null,
    md:1,
    mapaIdx:0,
    vA:0,
    vB:0,
    contexto:"",
    onSerieFim:null,
    /* Escolha da antessala, por MAPA: com ou sem narração. Nasce em false porque
       o modo limpo é o padrão de referência — ver a emenda de 06/08/2026 da
       §11-bis. */
    narrado:false,
    /* OS MAPAS DA SÉRIE, sorteados de uma vez — 07/08/2026.
       A antessala mostra TODOS os mapas do confronto (três num MD3, mesmo que a
       série termine em dois), então eles precisam existir antes do primeiro
       play. Sortear a série inteira aqui também corrige um defeito silencioso:
       a UI chamava `simularMapa` sem controle de repetição, e um MD3 podia
       jogar o mesmo mapa duas vezes — `simularSerie`, no motor, nunca permitiu
       isso.
       Vazio fora de uma série; `mapaIdx` é o índice do mapa em curso. */
    mapas:[],
  };
}

export function resetMatchState(state){
  Object.assign(state,{
    A:null,
    B:null,
    md:1,
    mapaIdx:0,
    vA:0,
    vB:0,
    contexto:"",
    onSerieFim:null,
    rodando:false,
    narrado:false,
    mapas:[],
  });
  return state;
}
