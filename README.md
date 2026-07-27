# @carbonenginejs/format-hlsl

Pure-JavaScript reader for Carbon/Trinity compiled effect containers.

Use this package to inspect permutation axes, techniques, passes, shader-stage
metadata, render states, and signatures in `.sm_hi`, `.sm_lo`, and
`.sm_depth` payloads. Embedded shader bytecode remains opaque; instruction
decoding belongs in a bytecode-format package such as
`@carbonenginejs/format-dxbc`.

## Install

```sh
npm install @carbonenginejs/format-hlsl
```

## Quick start

```js
import CjsFormatHlsl from "@carbonenginejs/format-hlsl";

const summary = CjsFormatHlsl.inspect(bytes);
const effect = CjsFormatHlsl.read(bytes);
const metadata = CjsFormatHlsl.read(bytes, { emit: "metadata" });
```

`read` emits the documented JSON graph by default. Use `metadata` when
bytecode and constant-value bytes are not needed, or select a permutation:

```js
const effect = CjsFormatHlsl.read(bytes, {
    permutation: [
        { name: "BLEND_MODE", value: "TRANSPARENT" }
    ]
});
```

Backend effect packagers that need complete source reflection for exact
version-15 bodies can use the versioned portable subpath:

```js
import {
    buildEffectBodyReflection,
    enumerateUniqueEffectBodies,
    readEffectBodyReflection
} from "@carbonenginejs/format-hlsl/portable";

const reflection = readEffectBodyReflection(bytes, {
    permutationIndex: 0
});

const effectRes = CjsFormatHlsl.read(bytes, {
    emit: CjsFormatHlsl.OUTPUT_RAW
});
const allUniqueBodies = enumerateUniqueEffectBodies(effectRes).map((body) =>
    buildEffectBodyReflection(effectRes, body.permutationIndex));
```

This contract owns copies of authored constant-default and source-program
bytes. The inventory groups exact raw aliases before decoding, and portable
builds always decode afresh from the owned source rather than trusting mutable
parser caches. It excludes renderer handles and other realized state.

Node callers can also use `CjsFormatHlsl.readFile(path)` or the included CLI:

```sh
format-hlsl metadata effect.sm_hi effect.json
```

## Documentation

- [Package documentation](docs/README.md)
- [Architecture](docs/architecture.md)
- [Reading effects](docs/guides/reading-effects.md)
- [API reference](docs/reference/api.md)
- [JSON graph reference](docs/reference/json-graph.md)
- [Portable body reflection](docs/reference/portable-reflection.md)

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

This project is not affiliated with or endorsed by CCP Games. It contains an
original implementation informed by interoperability research; no CCP Games
source code is included.
