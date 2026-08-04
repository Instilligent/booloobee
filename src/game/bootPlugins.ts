import { installProgression } from "./installProgression";
import { installVisualUpgrades } from "./visualUpgrades";
import { installDemandAndVariety } from "./demandAndVariety";
import { installStationsClarity } from "./stationsClarity";

/** One call from GameApp — keeps GameApp diff tiny. */
export function installAllGamePlugins(eng: any) {
  installProgression(eng);
  installVisualUpgrades(eng);
  installDemandAndVariety(eng);
  installStationsClarity(eng);
}
