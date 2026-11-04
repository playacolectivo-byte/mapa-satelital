/** Consolidate rapid completed gestures/keys. Only the final selection commits.
 * A generation invalidates callbacks already queued before cancellation. */
export class SettledSelection {
  private timer:ReturnType<typeof setTimeout>|undefined;
  private generation=0;
  private delay:number;
  constructor(delay=180){this.delay=delay;}
  request(value:number,commit:(value:number)=>void){
    this.cancel();const generation=this.generation;
    this.timer=setTimeout(()=>{this.timer=undefined;if(generation===this.generation)commit(value);},this.delay);
  }
  cancel(){this.generation++;clearTimeout(this.timer);this.timer=undefined;}
}
