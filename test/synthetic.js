/**
 * Synthetic Tr2 effect container builders for self-contained tests.
 *
 * Layout mirrors src/carbon/trinity/resources/Tr2EffectRes.js#DoLoad: the
 * tests must run without any game assets (org rule), so a minimal effect
 * header (and, optionally, permutation axes and zero-length shader bodies)
 * is assembled here from the documented field order.
 */

const textEncoder = new TextEncoder();

/**
 * Small append-only little-endian byte writer.
 */
class ByteWriter
{

    constructor()
    {
        this.chunks = [];
        this.length = 0;
    }

    u8(value)
    {
        return this._push(Uint8Array.of(value & 0xff));
    }

    u32(value)
    {
        const bytes = new Uint8Array(4);
        new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
        return this._push(bytes);
    }

    raw(bytes)
    {
        return this._push(bytes);
    }

    toBytes()
    {
        const out = new Uint8Array(this.length);
        let offset = 0;
        for (const chunk of this.chunks)
        {
            out.set(chunk, offset);
            offset += chunk.length;
        }
        return out;
    }

    _push(bytes)
    {
        this.chunks.push(bytes);
        this.length += bytes.length;
        return this;
    }

}

/**
 * Builds a null-terminated UTF-8 string table and records each string's
 * byte offset for use in permutation records.
 *
 * @param {string[]} strings Strings to place in the table (in order, deduped).
 * @returns {{bytes: Uint8Array, offsets: Map<string, number>}} Table bytes and offsets.
 */
function buildStringTable(strings)
{
    const writer = new ByteWriter();
    const offsets = new Map();
    for (const value of strings)
    {
        if (offsets.has(value)) continue;
        offsets.set(value, writer.length);
        writer.raw(textEncoder.encode(value));
        writer.u8(0);
    }
    return { bytes: writer.toBytes(), offsets };
}

/**
 * Builds a synthetic Tr2 effect container: header, string table, optional
 * permutation axes, and one or more compiled-body offset records.
 *
 * @param {object} [options] Effect shape.
 * @param {number} [options.version] Effect data version (8..15 supported).
 * @param {Array<object>} [options.permutations] Permutation axis descriptions.
 * @param {Array<{size?: number, bytes?: Uint8Array}>} [options.bodies] Compiled-body byte ranges.
 * @returns {Uint8Array} Synthetic effect container bytes.
 */
export function buildEffectBytes(options = {})
{
    const version = Number.isInteger(options.version) ? options.version : 8;
    const permutations = options.permutations || [];
    const bodies = options.bodies || [ { size: 0 } ];

    const strings = [];
    for (const permutation of permutations)
    {
        strings.push(permutation.name || "", permutation.description || "");
        for (const option of permutation.options || []) strings.push(option);
    }
    const table = buildStringTable(strings);

    const writer = new ByteWriter();
    writer.u32(version);
    if (version >= 15)
    {
        writer.u32(0);
        writer.raw(new Uint8Array(32));
    }

    writer.u32(table.bytes.length);
    writer.raw(table.bytes);

    writer.u8(permutations.length);
    for (const permutation of permutations)
    {
        writer.u32(table.offsets.get(permutation.name || ""));
        writer.u8(permutation.defaultOption || 0);
        writer.u32(table.offsets.get(permutation.description || ""));
        if (version > 5) writer.u8(permutation.type || 0);
        const permOptions = permutation.options || [];
        writer.u8(permOptions.length);
        for (const option of permOptions) writer.u32(table.offsets.get(option));
    }

    const RECORD_SIZE = 12;
    const offsetTableSize = 4 + bodies.length * RECORD_SIZE;
    let bodyCursor = writer.length + offsetTableSize;

    const records = bodies.map((body, index) =>
    {
        const size = Number.isInteger(body.size) ? body.size : (body.bytes ? body.bytes.length : 0);
        const record = { index, offset: bodyCursor, size };
        bodyCursor += size;
        return record;
    });

    writer.u32(bodies.length);
    for (const record of records)
    {
        writer.u32(record.index);
        writer.u32(record.offset);
        writer.u32(record.size);
    }
    for (let index = 0; index < bodies.length; index += 1)
    {
        const body = bodies[index];
        const size = records[index].size;
        writer.raw(body.bytes || new Uint8Array(size));
    }

    return writer.toBytes();
}
