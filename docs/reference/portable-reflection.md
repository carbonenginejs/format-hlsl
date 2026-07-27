# Portable body reflection

Status: Evolving
Scope: `@carbonenginejs/format-hlsl/portable`
Audience: Backend effect-packager authors
Summary: Defines exact, handle-free reflection for one compiled effect body.

## Purpose

The ordinary JSON and metadata modes describe one option-selected effect for
inspection. Backend package builders need a stronger boundary: exact
permutation-table selection, authored constant defaults, source programs, and
all reflection fields without renderer handles.

The portable subpath supplies that boundary:

```js
import {
    buildEffectBodyReflection,
    readEffectBodyReflection,
    validateEffectBodyReflection
} from "@carbonenginejs/format-hlsl/portable";

const document = readEffectBodyReflection(bytes, {
    source: "effect.sm_depth",
    permutationIndex: 4
});

validateEffectBodyReflection(document);
```

`buildEffectBodyReflection(effectRes, permutationIndex)` accepts an already
loaded raw `Tr2EffectRes`. This avoids reparsing when a backend builder already
uses `readEffectAnalysis`.

## Contract

Version 1 accepts compiled effect version 15 only. Earlier container versions
synthesize or normalize several signature fields while reading; rejecting them
keeps every portable field source-exact.

The root identifies `CJS_EFFECT_BODY_REFLECTION` version 1,
`mode: "single-body"`, `keyScope: "body-local"`,
`coverage.bodies: "single"`, the diagnostic source label and
compiled-effect version/compiler/shared-table/source envelope in `source`, the exact
`permutationIndex`, and its
`sourceRecord.offset` / `sourceRecord.byteLength` span. Its effect graph
preserves:

- ordered parameter annotation groups;
- ordered techniques, passes, raw render-state pairs, and libraries;
- every present vertex, pixel, compute, geometry, hull, or domain stage;
- constant, resource, UAV, dynamic sampler, and stage-annotation metadata;
- complete pipeline-input, register, static-sampler, and thread-group
  signatures;
- exact authored constant-default bytes and declared length; and
- owned copies of every stage and library source-program payload.

Every source-program record retains its exact shared-table offset. The
validator requires its complete byte range to remain within
`source.stringTableByteLength`.
Stage programs are explicitly `kind: "stage"` and carry their authored stage
identity. DXR library programs are `kind: "library"` and deliberately carry no
synthetic compute-stage identity.

Numeric BOOL, INT, and FLOAT annotations retain their exact serialized
`rawValue`. Sampler floats retain raw IEEE-754 bits. Static sampler border
colors remain their source enum byte; dynamic sampler border colors remain
four float bit patterns.

`source.nativeHash` is the compiler-provided v15 hash field, not a package
content digest. The backend package must independently hash its whole source
and body payloads.

The compiled body has no authored effect-name field. The caller-supplied
diagnostic name or path is retained only as `source.label`.

The serializer rejects defaults or constant extents beyond Carbon's 4,096-byte
stage constant-buffer limit.

## Source truth and realization

The portable document excludes shader, program, render-state, sampler, and
library handles. It also excludes resource-set descriptions, heap-view arrays,
backend layouts, masks, sort values, and caches. Those are engine-owned
realization or deterministic derived state.

Register dynamic classification is not persisted. It depends on per-frame
reader/engine policy and is not an authored binary field.

Authored constant defaults are separate from the raw model's mutable
`constantValues`. Carbon-compatible sampler-heap realization may zero-extend
the latter; it cannot change the portable source prefix.

## Selection and completeness

`GetShaderByIndex(index)` and the portable serializer bypass global and local
option selection. This makes a body-table index stable even when an application
has global effect options.

Version 1 describes one complete listed body. Body-local technique, pass,
stage, and library keys must be namespaced by a backend package before they are
flattened across bodies. This document does not claim that a backend package
contains every permutation body or a program for every body. A backend
container must reconcile all three of `permutationIndex`,
`sourceRecord.offset`, and `sourceRecord.byteLength` with its own body identity
and permutation graph, then reconcile the source byte length and native hash
before claiming completeness.

## Related documentation

- [JSON and metadata graphs](json-graph.md)
- [Advanced analysis exports](advanced-analysis.md)
- [Architecture](../architecture.md)
