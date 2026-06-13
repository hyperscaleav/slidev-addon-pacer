import { defineAppSetup } from "@slidev/types";
import BreakDemo from "../components/BreakDemo.vue";

// Register BreakDemo globally so the pacer addon can mount it by name
// (`pacer.breakComponent: BreakDemo`) during a break. See the addon README:
// breakComponent must be a globally-registered component, which Slidev's
// per-file auto-import does not provide for a dynamic `<component :is>`.
export default defineAppSetup(({ app }) => {
  app.component("BreakDemo", BreakDemo);
});
