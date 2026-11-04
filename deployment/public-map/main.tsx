import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import CoastApp from '../../components/coast-app';
import '../../app/globals.css';

class MapRecovery extends Component<{ children:ReactNode },{ failed:boolean }> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed)return <div className="map-startup" role="alert"><p>No se pudo abrir el mapa.</p><button onClick={()=>window.location.reload()}>Volver a intentar</button></div>;
    return this.props.children;
  }
}

// Offer recovery of a stale lazy chunk without an automatic reload loop.
window.addEventListener('vite:preloadError',event=>{
  event.preventDefault();
  if(document.querySelector('.map-update-retry'))return;
  const button=document.createElement('button');button.className='map-update-retry';
  button.textContent='No se pudo cargar esta sección. Recargar mapa';
  button.onclick=()=>window.location.reload();document.body.appendChild(button);
});
const localReview=['127.0.0.1','localhost'].includes(window.location.hostname)&&new URLSearchParams(window.location.search).get('review')==='1';
createRoot(document.getElementById('root')!).render(<StrictMode><MapRecovery><CoastApp reviewMode={localReview}/></MapRecovery></StrictMode>);
