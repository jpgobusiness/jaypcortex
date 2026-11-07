import assert from "node:assert/strict";
import { test } from "node:test";
import { composePromptText } from "./compose-text";

test("composer junta camadas ativas e catálogo", () => {
  const text = composePromptText(
    [
      { layer: "identidade", text: "Sou o agente MAP.", enabled: true },
      { layer: "guardrails", text: "Não inventar números.", enabled: true },
      { layer: "exemplos", text: "oculto", enabled: false },
    ],
    "Sempre citar fonte.",
    [{ kind: "metodologia", title: "Fase Assess" }]
  );
  assert.match(text, /## Identidade/);
  assert.match(text, /## Guardrails/);
  assert.doesNotMatch(text, /oculto/);
  assert.match(text, /Regras \(legado\)/);
  assert.match(text, /Fase Assess/);
});
