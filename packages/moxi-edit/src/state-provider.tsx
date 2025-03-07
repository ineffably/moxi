import { createContext, useReducer, useEffect } from "react";
import { EditorState, ProviderState } from "./editor-types";
import { editorReducer } from "./editor-reducer";

export const emptyState: EditorState = {
  isLoading: true,
}

export const EditorContext = createContext<ProviderState>({ state: emptyState });

export const StateProvider = ({ children, initState = emptyState }) => {
  const [state, dispatch] = useReducer(editorReducer, {...emptyState, ...initState});

  useEffect(() => {
    console.log('ROOT:', {...state});
    // dispatch({ type: 'InitState', payload: initState })
  }, [])

  return (
    <EditorContext.Provider value={{ state, dispatch }}>
      {children}
    </EditorContext.Provider>
  )
}

