import assert from "node:assert/strict";
import { test } from "node:test";
import {
  archiveBlockReason,
  documentPath,
  folderMoveBlockReason,
  introducesCycle,
  MAX_TREE_DEPTH,
  nestTree,
  parseBulkTree,
  TreeError,
} from "./tree-logic";

test("ciclo e profundidade da árvore", () => {
  const parent = new Map([
    ["a", null],
    ["b", "a"],
    ["c", "b"],
  ]);
  const parentOf = (id: string) => parent.get(id) ?? null;
  assert.equal(introducesCycle("a", "c", parentOf), true);
  assert.equal(introducesCycle("c", null, parentOf), false);
  assert.equal(archiveBlockReason("agent_room"), "A sala do agente não se arquiva por aqui.");
  assert.equal(archiveBlockReason("opportunities"), "O espaço Oportunidades não se arquiva.");
  assert.equal(archiveBlockReason("generic"), null);
  assert.equal(folderMoveBlockReason({ name: "_Templates" }), "A pasta _Templates não muda de lugar.");
  assert.equal(MAX_TREE_DEPTH, 8);
});

test("aninha pastas e subarquivos e monta o caminho", () => {
  const tree = nestTree(
    [
      { id: "f1", parentFolderId: null, name: "00 Finanças", order: 0 },
      { id: "f2", parentFolderId: "f1", name: "DRE", order: 0 },
    ],
    [
      { id: "a", folderId: "f1", parentFileId: null, title: "EBITDA", order: 0 },
      { id: "b", folderId: "f1", parentFileId: "a", title: "Fórmula", order: 0 },
    ]
  );
  assert.equal(tree.folders[0].name, "00 Finanças");
  assert.equal(tree.folders[0].folders[0].name, "DRE");
  assert.equal(tree.folders[0].files[0].title, "EBITDA");
  assert.equal(tree.folders[0].files[0].children[0].title, "Fórmula");
  assert.equal(
    documentPath({
      workspaceName: "Visão de Negócios",
      folderId: "f1",
      fileId: "b",
      folders: [
        { id: "f1", parentFolderId: null, name: "00 Finanças" },
      ],
      files: [
        { id: "a", parentFileId: null, title: "EBITDA" },
        { id: "b", parentFileId: "a", title: "Fórmula" },
      ],
    }),
    "Visão de Negócios/00 Finanças/EBITDA/Fórmula"
  );
});

test("parseBulkTree aceita JSON e recusa texto quebrado", () => {
  const tree = parseBulkTree(JSON.stringify({
    workspace: "Visão de Negócios",
    folders: [{ name: "00 Finanças", files: [{ title: "EBITDA", children: [{ title: "Fórmula" }] }] }],
  }));
  assert.equal(tree.workspace, "Visão de Negócios");
  assert.equal(tree.folders?.[0].files?.[0].children?.[0].title, "Fórmula");
  assert.throws(() => parseBulkTree("{"), (error: unknown) => {
    assert.ok(error instanceof TreeError);
    assert.equal(error.code, "invalid");
    return true;
  });
});
