# API reference

Status: Evolving
Scope: `@carbonenginejs/format-hlsl` supported reader API
Audience: Users and integrators
Summary: Documents the reader class, options, output modes, and Node adapters.

## Imports

The package root exports `CjsFormatHlsl` as both the default and a named
export:

```js
import CjsFormatHlsl from "@carbonenginejs/format-hlsl";
import { CjsFormatHlsl as NamedReader } from "@carbonenginejs/format-hlsl";
```

Additional named exports intended for advanced tooling are documented
separately in [advanced-analysis.md](advanced-analysis.md).

## Constructor

```js
const reader = new CjsFormatHlsl({
    emit: "json",
    source: "effect.sm_hi",
    permutation: null,
    classes: {}
});
```

Options are reusable on an instance and can be overridden per call:

- `emit`: `"json"` (default), `"metadata"`, or advanced `"raw"` output.
- `source`: a caller-supplied label used in diagnostics and output.
- `permutation`: a `Map` or an array of `{ name, value }` selections.
- `classes`: constructors used to hydrate supported JSON node kinds.

## Instance methods

- `SetValues(options)` updates the reusable profile and returns the reader.
- `GetValues(options)` returns effective values with optional overrides.
- `SetClasses(classes)` and `SetClass(type, Class)` configure hydration.
- `GetClass(type)` and `HasClass(type)` inspect hydration registrations.
- `Read(input, options)` parses input and emits the configured graph.
- `Inspect(input, options)` returns header and technique summary data.
- `ToJSON(value)` converts reader output to JSON-compatible data.

## Static methods

- `CjsFormatHlsl.isSupported(input)` performs a header-level support check.
- `CjsFormatHlsl.read(input, options)` performs a one-shot read.
- `CjsFormatHlsl.inspect(input, options)` performs a one-shot inspection.
- `CjsFormatHlsl.toJSON(value)` converts output to JSON-compatible data.
- `CjsFormatHlsl.readFile(path, options)` reads and parses a file in Node.

Inputs may be `Uint8Array`, `ArrayBuffer`, `Buffer`, or `DataView` values.
Supported container versions are 8 through 15.

## Constants

The class exposes `OUTPUT_JSON`, `OUTPUT_METADATA`, `OUTPUT_RAW`,
`CLASS_KEYS`, `type`, `mediaTypes`, `inputTypes`, `outputTypes`, and
`debugOutputTypes`. `inputTypes` contains `sm_hi`, `sm_lo`, and `sm_depth`.

## Output stability

The `json` and `metadata` modes are the supported data contracts described in
[json-graph.md](json-graph.md). `raw` returns internal `Tr2EffectRes` objects
for specialized callers and may change without a major version bump.

## CLI

The package installs a Node CLI that writes metadata JSON:

```sh
format-hlsl metadata effect.sm_hi
format-hlsl metadata effect.sm_hi effect.json
```

When the output path is omitted, the CLI writes `<input-name>.json` in the
current working directory.

## Related documentation

- [Reading effects](../guides/reading-effects.md)
- [Hydrating JSON output](../guides/hydrating-json-output.md)
- [Advanced analysis exports](advanced-analysis.md)
- [Class catalog](classes/README.md)
