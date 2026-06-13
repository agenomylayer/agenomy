import type { Address } from "viem";
import type { Manifest, Persona } from "@agenomy/shared";

export interface ConfigInput {
  handle: string;
  skills: string[];
  persona: Persona;
}

/** Canonical config object hashed into configHash (no timestamps/owner). */
export interface AgentConfig {
  handle: string;
  skills: string[];
  persona: Persona;
}

export function buildConfig(input: ConfigInput): AgentConfig {
  return {
    handle: input.handle,
    skills: [...input.skills].sort(),
    persona: {
      displayName: input.persona.displayName,
      bio: input.persona.bio,
      avatarSeed: input.persona.avatarSeed,
    },
  };
}

export interface ManifestInput {
  handle: string;
  owner: Address;
  skills: string[];
  persona: Persona;
  createdAt: number;
}

export function buildManifest(input: ManifestInput): Manifest {
  return {
    version: 1,
    handle: input.handle,
    owner: input.owner,
    persona: {
      displayName: input.persona.displayName,
      bio: input.persona.bio,
      avatarSeed: input.persona.avatarSeed,
    },
    skills: [...input.skills].sort(),
    createdAt: input.createdAt,
  };
}
