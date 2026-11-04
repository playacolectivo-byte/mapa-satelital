import type {Map as LeafletMap,Popup,PopupEvent} from 'leaflet';

type Rect={left:number;top:number;right:number;bottom:number};
type Point={x:number;y:number};
/** The popup moves on screen; its geographic source remains unchanged. */
export function popupViewportPlacement(box:Rect,safe:Rect,anchor:Point,map:Rect,shift:Point){
 const marginX=Math.max(300,(map.right-map.left)*.75),marginY=Math.max(300,(map.bottom-map.top)*.75);
 if(anchor.x<map.left-marginX||anchor.x>map.right+marginX||anchor.y<map.top-marginY||anchor.y>map.bottom+marginY)return {close:true,x:0,y:0};
 const left=box.left-shift.x,top=box.top-shift.y,width=box.right-box.left,height=box.bottom-box.top;
 const targetX=Math.max(safe.left,Math.min(left,safe.right-width));
 const targetY=Math.max(safe.top,Math.min(top,safe.bottom-height));
 return {close:false,x:targetX-left,y:targetY-top};
}

/** Keep all map data cards readable through a modest pan. Only a distant
 * source closes its card. Coalesce movement/resize work in background tabs too. */
export function keepMapPopupsVisible(map:LeafletMap):()=>void{
 let popup:Popup|null=null,shift:Point={x:0,y:0},observer:ResizeObserver|null=null,queued=false,disposed=false;
 const container=map.getContainer(),root=container.closest('.minimal-explorer')??container.parentElement;
 const visibleRect=(element:Element|null)=>{
  if(!element)return null;const rect=element.getBoundingClientRect();return rect.width&&rect.height?rect:null;
 };
 const update=()=>{
  queued=false;if(disposed||!popup)return;
  const element=popup.getElement();if(!element)return;
  const bounds=container.getBoundingClientRect(),width=bounds.width,height=bounds.height;
  if(!width||!height)return;
  if(bounds.bottom<-height*.75||bounds.top>window.innerHeight+height*.75){popup.remove();return;}
  const safe:Rect={left:Math.max(0,bounds.left)+12,top:Math.max(0,bounds.top)+12,right:Math.min(window.innerWidth,bounds.right)-12,bottom:Math.min(window.innerHeight,bounds.bottom)-12};
  const nav=visibleRect(root?.querySelector('.map-nav')??null),timeline=visibleRect(root?.querySelector('.timeline-pill')??null);
  if(nav)safe.top=Math.max(safe.top,nav.bottom+12);
  if(timeline)safe.bottom=Math.min(safe.bottom,timeline.top-12);
  if(safe.bottom-safe.top<80){safe.top=Math.max(0,bounds.top)+8;safe.bottom=Math.min(window.innerHeight,bounds.bottom)-8;}
  const panel=visibleRect(root?.querySelector('.coastal-period-sections')??null);
  if(panel&&safe.right-(panel.right+12)>=Math.min(element.offsetWidth,320)+24)safe.left=Math.max(safe.left,panel.right+12);
  const maxWidth=Math.max(120,safe.right-safe.left),maxHeight=Math.max(40,safe.bottom-safe.top-46);
  element.style.setProperty('--popup-max-width',maxWidth+'px');element.style.setProperty('--popup-content-max-height',maxHeight+'px');
  const location=popup.getLatLng();if(!location)return;
  const source=map.latLngToContainerPoint(location);
  const result=popupViewportPlacement(element.getBoundingClientRect(),safe,{x:bounds.left+source.x,y:bounds.top+source.y},bounds,shift);
  if(result.close){popup.remove();return;}
  shift={x:Math.round(result.x),y:Math.round(result.y)};
  element.style.setProperty('--popup-shift-x',shift.x+'px');element.style.setProperty('--popup-shift-y',shift.y+'px');
  element.dataset.viewportClamped=String(shift.x!==0||shift.y!==0);
 };
 const schedule=()=>{if(queued||disposed||!popup)return;queued=true;queueMicrotask(update);};
 const clear=()=>{
  observer?.disconnect();observer=null;
  const element=popup?.getElement();
  if(element){for(const name of ['--popup-max-width','--popup-content-max-height','--popup-shift-x','--popup-shift-y'])element.style.removeProperty(name);delete element.dataset.viewportClamped;}
  popup=null;shift={x:0,y:0};
 };
 const open=(event:PopupEvent)=>{
  clear();popup=event.popup;popup.options.autoPan=false;
  const element=popup.getElement();if(!element)return;
  observer=new ResizeObserver(schedule);observer.observe(element);
  update();
 };
 const close=(event:PopupEvent)=>{if(event.popup===popup)clear();};
 map.on('popupopen',open);map.on('popupclose',close);map.on('move zoomend resize',schedule);
 window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);
 return ()=>{disposed=true;clear();map.off('popupopen',open);map.off('popupclose',close);map.off('move zoomend resize',schedule);window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);};
}
