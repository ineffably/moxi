import { Layout } from "./layout"
import { SimpleRouter, RoutesConfig } from "./SimpleRouter"
import { Example01 } from "./example-1"
export const ExamplesRoot = () => {

  const routesConfig = [
    {
      path: '*',
      name: 'Layout',
      render: () => () => <Layout />
    },
    {
      path: '/examples/:number',
      name: 'Examples 1',
      render: () => (props = {} as any) => {
        console.log({ props })
        switch (props.number) {
          case '1':
            Example01();
            return null;
          default:
            return <Layout />
        }
      }
    }
  ] as RoutesConfig[];

  return (
    <SimpleRouter initState={{ routesConfig }} />
  )
}