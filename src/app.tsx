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
  | "edit_desc"
  | "view_desc"
  | "move_card"
  | "checklists"
  | "add_checklist"
  | "add_checkitem"
  | "create_checkitem"
  | "comments"
  | "add_comment"
  | "archived_cards"
  | "confirm";

type ConfirmAction =
  | "archive_card"
  | "restore_card"
  | "delete_card"
  | "delete_desc"
  | "delete_checklist"
  | "delete_checkitem";

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

function wrapText(text: string, width: number) {
  if (width <= 0) return [""];
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  paragraphs.forEach((paragraph, idx) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    if (words.length === 0) {
      lines.push("");
    } else {
      words.forEach((word) => {
        if (line.length === 0) {
          line = word;
        } else if (line.length + 1 + word.length <= width) {
          line = `${line} ${word}`;
        } else {
          lines.push(line);
          line = word;
        }
        while (line.length > width) {
          lines.push(line.slice(0, width));
          line = line.slice(width);
        }
      });
      if (line.length > 0) lines.push(line);
    }
    if (idx < paragraphs.length - 1) lines.push("");
  });
  return lines.length > 0 ? lines : [""];
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
      <Text color="white">{text}</Text>
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
      {detail ? <Text color="white">{detail}</Text> : null}
    </Box>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="green">{label}</Text>
      <Text color="blue">{"-".repeat(Math.max(3, label.length))}</Text>
    </Box>
  );
}

function SelectIndicator({ isSelected }: { isSelected?: boolean }) {
  return <Text>{isSelected ? " " : " "}</Text>;
}

function SelectItem({
  label,
  isSelected,
}: {
  label: string;
  isSelected?: boolean;
}) {
  return (
    <Text
      backgroundColor={isSelected ? "cyan" : undefined}
      color={isSelected ? "black" : "white"}
    >
      {` ${label}`}
    </Text>
  );
}

