import React, { useEffect, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import * as api from "./api.js";
import {
  TrelloBoard,
  TrelloCard,
  TrelloCheckItem,
  TrelloChecklist,
  TrelloList,
} from "./api.js";

type Screen =
  | "boards"
  | "lists"
  | "card_detail"
  | "create_card"
  | "edit_card"
  | "move_card"
  | "checklists"
  | "add_checklist"
  | "add_checkitem"
  | "comments"
  | "add_comment";

// ── helpers ─────────────────────────────────────────────────────────────────-

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function truncate(text: string, width: number) {
  if (width <= 0) return "";
  if (text.length <= width) return text;
  if (width <= 3) return text.slice(0, width);
  return text.slice(0, width - 3) + "...";
}

function HeaderBar({ title, width }: { title: string; width: number }) {
  const line = "-".repeat(Math.max(0, width));
  return (
    <Box flexDirection="column" width={width}>
      <Text color="blue">{line}</Text>
      <Box>
        <Text color="cyan" bold>
          Trello CLI
        </Text>
        <Text color="white"> {title}</Text>
      </Box>
      <Text color="blue">{line}</Text>
    </Box>
  );
}

function FooterBar({ hints, width }: { hints: string[]; width: number }) {
  const line = "-".repeat(Math.max(0, width));
  const text = truncate(hints.join("  "), width);
  return (
    <Box flexDirection="column" width={width}>
      <Text color="blue">{line}</Text>
      <Text color="gray">{text}</Text>
    </Box>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <Box>
      <Text color="green">
        <Spinner type="dots" />
      </Text>
      <Text> {label}</Text>
    </Box>
  );
}

function StatusMsg({ msg, color }: { msg: string; color?: string }) {
  return msg ? (
    <Box marginTop={1}>
      <Text color={(color as any) || "green"}>{msg}</Text>
    </Box>
  ) : null;
}

function ErrorBanner({ msg, detail }: { msg: string; detail?: string }) {
  if (!msg) return null;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text backgroundColor="red" color="white">
        {" ERROR: " + msg + " "}
      </Text>
      {detail ? <Text color="gray">{detail}</Text> : null}
    </Box>
  );
}

// ── Input panels ─────────────────────────────────────────────────------------

function TextInputPanel({
  prompt,
  onSubmit,
  initialValue = "",
}: {
  prompt: string;
  onSubmit: (val: string) => void;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <Box flexDirection="column">
      <Text color="yellow">{prompt}</Text>
      <Box marginTop={1}>
        <Text color="gray">{"> "}</Text>
        <TextInput value={value} onChange={setValue} onSubmit={onSubmit} />
      </Box>
    </Box>
  );
}

