import { Tr2SamplerDescription } from "./Tr2SamplerDescription.js";

/**
 * Trinity sampler binding that pairs a metadata name with a sampler descriptor.
 */
export class Tr2SamplerSetup 
{
    /**
   * Creates a sampler setup with an empty name and default descriptor.
   */
    constructor() 
    {
        this.name = null;
        this.sampler = new Tr2SamplerDescription();
    }

    /**
   * Returns a JSON-safe sampler binding.
   *
   * @returns {object} Serializable sampler setup.
   */
    toJSON() 
    {
        return {
            name: this.name,
            sampler: this.sampler?.toJSON?.() ?? this.sampler
        };
    }
}
