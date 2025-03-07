import { EditorState, ProviderState } from "./editor-types";
export declare const emptyState: EditorState;
export declare const EditorContext: import("react").Context<ProviderState>;
export declare const StateProvider: ({ children, initState }: {
    children: any;
    initState?: EditorState;
}) => import("react/jsx-runtime").JSX.Element;
