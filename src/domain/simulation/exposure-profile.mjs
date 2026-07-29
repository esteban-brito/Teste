import {combatProfile} from "./combat-profile.mjs";
import {styleAggression} from "../evaluation/style-identity.mjs";

export const CFG_PADRAO={
  STYLE_AGR:1.4,
  CONTACT_AGR:{opening:.45,preplant:.28,postplant:.28},
  CONTACT_OP:{opening:.06,preplant:.02,postplant:.02},
  CONTACT_EN:{opening:{CT:.30,TR:.35},preplant:{CT:.02,TR:.06},postplant:{CT:.08,TR:0}},
  CONTACT_POS:{
    AWPer:{opening:.10,preplant:.03,postplant:.03},
    Lurker:{opening:.06,preplant:.03,postplant:.03},
    Support:{opening:.02,preplant:.01,postplant:.01},
    Rifler:{opening:.02,preplant:.01,postplant:.01}
  }
};
/** Relative likelihood of taking a lost contact, not a direct death bonus. */
export function exposureProfile(player,cfg=CFG_PADRAO){
  const source=player?._eng||player||{};
  const role=combatProfile(player,cfg).activeCombatRole;
  const normalized=key=>((source[key]??50)-50)/50;
  const aggression=styleAggression(player,cfg.STYLE_AGR);
  const profile={};

  for(const phase of ["opening","preplant","postplant"]){
    profile[phase]={};
    for(const side of ["CT","TR"]){
      let positional=0;
      if(role==="AWPer")positional=cfg.CONTACT_POS.AWPer[phase]*normalized("sn");
      else if(role==="Lurker"){
        positional=cfg.CONTACT_POS.Lurker[phase]*(side==="TR"&&phase!=="postplant"?1:2/3)*normalized("cl");
      }else if(role==="Support"){
        positional=cfg.CONTACT_POS.Support[phase]*(side==="TR"&&phase!=="postplant"?1:.5)*normalized("ut");
      }else if(role==="Rifler")positional=cfg.CONTACT_POS.Rifler[phase]*normalized("cl");

      const score=cfg.CONTACT_AGR[phase]*aggression+
        cfg.CONTACT_EN[phase][side]*normalized("en")+
        cfg.CONTACT_OP[phase]*normalized("op")-positional;
      profile[phase][side]=Math.exp(score);
    }
  }
  return profile;
}
