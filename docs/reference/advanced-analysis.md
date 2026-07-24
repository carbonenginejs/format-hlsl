# Advanced analysis exports

Status: Experimental
Scope: `@carbonenginejs/format-hlsl` advanced named exports
Audience: Translation-tool authors and maintainers
Summary: Documents unstable helpers for raw graph analysis and binding-manifest construction.

## Stability

These exports support translation and inspection tooling that needs internal
effect-model objects. Their shapes may change without a major version bump.
Use `CjsFormatHlsl.read(..., { emit: "json" })` or `"metadata"` for the
supported data contracts.

## `readEffectAnalysis`

```js
import { readEffectAnalysis } from "@carbonenginejs/format-hlsl";

const analysis = readEffectAnalysis(bytes, {
    source: "effect.sm_hi",
    permutation: [
        { name: "BLEND_MODE", value: "TRANSPARENT" }
    ]
});
```

The result contains the loaded effect resource, resolved shader, selected
option and body-index data, effect description, and a binding manifest when
an effect description is available.

## `Tr2EffectBindingManifest`

`Tr2EffectBindingManifest` is an exported advanced class that derives
register-named constant, resource, sampler, and UAV bindings from an internal
effect description.

```js
import {
    readEffectAnalysis,
    Tr2EffectBindingManifest
} from "@carbonenginejs/format-hlsl";

const analysis = readEffectAnalysis(bytes);
analysis.bindingManifest instanceof Tr2EffectBindingManifest;
```

## Render-context helpers

`Tr2RenderContextEnum` contains the format's stage and render-context numeric
constants. `tr2ShaderStageName(value)` maps a known stage value to its
readable name. Both are advanced compatibility helpers rather than a stable
cross-package enumeration contract.
