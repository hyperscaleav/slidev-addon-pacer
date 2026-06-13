import BreakDemo from "../components/BreakDemo.vue";

// Register BreakDemo globally so the pacer addon can mount it by name
// (`pacer.breakComponent: BreakDemo`) during a break. breakComponent must be a
// globally-registered component, which Slidev's per-file auto-import does not
// provide for a dynamic `<component :is>`. Plain default-export function (the
// same shape defineAppSetup wraps) so the example carries no @slidev/types dep
// — the standalone addon repo doesn't install it.
export default function ({ app }) {
  app.component("BreakDemo", BreakDemo);
}
