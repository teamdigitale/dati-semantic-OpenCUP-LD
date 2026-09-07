import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Legge ?cup= (HashRouter) e lo applica se è tra i CUP campione. */
export function useCupQueryParam(
  sampleCups: string[],
  activeCup: string,
  setActiveCup: (cup: string) => void
) {
  const location = useLocation();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!sampleCups.length) return;
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get("cup");
    if (fromQuery && sampleCups.includes(fromQuery)) {
      setActiveCup(fromQuery);
    } else if (!activeCup) {
      setActiveCup(sampleCups[0]);
    }
    setReady(true);
  }, [sampleCups, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectCup = (cup: string) => {
    setActiveCup(cup);
    const params = new URLSearchParams(location.search);
    params.set("cup", cup);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  return { ready, selectCup };
}
