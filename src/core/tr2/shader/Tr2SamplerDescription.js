/**
 * Trinity sampler descriptor read from compiled effect metadata.
 */
export class Tr2SamplerDescription 
{
    /**
   * Creates a sampler descriptor with Carbon's default zeroed fields.
   */
    constructor() 
    {
        this.comparison = false;
        this.minFilter = 0;
        this.magFilter = 0;
        this.mipFilter = 0;
        this.addressU = 0;
        this.addressV = 0;
        this.addressW = 0;
        this.mipLODBias = 0;
        this.maxAnisotropy = 0;
        this.comparisonFunc = 0;
        this.borderColor = [ 0, 0, 0, 0 ];
        this.minLOD = 0;
        this.maxLOD = 0;
        this.isDynamic = true;
    }

    /**
   * Returns a JSON-safe sampler snapshot.
   *
   * @returns {object} Serializable sampler descriptor.
   */
    toJSON() 
    {
        return {
            ...this,
            borderColor: this.borderColor.slice()
        };
    }
}