function ListColumn({
  list,
  cards,
  selectedIndex,
  width,
  height,
  isActive,
}: {
  list: TrelloList;
  cards: TrelloCard[];
  selectedIndex: number;
  width: number;
  height: number;
  isActive: boolean;
}) {
  const header = truncate(`${list.name} (${cards.length})`, width);
  const items = [...cards.map((card) => card.name), "Buat card baru"];
  const viewHeight = Math.max(1, height - 1);
  const maxStart = Math.max(0, items.length - viewHeight);
  const start = clamp(selectedIndex - Math.floor(viewHeight / 2), 0, maxStart);
  const visible = items.slice(start, start + viewHeight);

  return (
    <Box flexDirection="column" width={width}>
      <Text color={isActive ? "cyan" : "gray"}>{header}</Text>
      {visible.length === 0 ? (
        <Text color="gray">(Kosong)</Text>
      ) : (
        visible.map((label, idx) => {
          const realIndex = start + idx;
          const isSelected = isActive && realIndex === selectedIndex;
          const isAction = realIndex === items.length - 1;
          const text = truncate(label, Math.max(1, width - 2));
          return (
            <Box key={`${list.id}-${realIndex}`}>
              <Text
                backgroundColor={isSelected ? "cyan" : undefined}
                color={isSelected ? "black" : isAction ? "cyan" : "white"}
              >
                {` ${text}`}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}

function CardDetailPanel({
  card,
  width,
}: {
  card: TrelloCard | null;
  width: number;
}) {
  if (!card) {
    return <Text color="gray">Pilih card untuk melihat detail.</Text>;
  }

  return (
    <Box flexDirection="column" width={width}>
      <Text color="cyan" bold>
        Detail Card
      </Text>
      <Text color="white" bold>
        {truncate(card.name, width)}
      </Text>
      {card.desc ? (
        <Text color="gray">{truncate(card.desc, width)}</Text>
      ) : (
        <Text color="gray">(Tanpa deskripsi)</Text>
      )}
      {card.due ? (
        <Text color={card.dueComplete ? "green" : "red"}>
          Due: {new Date(card.due).toLocaleDateString("id")}
          {card.dueComplete ? " (done)" : ""}
        </Text>
      ) : (
        <Text color="gray">Due: -</Text>
      )}
      <Text color="blue">{card.shortUrl}</Text>
    </Box>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? 80;
  const rows = stdout?.rows ?? 24;

  const [screen, setScreen] = useState<Screen>("boards");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [statusColor, setStatusColor] = useState("green");
  const [error, setError] = useState("");
  const [errorDetail, setErrorDetail] = useState("");

  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [cardsByList, setCardsByList] = useState<Record<string, TrelloCard[]>>(
    {},
  );
  const [checklists, setChecklists] = useState<TrelloChecklist[]>([]);
  const [comments, setComments] = useState<api.TrelloComment[]>([]);

  const [selectedBoard, setSelectedBoard] = useState<TrelloBoard | null>(null);
  const [selectedList, setSelectedList] = useState<TrelloList | null>(null);
  const [selectedCard, setSelectedCard] = useState<TrelloCard | null>(null);
  const [selectedChecklist, setSelectedChecklist] =
    useState<TrelloChecklist | null>(null);
  const [listIndex, setListIndex] = useState(0);
  const [listCardIndex, setListCardIndex] = useState<Record<string, number>>(
    {},
  );

  const flash = (msg: string, color = "green") => {
    setStatus(msg);
    setStatusColor(color);
    setTimeout(() => setStatus(""), 3000);
  };

  const showError = (msg: string, detail = "") => {
    setError(msg);
    setErrorDetail(detail);
  };

  const clearError = () => {
    setError("");
    setErrorDetail("");
  };

  const startLoading = () => {
    setLoading(true);
    clearError();
  };

  // ── Load boards ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen === "boards") {
      startLoading();
      api
        .getBoards()
        .then((b: TrelloBoard[]) => {
          setBoards(b);
          setLoading(false);
        })
        .catch((err) => {
          showError(
            "Gagal load boards. Cek API key/token.",
            err?.message || "",
          );
          setLoading(false);
        });
    }
  }, [screen]);

  useEffect(() => {
    if (lists.length === 0) {
      setSelectedList(null);
      setListIndex(0);
      return;
    }
    const nextIndex = clamp(listIndex, 0, lists.length - 1);
    setListIndex(nextIndex);
    setSelectedList(lists[nextIndex]);
  }, [lists, listIndex]);

  useEffect(() => {
    if (lists.length === 0) return;
    setListIndex(0);
    setListCardIndex((prev) => {
      const next: Record<string, number> = {};
      lists.forEach((list) => {
        next[list.id] = prev[list.id] ?? 0;
      });
      return next;
    });
  }, [lists]);

  useEffect(() => {
    if (lists.length === 0) return;
    setListCardIndex((prev) => {
      const next: Record<string, number> = { ...prev };
      lists.forEach((list) => {
        const maxIndex = cardsByList[list.id]?.length ?? 0;
        const current = next[list.id] ?? 0;
        next[list.id] = clamp(current, 0, maxIndex);
      });
      return next;
    });
  }, [cardsByList, lists]);

  useInput((_input, key) => {
    if (key.escape) handleBack();
    if (_input === "q") exit();
    if (screen === "lists") {
      if (key.leftArrow) {
        setListIndex((current) => clamp(current - 1, 0, lists.length - 1));
      }
      if (key.rightArrow) {
        setListIndex((current) => clamp(current + 1, 0, lists.length - 1));
      }
      if (key.upArrow) {
        const list = lists[listIndex];
        if (!list) return;
        const maxIndex = cardsByList[list.id]?.length ?? 0;
        setListCardIndex((prev) => {
          const current = prev[list.id] ?? 0;
          const next = clamp(current - 1, 0, maxIndex);
          return { ...prev, [list.id]: next };
        });
      }
      if (key.downArrow) {
        const list = lists[listIndex];
        if (!list) return;
        const maxIndex = cardsByList[list.id]?.length ?? 0;
        setListCardIndex((prev) => {
          const current = prev[list.id] ?? 0;
          const next = clamp(current + 1, 0, maxIndex);
          return { ...prev, [list.id]: next };
        });
      }
      if (key.return) {
        const list = lists[listIndex];
        if (!list) return;
        const listCards = cardsByList[list.id] ?? [];
        const index = listCardIndex[list.id] ?? 0;
        if (index >= listCards.length) {
          setSelectedList(list);
          setScreen("create_card");
        } else {
          setSelectedList(list);
          setSelectedCard(listCards[index]);
          setScreen("card_detail");
        }
      }
    }
  });

  function handleBack() {
    clearError();
    if (screen === "boards") return exit();
    if (screen === "lists") setScreen("boards");
    else if (screen === "card_detail") setScreen("lists");
    else if (screen === "checklists") setScreen("card_detail");
    else if (screen === "add_checklist") setScreen("checklists");
    else if (screen === "add_checkitem") setScreen("checklists");
    else if (screen === "comments") setScreen("card_detail");
    else if (screen === "add_comment") setScreen("comments");
    else if (screen === "create_card") setScreen("lists");
    else if (screen === "edit_card") setScreen("card_detail");
    else if (screen === "move_card") setScreen("card_detail");
    else setScreen("boards");
  }

  function requireSelectedList(): TrelloList | null {
    if (!selectedList) {
      showError("List belum dipilih.");
      setScreen("lists");
      return null;
    }
    return selectedList;
  }

  function requireSelectedCard(): TrelloCard | null {
    if (!selectedCard) {
      showError("Card belum dipilih.");
      setScreen("lists");
      return null;
    }
    return selectedCard;
  }

  function requireSelectedChecklist(): TrelloChecklist | null {
    if (!selectedChecklist) {
      showError("Checklist belum dipilih.");
      setScreen("checklists");
      return null;
    }
    return selectedChecklist;
  }

  // ── Board select ─────────────────────────────────────────────────────────────
  async function handleBoardSelect(item: { value: TrelloBoard }) {
    const board = item.value;
    setSelectedBoard(board);
    startLoading();
    try {
      const ls = await api.getLists(board.id);
      const cardsByListEntries = await Promise.all(
        ls.map(async (list) => ({
          listId: list.id,
          cards: await api.getCards(list.id),
        })),
      );
      const nextCardsByList: Record<string, TrelloCard[]> = {};
      cardsByListEntries.forEach((entry) => {
        nextCardsByList[entry.listId] = entry.cards;
      });
      setLists(ls);
      setCardsByList(nextCardsByList);
      setLoading(false);
      setScreen("lists");
    } catch (err: any) {
      showError("Gagal load lists pada board ini.", err?.message || "");
      setLoading(false);
    }
  }

  // ── List select ──────────────────────────────────────────────────────────────
  async function refreshListCards(listId: string) {
    const cs = await api.getCards(listId);
    setCardsByList((prev) => ({ ...prev, [listId]: cs }));
    return cs;
  }

  // ── Card detail actions ──────────────────────────────────────────────────────
  async function handleCardAction(item: { value: string }) {
    const action = item.value;
    if (action === "checklists") {
      const card = requireSelectedCard();
      if (!card) return;
      startLoading();
      try {
        const cls = await api.getChecklists(card.id);
        setChecklists(cls);
        setLoading(false);
        setScreen("checklists");
      } catch (err: any) {
        showError("Gagal load checklists untuk card ini.", err?.message || "");
        setLoading(false);
      }
    } else if (action === "comments") {
      const card = requireSelectedCard();
      if (!card) return;
      startLoading();
      try {
        const coms = await api.getComments(card.id);
        setComments(coms);
        setLoading(false);
        setScreen("comments");
      } catch (err: any) {
        showError("Gagal load komentar untuk card ini.", err?.message || "");
        setLoading(false);
      }
    } else if (action === "edit") {
      setScreen("edit_card");
    } else if (action === "move") {
      setScreen("move_card");
    }
  }

  // ── Create card ──────────────────────────────────────────────────────────────
  async function handleCreateCard(name: string) {
    if (!name.trim()) return;
    const list = requireSelectedList();
    if (!list) return;
    startLoading();
    try {
      await api.createCard(list.id, name.trim());
      await refreshListCards(list.id);
      setLoading(false);
      flash(`Card "${name}" dibuat.`);
      setScreen("lists");
    } catch (err: any) {
      showError("Gagal membuat card baru.", err?.message || "");
      setLoading(false);
    }
  }

  // ── Edit card ────────────────────────────────────────────────────────────────
  async function handleEditCard(newName: string) {
    if (!newName.trim()) return;
    const card = requireSelectedCard();
    if (!card) return;
    startLoading();
    try {
      const updated = await api.updateCard(card.id, { name: newName.trim() });
      setSelectedCard(updated);
      await refreshListCards(updated.idList);
      setLoading(false);
      flash("Card diupdate.");
      setScreen("card_detail");
    } catch (err: any) {
      showError("Gagal mengubah nama card.", err?.message || "");
      setLoading(false);
    }
  }

  // ── Move card ────────────────────────────────────────────────────────────────
  async function handleMoveCard(item: { value: TrelloList }) {
    const targetList = item.value as TrelloList;
    const card = requireSelectedCard();
    const list = requireSelectedList();
    if (!card || !list) return;
    startLoading();
    try {
      const sourceListId = card.idList;
      const updated = await api.updateCard(card.id, { idList: targetList.id });
      setSelectedCard(updated);
      await refreshListCards(sourceListId);
      await refreshListCards(targetList.id);
      setLoading(false);
      flash(`Card dipindah ke "${targetList.name}".`);
      setScreen("card_detail");
    } catch (err: any) {
      showError("Gagal memindahkan card.", err?.message || "");
      setLoading(false);
    }
  }

  // ── Checklist actions ────────────────────────────────────────────────────────
  async function handleChecklistAction(item: {
    value: string | TrelloChecklist;
  }) {
    if (item.value === "add_checklist") return setScreen("add_checklist");
    const cl = item.value as TrelloChecklist;
    setSelectedChecklist(cl);
    setScreen("add_checkitem");
  }

  async function handleCreateChecklist(name: string) {
    if (!name.trim()) return;
    const card = requireSelectedCard();
    if (!card) return;
    startLoading();
    try {
      await api.createChecklist(card.id, name.trim());
      const cls = await api.getChecklists(card.id);
      setChecklists(cls);
      setLoading(false);
      flash(`Checklist "${name}" dibuat.`);
      setScreen("checklists");
    } catch (err: any) {
      showError("Gagal membuat checklist baru.", err?.message || "");
      setLoading(false);
    }
  }

  async function handleCheckItemAction(item: {
    value: TrelloCheckItem | "add";
  }) {
    if (item.value === "add") return setScreen("add_checkitem");
    const ci = item.value as TrelloCheckItem;
    const newState = ci.state === "complete" ? "incomplete" : "complete";
    const card = requireSelectedCard();
    const checklist = requireSelectedChecklist();
    if (!card || !checklist) return;
    startLoading();
    try {
      await api.updateCheckItem(card.id, ci.id, newState);
      const cls = await api.getChecklists(card.id);
      setChecklists(cls);
      const updated =
        cls.find((c: TrelloChecklist) => c.id === checklist.id) || checklist;
      setSelectedChecklist(updated);
      setLoading(false);
      flash(
        newState === "complete"
          ? `Item "${ci.name}" selesai.`
          : `Item "${ci.name}" dibatalkan.`,
      );
    } catch (err: any) {
      showError("Gagal memperbarui item checklist.", err?.message || "");
      setLoading(false);
    }
  }

  async function handleAddCheckItem(name: string) {
    if (!name.trim()) return;
    const card = requireSelectedCard();
    const checklist = requireSelectedChecklist();
    if (!card || !checklist) return;
    startLoading();
    try {
      await api.addCheckItem(checklist.id, name.trim());
      const cls = await api.getChecklists(card.id);
      const updated =
        cls.find((c: TrelloChecklist) => c.id === checklist.id) || checklist;
      setChecklists(cls);
      setSelectedChecklist(updated);
      setLoading(false);
      flash(`Item "${name}" ditambahkan.`);
      setScreen("add_checkitem");
    } catch (err: any) {
      showError("Gagal menambahkan item checklist.", err?.message || "");
      setLoading(false);
    }
  }

  // ── Comments ─────────────────────────────────────────────────────────────────
  async function handleAddComment(text: string) {
    if (!text.trim()) return;
    const card = requireSelectedCard();
    if (!card) return;
    startLoading();
    try {
      await api.addComment(card.id, text.trim());
      const coms = await api.getComments(card.id);
      setComments(coms);
      setLoading(false);
      flash("Komentar ditambahkan.");
      setScreen("comments");
    } catch (err: any) {
      showError("Gagal menambahkan komentar.", err?.message || "");
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────-----------------

  const width = Math.max(40, columns);
  const height = Math.max(10, rows);
  const headerHeight = 3;
  const footerHeight = 2;
  const contentHeight = Math.max(1, height - headerHeight - footerHeight);
  const contentWidth = Math.max(20, width - 4);

  const headerTitle = (() => {
    switch (screen) {
      case "boards":
        return "Boards";
      case "lists":
        return selectedBoard ? `Board: ${selectedBoard.name}` : "Lists";
      case "card_detail":
        return selectedCard ? `Card: ${selectedCard.name}` : "Card";
      case "create_card":
        return "Buat Card Baru";
      case "edit_card":
        return "Edit Card";
      case "move_card":
        return "Pindahkan Card";
      case "checklists":
        return "Checklists";
      case "add_checklist":
        return "Buat Checklist";
      case "add_checkitem":
        return "Checklist Items";
      case "comments":
        return "Komentar";
      case "add_comment":
        return "Tambah Komentar";
      default:
        return "Trello CLI";
    }
  })();

  const footerHints = (() => {
    switch (screen) {
      case "boards":
        return ["Up/Down: navigasi", "Enter: pilih", "Q: quit"];
      case "lists":
        return [
          "Left/Right: list",
          "Up/Down: card",
          "Enter: buka",
          "Esc: back",
          "Q: quit",
        ];
      case "card_detail":
      case "checklists":
      case "comments":
        return ["Up/Down: navigasi", "Enter: pilih", "Esc: back", "Q: quit"];
      case "create_card":
      case "edit_card":
      case "add_checklist":
      case "add_checkitem":
      case "add_comment":
        return ["Enter: simpan", "Esc: back", "Q: quit"];
      case "move_card":
        return ["Up/Down: pilih", "Enter: pindah", "Esc: back", "Q: quit"];
      default:
        return ["Q: quit"];
    }
  })();

  let content: React.ReactNode = null;

  if (loading) {
    content = <Loading label="Loading..." />;
  } else if (screen === "boards") {
    const items = boards.map((b) => ({ label: b.name, value: b, key: b.id }));
    content = (
      <Box flexDirection="column">
        <SelectInput items={items} onSelect={handleBoardSelect} />
        <StatusMsg msg={status} color={statusColor} />
      </Box>
    );
  } else if (screen === "lists") {
    const columnWidth = Math.max(18, Math.floor((contentWidth - 4) / 3));
    const columnGap = 2;
    const maxVisible = Math.max(
      1,
      Math.floor((contentWidth + columnGap) / (columnWidth + columnGap)),
    );
    const maxStart = Math.max(0, lists.length - maxVisible);
    const start = clamp(listIndex - Math.floor(maxVisible / 2), 0, maxStart);
    const visibleLists = lists.slice(start, start + maxVisible);
    const columnHeight = Math.max(3, contentHeight - 1);

    content = (
      <Box flexDirection="row">
        {visibleLists.map((list, idx) => {
          const realIndex = start + idx;
          const isActive = realIndex === listIndex;
          const listCards = cardsByList[list.id] ?? [];
          const selectedIndex = listCardIndex[list.id] ?? 0;
          return (
            <Box
              key={list.id}
              flexDirection="column"
              width={columnWidth}
              marginRight={idx === visibleLists.length - 1 ? 0 : columnGap}
            >
              <ListColumn
                list={list}
                cards={listCards}
                selectedIndex={selectedIndex}
                width={columnWidth}
                height={columnHeight}
                isActive={isActive}
              />
            </Box>
          );
        })}
      </Box>
    );
  } else if (screen === "card_detail" && selectedCard) {
    const actions = [
      { label: "Checklists", value: "checklists" },
      { label: "Komentar", value: "comments" },
      { label: "Edit nama", value: "edit" },
      { label: "Pindahkan", value: "move" },
    ];
    const listWidth = Math.max(20, Math.floor(contentWidth * 0.45));
    const detailWidth = Math.max(20, contentWidth - listWidth - 2);
    content = (
      <Box flexDirection="row">
        <Box flexDirection="column" width={listWidth}>
          <Text color="gray">Aksi</Text>
          <SelectInput items={actions} onSelect={handleCardAction} />
          <StatusMsg msg={status} color={statusColor} />
        </Box>
        <Box flexDirection="column" width={detailWidth} marginLeft={2}>
          <CardDetailPanel card={selectedCard} width={detailWidth} />
        </Box>
      </Box>
    );
  } else if (screen === "create_card") {
    content = (
      <TextInputPanel
        prompt={`Nama card baru di "${selectedList?.name}":`}
        onSubmit={handleCreateCard}
      />
    );
  } else if (screen === "edit_card" && selectedCard) {
    content = (
      <TextInputPanel
        prompt="Nama baru:"
        onSubmit={handleEditCard}
        initialValue={selectedCard.name}
      />
    );
  } else if (screen === "move_card") {
    const items = [
      ...lists
        .filter((l) => l.id !== selectedCard?.idList)
        .map((l) => ({
          label: l.name,
          value: l as TrelloList,
          key: l.id,
        })),
    ];
    content = (
      <Box flexDirection="column">
        <Text color="gray">Pilih list tujuan:</Text>
        <SelectInput items={items} onSelect={handleMoveCard} />
      </Box>
    );
  } else if (screen === "checklists") {
    const items = [
      ...checklists.map((cl) => {
        const total = cl.checkItems.length;
        const done = cl.checkItems.filter(
          (i: TrelloCheckItem) => i.state === "complete",
        ).length;
        return {
          label: `${cl.name}  [${done}/${total}]`,
          value: cl as TrelloChecklist | string,
          key: cl.id,
        };
      }),
      {
        label: "Buat checklist baru",
        value: "add_checklist",
        key: "add_checklist",
      },
    ];
    content = (
      <Box flexDirection="column">
        {checklists.length === 0 && (
          <Text color="gray">Belum ada checklist.</Text>
        )}
        <SelectInput items={items} onSelect={handleChecklistAction} />
        <StatusMsg msg={status} color={statusColor} />
      </Box>
    );
  } else if (screen === "add_checklist") {
    content = (
      <TextInputPanel
        prompt="Nama checklist:"
        onSubmit={handleCreateChecklist}
      />
    );
  } else if (screen === "add_checkitem" && selectedChecklist) {
    const items = [
      ...selectedChecklist.checkItems.map((ci: TrelloCheckItem) => ({
        label: `${ci.state === "complete" ? "[x]" : "[ ]"} ${ci.name}`,
        value: ci as TrelloCheckItem | "add",
        key: ci.id,
      })),
      { label: "Tambah item", value: "add" as const, key: "add" },
    ];
    const total = selectedChecklist.checkItems.length;
    const done = selectedChecklist.checkItems.filter(
      (i: TrelloCheckItem) => i.state === "complete",
    ).length;
    content = (
      <Box flexDirection="column">
        <Text color="gray">
          {selectedChecklist.name} [{done}/{total}]
        </Text>
        <Text color="gray">
          Pilih item untuk toggle [x]/[ ], atau tambah baru:
        </Text>
        <Box marginTop={1}>
          <SelectInput items={items} onSelect={handleCheckItemAction} />
        </Box>
        <StatusMsg msg={status} color={statusColor} />
      </Box>
    );
  } else if (screen === "add_checkitem" && !selectedChecklist) {
    content = <Loading label="Loading checklist..." />;
  } else if (screen === "comments") {
    content = (
      <Box flexDirection="column">
        {comments.length === 0 && <Text color="gray">Belum ada komentar.</Text>}
        {comments.map((c) => (
          <Box key={c.id} flexDirection="column" marginBottom={1}>
            <Text color="cyan" bold>
              {c.memberCreator.fullName}
            </Text>
            <Text color="gray">{new Date(c.date).toLocaleString("id")}</Text>
            <Text>{c.data.text}</Text>
          </Box>
        ))}
        <Box marginTop={1} flexDirection="column">
          <SelectInput
            items={[{ label: "Tambah komentar", value: "add" }]}
            onSelect={(item) => {
              if (item.value === "add") setScreen("add_comment");
            }}
          />
        </Box>
        <StatusMsg msg={status} color={statusColor} />
      </Box>
    );
  } else if (screen === "add_comment") {
    content = (
      <TextInputPanel prompt="Tulis komentar:" onSubmit={handleAddComment} />
    );
  } else {
    content = <Loading label="Loading..." />;
  }

  return (
    <Box flexDirection="column" width={width} height={height}>
      <HeaderBar title={headerTitle} width={width} />
      <Box
        flexDirection="column"
        width={width}
        height={contentHeight}
        paddingX={2}
        paddingY={1}
      >
        <ErrorBanner msg={error} detail={errorDetail} />
        {content}
      </Box>
      <FooterBar hints={footerHints} width={width} />
    </Box>
  );
}
