import { RenderManager } from 'moxi';
import PIXI from 'pixi.js';
import { useEffect, useRef } from 'react';

export const SceneEditor = () => {
  const sceneRef = useRef(null);
  
  useEffect(() => {
    (async () => {
      const renderMan = await RenderManager.create(sceneRef.current, { width: 1280, height: 720 });
    })()
  }, [])

  return(
    <div ref={sceneRef}></div>
  )
}