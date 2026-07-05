import { CjsBinaryReader } from "../../../carbon/cjs/CjsBinaryReader.js";
import { cjsNormalizeBytes, cjsUint32ToFloat32 } from "../../../carbon/cjs/CjsBinaryUtils.js";
import { CjsRenderStateSetup } from "../../../carbon/cjs/CjsRenderStateSetup.js";
import { CjsResourceSetDescription } from "../../../carbon/cjs/CjsResourceSetDescription.js";
import { CjsShaderBytecode } from "../../../carbon/cjs/CjsShaderBytecode.js";
import {
    Tr2RenderContextEnum,
    Tr2UsageCodeNames,
    tr2ShaderStageName
} from "../Tr2RenderContextEnum.js";
import { Tr2EffectConstant } from "./Tr2EffectConstant.js";
import { Tr2EffectLibrary } from "./Tr2EffectLibrary.js";
import { Tr2EffectParameterAnnotation } from "./Tr2EffectParameterAnnotation.js";
import { Tr2EffectResource } from "./Tr2EffectResource.js";
import { Tr2EffectStageInput } from "./Tr2EffectStageInput.js";
import { Tr2EffectTechnique } from "./Tr2EffectTechnique.js";
import { Tr2Pass } from "./Tr2Pass.js";
import { Tr2SamplerDescription } from "./Tr2SamplerDescription.js";
import { Tr2SamplerSetup } from "./Tr2SamplerSetup.js";

export const DEFAULT_TECHNIQUE = "Main";
export const ANY_TECHNIQUE = "";

/**
 * Trinity effect-description body decoded from one compiled permutation record.
 */
export class Tr2EffectDescription 
{
    /**
   * Creates an empty decoded effect description.
   */
    constructor() 
    {
        this.techniques = [];
        this.annotations = new Map();
        this.version = 0;
        this.effectName = "";
        this.readError = null;
        this.effectStateManager = null;
    }

    /**
   * Reads a compiled effect body using the shared string table from `Tr2EffectRes`.
   *
   * @param {ArrayBuffer|ArrayBufferView|Uint8Array} data Effect body bytes.
   * @param {number} dataSize Valid byte size of the effect body.
   * @param {number} version Carbon effect data version.
   * @param {ArrayBuffer|ArrayBufferView|Uint8Array} stringTable Shared effect string table.
   * @param {number} stringTableSize Valid string-table byte count.
   * @param {string} effectName Source effect name or path.
   * @param {object} [options] Reader options and dependency overrides.
   * @returns {boolean} True when the body was decoded successfully.
   */
    Read(data, dataSize, version, stringTable, stringTableSize, effectName, options = {}) 
    {
        this.techniques = [];
        this.annotations = new Map();
        this.version = Number(version) || 0;
        this.effectName = effectName || "";
        this.readError = null;
        this.effectStateManager = options.effectStateManager || options.renderContext?.m_esm || null;

        try 
        {
            const bodyBytes = cjsNormalizeBytes(data).subarray(0, Number(dataSize) || 0);
            const tableBytes = cjsNormalizeBytes(stringTable).subarray(0, Number(stringTableSize) || 0);
            const stream = new CjsBinaryReader(bodyBytes, {
                stringTable: tableBytes,
                stringTableSize: tableBytes.length,
                source: effectName || "Tr2EffectDescription"
            });
            const context = createReadContext(options, this.effectStateManager);
            this.effectStateManager = context.effectStateManager;

            let techniqueCount = 1;
            if (version > 6) 
            {
                techniqueCount = stream.readUint8();
            }

            for (let techniqueIndex = 0; techniqueIndex < techniqueCount; techniqueIndex += 1) 
            {
                const technique = new Tr2EffectTechnique();
                technique.name = version > 6 ? stream.readString() : DEFAULT_TECHNIQUE;
                technique.shaderTypeMask = 0;

                const passCount = sanityCheck(stream.readUint8(), 64, "pass count");
                for (let passIndex = 0; passIndex < passCount; passIndex += 1) 
                {
                    const pass = readPass(stream, version, effectName || "", context);
                    technique.passes.push(pass);
                    technique.shaderTypeMask |= pass.shaderTypeMask;
                }

                if (version > 13) 
                {
                    const libraryCount = stream.readUint8();
                    for (let libraryIndex = 0; libraryIndex < libraryCount; libraryIndex += 1) 
                    {
                        technique.libraries.push(readLibrary(stream, version, context));
                    }
                }

                this.techniques.push(technique);
            }

            const parameterCount = sanityCheck(stream.readUint16(), 256, "parameter annotation count");
            for (let parameterIndex = 0; parameterIndex < parameterCount; parameterIndex += 1) 
            {
                const name = stream.readString();
                this.annotations.set(name, readAnnotations(stream));
            }

            applyHeapViewAnnotations(this, context);
            return true;
        }
        catch (error) 
        {
            this.readError = error;
            this.techniques = [];
            this.annotations = new Map();
            return false;
        }
    }

