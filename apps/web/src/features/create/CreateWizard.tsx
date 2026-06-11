"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { Address } from "viem";
import { wizardReducer, initialWizardState, canAdvance } from "./wizardMachine";
import { useHandleAvailability } from "./useHandleAvailability";
import { usePredictedWallet } from "../../hooks/usePredictedWallet";
import { useSpawnAgent } from "../../hooks/useSpawnAgent";
import { fetchSkills } from "../../lib/api";
import { buildManifest, buildConfig } from "../../lib/manifest";
import { pinManifest } from "../../lib/api";
import { computeConfigHash, type Skill } from "@aeonomy/shared";
import { SkillChip } from "../../components/SkillChip";
import { shortAddress } from "../../components/format";

const STEP_LABELS: Record<string, string> = {
  connect: "Connect",
  handle: "Handle",
  skills: "Skills",
  persona: "Persona",
  review: "Review",
};

export function CreateWizard() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const availability = useHandleAvailability(state.handle);
  const predicted = usePredictedWallet(state.owner, state.handle);
  const { spawn, isWriting, isConfirming, isConfirmed, spawned, error } =
    useSpawnAgent();

  // sync wallet connection into machine
  useEffect(() => {
    dispatch({
      type: "setConnected",
      connected: isConnected,
      owner: address as Address | undefined,
    });
  }, [isConnected, address]);

  // sync availability into machine
  useEffect(() => {
    dispatch({
      type: "setHandleAvailable",
      available: availability.status === "available",
    });
  }, [availability.status]);

  // load skills when entering skills step
  useEffect(() => {
    if (state.step === "skills" && skills.length === 0) {
      fetchSkills()
        .then(setSkills)
        .catch(() => setSkills([]));
    }
  }, [state.step, skills.length]);

  // redirect after the agent is indexed-or-confirmed
  useEffect(() => {
    if (isConfirmed && spawned) {
      router.push(`/agents/${state.handle}`);
    }
  }, [isConfirmed, spawned, router, state.handle]);

  async function handleSubmit() {
    if (!state.owner) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const manifest = buildManifest({
        handle: state.handle,
        owner: state.owner,
        skills: state.skills,
        persona: state.persona,
        createdAt: Math.floor(Date.now() / 1000),
      });
      const { manifestHash } = await pinManifest(manifest);
      const config = buildConfig({
        handle: state.handle,
        skills: state.skills,
        persona: state.persona,
      });
      const configHash = computeConfigHash(config);
      await spawn({ handle: state.handle, manifestHash, configHash });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-accent">
        New agent
      </p>
      <h1 className="mb-8 text-3xl font-semibold tracking-tight text-ink">
        Spawn an agent
      </h1>

      <ol
        className="mb-10 flex flex-wrap gap-2 font-mono text-[0.7rem] uppercase tracking-[0.14em]"
        aria-label="steps"
      >
        {["connect", "handle", "skills", "persona", "review"].map((s) => {
          const active = state.step === s;
          return (
            <li key={s} aria-current={active ? "step" : undefined}>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 ${
                  active
                    ? "border-accent bg-accent text-surface"
                    : "border-line bg-surface text-muted"
                }`}
              >
                {STEP_LABELS[s]}
              </span>
            </li>
          );
        })}
      </ol>

      <section className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        {state.step === "connect" && (
          <div>
            <h2 className="mb-2 text-xl font-semibold text-ink">
              Connect your wallet
            </h2>
            <p className="mb-5 text-sm text-muted">
              Your wallet owns the agent and its deterministic smart account.
            </p>
            <ConnectButton />
          </div>
        )}

        {state.step === "handle" && (
          <div>
            <h2 className="mb-2 text-xl font-semibold text-ink">
              Choose a handle
            </h2>
            <p className="mb-4 text-sm text-muted">
              Lowercase letters, digits, and hyphens. 3–32 characters.
            </p>
            <input
              aria-label="handle"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-ink outline-none focus:border-accent"
              value={state.handle}
              onChange={(e) =>
                dispatch({ type: "setHandle", handle: e.target.value })
              }
              placeholder="lowercase-handle"
            />
            <p
              className={`mt-2 text-sm ${
                availability.status === "available"
                  ? "text-green"
                  : availability.status === "checking"
                    ? "text-muted"
                    : "text-accent"
              }`}
              role="status"
            >
              {availability.status === "checking" && "Checking…"}
              {availability.status === "available" && "Available"}
              {availability.status === "taken" &&
                (availability.reason ?? "Taken")}
              {availability.status === "invalid" && availability.reason}
              {availability.status === "error" && availability.reason}
            </p>
            {predicted.data && (
              <p className="mt-1 font-mono text-xs text-muted">
                Predicted wallet: {shortAddress(predicted.data)}
              </p>
            )}
          </div>
        )}

        {state.step === "skills" && (
          <div>
            <h2 className="mb-2 text-xl font-semibold text-ink">Pick skills</h2>
            <p className="mb-4 text-sm text-muted">
              Choose at least one capability for your agent.
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {skills.map((sk) => {
                const selected = state.skills.includes(sk.slug);
                return (
                  <li key={sk.slug}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        dispatch({ type: "toggleSkill", slug: sk.slug })
                      }
                      className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                        selected
                          ? "border-accent bg-accent-wash"
                          : "border-line bg-surface hover:border-line-strong"
                      }`}
                    >
                      <span className="font-medium text-ink">{sk.name}</span>
                      <span className="block text-xs text-muted">
                        {sk.description}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {state.step === "persona" && (
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold text-ink">Persona</h2>
            <input
              aria-label="display name"
              className="rounded-xl border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
              value={state.persona.displayName}
              onChange={(e) =>
                dispatch({
                  type: "setPersona",
                  persona: { ...state.persona, displayName: e.target.value },
                })
              }
              placeholder="Display name"
            />
            <textarea
              aria-label="bio"
              className="min-h-[96px] rounded-xl border border-line bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
              value={state.persona.bio}
              onChange={(e) =>
                dispatch({
                  type: "setPersona",
                  persona: { ...state.persona, bio: e.target.value },
                })
              }
              placeholder="Short bio"
            />
            <input
              aria-label="avatar seed"
              className="rounded-xl border border-line bg-surface px-3 py-2 font-mono text-ink outline-none focus:border-accent"
              value={state.persona.avatarSeed}
              onChange={(e) =>
                dispatch({
                  type: "setPersona",
                  persona: { ...state.persona, avatarSeed: e.target.value },
                })
              }
              placeholder="Avatar seed"
            />
          </div>
        )}

        {state.step === "review" && (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-ink">
              Review &amp; spawn
            </h2>
            <dl className="space-y-2 text-sm text-ink">
              <div>
                <dt className="inline font-medium text-muted">Handle: </dt>
                <dd className="inline font-mono">{state.handle}</dd>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <dt className="font-medium text-muted">Skills: </dt>
                <dd className="inline-flex flex-wrap gap-1">
                  {state.skills.map((s) => (
                    <SkillChip key={s} slug={s} />
                  ))}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-muted">
                  Display name:{" "}
                </dt>
                <dd className="inline">{state.persona.displayName}</dd>
              </div>
              {predicted.data && (
                <div>
                  <dt className="inline font-medium text-muted">
                    Predicted wallet:{" "}
                  </dt>
                  <dd className="inline font-mono">
                    {shortAddress(predicted.data)}
                  </dd>
                </div>
              )}
            </dl>
            <button
              type="button"
              className="mt-6 rounded-xl bg-accent px-5 py-2.5 font-medium text-surface shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              disabled={submitting || isWriting || isConfirming}
              onClick={handleSubmit}
            >
              {isWriting
                ? "Confirm in wallet…"
                : isConfirming
                  ? "Waiting for confirmation…"
                  : "Spawn agent"}
            </button>
            {(submitError || error) && (
              <p className="mt-3 text-sm text-accent" role="alert">
                {submitError ?? (error as Error)?.message}
              </p>
            )}
          </div>
        )}
      </section>

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          className="rounded-xl border border-line bg-surface px-5 py-2.5 font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-40"
          onClick={() => dispatch({ type: "back" })}
          disabled={state.step === "connect"}
        >
          Back
        </button>
        {state.step !== "review" && (
          <button
            type="button"
            className="rounded-xl border border-accent bg-surface px-5 py-2.5 font-medium text-accent transition-colors hover:bg-accent-wash disabled:opacity-40"
            onClick={() => dispatch({ type: "next" })}
            disabled={!canAdvance(state)}
          >
            Next
          </button>
        )}
      </div>
    </main>
  );
}
