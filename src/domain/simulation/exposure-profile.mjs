import {combatProfile} from "./combat-profile.mjs";
import {styleAggression} from "../evaluation/style-identity.mjs";

const CONTACT_AGGRESSION={opening:.45,preplant:.28,postplant:.28};
const CONTACT_OPPORTUNITY={opening:.06,preplant:.02,postplant:.02};
const CONTACT_ENTRY={
  opening:{CT:.30,TR:.35},
  preplant:{CT:.02,TR:.06},
  postplant:{CT:.08,TR:0}
};
const CONTACT_POSITION={
  AWPer:{opening:.10,preplant:.03,postplant:.03},
  Lurker:{opening:.06,preplant:.03,postplant:.03},
  Support:{opening:.02,preplant:.01,postplant:.01},
  Rifler:{opening:.02,preplant:.01,postplant:.01}
};
/** Relative likelihood of taking a lost contact, not a direct death bonus. */
export function exposureProfile(player){
  const source=player?._eng||player||{};
  const role=combatProfile(player).activeCombatRole;
  const normalized=key=>((source[key]??50)-50)/50;
  const aggression=styleAggression(player);
  const profile={};

  for(const phase of ["opening","preplant","postplant"]){
    profile[phase]={};
    for(const side of ["CT","TR"]){
      let positional=0;
      if(role==="AWPer")positional=CONTACT_POSITION.AWPer[phase]*normalized("sn");
      else if(role==="Lurker"){
        positional=CONTACT_POSITION.Lurker[phase]*(side==="TR"&&phase!=="postplant"?1:2/3)*normalized("cl");
      }else if(role==="Support"){
        positional=CONTACT_POSITION.Support[phase]*(side==="TR"&&phase!=="postplant"?1:.5)*normalized("ut");
      }else if(role==="Rifler")positional=CONTACT_POSITION.Rifler[phase]*normalized("cl");

      const score=CONTACT_AGGRESSION[phase]*aggression+
        CONTACT_ENTRY[phase][side]*normalized("en")+
        CONTACT_OPPORTUNITY[phase]*normalized("op")-positional;
      profile[phase][side]=Math.exp(score);
    }
  }
  return profile;
}
