export type ActionTypes = 'Loaded' | 'HashChange';
export type RoutesConfig = {
    path: string;
    name?: string;
    render?: ReturnType<() => any>;
    route?: string[];
};
export type RouterState = {
    routesConfig: RoutesConfig[];
    hash?: string;
    path?: string[];
};
export interface ReducerActions {
    payload: any;
    type: ActionTypes;
}
export interface ProviderState {
    state: RouterState;
    dispatch?: React.Dispatch<ReducerActions>;
}
export interface RouterProviderProps {
    children?: React.ReactNode | React.ReactNode[];
    initState?: RouterState;
}
export declare const emptyState: RouterState;
export declare const RouterContext: import("react").Context<ProviderState>;
export declare function SimpleRouter({ initState }: RouterProviderProps): import("react/jsx-runtime").JSX.Element;
export declare function routerReducer(lastState: RouterState, action: ReducerActions): RouterState;