    /**
   * Returns a JSON-safe summary of decoded techniques and annotations.
   *
   * @returns {object} Serializable effect-description summary.
   */
    toJSON() 
    {
        return {
            version: this.version,
            effectName: this.effectName,
            techniques: this.techniques.map((entry) => entry.toJSON()),
            annotations: mapAnnotationToJson(this.annotations),
            readError: this.readError ? {
                name: this.readError.name,
                message: this.readError.message,
                details: this.readError.details || null
            } : null
        };
    }
}

/**
 * Builds the shared parser context used while reading one effect body.
 *
 * @param {object} options Reader options from `Read`.
 * @param {object|null} effectStateManager Effect-state registry override.
 * @returns {object} Parser context.
 */
function createReadContext(options, effectStateManager) 
{
    return {
        effectStateManager,
        perFrameVSStartRegister: Number.isInteger(options.perFrameVSStartRegister)
            ? options.perFrameVSStartRegister
            : null,
        perFramePSStartRegister: Number.isInteger(options.perFramePSStartRegister)
            ? options.perFramePSStartRegister
            : null
    };
}

/**
 * Reads one technique pass, including shader stages, signatures, resources, and states.
 *
 * @param {CjsBinaryReader} stream Binary reader positioned at a pass record.
 * @param {number} version Carbon effect data version.
 * @param {string} effectName Source effect name or path.
 * @param {object} context Shared parser context.
 * @returns {Tr2Pass} Decoded pass.
 */
