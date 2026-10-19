/**
 * Opzioni di rendering Cytoscape condivise.
 *
 * Su Firefox il canvas resta spesso bianco con `pixelRatio: "auto"`
 * (DPR / zoom pagina — cytoscape.js#372). Usiamo sempre 1: un po’
 * meno nitido su display retina, ma visibile su Chrome e Firefox.
 */
export function cytoscapeRenderOptions(): {
  textureOnViewport: false;
  motionBlur: false;
  pixelRatio: 1;
  hideEdgesOnViewport: false;
} {
  return {
    textureOnViewport: false,
    motionBlur: false,
    hideEdgesOnViewport: false,
    pixelRatio: 1,
  };
}
