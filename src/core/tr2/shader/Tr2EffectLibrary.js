import { Tr2EffectStageInput } from "./Tr2EffectStageInput.js";

/**
 * Ray-tracing shader library metadata from v14+ Trinity effects.
 */
export class Tr2EffectLibrary 
{
    /**
   * Creates an empty shader-library metadata record.
   */
    constructor() 
    {
        this.payloadSize = 0;
        this.libraryHandle = 0;
        this.rayGenName = "";
        this.missName = "";
        this.closestHitName = "";
        this.anyHitName = "";
        this.intersectionName = "";
        this.hitGroupName = "";
        this.exports = [];
        this.globalInput = new Tr2EffectStageInput();
        this.localInput = new Tr2EffectStageInput();
        this.globalResourceSetDesc = null;
    }

    /**
   * Returns a JSON-safe shader-library metadata snapshot.
   *
   * @returns {object} Serializable shader-library metadata.
   */
    toJSON() 
    {
        return {
            payloadSize: this.payloadSize,
            libraryHandle: this.libraryHandle,
            rayGenName: this.rayGenName,
            missName: this.missName,
            closestHitName: this.closestHitName,
            anyHitName: this.anyHitName,
            intersectionName: this.intersectionName,
            hitGroupName: this.hitGroupName,
            exports: this.exports.map((entry) => ({ ...entry })),
            globalInput: this.globalInput.toJSON(),
            localInput: this.localInput.toJSON(),
            globalResourceSetDesc: this.globalResourceSetDesc?.toJSON?.() ?? this.globalResourceSetDesc
        };
    }
}