function readPass(stream, version, effectName, context) 
{
    const pass = new Tr2Pass();
    const shaderTypes = [];
    const signatures = [];
    const shaderHandles = [];
    const stageCount = sanityCheck(stream.readUint8(), Tr2RenderContextEnum.SHADER_TYPE_COUNT, "stage count");

    for (let stageIndex = 0; stageIndex < stageCount; stageIndex += 1) 
    {
        const stageType = stream.readUint8();
        const stageInput = pass.stageInputs[stageType] || new Tr2EffectStageInput();
        pass.stageInputs[stageType] = stageInput;
        pass.shaderTypeMask |= 1 << stageType;
        stageInput.m_exists = true;

        if (version < 14) 
        {
            readPipelineInputs(stageInput.signature.pipelineInputs, stream, version);
            if (version > 8) 
            {
                readRegisters(stageInput.signature, stream, version, stageType, context);
            }
        }

        const shaderSize = stream.readUint32();
        let shaderBlob;
        if (version < 5) 
        {
            shaderBlob = {
                offset: null,
                bytes: stream.readRaw(shaderSize)
            };
            stream.readRaw(stream.readUint32());
        }
        else 
        {
            shaderBlob = stream.readTableBlob(shaderSize);
            if (version < 12) 
            {
                stream.readUint32();
                stream.readUint32();
            }
        }

        if (version >= 3) 
        {
            stageInput.signature.threadGroupSize = {
                x: stream.readUint32(),
                y: stream.readUint32(),
                z: stream.readUint32()
            };
        }

        if (version >= 14) 
        {
            readPipelineInputs(stageInput.signature.pipelineInputs, stream, version);
            readRegisters(stageInput.signature, stream, version, stageType, context);
        }

        readInput(stageInput, stream, version, stageType, context);

        const bytecode = new CjsShaderBytecode({
            stageType,
            stageName: tr2ShaderStageName(stageType),
            bytes: shaderBlob.bytes,
            shaderSize,
            stringTableOffset: shaderBlob.offset,
            effectName
        });
        stageInput.cjsShaderBytecode = bytecode;
        stageInput.m_shader = context.effectStateManager.RegisterShader(stageType, bytecode, stageInput.signature, effectName);
        shaderHandles[stageIndex] = stageInput.m_shader;
        shaderTypes.push(stageType);
        signatures.push(stageInput.signature);
    }

    pass.resourceSetDesc = new CjsResourceSetDescription(shaderTypes, signatures);
    for (let stageType = 0; stageType < Tr2RenderContextEnum.SHADER_TYPE_COUNT; stageType += 1) 
    {
        const stageInput = pass.stageInputs[stageType];
        if (!stageInput?.m_exists) continue;
        for (const [ registerIndex, sampler ] of stageInput.samplers.entries()) 
        {
            pass.resourceSetDesc.SetSampler(stageType, registerIndex, sampler.sampler);
        }
    }

    pass.shaderProgram = context.effectStateManager.RegisterShaderProgram(shaderHandles, stageCount);

    const stateCount = sanityCheck(stream.readUint8(), 64, "render state count");
    const states = new Map();
    for (let stateIndex = 0; stateIndex < stateCount; stateIndex += 1) 
    {
        states.set(stream.readUint32(), stream.readUint32());
    }
    pass.cjsRenderStateSetup = new CjsRenderStateSetup(states);
    pass.renderStates = context.effectStateManager.RegisterRenderStateSetup(pass.cjsRenderStateSetup);

    return pass;
}

/**
 * Reads one ray-tracing shader library block from v14+ effect data.
 *
 * @param {CjsBinaryReader} stream Binary reader positioned at a library record.
 * @param {number} version Carbon effect data version.
 * @param {object} context Shared parser context.
 * @returns {Tr2EffectLibrary} Decoded library metadata.
 */
function readLibrary(stream, version, context) 
{
    const library = new Tr2EffectLibrary();
    library.payloadSize = stream.readUint32();
    const bytecodeSize = stream.readUint32();
    const bytecodeBlob = stream.readTableBlob(bytecodeSize);
    library.libraryHandle = context.effectStateManager.RegisterShaderLibrary(new CjsShaderBytecode({
        stageType: Tr2RenderContextEnum.COMPUTE_SHADER,
        stageName: "library",
        bytes: bytecodeBlob.bytes,
        shaderSize: bytecodeSize,
        stringTableOffset: bytecodeBlob.offset
    }));

    const exportCount = stream.readUint32();
    for (let exportIndex = 0; exportIndex < exportCount; exportIndex += 1) 
    {
        const type = stream.readUint8();
        const name = stream.readString();
        library.exports.push({ type, name });
        if (type === 0) library.rayGenName = name;
        if (type === 1) library.missName = name;
        if (type === 2) library.closestHitName = name;
        if (type === 3) library.anyHitName = name;
        if (type === 4) library.intersectionName = name;
    }
    library.hitGroupName = stream.readString();

    const shaderType = Tr2RenderContextEnum.COMPUTE_SHADER;
    readRegisters(library.globalInput.signature, stream, version, shaderType, context);
    readInput(library.globalInput, stream, version, shaderType, context);
    library.globalResourceSetDesc = new CjsResourceSetDescription([ shaderType ], [ library.globalInput.signature ]);
    for (const [ registerIndex, sampler ] of library.globalInput.samplers.entries()) 
    {
        library.globalResourceSetDesc.SetSampler(shaderType, registerIndex, sampler.sampler);
    }

    readRegisters(library.localInput.signature, stream, version, shaderType, context);
    readInput(library.localInput, stream, version, shaderType, context);

    return library;
}

