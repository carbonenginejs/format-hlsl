import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CjsHlslReader } from "../src/index.js";

/**
 * Optional corpus sweep: parses every `.sm_hi` compiled effect file found
 * under a local directory of EVE Online effect assets. Not part of the
 * baseline checks; game assets are never committed (org rule). Enable with:
 *   HLSL_CORPUS_DIR=path/to/effect.dx11 npm test
 * or a gitignored corpus.local.json: { "corpusDir": "path/to/effect.dx11" }
 */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveCorpusDir()
{
    if (process.env.HLSL_CORPUS_DIR) return process.env.HLSL_CORPUS_DIR;
    const local = path.join(projectRoot, "corpus.local.json");
    if (existsSync(local))
    {
        try
        {
            return JSON.parse(readFileSync(local, "utf8")).corpusDir || null;
        }
        catch
        {
            return null;
        }
    }
    return null;
}

async function* walk(dir)
{
    for (const entry of await readdir(dir, { withFileTypes: true }))
    {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(entryPath);
        else if (entry.name.toLowerCase().endsWith(".sm_hi")) yield entryPath;
    }
}

const corpusDir = resolveCorpusDir();

test(
    "corpus sweep parses every .sm_hi effect container",
    { skip: corpusDir ? false : "set HLSL_CORPUS_DIR or corpus.local.json { corpusDir } to run the corpus sweep" },
    async () =>
    {
        assert.ok((await stat(corpusDir)).isDirectory(), `corpus dir not found: ${corpusDir}`);

        let files = 0;
        let permutations = 0;
        let techniques = 0;
        let quadv5Techniques = null;
        const failures = [];

        for await (const filePath of walk(corpusDir))
        {
            files += 1;
            const bytes = new Uint8Array(await readFile(filePath));
            try
            {
                // Default emit: "json" — the documented plain effect graph.
                const result = CjsHlslReader.read(bytes, { source: filePath });
                permutations += result.permutations.length;

                if (result.effect)
                {
                    const names = result.effect.techniques.map((technique) => technique.name);
                    techniques += names.length;
                    if (path.basename(filePath).toLowerCase() === "quadv5.sm_hi") quadv5Techniques = names;
                }
            }
            catch (error)
            {
                failures.push({ filePath, message: error.message });
            }
        }

        console.log(`corpus: ${files} .sm_hi files, ${permutations} permutation axes, ${techniques} techniques decoded`);
        assert.ok(files > 0, "no .sm_hi files found under the corpus dir");
        assert.deepEqual(failures.slice(0, 5), [], `${failures.length} parse failures`);
        assert.ok(permutations > 0, "no permutation axes decoded across the corpus");
        assert.ok(techniques > 0, "no techniques decoded across the corpus");

        if (quadv5Techniques)
        {
            assert.deepEqual(quadv5Techniques, [ "Main", "Depth", "Picking", "Shadow", "DynamicLightShadow" ]);
        }
    }
);
