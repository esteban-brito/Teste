/** Abstract value of preserving a survivor; it does not infer owned weapons. */
export function preservationValue(player){
  const source=player?._eng||player||{};
  return ((source.sn??0)+(source.cl??0)+(source.ut??0)+(source.fp??0))/400;
}