/**
 * Reads constants, resources, samplers, UAVs, and annotations for one shader input.
 *
 * @param {Tr2EffectStageInput} input Stage or library input to populate.
 * @param {CjsBinaryReader} stream Binary reader positioned at an input record.
 * @param {number} version Carbon effect data version.
 * @param {number} stageType Trinity shader stage enum value.
 * @param {object} context Shared parser context.
 */
function readInput(input, stream, version, stageType, context) 
{
    const constantCount = stream.readUint32();
    input.constants = [];
    for (let constantIndex = 0; constantIndex < constantCount; constantIndex += 1) 
    {
        input.constants.push(readConstant(stream, version));
    }

    const constantValueSize = stream.readUint32();
    input.m_constantValueSize = Math.min(constantValueSize, Tr2EffectStageInput.SHADER_CONSTANTS_MAX);
    if (version < 5) 
    {
        input.constantValues = constantValueSize
            ? stream.readRaw(constantValueSize).subarray(0, input.m_constantValueSize)
            : new Uint8Array(0);
    }
    else 
    {
        const blob = stream.readTableBlobOptional(constantValueSize);
        input.constantValues = blob.bytes.subarray(0, input.m_constantValueSize);
    }

    const textureCount = sanityCheck(stream.readUint8(), 64, "texture count");
    input.resources = new Map();
    for (let textureIndex = 0; textureIndex < textureCount; textureIndex += 1) 
    {
        input.resources.set(stream.readUint8(), readResource(stream, version));
    }

    const samplerCount = sanityCheck(stream.readUint8(), 64, "sampler count");
    input.samplers = new Map();
    for (let samplerIndex = 0; samplerIndex < samplerCount; samplerIndex += 1) 
    {
        const registerIndex = stream.readUint8();
        const samplerSetup = new Tr2SamplerSetup();
        samplerSetup.name = version >= 4 ? stream.readString() : null;
        samplerSetup.sampler = readSampler(stream);
        if (version < 4) 
        {
            stream.readBool();
        }
        if (version > 12) 
        {
            samplerSetup.sampler.isDynamic = stream.readBool();
            if (!samplerSetup.sampler.isDynamic) 
            {
                samplerSetup.name = null;
            }
        }
        input.samplers.set(registerIndex, samplerSetup);
    }

    if (version >= 3) 
    {
        const uavCount = sanityCheck(stream.readUint8(), 64, "uav count");
        input.uavs = new Map();
        for (let uavIndex = 0; uavIndex < uavCount; uavIndex += 1) 
        {
            const registerIndex = stream.readUint8();
            const resource = new Tr2EffectResource();
            resource.isSRGB = false;
            resource.name = stream.readString();
            resource.type = stream.readUint8();
            resource.arrayElements = version >= 13 ? stream.readUint32() : 1;
            resource.isAutoregister = stream.readBool();
            input.uavs.set(registerIndex, resource);
        }

        if (version >= 8) 
        {
            input.annotation = readAnnotations(stream);
        }
    }

    for (const constant of input.constants) 
    {
        patchSamplerHeapIndexConstant(input, constant, context, stageType);
    }
}

/**
 * Reads a vector of parameter annotations from the effect stream.
 *
 * @param {CjsBinaryReader} stream Binary reader positioned at an annotation vector.
 * @returns {Tr2EffectParameterAnnotation[]} Decoded annotations.
 */
function readAnnotations(stream) 
{
    const annotations = [];
    const annotationCount = stream.readUint8();
    for (let annotationIndex = 0; annotationIndex < annotationCount; annotationIndex += 1) 
    {
        const annotation = new Tr2EffectParameterAnnotation();
        annotation.name = stream.readString();
        annotation.type = stream.readUint8();

        if (annotation.type === Tr2EffectParameterAnnotation.Type.STRING) 
        {
            annotation.stringValue = stream.readString();
        }
        else 
        {
            annotation.rawValue = stream.readUint32();
            annotation.boolValue = annotation.rawValue !== 0;
            annotation.intValue = annotation.rawValue | 0;
            annotation.floatValue = cjsUint32ToFloat32(annotation.rawValue);
        }
        annotations.push(annotation);
    }
    return annotations;
}

