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
  });
  return state;
}
