import { CodeEditorUI } from "./code-editor/code-editor-ui";
import { StateProvider } from "./state-provider";
import { SceneEditor } from "./scene-editor/scene-editor";

export const EditorRoot = ({ children }) => {
  return (
    <StateProvider>
      <CodeEditorUI />
    </StateProvider>
  )
}