/**
 * Reads one constant-buffer metadata record.
 *
 * @param {CjsBinaryReader} stream Binary reader positioned at a constant record.
 * @param {number} version Carbon effect data version.
 * @returns {Tr2EffectConstant} Decoded constant metadata.
 */
function readConstant(stream, version) 
{
    const constant = new Tr2EffectConstant();
    constant.name = stream.readString();
    constant.offset = stream.readUint32();
    constant.size = stream.readUint32();
    if (version < 11) 
    {
        const oldType = stream.readUint8();
        if (oldType === 0) constant.type = Tr2EffectConstant.Type.FLOAT;
        else if (oldType === 1) constant.type = Tr2EffectConstant.Type.INT;
        else if (oldType === 2) constant.type = Tr2EffectConstant.Type.BOOL;
        else constant.type = Tr2EffectConstant.Type.OTHER;
    }
    else 
    {
        constant.type = stream.readUint8();
    }
    constant.dimension = stream.readUint8();
    constant.elements = stream.readUint32();
    constant.isSRGB = stream.readBool();
    constant.isAutoregister = stream.readBool();
    return constant;
}

/**
 * Reads one shader resource metadata record.
 *
 * @param {CjsBinaryReader} stream Binary reader positioned at a resource record.
 * @param {number} version Carbon effect data version.
 * @returns {Tr2EffectResource} Decoded resource metadata.
 */
function readResource(stream, version) 
{
    const resource = new Tr2EffectResource();
    resource.name = stream.readString();
    resource.type = stream.readUint8();
    resource.arrayElements = version >= 13 ? stream.readUint32() : 1;
    resource.isSRGB = stream.readBool();
    resource.isAutoregister = stream.readBool();
    return resource;
}

/**
 * Reads one static or dynamic sampler descriptor.
 *
 * @param {CjsBinaryReader} stream Binary reader positioned at a sampler descriptor.
 * @returns {Tr2SamplerDescription} Decoded sampler descriptor.
 */
function readSampler(stream) 
{
    const sampler = new Tr2SamplerDescription();
    sampler.comparison = stream.readBool();
    sampler.minFilter = stream.readUint8();
    sampler.magFilter = stream.readUint8();
    sampler.mipFilter = stream.readUint8();
    sampler.addressU = stream.readUint8();
    sampler.addressV = stream.readUint8();
    sampler.addressW = stream.readUint8();
    sampler.mipLODBias = stream.readFloat32();
    sampler.maxAnisotropy = stream.readUint8();
    sampler.comparisonFunc = stream.readUint8();
    sampler.borderColor = [
        stream.readFloat32(),
        stream.readFloat32(),
        stream.readFloat32(),
        stream.readFloat32()
    ];
    sampler.minLOD = stream.readFloat32();
    sampler.maxLOD = stream.readFloat32();
    return sampler;
}

/**
 * Reads vertex/input-layout signature records for one shader stage.
 *
 * @param {object[]} pipelineInputs Destination pipeline-input array.
 * @param {CjsBinaryReader} stream Binary reader positioned at the input list.
 * @param {number} version Carbon effect data version.
 */
function readPipelineInputs(pipelineInputs, stream, version) 
{
    const inputCount = sanityCheck(stream.readUint8(), 64, "pipeline input count");
    pipelineInputs.length = 0;
    for (let inputIndex = 0; inputIndex < inputCount; inputIndex += 1) 
    {
        const usage = stream.readUint8();
        const registerIndex = stream.readUint8();
        const usageIndex = stream.readUint8();
        const usedMask = stream.readUint8();
        const input = {
            usage,
            usageName: Tr2UsageCodeNames[usage] || `USAGE_${usage}`,
            registerIndex,
            usageIndex,
            usedMask,
            type: 0,
            dimension: 4
        };
        if (version > 10) 
        {
            input.type = stream.readUint8();
            input.dimension = stream.readUint8();
        }
        else 
        {
            input.type = usage === 6 ? Tr2EffectConstant.Type.UINT : Tr2EffectConstant.Type.FLOAT;
            input.dimension = 4;
        }
        pipelineInputs.push(input);
    }
}

