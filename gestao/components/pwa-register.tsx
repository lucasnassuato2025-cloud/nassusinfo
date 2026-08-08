"use client";

import { useEffect } from "react";

export default function PWARegister(){
  useEffect(()=>{
    if("serviceWorker" in navigator){
      const register=()=>navigator.serviceWorker.register("/sw.js").catch(()=>undefined);
      if(document.readyState==="complete")void register();
      else window.addEventListener("load",register,{once:true});
    }
  },[]);
  return null;
}
