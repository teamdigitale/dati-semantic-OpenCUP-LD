/// <reference types="vite/client" />

declare module "bootstrap-italia/dist/js/bootstrap-italia.bundle.min.js";

declare module "*.md?raw" {
  const content: string;
  export default content;
}

declare module "*.yml?raw" {
  const content: string;
  export default content;
}

declare module "*.yaml?raw" {
  const content: string;
  export default content;
}