/**
 * Reads resource-register signatures and static sampler signatures for one stage.
 *
 * @param {object} signature Stage signature object to populate.
 * @param {CjsBinaryReader} stream Binary reader positioned at the register list.
 * @param {number} version Carbon effect data version.
 * @param {number} stageType Trinity shader stage enum value.
 * @param {object} context Shared parser context.
 */
function readRegisters(signature, stream, version, stageType, context) 
{
    let inputCount = stream.readUint8();
    signature.registers = [];
    for (let inputIndex = 0; inputIndex < inputCount; inputIndex += 1) 
    {
        const register = {};
        if (version > 9) 
        {
            register.registerType = stream.readUint8();
        }
        else 
        {
            register.registerType = mapOldRegisterType(stream.readUint8());
        }
        register.registerIndex = stream.readUint32();
        if (version > 12) 
        {
            register.arrayCount = stream.readUint32();
            register.registerCount = register.arrayCount;
            register.registerSpace = stream.readUint8();
        }
        else 
        {
            register.arrayCount = 1;
            register.registerCount = 1;
            register.registerSpace = stageType;
        }
        register.dynamic = isRegisterDynamic(register, stageType, context);
        signature.registers.push(register);
    }

    if (version > 12) 
    {
        inputCount = stream.readUint8();
        signature.samplers = [];
        for (let inputIndex = 0; inputIndex < inputCount; inputIndex += 1) 
        {
            signature.samplers.push(readStaticSampler(stream));
        }
    }
}

/**
 * Reads one static sampler signature entry from v13+ effect data.
 *
 * @param {CjsBinaryReader} stream Binary reader positioned at a static sampler record.
 * @returns {object} Decoded static sampler entry.
 */
function readStaticSampler(stream) 
{
    return {
        registerIndex: stream.readUint32(),
        registerSpace: stream.readUint8(),
        sampler: {
            comparison: stream.readBool(),
            minFilter: stream.readUint8(),
            magFilter: stream.readUint8(),
            mipFilter: stream.readUint8(),
            addressU: stream.readUint8(),
            addressV: stream.readUint8(),
            addressW: stream.readUint8(),
            mipLODBias: stream.readFloat32(),
            maxAnisotropy: stream.readUint8(),
            comparisonFunc: stream.readUint8(),
            borderColor: stream.readUint8(),
            minLOD: stream.readFloat32(),
            maxLOD: stream.readFloat32()
        }
    };
}

/**
 * Maps pre-v10 register type ids to Carbon's newer register type values.
 *
 * @param {number} value Legacy register type id.
 * @returns {number} Modern register type value.
 */
function mapOldRegisterType(value) 
{
    if (value === 0) return 0;
    if (value === 1) return 36;
    if (value === 2) return 68;
    if (value === 3) return 1;
    return 36;
}

/**
 * Determines whether a resource register is dynamic for the current stage.
 *
 * @param {object} register Register signature metadata.
 * @param {number} stageType Trinity shader stage enum value.
 * @param {object} context Shared parser context.
 * @returns {boolean} True when the register should be treated as dynamic.
 */
function isRegisterDynamic(register, stageType, context) 
{
    if (register.registerType !== 0) 
    {
        return true;
    }
    if (stageType === Tr2RenderContextEnum.VERTEX_SHADER && register.registerIndex === context.perFrameVSStartRegister) 
    {
        return false;
    }
    if (stageType === Tr2RenderContextEnum.PIXEL_SHADER && register.registerIndex === context.perFramePSStartRegister) 
    {
        return false;
    }
    return true;
}

