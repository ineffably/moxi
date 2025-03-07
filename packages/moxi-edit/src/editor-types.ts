export interface EditorState {
  isLoading?: boolean;
}

export type ActionTypes =
  'SetEngine' |
  'SetWorld' |
  'Loaded';

export interface ReducerActions {
  payload: any;
  type: ActionTypes;
}

export interface ProviderState {
  state: EditorState;
  dispatch?: React.Dispatch<ReducerActions>;
}
