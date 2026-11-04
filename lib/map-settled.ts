type MovementEvents = {
  on(events:string,listener:()=>void):unknown;
  off(events:string,listener:()=>void):unknown;
};

/** Leaflet emits both events for one zoom. Run expensive view/layer work once.
 * A microtask also works in a background tab, where animation frames may stop. */
export function onMapSettled(map:MovementEvents,update:()=>void):()=>void {
  let queued=false,disposed=false;
  const schedule=()=>{
    if(queued||disposed)return;queued=true;
    queueMicrotask(()=>{queued=false;if(!disposed)update();});
  };
  map.on('moveend zoomend',schedule);
  return ()=>{disposed=true;map.off('moveend zoomend',schedule);};
}
