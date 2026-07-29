/* Cópia de migração dos metadados legados de país.
   Enquanto game.js ainda for consumidor, tools/check-raw-country-parity.js
   impede divergência integral entre as duas representações.

   DUAS TABELAS, NÃO UMA (28/07/2026). Antes existia um `PAISES_MAP` único
   misturando três espaços de nome: jogador, treinador e — numa entrada só —
   NOME DE TIME ("Outsiders"), usada como último fallback do país do treinador.
   Misturar espaços de nome numa tabela é o tipo de coisa que faz um leitor
   concluir que o dado não existe: a busca de jogador usava `p.nome`, então a
   chave `apEX_envy` nunca era consultada e ficava morta no arquivo.

   Agora cada tabela declara sua chave:
   - PAIS_JOGADOR   indexa pelo **ID cru** (`id || nome`), a identidade do
     projeto (docs/architecture.md §Dados e identidade);
   - PAIS_TREINADOR indexa pelo **nome do treinador**.

   A entrada de time foi removida por ser inalcançável: todo treinador resolve
   antes, por `coachPais` inline ou pelo próprio nome. Medido, não presumido. */

/** País por ID CRU do jogador. Só as 45 entradas que o registro não traz. */
export const PAIS_JOGADOR={s1mple:"UKR",electroNic:"RUS",b1t:"UKR",Perfecto:"RUS",Boombl4:"RUS",donk:"RUS",sh1ro:"RUS",tN1R:"BLR",zweih:"RUS",chopper:"RUS",
  ZywOo:"FRA",ropz:"EST",mezii:"GBR",flameZ:"ISR",apEX:"FRA",mzinho:"MNG",bLitz:"MNG","910":"MNG",controlez:"MNG",Techno:"MNG",
  KSCERATO:"BRA",yuurih:"BRA",saffee:"BRA",arT:"BRA",drop:"BRA",FL1T:"RUS",fame:"RUS",n0rb3r7:"RUS",Qikert:"KAZ",Jame:"RUS",
  coldzera:"BRA",TACO:"BRA",FalleN:"BRA",fnx:"BRA",fer:"BRA",
  kennyS:"FRA","NBK-":"FRA",Happy:"FRA",apEX_envy:"FRA",kioShiMa:"FRA",
  tarik:"USA",autimatic:"USA",RUSH:"USA",Skadoodle:"USA",Stewie2K:"USA"};

/** País por nome do treinador. `coachPais` inline no elenco tem precedência. */
export const PAIS_TREINADOR={B1ad3:"UKR",guerri:"BRA",dead:"BRA",XTQZZZ:"FRA",hally:"RUS",maaRaa:"MNG",dastan:"KAZ",valens:"CAN",zakk:"BRA",Swani:"GER",sidde:"BRA",
  RobbaN:"SWE",zonic:"DEN",kakafu:"AUT"};
