"use client";

import { useEffect, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import { wizardReducer, initialWizardState, canAdvance } from "./wizardMachine";
import { useHandleAvailability } from "./useHandleAvailability";
import { usePredictedWallet } from "../../hooks/usePredictedWallet";
import { useSpawnAgent } from "../../hooks/useSpawnAgent";
import { fetchSkills } from "../../lib/api";
import { buildManifest, buildConfig } from "../../lib/manifest";
import { pinManifest } from "../../lib/api";
import { computeConfigHash, type Skill } from "@agenomy/shared";
import { SkillChip } from "../../components/SkillChip";
import { shortAddress } from "../../components/format";
import { WalletConnect } from "./WalletConnect";

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
    <main className="page page--sm">
      <span className="kicker">new agent</span>
      <h1 className="page-title" style={{ marginBottom: "28px" }}>
        Spawn an agent
      </h1>

      <ol className="steps" aria-label="steps">
        {["connect", "handle", "skills", "persona", "review"].map((s) => {
          const active = state.step === s;
          return (
            <li key={s} aria-current={active ? "step" : undefined}>
              <span
                className="step-pill"
                aria-current={active ? "step" : undefined}
              >
                {STEP_LABELS[s]}
              </span>
            </li>
          );
        })}
      </ol>

      <section className="card">
        {state.step === "connect" && (
          <div>
            <h2 className="wizard-title">Connect your wallet</h2>
            <p className="wizard-desc">
              Your wallet owns the agent and its deterministic smart account.
            </p>
            <WalletConnect />
          </div>
        )}

        {state.step === "handle" && (
          <div>
            <h2 className="wizard-title">Choose a handle</h2>
            <p className="wizard-desc">
              Lowercase letters, digits, and hyphens. 3–32 characters.
            </p>
            <input
              aria-label="handle"
              className="field mono"
              value={state.handle}
              onChange={(e) =>
                dispatch({ type: "setHandle", handle: e.target.value })
              }
              placeholder="lowercase-handle"
            />
            <p
              className={`field-hint ${
                availability.status === "available"
                  ? "ok"
                  : availability.status === "checking"
                    ? ""
                    : "bad"
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
              <p className="field-hint mono">
                Predicted wallet: {shortAddress(predicted.data)}
              </p>
            )}
          </div>
        )}

        {state.step === "skills" && (
          <div>
            <h2 className="wizard-title">Pick skills</h2>
            <p className="wizard-desc">
              Choose at least one capability for your agent.
            </p>
            <ul className="skill-grid">
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
                      className="skill-option"
                    >
                      <span className="name">{sk.name}</span>
                      <span className="desc">{sk.description}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {state.step === "persona" && (
          <div className="wizard-fields">
            <h2 className="wizard-title">Persona</h2>
            <input
              aria-label="display name"
              className="field"
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
              className="field"
              style={{ minHeight: "96px", resize: "vertical" }}
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
              className="field mono"
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
            <h2 className="wizard-title">Review &amp; spawn</h2>
            <dl className="kv">
              <div>
                <span className="k">Handle </span>
                <span className="v mono">{state.handle}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                <span className="k">Skills </span>
                <span className="ac-skills" style={{ margin: 0 }}>
                  {state.skills.map((s) => (
                    <SkillChip key={s} slug={s} />
                  ))}
                </span>
              </div>
              <div>
                <span className="k">Display name </span>
                <span className="v">{state.persona.displayName}</span>
              </div>
              {predicted.data && (
                <div>
                  <span className="k">Predicted wallet </span>
                  <span className="v mono">{shortAddress(predicted.data)}</span>
                </div>
              )}
            </dl>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: "24px" }}
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
              <p className="field-hint bad" role="alert">
                {submitError ?? (error as Error)?.message}
              </p>
            )}
          </div>
        )}
      </section>

      <div className="wizard-nav">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => dispatch({ type: "back" })}
          disabled={state.step === "connect"}
        >
          Back
        </button>
        {state.step !== "review" && (
          <button
            type="button"
            className="btn btn-ghost btn-next"
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