function ConfirmPanel({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Box flexDirection="column">
      <SectionTitle label={title} />
      <Text color="white">{message}</Text>
      <Box marginTop={1}>
        <SelectInput
          items={[
            { label: "Ya", value: "yes" },
            { label: "Batal", value: "no" },
          ]}
          onSelect={(item) => {
            if (item.value === "yes") onConfirm();
            else onCancel();
          }}
          itemComponent={SelectItem}
          indicatorComponent={SelectIndicator}
        />
      </Box>
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
        <Text color="white">{"> "}</Text>
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
  const innerWidth = Math.max(1, width - 2);
  const header = truncate(`${list.name} (${cards.length})`, innerWidth);
  const items = [...cards.map((card) => card.name), "Buat card baru"];
  const viewHeight = Math.max(1, height - 1);
  const maxStart = Math.max(0, items.length - viewHeight);
  const start = clamp(selectedIndex - Math.floor(viewHeight / 2), 0, maxStart);
  const visible = items.slice(start, start + viewHeight);

  return (
    <Box flexDirection="column" width={width} paddingX={1}>
      <Text color={isActive ? "cyan" : "white"}>{header}</Text>
      {visible.length === 0 ? (
        <Text color="white">(Kosong)</Text>
      ) : (
        visible.map((label, idx) => {
          const realIndex = start + idx;
          const isSelected = isActive && realIndex === selectedIndex;
          const isAction = realIndex === items.length - 1;
          const text = truncate(label, innerWidth);
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

function VerticalDivider({ height }: { height: number }) {
  return (
    <Box flexDirection="column" width={1} height={height}>
      {Array.from({ length: height }).map((_, index) => (
        <Text key={index} color="blue">
          |
        </Text>
      ))}
    </Box>
  );
}

function CardDetailPanel({
  card,
  width,
  height,
}: {
  card: TrelloCard | null;
  width: number;
  height: number;
}) {
  if (!card) {
    return <Text color="white">Pilih card untuk melihat detail.</Text>;
  }
  const descText = card.desc?.trim() || "(Tanpa deskripsi)";
  const descPreview = truncate(descText, width);

  return (
    <Box flexDirection="column" width={width}>
      <Text color="cyan" bold>
        Detail Card
      </Text>
      <Text color="white" bold>
        {truncate(card.name, width)}
      </Text>
      <Text color="white">{descPreview}</Text>
      {card.due ? (
        <Text color={card.dueComplete ? "green" : "red"}>
          Due: {new Date(card.due).toLocaleDateString("id")}
          {card.dueComplete ? " (done)" : ""}
        </Text>
      ) : (
        <Text color="white">Due: -</Text>
      )}
      <Text color="blue">{card.shortUrl}</Text>
    </Box>
  );
}

// ── App ─────────────────────────────────────────────────────────────────-----

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
  const [archivedCards, setArchivedCards] = useState<TrelloCard[]>([]);
  const [archivedList, setArchivedList] = useState<TrelloList | null>(null);
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
  const [descScroll, setDescScroll] = useState(0);
  const [descDraft, setDescDraft] = useState("");
  const [blinkOn, setBlinkOn] = useState(true);
  const [highlightChecklistId, setHighlightChecklistId] = useState<
    string | null
  >(null);
  const [highlightCheckItem, setHighlightCheckItem] =
    useState<TrelloCheckItem | null>(null);
  const [highlightArchivedCard, setHighlightArchivedCard] =
    useState<TrelloCard | null>(null);
  const [confirmState, setConfirmState] = useState<{
    type: ConfirmAction;
    returnScreen: Screen;
    checklistId?: string;
    checkItemId?: string;
  } | null>(null);

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

  // ── Load boards ─────────────────────────────────────────────────----------
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
    if (screen === "boards") {
      setArchivedCards([]);
      setArchivedList(null);
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

  useEffect(() => {
    setHighlightCheckItem(null);
  }, [selectedChecklist?.id, screen]);

  useEffect(() => {
    if (screen !== "archived_cards") {
      setHighlightArchivedCard(null);
      return;
    }
    setHighlightArchivedCard(archivedCards[0] ?? null);
  }, [archivedCards, screen]);

  useEffect(() => {
    if (screen !== "view_desc") return;
    setDescScroll(0);
  }, [screen, selectedCard?.id]);

  useEffect(() => {
    if (screen !== "edit_desc") return;
    setDescDraft(selectedCard?.desc || "");
    setDescScroll(0);
  }, [screen, selectedCard?.id]);

  useEffect(() => {
    if (screen !== "edit_desc") return;
    const id = setInterval(() => {
      setBlinkOn((current) => !current);
    }, 500);
    return () => clearInterval(id);
  }, [screen]);

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
      if (_input === "v") {
        const list = lists[listIndex];
        if (!list) return;
        setSelectedList(list);
        setArchivedList(list);
        startLoading();
        api
          .getArchivedCards(list.id)
          .then((cards) => {
            setArchivedCards(cards);
            setLoading(false);
            setScreen("archived_cards");
          })
          .catch((err) => {
            showError("Gagal load arsip card.", err?.message || "");
            setLoading(false);
          });
      }
      if (_input === "a" || _input === "d") {
        const list = lists[listIndex];
        if (!list) return;
        const listCards = cardsByList[list.id] ?? [];
        const index = listCardIndex[list.id] ?? 0;
        const card = listCards[index];
        if (!card) return;
        setSelectedList(list);
        setSelectedCard(card);
        setConfirmState({
          type: _input === "a" ? "archive_card" : "delete_card",
          returnScreen: "lists",
        });
        setScreen("confirm");
      }
    }
    if (screen === "card_detail" && _input === "a") {
      setConfirmState({ type: "archive_card", returnScreen: "card_detail" });
      setScreen("confirm");
    }
    if (screen === "card_detail" && _input === "d") {
      setConfirmState({ type: "delete_card", returnScreen: "card_detail" });
      setScreen("confirm");
    }
    if (screen === "checklists" && _input === "d") {
      if (!highlightChecklistId) {
        showError("Checklist belum dipilih.");
        return;
      }
      setConfirmState({
        type: "delete_checklist",
        returnScreen: "checklists",
        checklistId: highlightChecklistId,
      });
      setScreen("confirm");
    }
    if (screen === "add_checkitem" && _input === "d") {
      if (!highlightCheckItem) {
        showError("Item checklist belum dipilih.");
        return;
      }
      setConfirmState({
        type: "delete_checkitem",
        returnScreen: "add_checkitem",
        checklistId: highlightCheckItem.idChecklist,
        checkItemId: highlightCheckItem.id,
      });
      setScreen("confirm");
    }
    if (screen === "archived_cards" && (_input === "r" || _input === "d")) {
      if (!highlightArchivedCard) {
        showError("Card arsip belum dipilih.");
        return;
      }
      setSelectedCard(highlightArchivedCard);
      setConfirmState({
        type: _input === "r" ? "restore_card" : "delete_card",
        returnScreen: "archived_cards",
      });
      setScreen("confirm");
    }
    if (screen === "view_desc") {
      const viewWidth = Math.max(20, (stdout?.columns ?? 80) - 4);
      const viewHeight = Math.max(1, Math.max(10, rows) - 3 - 2 - 2 - 3);
      const desc = selectedCard?.desc?.trim() || "(Tanpa deskripsi)";
      const lines = wrapText(desc, viewWidth);
      const maxStart = Math.max(0, lines.length - viewHeight);
      if (key.upArrow) {
        setDescScroll((current) => Math.max(0, current - 1));
      }
      if (key.downArrow) {
        setDescScroll((current) => Math.min(maxStart, current + 1));
      }
    }
    if (screen === "edit_desc") {
      const viewWidth = Math.max(20, (stdout?.columns ?? 80) - 4);
      const viewHeight = Math.max(1, Math.max(10, rows) - 3 - 2 - 2 - 4);
      const lines = wrapText(descDraft || "(Kosong)", viewWidth);
      const maxStart = Math.max(0, lines.length - viewHeight);
      if (key.ctrl && _input === "s") {
        handleEditDescription(descDraft);
        return;
      }
      if (key.upArrow) {
        setDescScroll((current) => Math.max(0, current - 1));
        return;
      }
      if (key.downArrow) {
        setDescScroll((current) => Math.min(maxStart, current + 1));
        return;
      }
      if (key.return) {
        const nextDraft = `${descDraft}\n`;
        setDescDraft(nextDraft);
        const nextLines = wrapText(nextDraft, viewWidth);
        const nextMax = Math.max(0, nextLines.length - viewHeight);
        setDescScroll(nextMax);
        return;
      }
      if (key.backspace || key.delete) {
        if (descDraft.length === 0) return;
        const nextDraft = descDraft.slice(0, -1);
        setDescDraft(nextDraft);
        const nextLines = wrapText(nextDraft || "(Kosong)", viewWidth);
        const nextMax = Math.max(0, nextLines.length - viewHeight);
        setDescScroll(Math.min(descScroll, nextMax));
        return;
      }
      if (_input && _input.length === 1 && !key.ctrl && !key.meta) {
        const nextDraft = `${descDraft}${_input}`;
        setDescDraft(nextDraft);
        const nextLines = wrapText(nextDraft, viewWidth);
        const nextMax = Math.max(0, nextLines.length - viewHeight);
        setDescScroll(nextMax);
      }
    }
  });

  function handleBack() {
    clearError();
    if (screen === "confirm" && confirmState) {
      setConfirmState(null);
      setScreen(confirmState.returnScreen);
      return;
    }
    if (screen === "boards") return exit();
    if (screen === "lists") setScreen("boards");
    else if (screen === "archived_cards") setScreen("lists");
    else if (screen === "card_detail") setScreen("lists");
    else if (screen === "checklists") setScreen("card_detail");
    else if (screen === "add_checklist") setScreen("checklists");
    else if (screen === "add_checkitem") setScreen("checklists");
    else if (screen === "create_checkitem") setScreen("add_checkitem");
    else if (screen === "comments") setScreen("card_detail");
    else if (screen === "add_comment") setScreen("comments");
    else if (screen === "create_card") setScreen("lists");
    else if (screen === "edit_card") setScreen("card_detail");
    else if (screen === "edit_desc") setScreen("card_detail");
    else if (screen === "view_desc") setScreen("card_detail");
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

  // ── Board select ─────────────────────────────────────────────────----------
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

  async function refreshListCards(listId: string) {
    const cs = await api.getCards(listId);
    setCardsByList((prev) => ({ ...prev, [listId]: cs }));
    return cs;
  }

  async function refreshArchivedCards(listId: string) {
    const cs = await api.getArchivedCards(listId);
    setArchivedCards(cs);
    return cs;
  }

  async function refreshChecklists(cardId: string) {
    const cls = await api.getChecklists(cardId);
    setChecklists(cls);
    return cls;
  }

  // ── Card detail actions ─────────────────────────────────────────────────---
  async function handleCardAction(item: { value: string }) {
    const action = item.value;
    if (action === "checklists") {
      const card = requireSelectedCard();
      if (!card) return;
      startLoading();
      try {
        await refreshChecklists(card.id);
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
    } else if (action === "edit_desc") {
      setScreen("edit_desc");
    } else if (action === "delete_desc") {
      setConfirmState({ type: "delete_desc", returnScreen: "card_detail" });
      setScreen("confirm");
    } else if (action === "view_desc") {
      setScreen("view_desc");
    } else if (action === "move") {
      setScreen("move_card");
    } else if (action === "archive") {
      setConfirmState({ type: "archive_card", returnScreen: "card_detail" });
      setScreen("confirm");
    } else if (action === "delete") {
      setConfirmState({ type: "delete_card", returnScreen: "card_detail" });
      setScreen("confirm");
    }
  }

  // ── Create card ─────────────────────────────────────────────────----------
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

  // ── Edit card ─────────────────────────────────────────────────------------
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

  async function handleEditDescription(newDesc: string) {
    const card = requireSelectedCard();
    if (!card) return;
    startLoading();
    try {
      const updated = await api.updateCard(card.id, {
        desc: newDesc.trim(),
      });
      setSelectedCard(updated);
      await refreshListCards(updated.idList);
      setLoading(false);
      flash("Deskripsi diperbarui.");
      setScreen("card_detail");
    } catch (err: any) {
      showError("Gagal mengubah deskripsi card.", err?.message || "");
      setLoading(false);
    }
  }

  // ── Move card ─────────────────────────────────────────────────------------
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

  // ── Checklist actions ─────────────────────────────────────────────────-----
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
      await refreshChecklists(card.id);
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
    if (item.value === "add") return setScreen("create_checkitem");
    const ci = item.value as TrelloCheckItem;
    const newState = ci.state === "complete" ? "incomplete" : "complete";
    const card = requireSelectedCard();
    const checklist = requireSelectedChecklist();
    if (!card || !checklist) return;
    startLoading();
    try {
      await api.updateCheckItem(card.id, ci.id, newState);
      const cls = await refreshChecklists(card.id);
      const updated = cls.find((c) => c.id === checklist.id) || checklist;
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
      const cls = await refreshChecklists(card.id);
      const updated = cls.find((c) => c.id === checklist.id) || checklist;
      setSelectedChecklist(updated);
      setLoading(false);
      flash(`Item "${name}" ditambahkan.`);
      setScreen("add_checkitem");
    } catch (err: any) {
      showError("Gagal menambahkan item checklist.", err?.message || "");
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!confirmState) return;
    startLoading();
    try {
      if (confirmState.type === "archive_card") {
        const card = requireSelectedCard();
        if (!card) return;
        await api.archiveCard(card.id);
        await refreshListCards(card.idList);
        setSelectedCard(null);
        setLoading(false);
        flash("Card diarsipkan.");
        setScreen("lists");
      } else if (confirmState.type === "restore_card") {
        const card = requireSelectedCard();
        if (!card) return;
        await api.unarchiveCard(card.id);
        await refreshListCards(card.idList);
        if (archivedList) {
          await refreshArchivedCards(archivedList.id);
        }
        setSelectedCard(null);
        setLoading(false);
        flash("Card dikembalikan ke list.");
        setScreen("archived_cards");
      } else if (confirmState.type === "delete_card") {
        const card = requireSelectedCard();
        if (!card) return;
        await api.deleteCard(card.id);
        await refreshListCards(card.idList);
        if (confirmState.returnScreen === "archived_cards" && archivedList) {
          await refreshArchivedCards(archivedList.id);
        }
        setSelectedCard(null);
        setLoading(false);
        flash("Card dihapus.");
        setScreen(
          confirmState.returnScreen === "archived_cards"
            ? "archived_cards"
            : "lists",
        );
      } else if (confirmState.type === "delete_desc") {
        const card = requireSelectedCard();
        if (!card) return;
        const updated = await api.updateCard(card.id, { desc: "" });
        setSelectedCard(updated);
        await refreshListCards(updated.idList);
        setLoading(false);
        flash("Deskripsi dihapus.");
        setScreen("card_detail");
      } else if (confirmState.type === "delete_checklist") {
        const card = requireSelectedCard();
        if (!card || !confirmState.checklistId) return;
        await api.deleteChecklist(confirmState.checklistId);
        await refreshChecklists(card.id);
        setLoading(false);
        flash("Checklist dihapus.");
        setScreen("checklists");
      } else if (confirmState.type === "delete_checkitem") {
        const card = requireSelectedCard();
        if (!card || !confirmState.checklistId || !confirmState.checkItemId)
          return;
        await api.deleteCheckItem(
          confirmState.checklistId,
          confirmState.checkItemId,
        );
        const cls = await refreshChecklists(card.id);
        if (selectedChecklist) {
          const updated =
            cls.find((c) => c.id === selectedChecklist.id) || null;
          setSelectedChecklist(updated);
        }
        setLoading(false);
        flash("Item checklist dihapus.");
        setScreen("add_checkitem");
      }
      setConfirmState(null);
    } catch (err: any) {
      showError("Aksi gagal dijalankan.", err?.message || "");
      setLoading(false);
      setScreen(confirmState.returnScreen);
    }
  }

  // ── Comments ─────────────────────────────────────────────────--------------
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
  const contentWidth = Math.max(20, width - 12);

  const headerTitle = (() => {
    switch (screen) {
      case "boards":
        return "Boards";
      case "lists":
        return selectedBoard ? `Board: ${selectedBoard.name}` : "Lists";
      case "archived_cards":
        return archivedList ? `Arsip: ${archivedList.name}` : "Arsip Cards";
      case "card_detail":
        return selectedCard ? `Card: ${selectedCard.name}` : "Card";
      case "create_card":
        return "Buat Card Baru";
      case "edit_card":
        return "Edit Card";
      case "edit_desc":
        return "Edit Deskripsi";
      case "view_desc":
        return "Deskripsi";
      case "move_card":
        return "Pindahkan Card";
      case "checklists":
        return "Checklists";
      case "add_checklist":
        return "Buat Checklist";
      case "add_checkitem":
        return "Checklist Items";
      case "create_checkitem":
        return "Tambah Item";
      case "comments":
        return "Komentar";
      case "add_comment":
        return "Tambah Komentar";
      case "confirm":
        return "Konfirmasi";
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
          "V: card yang diarsipkan",
          "A: arsip",
          "D: hapus",
          "Esc: back",
          "Q: quit",
        ];
      case "archived_cards":
        return [
          "Up/Down: navigasi",
          "Enter: buka",
          "R: kembalikan",
          "D: hapus",
          "Esc: back",
          "Q: quit",
        ];
      case "card_detail":
        return [
          "Up/Down: navigasi",
          "Enter: pilih",
          "A: arsip",
          "D: hapus",
          "Esc: back",
          "Q: quit",
        ];
      case "checklists":
        return [
          "Up/Down: navigasi",
          "Enter: pilih",
          "D: hapus",
          "Esc: back",
          "Q: quit",
        ];
      case "comments":
        return ["Up/Down: navigasi", "Enter: pilih", "Esc: back", "Q: quit"];
      case "view_desc":
        return ["Up/Down: scroll", "Esc: back", "Q: quit"];
      case "edit_desc":
        return [
          "Ctrl+S: simpan",
          "Enter: baris baru",
          "Up/Down: scroll",
          "Esc: back",
          "Q: quit",
        ];
      case "confirm":
        return ["Up/Down: navigasi", "Enter: pilih", "Esc: back", "Q: quit"];
      case "create_card":
      case "edit_card":
      case "add_checklist":
      case "add_comment":
        return ["Enter: simpan", "Esc: back", "Q: quit"];
      case "add_checkitem":
        return [
          "Up/Down: navigasi",
          "Enter: pilih",
          "D: hapus",
          "Esc: back",
          "Q: quit",
        ];
      case "create_checkitem":
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
    const items = boards.map((b) => ({
      label: truncate(b.name, contentWidth),
      value: b,
      key: b.id,
    }));
    content = (
      <Box flexDirection="column">
        <SectionTitle label="Boards" />
        <SelectInput
          items={items}
          onSelect={handleBoardSelect}
          itemComponent={SelectItem}
          indicatorComponent={SelectIndicator}
        />
        <StatusMsg msg={status} color={statusColor} />
      </Box>
    );
  } else if (screen === "lists") {
    const columnWidth = Math.max(18, Math.floor((contentWidth - 4) / 3));
    const columnGap = 1;
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
            <Box key={list.id} flexDirection="row">
              <Box flexDirection="column" width={columnWidth}>
                <ListColumn
                  list={list}
                  cards={listCards}
                  selectedIndex={selectedIndex}
                  width={columnWidth}
                  height={columnHeight}
                  isActive={isActive}
                />
              </Box>
              {idx === visibleLists.length - 1 ? null : (
                <Box marginX={columnGap}>
                  <VerticalDivider height={columnHeight} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    );
  } else if (screen === "card_detail" && selectedCard) {
    const descLabel = selectedCard.desc?.trim()
      ? "Edit deskripsi"
      : "Tambah deskripsi";
    const actions = [
      { label: "Edit nama", value: "edit" },
      { label: "Lihat deskripsi", value: "view_desc" },
      { label: descLabel, value: "edit_desc" },
      { label: "Hapus deskripsi", value: "delete_desc" },
      { label: "Checklists", value: "checklists" },
      { label: "Komentar", value: "comments" },
      { label: "Pindahkan", value: "move" },
    ];
    const listWidth = Math.max(20, Math.floor(contentWidth * 0.45));
    const detailWidth = Math.max(20, contentWidth - listWidth - 2);
    content = (
      <Box flexDirection="row">
        <Box flexDirection="column" width={listWidth}>
          <SectionTitle label="Aksi" />
          <SelectInput
            items={actions}
            onSelect={handleCardAction}
            itemComponent={SelectItem}
            indicatorComponent={SelectIndicator}
          />
          <StatusMsg msg={status} color={statusColor} />
        </Box>
        <Box flexDirection="column" width={detailWidth} marginLeft={2}>
          <CardDetailPanel
            card={selectedCard}
            width={detailWidth}
            height={contentHeight}
          />
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
  } else if (screen === "edit_desc" && selectedCard) {
    const lines = wrapText(descDraft || "(Kosong)", contentWidth);
    const viewHeight = Math.max(1, contentHeight - 6);
    const maxStart = Math.max(0, lines.length - viewHeight);
    const start = clamp(descScroll, 0, maxStart);
    const visible = lines.slice(start, start + viewHeight);
    const cursorLine = lines.length - 1;
    content = (
      <Box flexDirection="column">
        <SectionTitle label="Edit Deskripsi" />
        <Text color="cyan">Ctrl+S simpan, Enter baris baru.</Text>
        {visible.map((line, idx) => {
          const lineIndex = start + idx;
          const isCursor = lineIndex === cursorLine;
          const renderedLine = isCursor
            ? `${line}${blinkOn ? "|" : " "}`
            : line;
          return (
            <Text key={`desc-edit-${idx}`} color="white">
              {renderedLine}
            </Text>
          );
        })}
      </Box>
    );
  } else if (screen === "view_desc" && selectedCard) {
    const desc = selectedCard.desc?.trim() || "(Tanpa deskripsi)";
    const lines = wrapText(desc, contentWidth);
    const viewHeight = Math.max(1, contentHeight - 5);
    const maxStart = Math.max(0, lines.length - viewHeight);
    const start = clamp(descScroll, 0, maxStart);
    const visible = lines.slice(start, start + viewHeight);
    content = (
      <Box flexDirection="column">
        <SectionTitle label="Deskripsi" />
        {visible.map((line, idx) => (
          <Text key={`desc-view-${idx}`} color="white">
            {line}
          </Text>
        ))}
      </Box>
    );
  } else if (screen === "move_card") {
    const items = [
      ...lists
        .filter((l) => l.id !== selectedCard?.idList)
        .map((l) => ({
          label: truncate(l.name, contentWidth),
          value: l as TrelloList,
          key: l.id,
        })),
    ];
    content = (
      <Box flexDirection="column">
        <SectionTitle label="Pilih list tujuan" />
        <SelectInput
          items={items}
          onSelect={handleMoveCard}
          itemComponent={SelectItem}
          indicatorComponent={SelectIndicator}
        />
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
          label: truncate(`${cl.name}  [${done}/${total}]`, contentWidth),
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
        <SectionTitle label="Checklists" />
        {checklists.length === 0 && (
          <Text color="white">Belum ada checklist.</Text>
        )}
        <SelectInput
          items={items}
          onSelect={handleChecklistAction}
          onHighlight={(item) => {
            const value = item.value as TrelloChecklist | string;
            if (typeof value === "string") setHighlightChecklistId(null);
            else setHighlightChecklistId(value.id);
          }}
          itemComponent={SelectItem}
          indicatorComponent={SelectIndicator}
        />
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
        label: truncate(
          `${ci.state === "complete" ? "[x]" : "[ ]"} ${ci.name}`,
          contentWidth,
        ),
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
        <Text color="white">
          {selectedChecklist.name} [{done}/{total}]
        </Text>
        <Text color="white">
          Pilih item untuk toggle [x]/[ ], atau tambah baru:
        </Text>
        <Box marginTop={1}>
          <SelectInput
            items={items}
            onSelect={handleCheckItemAction}
            onHighlight={(item) => {
              const value = item.value as TrelloCheckItem | "add";
              if (value === "add") setHighlightCheckItem(null);
              else setHighlightCheckItem(value);
            }}
            itemComponent={SelectItem}
            indicatorComponent={SelectIndicator}
          />
        </Box>
        <StatusMsg msg={status} color={statusColor} />
      </Box>
    );
  } else if (screen === "create_checkitem") {
    content = (
      <TextInputPanel
        prompt="Nama item checklist:"
        onSubmit={handleAddCheckItem}
      />
    );
  } else if (screen === "add_checkitem" && !selectedChecklist) {
    content = <Loading label="Loading checklist..." />;
  } else if (screen === "archived_cards") {
    const items = archivedCards.map((c) => ({
      label: truncate(c.name, contentWidth),
      value: c as TrelloCard,
      key: c.id,
    }));
    content = (
      <Box flexDirection="column">
        <SectionTitle label="Arsip Card" />
        {archivedCards.length === 0 && (
          <Text color="white">Tidak ada card terarsip.</Text>
        )}
        {archivedCards.length > 0 && (
          <SelectInput
            items={items}
            onSelect={(item) => {
              const card = item.value as TrelloCard;
              setSelectedCard(card);
              setScreen("card_detail");
            }}
            onHighlight={(item) => {
              setHighlightArchivedCard(item.value as TrelloCard);
            }}
            itemComponent={SelectItem}
            indicatorComponent={SelectIndicator}
          />
        )}
      </Box>
    );
  } else if (screen === "confirm" && confirmState) {
    const titleMap: Record<ConfirmAction, string> = {
      archive_card: "Arsipkan card",
      restore_card: "Kembalikan card",
      delete_card: "Hapus card",
      delete_desc: "Hapus deskripsi",
      delete_checklist: "Hapus checklist",
      delete_checkitem: "Hapus item",
    };
    const messageMap: Record<ConfirmAction, string> = {
      archive_card: "Card akan dipindahkan ke arsip.",
      restore_card: "Card akan dikembalikan ke list.",
      delete_card: "Card akan dihapus permanen.",
      delete_desc: "Deskripsi card akan dihapus.",
      delete_checklist: "Checklist akan dihapus permanen.",
      delete_checkitem: "Item checklist akan dihapus permanen.",
    };
    content = (
      <ConfirmPanel
        title={titleMap[confirmState.type]}
        message={messageMap[confirmState.type]}
        onConfirm={handleConfirm}
        onCancel={() => {
          setConfirmState(null);
          setScreen(confirmState.returnScreen);
        }}
      />
    );
  } else if (screen === "comments") {
    content = (
      <Box flexDirection="column">
        <SectionTitle label="Komentar" />
        {comments.length === 0 && (
          <Text color="white">Belum ada komentar.</Text>
        )}
        {comments.map((c) => (
          <Box key={c.id} flexDirection="column" marginBottom={1}>
            <Text color="cyan" bold>
              {c.memberCreator.fullName}
            </Text>
            <Text color="white">{new Date(c.date).toLocaleString("id")}</Text>
            <Text>{c.data.text}</Text>
          </Box>
        ))}
        <Box marginTop={1} flexDirection="column">
          <SelectInput
            items={[{ label: "Tambah komentar", value: "add" }]}
            onSelect={(item) => {
              if (item.value === "add") setScreen("add_comment");
            }}
            itemComponent={SelectItem}
            indicatorComponent={SelectIndicator}
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
