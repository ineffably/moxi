import { useContext, useEffect, useState } from "react";
import { RouterContext } from "./SimpleRouter";

export const Layout = () => {
  const { state: { hash, path } } = useContext(RouterContext) || {};
    
  useEffect(() => {
    
  }, [])

  return (
    <div>
      <h1>Layout</h1>
      <a href="#/examples/1">Example 1</a>
    </div>
  )
}