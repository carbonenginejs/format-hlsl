import test from "node:test";
import assert from "node:assert/strict";

import { CjsFormatHlsl } from "../src/index.js";
import {
    buildEffectBodyReflection,
    EFFECT_BODY_REFLECTION_FORMAT,
    EFFECT_BODY_REFLECTION_VERSION,
    readEffectBodyReflection,
    validateEffectBodyReflection
} from "@carbonenginejs/format-hlsl/portable";
import {
    buildEffectBytes,
    buildPortableReflectionEffectBytes
} from "./synthetic.js";

test("portable reflection preserves complete authored body data without runtime handles", () =>
{
    const bytes = buildPortableReflectionEffectBytes();
    const effectRes = CjsFormatHlsl.read(bytes, {
        emit: CjsFormatHlsl.OUTPUT_RAW,
        source: "portable.sm_depth"
    });
    const shader = effectRes.GetShaderByIndex(0);
    const stageInput = shader.GetEffectDescription()
        .techniques[0].passes[0].stageInputs[0];
    const reflection = buildEffectBodyReflection(effectRes, 0);
    const counts = validateEffectBodyReflection(reflection);
    const legacyJson = shader.toJSON();

    assert.equal(reflection.format, EFFECT_BODY_REFLECTION_FORMAT);
    assert.equal(reflection.formatVersion, EFFECT_BODY_REFLECTION_VERSION);
    assert.equal(reflection.mode, "single-body");
    assert.equal(reflection.keyScope, "body-local");
    assert.equal(reflection.coverage.bodies, "single");
    assert.deepEqual(counts, {
        permutationIndex: 0,
        techniqueCount: 1,
        passCount: 1,
        stageCount: 1,
        libraryCount: 1,
        sourceProgramCount: 2
    });
    assert.equal(reflection.source.effectVersion, 15);
    assert.equal(reflection.source.compilerVersion, 77);
    assert.equal(reflection.source.label, "portable.sm_depth");
    assert.equal(reflection.source.stringTableByteLength > 0, true);
    assert.equal(reflection.source.byteLength, bytes.byteLength);
    assert.equal(reflection.sourceRecord.byteLength > 0, true);
    assert.deepEqual(Array.from(reflection.source.nativeHash), Array.from({ length: 32 }, (_, index) => index));

    const technique = reflection.effect.techniques[0];
    const pass = technique.passes[0];
    const stage = pass.stages[0];
    assert.equal(technique.key, "technique0");
    assert.equal(pass.key, "technique0.pass0");
    assert.equal(stage.key, "technique0.pass0.stage0");
    assert.deepEqual(pass.renderStates, [
        { state: 22, value: 3 },
        { state: 175, value: 0x3f800000 }
    ]);
    assert.deepEqual(Array.from(stage.sourceProgram.bytes), [ 0x44, 0x58, 0x42, 0x43 ]);
    assert.equal(stage.sourceProgram.kind, "stage");
    assert.deepEqual(stage.input.constantDefaults, {
        declaredByteLength: 4,
        bytes: new Uint8Array([ 1, 2, 3, 4 ])
    });
    assert.equal(stageInput.sourceConstantValueSize, 4);
    assert.deepEqual(Array.from(stageInput.sourceConstantValues), [ 1, 2, 3, 4 ]);
    assert.equal(stageInput.m_constantValueSize, 12);
    assert.deepEqual(Array.from(stageInput.constantValues), [
        1, 2, 3, 4, 0, 0, 0, 0, 0, 0, 0, 0
    ]);
    assert.equal(stage.input.samplers[0].descriptor.mipLODBiasRaw, 0x80000000);
    assert.deepEqual(stage.input.samplers[0].descriptor.borderColorRaw, [
        0,
        0x3f800000,
        0x40000000,
        0x40400000
    ]);
    assert.equal(stage.input.signature.staticSamplers[0].descriptor.borderColor, 3);
    assert.equal(stage.input.annotations[0].rawValue, 0x7fc01234);
    assert.deepEqual(
        reflection.effect.annotations[0].annotations,
        [
            { name: "Enabled", type: 0, rawValue: 1 },
            { name: "Count", type: 1, rawValue: 0xffffffff },
            { name: "Weight", type: 2, rawValue: 0x7fc01234 },
            { name: "Label", type: 3, stringValue: "hello" }
        ]
    );
    assert.deepEqual(
        Array.from(technique.libraries[0].sourceProgram.bytes),
        [ 9, 8, 7, 6 ]
    );
    assert.equal(technique.libraries[0].sourceProgram.kind, "library");
    assert.equal(Object.hasOwn(technique.libraries[0].sourceProgram, "stageType"), false);
    assert.equal(Object.hasOwn(reflection.effect, "name"), false);
    assert.equal(Object.hasOwn(pass, "renderStatesHandle"), false);
    assert.equal(Object.hasOwn(stage, "shaderHandle"), false);
    assert.equal(Object.hasOwn(technique.libraries[0], "libraryHandle"), false);
    const legacyStageInput = legacyJson.effect.techniques[0]
        .passes[0].stageInputs[0];
    const legacyLibrary = legacyJson.effect.techniques[0].libraries[0];
    assert.equal(Object.hasOwn(legacyStageInput, "sourceConstantValueSize"), false);
    assert.equal(Object.hasOwn(legacyStageInput, "sourceConstantValues"), false);
    assert.equal(Object.hasOwn(legacyLibrary, "cjsShaderBytecode"), false);
});

