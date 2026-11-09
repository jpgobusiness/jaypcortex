import assert from "node:assert/strict";
import { test } from "node:test";
import { getProposalTemplate, proposalSectionMap } from "./html-template";
import { PROPOSAL_HEADINGS } from "./constants";

test("template padrao cobre todos os H2 do Proposal Doc", () => {
  const tpl = getProposalTemplate();
  assert.equal(tpl.name, "padrao");
  for (const heading of PROPOSAL_HEADINGS) {
    assert.ok(tpl.html.includes(`data-section="${heading}"`), heading);
    assert.ok(tpl.html.includes(`{{${heading}}}`), heading);
  }
  assert.equal(proposalSectionMap().length, PROPOSAL_HEADINGS.length);
});
