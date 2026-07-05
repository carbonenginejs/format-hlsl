import { Tr2RenderContextEnum } from "../Tr2RenderContextEnum.js";

/**
 * Shader resource or UAV metadata read from a Trinity effect body.
 */
export class Tr2EffectResource 
{
    static Type = Object.freeze({
        TEXTURE_1D: Tr2RenderContextEnum.TEX_TYPE_1D,
        TEXTURE_2D: Tr2RenderContextEnum.TEX_TYPE_2D,
        TEXTURE_3D: Tr2RenderContextEnum.TEX_TYPE_3D,
        TEXTURE_CUBE: Tr2RenderContextEnum.TEX_TYPE_CUBE,
        TEXTURE_TYPELESS: Tr2RenderContextEnum.TEX_TYPE_TYPELESS,
        BUFFER: 6,
        STRUCTURED_BUFFER: 7,
        TBUFFER: 8,
        BYTEADDRESS_BUFFER: 9,
        UAV_RWTYPED: 10,
        UAV_RWSTRUCTURED: 11,
        UAV_RWBYTEADDRESS: 12,
        UAV_APPEND_STRUCTURED: 13,
        UAV_CONSUME_STRUCTURED: 14,
        UAV_RWSTRUCTURED_WITH_COUNTER: 15,
        BINDLESS_SAMPLER: 100
    });

    /**
   * Creates an empty shader resource record with Carbon-compatible defaults.
   */
    constructor() 
    {
        this.name = "";
        this.type = Tr2EffectResource.Type.TEXTURE_2D;
        this.arrayElements = 1;
        this.isSRGB = false;
        this.isAutoregister = false;
    }

    /**
   * Returns a JSON-safe resource metadata snapshot.
   *
   * @returns {object} Serializable resource metadata.
   */
    toJSON() 
    {
        return { ...this };
    }
}
