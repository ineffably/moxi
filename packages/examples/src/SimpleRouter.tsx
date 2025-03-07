import { useReducer, useEffect, createContext, useState } from "react";

export type ActionTypes = 'Loaded' | 'HashChange';

export type RoutesConfig = {
  path: string;
  name?: string;
  render?: ReturnType<() => any>;
  route?: string[];
}

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

export const emptyState: RouterState = {
  routesConfig: [{ path: '*' }],
  hash: '',
  path: [''],
}

export const RouterContext = createContext<ProviderState>({ state: emptyState });

export function SimpleRouter({ initState = emptyState }: RouterProviderProps) {
  const [state, dispatch] = useReducer(routerReducer, { ...emptyState, ...initState });
  const [renderComponent, setRenderComponent] = useState(() => null);
  const [routesConfig, setRoutesConfig] = useState<RoutesConfig[]>(null);
  const [renderProps, setRenderProps] = useState<Record<string, string>>({});

  useEffect(() => {
    console.log('initState.routesConfig', initState.routesConfig)
    setRoutesConfig(initState.routesConfig.map(
      (route) => ({ route: ['/'].concat(route.path.split('/').filter(Boolean)) })).map(
        (route, index) => ({ ...initState.routesConfig[index], ...route })
      )
    );

    dispatch(({ type: 'HashChange', payload: { hash: window.location.hash } }));

    window.addEventListener('hashchange', () => {
      dispatch(({ type: 'HashChange', payload: { hash: window.location.hash } }));
    })
  }, [])

  useEffect(() => {
    console.log('state.hash', state.hash, routesConfig)
    if (!routesConfig) return;
    const { path } = state;

    const foundRoute = routesConfig.filter(
      (entry) => entry.route.length <= path.length &&
        entry.route.every((routePart, index) => routePart.startsWith(':') || (routePart === path[index]))
    );

    console.log('found routh', foundRoute.length, path)

    const fallbackRoute = routesConfig.find((route) => route.path === '*') || routesConfig[0];

    if (foundRoute.length > 0) {
      const params = foundRoute[0].route.reduce((acc, routePart, index) => {
        if (routePart.startsWith(':')) {
          acc[routePart.replace(':', '')] = path[index];
        }
        return acc;
      }, {})
      setRenderComponent(foundRoute[0].render);
      setRenderProps(params);
    } else if (fallbackRoute) {
      setRenderComponent(fallbackRoute.render);
    }
  }, [state.hash, routesConfig])

  const RenderRoute = () => (renderComponent && renderComponent({ ...renderProps }));

  return (
    <RouterContext.Provider value={{ state, dispatch }}>
      <RenderRoute />
    </RouterContext.Provider>
  )
}

export function routerReducer(
  lastState: RouterState,
  action: ReducerActions
): RouterState {
  const { payload, type } = action;

  switch (type) {
    case 'HashChange':
      const { hash } = payload;
      const path = ['/'].concat(hash.replace('#', '').split('/').filter(Boolean));
      return ({ ...lastState, hash, path });
    default: {
      console.warn('StoreReducer: type not handled', type);
      console.warn('StoreReducer: payload', payload);
      return { ...lastState };
    }
  }
}
