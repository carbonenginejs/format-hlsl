import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { buildEffectBytes } from "./synthetic.js";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../bin/format-hlsl.js", import.meta.url));

test("metadata CLI writes default JSON output in the working directory", async () =>
{
    const dir = await mkdtemp(path.join(tmpdir(), "format-hlsl-cli-"));
    const inputPath = path.join(dir, "fixture.fx11");
    const outputPath = path.join(dir, "fixture.json");

    try
    {
        await writeFile(inputPath, buildEffectBytes({
            permutations: [ {
                name: "QUALITY",
                description: "Quality selector",
                defaultOption: 0,
                options: [ "LOW", "HIGH" ]
            } ]
        }));

        const { stdout } = await execFileAsync(process.execPath, [
            cliPath,
            "metadata",
            inputPath
        ], { cwd: dir });

        assert.equal(stdout.trim(), outputPath);

        const metadata = JSON.parse(await readFile(outputPath, "utf8"));
        assert.equal(metadata.version, 8);
        assert.equal(metadata.bodyIndex, 0);
        assert.deepEqual(metadata.permutations[0].options, [ "LOW", "HIGH" ]);
        assert.deepEqual(metadata.selectedOptions.map((entry) => entry.value), [ "LOW" ]);
    }
    finally
    {
        await rm(dir, { recursive: true, force: true });
    }
});
