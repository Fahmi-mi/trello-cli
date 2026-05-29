import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import * as api from "./api.js";
// ── helpers ─────────────────────────────────────────────────────────────────-
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function truncate(text, width) {
    if (width <= 0)
        return "";
    if (text.length <= width)
        return text;
    if (width <= 3)
        return text.slice(0, width);
    return text.slice(0, width - 3) + "...";
}
function HeaderBar({ title, width }) {
    const line = "-".repeat(Math.max(0, width));
    return (_jsxs(Box, { flexDirection: "column", width: width, children: [_jsx(Text, { color: "blue", children: line }), _jsxs(Box, { children: [_jsx(Text, { color: "cyan", bold: true, children: "Trello CLI" }), _jsxs(Text, { color: "white", children: [" ", title] })] }), _jsx(Text, { color: "blue", children: line })] }));
}
function FooterBar({ hints, width }) {
    const line = "-".repeat(Math.max(0, width));
    const text = truncate(hints.join("  "), width);
    return (_jsxs(Box, { flexDirection: "column", width: width, children: [_jsx(Text, { color: "blue", children: line }), _jsx(Text, { color: "gray", children: text })] }));
}
function Loading({ label }) {
    return (_jsxs(Box, { children: [_jsx(Text, { color: "green", children: _jsx(Spinner, { type: "dots" }) }), _jsxs(Text, { children: [" ", label] })] }));
}
function StatusMsg({ msg, color }) {
    return msg ? (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: color || "green", children: msg }) })) : null;
}
function ErrorBanner({ msg, detail }) {
    if (!msg)
        return null;
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { backgroundColor: "red", color: "white", children: " ERROR: " + msg + " " }), detail ? _jsx(Text, { color: "gray", children: detail }) : null] }));
}
// ── Input panels ─────────────────────────────────────────────────------------
function TextInputPanel({ prompt, onSubmit, initialValue = "", }) {
    const [value, setValue] = useState(initialValue);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "yellow", children: prompt }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "gray", children: "> " }), _jsx(TextInput, { value: value, onChange: setValue, onSubmit: onSubmit })] })] }));
}
function ListColumn({ list, cards, selectedIndex, width, height, isActive, }) {
    const innerWidth = Math.max(1, width - 2);
    const header = truncate(`${list.name} (${cards.length})`, innerWidth);
    const items = [...cards.map((card) => card.name), "Buat card baru"];
    const viewHeight = Math.max(1, height - 1);
    const maxStart = Math.max(0, items.length - viewHeight);
    const start = clamp(selectedIndex - Math.floor(viewHeight / 2), 0, maxStart);
    const visible = items.slice(start, start + viewHeight);
    return (_jsxs(Box, { flexDirection: "column", width: width, paddingX: 1, children: [_jsx(Text, { color: isActive ? "cyan" : "gray", children: header }), visible.length === 0 ? (_jsx(Text, { color: "gray", children: "(Kosong)" })) : (visible.map((label, idx) => {
                const realIndex = start + idx;
                const isSelected = isActive && realIndex === selectedIndex;
                const isAction = realIndex === items.length - 1;
                const text = truncate(label, innerWidth);
                return (_jsx(Box, { children: _jsx(Text, { backgroundColor: isSelected ? "cyan" : undefined, color: isSelected ? "black" : isAction ? "cyan" : "white", children: ` ${text}` }) }, `${list.id}-${realIndex}`));
            }))] }));
}
function VerticalDivider({ height }) {
    return (_jsx(Box, { flexDirection: "column", width: 1, height: height, children: Array.from({ length: height }).map((_, index) => (_jsx(Text, { color: "blue", children: "|" }, index))) }));
}
function CardDetailPanel({ card, width, }) {
    if (!card) {
        return _jsx(Text, { color: "gray", children: "Pilih card untuk melihat detail." });
    }
    return (_jsxs(Box, { flexDirection: "column", width: width, children: [_jsx(Text, { color: "cyan", bold: true, children: "Detail Card" }), _jsx(Text, { color: "white", bold: true, children: truncate(card.name, width) }), card.desc ? (_jsx(Text, { color: "gray", children: truncate(card.desc, width) })) : (_jsx(Text, { color: "gray", children: "(Tanpa deskripsi)" })), card.due ? (_jsxs(Text, { color: card.dueComplete ? "green" : "red", children: ["Due: ", new Date(card.due).toLocaleDateString("id"), card.dueComplete ? " (done)" : ""] })) : (_jsx(Text, { color: "gray", children: "Due: -" })), _jsx(Text, { color: "blue", children: card.shortUrl })] }));
}
// ── App ─────────────────────────────────────────────────────────────────-----
export default function App() {
    const { exit } = useApp();
    const { stdout } = useStdout();
    const columns = stdout?.columns ?? 80;
    const rows = stdout?.rows ?? 24;
    const [screen, setScreen] = useState("boards");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [statusColor, setStatusColor] = useState("green");
    const [error, setError] = useState("");
    const [errorDetail, setErrorDetail] = useState("");
    const [boards, setBoards] = useState([]);
    const [lists, setLists] = useState([]);
    const [cardsByList, setCardsByList] = useState({});
    const [checklists, setChecklists] = useState([]);
    const [comments, setComments] = useState([]);
    const [selectedBoard, setSelectedBoard] = useState(null);
    const [selectedList, setSelectedList] = useState(null);
    const [selectedCard, setSelectedCard] = useState(null);
    const [selectedChecklist, setSelectedChecklist] = useState(null);
    const [listIndex, setListIndex] = useState(0);
    const [listCardIndex, setListCardIndex] = useState({});
    const flash = (msg, color = "green") => {
        setStatus(msg);
        setStatusColor(color);
        setTimeout(() => setStatus(""), 3000);
    };
    const showError = (msg, detail = "") => {
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
                .then((b) => {
                setBoards(b);
                setLoading(false);
            })
                .catch((err) => {
                showError("Gagal load boards. Cek API key/token.", err?.message || "");
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
        if (lists.length === 0)
            return;
        setListIndex(0);
        setListCardIndex((prev) => {
            const next = {};
            lists.forEach((list) => {
                next[list.id] = prev[list.id] ?? 0;
            });
            return next;
        });
    }, [lists]);
    useEffect(() => {
        if (lists.length === 0)
            return;
        setListCardIndex((prev) => {
            const next = { ...prev };
            lists.forEach((list) => {
                const maxIndex = cardsByList[list.id]?.length ?? 0;
                const current = next[list.id] ?? 0;
                next[list.id] = clamp(current, 0, maxIndex);
            });
            return next;
        });
    }, [cardsByList, lists]);
    useInput((_input, key) => {
        if (key.escape)
            handleBack();
        if (_input === "q")
            exit();
        if (screen === "lists") {
            if (key.leftArrow) {
                setListIndex((current) => clamp(current - 1, 0, lists.length - 1));
            }
            if (key.rightArrow) {
                setListIndex((current) => clamp(current + 1, 0, lists.length - 1));
            }
            if (key.upArrow) {
                const list = lists[listIndex];
                if (!list)
                    return;
                const maxIndex = cardsByList[list.id]?.length ?? 0;
                setListCardIndex((prev) => {
                    const current = prev[list.id] ?? 0;
                    const next = clamp(current - 1, 0, maxIndex);
                    return { ...prev, [list.id]: next };
                });
            }
            if (key.downArrow) {
                const list = lists[listIndex];
                if (!list)
                    return;
                const maxIndex = cardsByList[list.id]?.length ?? 0;
                setListCardIndex((prev) => {
                    const current = prev[list.id] ?? 0;
                    const next = clamp(current + 1, 0, maxIndex);
                    return { ...prev, [list.id]: next };
                });
            }
            if (key.return) {
                const list = lists[listIndex];
                if (!list)
                    return;
                const listCards = cardsByList[list.id] ?? [];
                const index = listCardIndex[list.id] ?? 0;
                if (index >= listCards.length) {
                    setSelectedList(list);
                    setScreen("create_card");
                }
                else {
                    setSelectedList(list);
                    setSelectedCard(listCards[index]);
                    setScreen("card_detail");
                }
            }
        }
    });
    function handleBack() {
        clearError();
        if (screen === "boards")
            return exit();
        if (screen === "lists")
            setScreen("boards");
        else if (screen === "card_detail")
            setScreen("lists");
        else if (screen === "checklists")
            setScreen("card_detail");
        else if (screen === "add_checklist")
            setScreen("checklists");
        else if (screen === "add_checkitem")
            setScreen("checklists");
        else if (screen === "comments")
            setScreen("card_detail");
        else if (screen === "add_comment")
            setScreen("comments");
        else if (screen === "create_card")
            setScreen("lists");
        else if (screen === "edit_card")
            setScreen("card_detail");
        else if (screen === "move_card")
            setScreen("card_detail");
        else
            setScreen("boards");
    }
    function requireSelectedList() {
        if (!selectedList) {
            showError("List belum dipilih.");
            setScreen("lists");
            return null;
        }
        return selectedList;
    }
    function requireSelectedCard() {
        if (!selectedCard) {
            showError("Card belum dipilih.");
            setScreen("lists");
            return null;
        }
        return selectedCard;
    }
    function requireSelectedChecklist() {
        if (!selectedChecklist) {
            showError("Checklist belum dipilih.");
            setScreen("checklists");
            return null;
        }
        return selectedChecklist;
    }
    // ── Board select ─────────────────────────────────────────────────----------
    async function handleBoardSelect(item) {
        const board = item.value;
        setSelectedBoard(board);
        startLoading();
        try {
            const ls = await api.getLists(board.id);
            const cardsByListEntries = await Promise.all(ls.map(async (list) => ({
                listId: list.id,
                cards: await api.getCards(list.id),
            })));
            const nextCardsByList = {};
            cardsByListEntries.forEach((entry) => {
                nextCardsByList[entry.listId] = entry.cards;
            });
            setLists(ls);
            setCardsByList(nextCardsByList);
            setLoading(false);
            setScreen("lists");
        }
        catch (err) {
            showError("Gagal load lists pada board ini.", err?.message || "");
            setLoading(false);
        }
    }
    async function refreshListCards(listId) {
        const cs = await api.getCards(listId);
        setCardsByList((prev) => ({ ...prev, [listId]: cs }));
        return cs;
    }
    // ── Card detail actions ─────────────────────────────────────────────────---
    async function handleCardAction(item) {
        const action = item.value;
        if (action === "checklists") {
            const card = requireSelectedCard();
            if (!card)
                return;
            startLoading();
            try {
                const cls = await api.getChecklists(card.id);
                setChecklists(cls);
                setLoading(false);
                setScreen("checklists");
            }
            catch (err) {
                showError("Gagal load checklists untuk card ini.", err?.message || "");
                setLoading(false);
            }
        }
        else if (action === "comments") {
            const card = requireSelectedCard();
            if (!card)
                return;
            startLoading();
            try {
                const coms = await api.getComments(card.id);
                setComments(coms);
                setLoading(false);
                setScreen("comments");
            }
            catch (err) {
                showError("Gagal load komentar untuk card ini.", err?.message || "");
                setLoading(false);
            }
        }
        else if (action === "edit") {
            setScreen("edit_card");
        }
        else if (action === "move") {
            setScreen("move_card");
        }
    }
    // ── Create card ─────────────────────────────────────────────────----------
    async function handleCreateCard(name) {
        if (!name.trim())
            return;
        const list = requireSelectedList();
        if (!list)
            return;
        startLoading();
        try {
            await api.createCard(list.id, name.trim());
            await refreshListCards(list.id);
            setLoading(false);
            flash(`Card "${name}" dibuat.`);
            setScreen("lists");
        }
        catch (err) {
            showError("Gagal membuat card baru.", err?.message || "");
            setLoading(false);
        }
    }
    // ── Edit card ─────────────────────────────────────────────────------------
    async function handleEditCard(newName) {
        if (!newName.trim())
            return;
        const card = requireSelectedCard();
        if (!card)
            return;
        startLoading();
        try {
            const updated = await api.updateCard(card.id, { name: newName.trim() });
            setSelectedCard(updated);
            await refreshListCards(updated.idList);
            setLoading(false);
            flash("Card diupdate.");
            setScreen("card_detail");
        }
        catch (err) {
            showError("Gagal mengubah nama card.", err?.message || "");
            setLoading(false);
        }
    }
    // ── Move card ─────────────────────────────────────────────────------------
    async function handleMoveCard(item) {
        const targetList = item.value;
        const card = requireSelectedCard();
        const list = requireSelectedList();
        if (!card || !list)
            return;
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
        }
        catch (err) {
            showError("Gagal memindahkan card.", err?.message || "");
            setLoading(false);
        }
    }
    // ── Checklist actions ─────────────────────────────────────────────────-----
    async function handleChecklistAction(item) {
        if (item.value === "add_checklist")
            return setScreen("add_checklist");
        const cl = item.value;
        setSelectedChecklist(cl);
        setScreen("add_checkitem");
    }
    async function handleCreateChecklist(name) {
        if (!name.trim())
            return;
        const card = requireSelectedCard();
        if (!card)
            return;
        startLoading();
        try {
            await api.createChecklist(card.id, name.trim());
            const cls = await api.getChecklists(card.id);
            setChecklists(cls);
            setLoading(false);
            flash(`Checklist "${name}" dibuat.`);
            setScreen("checklists");
        }
        catch (err) {
            showError("Gagal membuat checklist baru.", err?.message || "");
            setLoading(false);
        }
    }
    async function handleCheckItemAction(item) {
        if (item.value === "add")
            return setScreen("add_checkitem");
        const ci = item.value;
        const newState = ci.state === "complete" ? "incomplete" : "complete";
        const card = requireSelectedCard();
        const checklist = requireSelectedChecklist();
        if (!card || !checklist)
            return;
        startLoading();
        try {
            await api.updateCheckItem(card.id, ci.id, newState);
            const cls = await api.getChecklists(card.id);
            setChecklists(cls);
            const updated = cls.find((c) => c.id === checklist.id) || checklist;
            setSelectedChecklist(updated);
            setLoading(false);
            flash(newState === "complete"
                ? `Item "${ci.name}" selesai.`
                : `Item "${ci.name}" dibatalkan.`);
        }
        catch (err) {
            showError("Gagal memperbarui item checklist.", err?.message || "");
            setLoading(false);
        }
    }
    async function handleAddCheckItem(name) {
        if (!name.trim())
            return;
        const card = requireSelectedCard();
        const checklist = requireSelectedChecklist();
        if (!card || !checklist)
            return;
        startLoading();
        try {
            await api.addCheckItem(checklist.id, name.trim());
            const cls = await api.getChecklists(card.id);
            const updated = cls.find((c) => c.id === checklist.id) || checklist;
            setChecklists(cls);
            setSelectedChecklist(updated);
            setLoading(false);
            flash(`Item "${name}" ditambahkan.`);
            setScreen("add_checkitem");
        }
        catch (err) {
            showError("Gagal menambahkan item checklist.", err?.message || "");
            setLoading(false);
        }
    }
    // ── Comments ─────────────────────────────────────────────────--------------
    async function handleAddComment(text) {
        if (!text.trim())
            return;
        const card = requireSelectedCard();
        if (!card)
            return;
        startLoading();
        try {
            await api.addComment(card.id, text.trim());
            const coms = await api.getComments(card.id);
            setComments(coms);
            setLoading(false);
            flash("Komentar ditambahkan.");
            setScreen("comments");
        }
        catch (err) {
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
    let content = null;
    if (loading) {
        content = _jsx(Loading, { label: "Loading..." });
    }
    else if (screen === "boards") {
        const items = boards.map((b) => ({ label: b.name, value: b, key: b.id }));
        content = (_jsxs(Box, { flexDirection: "column", children: [_jsx(SelectInput, { items: items, onSelect: handleBoardSelect }), _jsx(StatusMsg, { msg: status, color: statusColor })] }));
    }
    else if (screen === "lists") {
        const columnWidth = Math.max(18, Math.floor((contentWidth - 4) / 3));
        const columnGap = 1;
        const maxVisible = Math.max(1, Math.floor((contentWidth + columnGap) / (columnWidth + columnGap)));
        const maxStart = Math.max(0, lists.length - maxVisible);
        const start = clamp(listIndex - Math.floor(maxVisible / 2), 0, maxStart);
        const visibleLists = lists.slice(start, start + maxVisible);
        const columnHeight = Math.max(3, contentHeight - 1);
        content = (_jsx(Box, { flexDirection: "row", children: visibleLists.map((list, idx) => {
                const realIndex = start + idx;
                const isActive = realIndex === listIndex;
                const listCards = cardsByList[list.id] ?? [];
                const selectedIndex = listCardIndex[list.id] ?? 0;
                return (_jsxs(Box, { flexDirection: "row", children: [_jsx(Box, { flexDirection: "column", width: columnWidth, children: _jsx(ListColumn, { list: list, cards: listCards, selectedIndex: selectedIndex, width: columnWidth, height: columnHeight, isActive: isActive }) }), idx === visibleLists.length - 1 ? null : (_jsx(Box, { marginX: columnGap, children: _jsx(VerticalDivider, { height: columnHeight }) }))] }, list.id));
            }) }));
    }
    else if (screen === "card_detail" && selectedCard) {
        const actions = [
            { label: "Checklists", value: "checklists" },
            { label: "Komentar", value: "comments" },
            { label: "Edit nama", value: "edit" },
            { label: "Pindahkan", value: "move" },
        ];
        const listWidth = Math.max(20, Math.floor(contentWidth * 0.45));
        const detailWidth = Math.max(20, contentWidth - listWidth - 2);
        content = (_jsxs(Box, { flexDirection: "row", children: [_jsxs(Box, { flexDirection: "column", width: listWidth, children: [_jsx(Text, { color: "gray", children: "Aksi" }), _jsx(SelectInput, { items: actions, onSelect: handleCardAction }), _jsx(StatusMsg, { msg: status, color: statusColor })] }), _jsx(Box, { flexDirection: "column", width: detailWidth, marginLeft: 2, children: _jsx(CardDetailPanel, { card: selectedCard, width: detailWidth }) })] }));
    }
    else if (screen === "create_card") {
        content = (_jsx(TextInputPanel, { prompt: `Nama card baru di "${selectedList?.name}":`, onSubmit: handleCreateCard }));
    }
    else if (screen === "edit_card" && selectedCard) {
        content = (_jsx(TextInputPanel, { prompt: "Nama baru:", onSubmit: handleEditCard, initialValue: selectedCard.name }));
    }
    else if (screen === "move_card") {
        const items = [
            ...lists
                .filter((l) => l.id !== selectedCard?.idList)
                .map((l) => ({
                label: l.name,
                value: l,
                key: l.id,
            })),
        ];
        content = (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "gray", children: "Pilih list tujuan:" }), _jsx(SelectInput, { items: items, onSelect: handleMoveCard })] }));
    }
    else if (screen === "checklists") {
        const items = [
            ...checklists.map((cl) => {
                const total = cl.checkItems.length;
                const done = cl.checkItems.filter((i) => i.state === "complete").length;
                return {
                    label: `${cl.name}  [${done}/${total}]`,
                    value: cl,
                    key: cl.id,
                };
            }),
            {
                label: "Buat checklist baru",
                value: "add_checklist",
                key: "add_checklist",
            },
        ];
        content = (_jsxs(Box, { flexDirection: "column", children: [checklists.length === 0 && (_jsx(Text, { color: "gray", children: "Belum ada checklist." })), _jsx(SelectInput, { items: items, onSelect: handleChecklistAction }), _jsx(StatusMsg, { msg: status, color: statusColor })] }));
    }
    else if (screen === "add_checklist") {
        content = (_jsx(TextInputPanel, { prompt: "Nama checklist:", onSubmit: handleCreateChecklist }));
    }
    else if (screen === "add_checkitem" && selectedChecklist) {
        const items = [
            ...selectedChecklist.checkItems.map((ci) => ({
                label: `${ci.state === "complete" ? "[x]" : "[ ]"} ${ci.name}`,
                value: ci,
                key: ci.id,
            })),
            { label: "Tambah item", value: "add", key: "add" },
        ];
        const total = selectedChecklist.checkItems.length;
        const done = selectedChecklist.checkItems.filter((i) => i.state === "complete").length;
        content = (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { color: "gray", children: [selectedChecklist.name, " [", done, "/", total, "]"] }), _jsx(Text, { color: "gray", children: "Pilih item untuk toggle [x]/[ ], atau tambah baru:" }), _jsx(Box, { marginTop: 1, children: _jsx(SelectInput, { items: items, onSelect: handleCheckItemAction }) }), _jsx(StatusMsg, { msg: status, color: statusColor })] }));
    }
    else if (screen === "add_checkitem" && !selectedChecklist) {
        content = _jsx(Loading, { label: "Loading checklist..." });
    }
    else if (screen === "comments") {
        content = (_jsxs(Box, { flexDirection: "column", children: [comments.length === 0 && _jsx(Text, { color: "gray", children: "Belum ada komentar." }), comments.map((c) => (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { color: "cyan", bold: true, children: c.memberCreator.fullName }), _jsx(Text, { color: "gray", children: new Date(c.date).toLocaleString("id") }), _jsx(Text, { children: c.data.text })] }, c.id))), _jsx(Box, { marginTop: 1, flexDirection: "column", children: _jsx(SelectInput, { items: [{ label: "Tambah komentar", value: "add" }], onSelect: (item) => {
                            if (item.value === "add")
                                setScreen("add_comment");
                        } }) }), _jsx(StatusMsg, { msg: status, color: statusColor })] }));
    }
    else if (screen === "add_comment") {
        content = (_jsx(TextInputPanel, { prompt: "Tulis komentar:", onSubmit: handleAddComment }));
    }
    else {
        content = _jsx(Loading, { label: "Loading..." });
    }
    return (_jsxs(Box, { flexDirection: "column", width: width, height: height, children: [_jsx(HeaderBar, { title: headerTitle, width: width }), _jsxs(Box, { flexDirection: "column", width: width, height: contentHeight, paddingX: 2, paddingY: 1, children: [_jsx(ErrorBanner, { msg: error, detail: errorDetail }), content] }), _jsx(FooterBar, { hints: footerHints, width: width })] }));
}
