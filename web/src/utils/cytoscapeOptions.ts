/**
 * Opzioni di rendering Cytoscape condivise.
 * Firefox (Gecko) con `pixelRatio: "auto"` spesso lascia il canvas bianco
 * (DPR / zoom pagina); su Chrome funziona. Vedi cytoscape.js#372.
 */
export function cytoscapeRenderOptions(): {
  textureOnViewport: false;
  motionBlur: false;
  pixelRatio: 1 | "auto";
} {
  const isFirefox =
    typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent);
  return {
    textureOnViewport: false,
    motionBlur: false,
    pixelRatio: isFirefox ? 1 : "auto",
  };
}

export function isFirefoxBrowser(): boolean {
  return typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent);
}