/**
 * Ensures sampler heap-index constants have enough backing constant data.
 *
 * @param {Tr2EffectStageInput} input Stage input containing samplers and constants.
 * @param {Tr2EffectConstant} constant Constant metadata to compare with sampler names.
 */
function patchSamplerHeapIndexConstant(input, constant) 
{
    if (constant.type !== Tr2EffectConstant.Type.UINT || constant.dimension !== 1) 
    {
        return;
    }
    for (const sampler of input.samplers.values()) 
    {
        if (sampler.name !== constant.name) continue;
        const neededSize = constant.offset + constant.size;
        if (neededSize > input.m_constantValueSize) 
        {
            const next = new Uint8Array(neededSize);
            next.set(input.constantValues);
            input.constantValues = next;
            input.m_constantValueSize = neededSize;
        }
        break;
    }
}

/**
 * Applies `IsHeapView` parameter annotations to resource-set descriptions.
 *
 * @param {Tr2EffectDescription} effectDescription Fully read effect description.
 */
function applyHeapViewAnnotations(effectDescription) 
{
    const isHeapView = (name) => 
    {
        if (!name) return false;
        const annotations = effectDescription.annotations.get(name) || [];
        return annotations.some((annotation) =>
            annotation.name === "IsHeapView" &&
      annotation.type === Tr2EffectParameterAnnotation.Type.BOOL &&
      annotation.boolValue
        );
    };

    for (const technique of effectDescription.techniques) 
    {
        for (const library of technique.libraries) 
        {
            const shaderType = Tr2RenderContextEnum.COMPUTE_SHADER;
            for (const [ registerIndex, resource ] of library.globalInput.resources.entries()) 
            {
                if (isHeapView(resource.name)) library.globalResourceSetDesc?.SetSrvHeapView(shaderType, registerIndex);
            }
            for (const [ registerIndex, resource ] of library.globalInput.uavs.entries()) 
            {
                if (isHeapView(resource.name)) library.globalResourceSetDesc?.SetUavHeapView(shaderType, registerIndex);
            }
            for (const [ registerIndex, sampler ] of library.globalInput.samplers.entries()) 
            {
                if (isHeapView(sampler.name)) library.globalResourceSetDesc?.SetSamplerHeapView(shaderType, registerIndex);
            }
        }

        for (const pass of technique.passes) 
        {
            for (let stageType = 0; stageType < pass.stageInputs.length; stageType += 1) 
            {
                const stage = pass.stageInputs[stageType];
                if (!stage?.m_exists) continue;
                for (const [ registerIndex, resource ] of stage.resources.entries()) 
                {
                    if (isHeapView(resource.name)) pass.resourceSetDesc?.SetSrvHeapView(stageType, registerIndex);
                }
                for (const [ registerIndex, resource ] of stage.uavs.entries()) 
                {
                    if (isHeapView(resource.name)) pass.resourceSetDesc?.SetUavHeapView(stageType, registerIndex);
                }
                for (const [ registerIndex, sampler ] of stage.samplers.entries()) 
                {
                    if (isHeapView(sampler.name)) pass.resourceSetDesc?.SetSamplerHeapView(stageType, registerIndex);
                }
            }
        }
    }
}

/**
 * Rejects unexpectedly large counts before allocating or iterating.
 *
 * @param {number} value Count read from the effect stream.
 * @param {number} limit Maximum expected count.
 * @param {string} label Name used in the thrown error.
 * @returns {number} The original value when it is within range.
 */
function sanityCheck(value, limit, label) 
{
    if (value > limit) 
    {
        throw new Error(`Unexpected ${label}: ${value}`);
    }
    return value;
}

/**
 * Serializes a map of parameter names to annotation arrays.
 *
 * @param {Map<string, Tr2EffectParameterAnnotation[]>} map Annotation map.
 * @returns {object[]} JSON-safe annotation groups.
 */
function mapAnnotationToJson(map) 
{
    return Array.from(map.entries()).map(([ name, annotations ]) => ({
        name,
        annotations: annotations.map((entry) => entry.toJSON())
    }));
}
