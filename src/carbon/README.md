# Package-local Carbon compatibility models

This directory contains the binary utilities and Carbon-shaped records used
inside `@carbonenginejs/format-hlsl`.

These classes support the compiled effect reader. They are not independent
package entry points, and direct imports from this directory are not a stable
public API. The supported package boundary is `CjsFormatHlsl`; explicitly
exported advanced helpers are documented under `docs/reference`.

Names and shapes that mirror Carbon/Trinity concepts preserve their
interoperability provenance. The implementations are original
CarbonEngineJS code and do not imply affiliation with or endorsement by CCP
Games.
