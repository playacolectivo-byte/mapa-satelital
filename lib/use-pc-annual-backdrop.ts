'use client';
import {useEffect,useState} from 'react';
import type {AnnualBackdrop} from './annual-backdrop';
import {loadPcAnnualBackdrop} from './pc-annual-backdrop';
export function usePcAnnualBackdrop(year:number|null,attempt:number){
 const [hour,setHour]=useState(()=>Math.floor(Date.now()/3600000));
 useEffect(()=>{const timer=window.setInterval(()=>setHour(Math.floor(Date.now()/3600000)),3600000);return()=>window.clearInterval(timer);},[]);
 const key=year+':'+attempt+':'+hour;
 const [result,setResult]=useState<{key:string;value:AnnualBackdrop|null;failed:boolean}|null>(null);
 useEffect(()=>{
  if(year===null)return;
  const controller=new AbortController();
  void loadPcAnnualBackdrop(year,attempt,controller.signal).then(value=>{if(!controller.signal.aborted)setResult({key,value,failed:false});}).catch(()=>{if(!controller.signal.aborted)setResult({key,value:null,failed:true});});
  return()=>controller.abort();
 },[key,year,attempt]);
 return {backdrop:result?.key===key?result.value:null,status:year===null?'ready':result?.key!==key?'loading':result.failed?'error':'ready'} as const;
}