test("exact body-index decoding bypasses global options and owns returned bytes", () =>
{
    const sourceBytes = buildPortableReflectionEffectBytes();
    const effectRes = CjsFormatHlsl.read(sourceBytes, {
        emit: CjsFormatHlsl.OUTPUT_RAW
    });
    sourceBytes.fill(0);
    const globals = effectRes.constructor.globalEffectOptions;
    const previous = globals.slice();
    globals.splice(0, globals.length, { name: "AXIS", value: "B" });

    try
    {
        const globalShader = effectRes.GetShader();
        const exactShader = effectRes.GetShaderByIndex(0);
        assert.equal(effectRes.m_shaders.get(1), globalShader);
        assert.equal(effectRes.m_shaders.get(0), exactShader);
        assert.notEqual(globalShader, exactShader);

        const reflection = buildEffectBodyReflection(effectRes, 0);
        const sourceStage = exactShader.GetEffectDescription()
            .techniques[0].passes[0].stageInputs[0];
        reflection.effect.techniques[0].passes[0].stages[0]
            .input.constantDefaults.bytes[0] = 99;
        reflection.effect.techniques[0].passes[0].stages[0]
            .sourceProgram.bytes[0] = 99;
        reflection.source.nativeHash[0] = 99;
        sourceStage.constantValues[0] = 77;

        const rebuilt = buildEffectBodyReflection(effectRes, 0);
        const rebuiltStage = rebuilt.effect.techniques[0].passes[0].stages[0];
        assert.deepEqual(Array.from(rebuiltStage.input.constantDefaults.bytes), [ 1, 2, 3, 4 ]);
        assert.deepEqual(Array.from(rebuiltStage.sourceProgram.bytes), [ 0x44, 0x58, 0x42, 0x43 ]);
        assert.equal(rebuilt.source.nativeHash[0], 0);
    }
    finally
    {
        globals.splice(0, globals.length, ...previous);
    }
});

