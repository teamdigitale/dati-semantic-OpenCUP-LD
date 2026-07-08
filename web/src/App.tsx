import { HashRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Mappature } from "./pages/Mappature";
import { Grafi } from "./pages/Grafi";
import { Unione } from "./pages/Unione";
import { UnioneAnimazione } from "./pages/UnioneAnimazione";
import { Analisi } from "./pages/Analisi";

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="mappature" element={<Mappature />} />
          <Route path="grafi" element={<Grafi />} />
          <Route path="unione" element={<Unione />} />
          <Route path="unione/animazione" element={<UnioneAnimazione />} />
          <Route path="analisi" element={<Analisi />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
