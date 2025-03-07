import { EditorState, ReducerActions } from "./editor-types";

const persistState = (state: EditorState) => {
  // console.log('==> PersistState:', state);
  // putLocalData('ed3-editor', state);
  return state;
}

export const editorReducer = (
  lastState: EditorState,
  action: ReducerActions
): EditorState => {
  const { payload, type } = action;

  switch (type) {
    case 'Loaded':
      const { isLoading } = payload;
      return persistState({
        ...lastState,
        ...{ isLoading }
      });
    default: {
      console.warn('StoreReducer: type not handled', type);
      console.warn('StoreReducer: payload', payload);
      return persistState({ ...lastState });
    }
  }
}