test("portable one-shot selection and validator fail closed", () =>
{
    const bytes = buildPortableReflectionEffectBytes();
    const reflection = readEffectBodyReflection(bytes, {
        source: "portable.sm_depth",
        permutationIndex: 1
    });

    assert.equal(reflection.permutationIndex, 1);
    assert.throws(
        () => readEffectBodyReflection(bytes, { permutationIndex: 2 }),
        /body index 2 is unavailable/u
    );
    const malformed = structuredClone(reflection);
    malformed.effect.techniques[0].passes[0].stages[0]
        .input.constantDefaults.declaredByteLength = 5;
    assert.throws(
        () => validateEffectBodyReflection(malformed),
        /constant defaults are invalid/u
    );
    const withRootHandle = structuredClone(reflection);
    withRootHandle.backendLayout = {};
    assert.throws(
        () => validateEffectBodyReflection(withRootHandle),
        /unsupported or missing fields/u
    );
    const withStageHandle = structuredClone(reflection);
    withStageHandle.effect.techniques[0].passes[0].stages[0].shaderHandle = {};
    assert.throws(
        () => validateEffectBodyReflection(withStageHandle),
        /unsupported or missing fields/u
    );
    const withInputHandle = structuredClone(reflection);
    withInputHandle.effect.techniques[0].passes[0].stages[0]
        .input.resourceSetDesc = {};
    assert.throws(
        () => validateEffectBodyReflection(withInputHandle),
        /unsupported or missing fields/u
    );
    const withLibraryHandle = structuredClone(reflection);
    withLibraryHandle.effect.techniques[0].libraries[0].libraryHandle = {};
    assert.throws(
        () => validateEffectBodyReflection(withLibraryHandle),
        /unsupported or missing fields/u
    );
    const withInvalidSamplerIdentity = structuredClone(reflection);
    const invalidSampler = withInvalidSamplerIdentity.effect.techniques[0]
        .passes[0].stages[0].input.samplers[0];
    invalidSampler.isDynamic = false;
    invalidSampler.name = "SamplerHeap";
    assert.throws(
        () => validateEffectBodyReflection(withInvalidSamplerIdentity),
        /samplers entry is malformed/u
    );
    const withOverlappingRegisters = structuredClone(reflection);
    const overlappingSignature = withOverlappingRegisters.effect.techniques[0]
        .passes[0].stages[0].input.signature;
    overlappingSignature.registers.push({
        registerType: 32,
        registerIndex: 4,
        arrayCount: 2,
        registerCount: 2,
        registerSpace: 0
    }, {
        registerType: 33,
        registerIndex: 5,
        arrayCount: 1,
        registerCount: 1,
        registerSpace: 0
    });
    overlappingSignature.registerCount += 2;
    assert.throws(
        () => validateEffectBodyReflection(withOverlappingRegisters),
        /signature register range overlaps/u
    );
    const withMapMismatch = structuredClone(reflection);
    const mismatchedInput = withMapMismatch.effect.techniques[0]
        .passes[0].stages[0].input;
    mismatchedInput.resources.push({
        registerIndex: 7,
        name: "Mismatch",
        type: 2,
        arrayElements: 2,
        isSRGB: false,
        isAutoregister: false
    });
    mismatchedInput.resourceCount += 1;
    mismatchedInput.signature.registers.push({
        registerType: 32,
        registerIndex: 7,
        arrayCount: 1,
        registerCount: 1,
        registerSpace: 0
    });
    mismatchedInput.signature.registerCount += 1;
    assert.throws(
        () => validateEffectBodyReflection(withMapMismatch),
        /resource.*map disagrees with its signature/u
    );
    const withInvalidProgramOffset = structuredClone(reflection);
    withInvalidProgramOffset.effect.techniques[0].passes[0].stages[0]
        .sourceProgram.stringTableOffset =
        withInvalidProgramOffset.source.stringTableByteLength;
    assert.throws(
        () => validateEffectBodyReflection(withInvalidProgramOffset),
        /outside the shared string table/u
    );
    const withWideMapRegister = structuredClone(reflection);
    withWideMapRegister.effect.techniques[0].passes[0].stages[0]
        .input.samplers[0].registerIndex = 0xffffffff;
    assert.throws(
        () => validateEffectBodyReflection(withWideMapRegister),
        /registerIndex must fit uint8/u
    );
    assert.throws(
        () => readEffectBodyReflection(buildEffectBytes({ version: 8 })),
        /requires source effect version 15/u
    );
});
