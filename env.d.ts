/// <reference types="@remix-run/node" />
/// <reference types="vite/client" />

declare module "*.css?url" {
  const url: string;
  export default url;
}
