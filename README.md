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

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

This project is not affiliated with or endorsed by CCP Games. It contains an
original implementation informed by interoperability research; no CCP Games
source code is included.
