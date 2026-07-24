# Package documentation

Status: Evolving
Scope: `@carbonenginejs/format-hlsl`
Audience: Users and integrators
Summary: Documentation home for the compiled Carbon/Trinity effect-container reader.

## Purpose

`@carbonenginejs/format-hlsl` reads versions 8 through 15 of the compiled
effect container used by Carbon/Trinity. It resolves a permutation and exposes
techniques, passes, stage metadata, render states, signatures, and opaque
shader bytecode as JavaScript data.

```js
import CjsFormatHlsl from "@carbonenginejs/format-hlsl";

const metadata = CjsFormatHlsl.read(bytes, {
    emit: "metadata"
});
```

## Where it fits

- Use this package for the effect container and its metadata.
- Use `@carbonenginejs/format-dxbc` to decode supported embedded Direct3D
  shader bytecode.
- Translation backends such as `@carbonenginejs/format-webgpu` can consume
  the metadata and bytecode through their own integration layers.

The package does not compile HLSL source, translate shader instructions, or
provide a rendering runtime.

## Start here

- [Architecture](architecture.md)
- [Reading effects](guides/reading-effects.md)
- [Hydrating JSON output](guides/hydrating-json-output.md)
- [API reference](reference/api.md)
- [Advanced analysis exports](reference/advanced-analysis.md)
- [JSON graph reference](reference/json-graph.md)
- [Class catalog](reference/classes/README.md)

## Compatibility

Supported input types are `.sm_hi`, `.sm_lo`, and `.sm_depth` compiled effect
bodies. Unsupported headers, invalid offsets, truncated data, and invalid
permutation selections fail with an error rather than returning a partial
success value.
