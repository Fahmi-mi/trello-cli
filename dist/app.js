import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import * as api from './api.js';
// ── helpers ──────────────────────────────────────────────────────────────────
function Header({ title }) {
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Box, { children: _jsx(Text, { bold: true, color: "blueBright", children: '━'.repeat(50) }) }), _jsxs(Text, { bold: true, color: "cyanBright", children: [' 🗂  Trello CLI  ', _jsxs(Text, { color: "white", children: ["\u203A ", title] })] }), _jsx(Box, { children: _jsx(Text, { bold: true, color: "blueBright", children: '━'.repeat(50) }) })] }));
}
function Loading({ label }) {
    return (_jsxs(Box, { children: [_jsx(Text, { color: "green", children: _jsx(Spinner, { type: "dots" }) }), _jsxs(Text, { children: [" ", label] })] }));
}
function StatusMsg({ msg, color }) {
    return msg ? (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: color || 'green', children: msg }) })) : null;
}
// ── TextInputScreen ───────────────────────────────────────────────────────────
function TextInputScreen({ title, prompt, onSubmit, onBack, initialValue = '', }) {
    const [value, setValue] = useState(initialValue);
    useInput((input, key) => {
        if (key.escape)
            onBack();
    });
    return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Header, { title: title }), _jsx(Text, { color: "yellow", children: prompt }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "gray", children: '> ' }), _jsx(TextInput, { value: value, onChange: setValue, onSubmit: onSubmit })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", children: "[ESC] back" }) })] }));
}
// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
    const { exit } = useApp();
    const [screen, setScreen] = useState('boards');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [statusColor, setStatusColor] = useState('green');
    const [boards, setBoards] = useState([]);
    const [lists, setLists] = useState([]);
    const [cards, setCards] = useState([]);
    const [checklists, setChecklists] = useState([]);
    const [comments, setComments] = useState([]);
    const [selectedBoard, setSelectedBoard] = useState(null);
    const [selectedList, setSelectedList] = useState(null);
    const [selectedCard, setSelectedCard] = useState(null);
    const [selectedChecklist, setSelectedChecklist] = useState(null);
    const flash = (msg, color = 'green') => {
        setStatus(msg);
        setStatusColor(color);
        setTimeout(() => setStatus(''), 3000);
    };
    // ── Load boards ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (screen === 'boards') {
            setLoading(true);
            api.getBoards().then((b) => { setBoards(b); setLoading(false); }).catch(() => {
                flash('❌ Gagal load boards. Cek API key/token.', 'red');
                setLoading(false);
            });
        }
    }, [screen]);
    useInput((_input, key) => {
        if (key.escape)
            handleBack();
        if (_input === 'q')
            exit();
    });
    function handleBack() {
        if (screen === 'boards')
            return exit();
        if (screen === 'lists')
            setScreen('boards');
        else if (screen === 'cards')
            setScreen('lists');
        else if (screen === 'card_detail')
            setScreen('cards');
        else if (screen === 'checklists')
            setScreen('card_detail');
        else if (screen === 'add_checklist')
            setScreen('checklists');
        else if (screen === 'add_checkitem')
            setScreen('checklists');
        else if (screen === 'comments')
            setScreen('card_detail');
        else if (screen === 'add_comment')
            setScreen('comments');
        else if (screen === 'create_card')
            setScreen('cards');
        else if (screen === 'edit_card')
            setScreen('card_detail');
        else if (screen === 'move_card')
            setScreen('card_detail');
        else
            setScreen('boards');
    }
    // ── Board select ─────────────────────────────────────────────────────────────
    async function handleBoardSelect(item) {
        const board = item.value;
        setSelectedBoard(board);
        setLoading(true);
        const ls = await api.getLists(board.id);
        setLists(ls);
        setLoading(false);
        setScreen('lists');
    }
    // ── List select ──────────────────────────────────────────────────────────────
    async function handleListSelect(item) {
        if (item.value === 'back')
            return handleBack();
        const list = item.value;
        setSelectedList(list);
        setLoading(true);
        const cs = await api.getCards(list.id);
        setCards(cs);
        setLoading(false);
        setScreen('cards');
    }
    // ── Card select ──────────────────────────────────────────────────────────────
    async function handleCardSelect(item) {
        if (item.value === 'back')
            return handleBack();
        if (item.value === 'create')
            return setScreen('create_card');
        const card = item.value;
        setSelectedCard(card);
        setScreen('card_detail');
    }
    // ── Card detail actions ──────────────────────────────────────────────────────
    async function handleCardAction(item) {
        const action = item.value;
        if (action === 'back')
            return handleBack();
        if (action === 'checklists') {
            setLoading(true);
            const cls = await api.getChecklists(selectedCard.id);
            setChecklists(cls);
            setLoading(false);
            setScreen('checklists');
        }
        else if (action === 'comments') {
            setLoading(true);
            const coms = await api.getComments(selectedCard.id);
            setComments(coms);
            setLoading(false);
            setScreen('comments');
        }
        else if (action === 'edit') {
            setScreen('edit_card');
        }
        else if (action === 'move') {
            setScreen('move_card');
        }
    }
    // ── Create card ──────────────────────────────────────────────────────────────
    async function handleCreateCard(name) {
        if (!name.trim())
            return;
        setLoading(true);
        await api.createCard(selectedList.id, name.trim());
        const cs = await api.getCards(selectedList.id);
        setCards(cs);
        setLoading(false);
        flash(`✅ Card "${name}" dibuat!`);
        setScreen('cards');
    }
    // ── Edit card ────────────────────────────────────────────────────────────────
    async function handleEditCard(newName) {
        if (!newName.trim())
            return;
        setLoading(true);
        const updated = await api.updateCard(selectedCard.id, { name: newName.trim() });
        setSelectedCard(updated);
        setLoading(false);
        flash(`✅ Card diupdate!`);
        setScreen('card_detail');
    }
    // ── Move card ────────────────────────────────────────────────────────────────
    async function handleMoveCard(item) {
        if (item.value === 'back')
            return handleBack();
        const targetList = item.value;
        setLoading(true);
        const updated = await api.updateCard(selectedCard.id, { idList: targetList.id });
        setSelectedCard(updated);
        const cs = await api.getCards(selectedList.id);
        setCards(cs);
        setLoading(false);
        flash(`✅ Card dipindah ke "${targetList.name}"!`);
        setScreen('card_detail');
    }
    // ── Checklist actions ────────────────────────────────────────────────────────
    async function handleChecklistAction(item) {
        if (item.value === 'back')
            return handleBack();
        if (item.value === 'add_checklist')
            return setScreen('add_checklist');
        const cl = item.value;
        setSelectedChecklist(cl);
        setScreen('add_checkitem');
    }
    async function handleCreateChecklist(name) {
        if (!name.trim())
            return;
        setLoading(true);
        await api.createChecklist(selectedCard.id, name.trim());
        const cls = await api.getChecklists(selectedCard.id);
        setChecklists(cls);
        setLoading(false);
        flash(`✅ Checklist "${name}" dibuat!`);
        setScreen('checklists');
    }
    async function handleCheckItemAction(item) {
        if (item.value === 'back') {
            setLoading(true);
            const cls = await api.getChecklists(selectedCard.id);
            setChecklists(cls);
            setLoading(false);
            return setScreen('checklists');
        }
        if (item.value === 'add')
            return setScreen('add_checkitem');
        const ci = item.value;
        const newState = ci.state === 'complete' ? 'incomplete' : 'complete';
        setLoading(true);
        await api.updateCheckItem(selectedCard.id, ci.id, newState);
        const cls = await api.getChecklists(selectedCard.id);
        setChecklists(cls);
        const updated = cls.find((c) => c.id === selectedChecklist.id) || selectedChecklist;
        setSelectedChecklist(updated);
        setLoading(false);
        flash(newState === 'complete' ? `✅ "${ci.name}" selesai!` : `↩ "${ci.name}" di-uncheck`);
    }
    async function handleAddCheckItem(name) {
        if (!name.trim())
            return;
        setLoading(true);
        await api.addCheckItem(selectedChecklist.id, name.trim());
        const cls = await api.getChecklists(selectedCard.id);
        const updated = cls.find((c) => c.id === selectedChecklist.id) || selectedChecklist;
        setChecklists(cls);
        setSelectedChecklist(updated);
        setLoading(false);
        flash(`✅ Item "${name}" ditambahkan!`);
        setScreen('add_checkitem');
    }
    // ── Comments ─────────────────────────────────────────────────────────────────
    async function handleAddComment(text) {
        if (!text.trim())
            return;
        setLoading(true);
        await api.addComment(selectedCard.id, text.trim());
        const coms = await api.getComments(selectedCard.id);
        setComments(coms);
        setLoading(false);
        flash('✅ Komentar ditambahkan!');
        setScreen('comments');
    }
    // ── Render ───────────────────────────────────────────────────────────────────
    if (loading)
        return _jsx(Loading, { label: "Loading..." });
    // BOARDS
    if (screen === 'boards') {
        const items = boards.map((b) => ({ label: b.name, value: b, key: b.id }));
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Header, { title: "Pilih Board" }), _jsx(SelectInput, { items: items, onSelect: handleBoardSelect }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", children: "[Q] quit" }) }), _jsx(StatusMsg, { msg: status, color: statusColor })] }));
    }
    // LISTS
    if (screen === 'lists') {
        const items = [
            ...lists.map((l) => ({ label: l.name, value: l, key: l.id })),
            { label: '← Back', value: 'back', key: 'back' },
        ];
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Header, { title: `${selectedBoard?.name} › Lists` }), _jsx(SelectInput, { items: items, onSelect: handleListSelect }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", children: "[ESC] back" }) })] }));
    }
    // CARDS
    if (screen === 'cards') {
        const items = [
            ...cards.map((c) => ({
                label: c.name + (c.due ? ` 📅 ${new Date(c.due).toLocaleDateString('id')}` : ''),
                value: c,
                key: c.id,
            })),
            { label: '➕ Buat card baru', value: 'create', key: 'create' },
            { label: '← Back', value: 'back', key: 'back' },
        ];
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Header, { title: `${selectedList?.name} › Cards` }), cards.length === 0 && _jsx(Text, { color: "gray", children: "Belum ada card di list ini." }), _jsx(SelectInput, { items: items, onSelect: handleCardSelect }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", children: "[ESC] back" }) }), _jsx(StatusMsg, { msg: status, color: statusColor })] }));
    }
    // CARD DETAIL
    if (screen === 'card_detail' && selectedCard) {
        const actions = [
            { label: '☑  Checklists', value: 'checklists' },
            { label: '💬 Komentar', value: 'comments' },
            { label: '✏️  Edit nama', value: 'edit' },
            { label: '➡️  Pindahkan', value: 'move' },
            { label: '← Back', value: 'back' },
        ];
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Header, { title: "Detail Card" }), _jsxs(Box, { marginBottom: 1, flexDirection: "column", children: [_jsx(Text, { bold: true, color: "yellow", children: selectedCard.name }), selectedCard.desc && _jsx(Text, { color: "gray", children: selectedCard.desc }), selectedCard.due && (_jsxs(Text, { color: selectedCard.dueComplete ? 'green' : 'red', children: ["\uD83D\uDCC5 Due: ", new Date(selectedCard.due).toLocaleDateString('id'), selectedCard.dueComplete ? ' ✅' : ''] })), _jsx(Text, { color: "blue", children: selectedCard.shortUrl })] }), _jsx(SelectInput, { items: actions, onSelect: handleCardAction }), _jsx(StatusMsg, { msg: status, color: statusColor })] }));
    }
    // CREATE CARD
    if (screen === 'create_card') {
        return (_jsx(TextInputScreen, { title: "Buat Card Baru", prompt: `Nama card baru di "${selectedList?.name}":`, onSubmit: handleCreateCard, onBack: handleBack }));
    }
    // EDIT CARD
    if (screen === 'edit_card' && selectedCard) {
        return (_jsx(TextInputScreen, { title: "Edit Card", prompt: "Nama baru:", onSubmit: handleEditCard, onBack: handleBack, initialValue: selectedCard.name }));
    }
    // MOVE CARD
    if (screen === 'move_card') {
        const items = [
            ...lists
                .filter((l) => l.id !== selectedCard?.idList)
                .map((l) => ({ label: l.name, value: l, key: l.id })),
            { label: '← Back', value: 'back', key: 'back' },
        ];
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Header, { title: `Pindahkan "${selectedCard?.name}"` }), _jsx(Text, { color: "gray", children: "Pilih list tujuan:" }), _jsx(SelectInput, { items: items, onSelect: handleMoveCard })] }));
    }
    // CHECKLISTS
    if (screen === 'checklists') {
        const items = [
            ...checklists.map((cl) => {
                const total = cl.checkItems.length;
                const done = cl.checkItems.filter((i) => i.state === 'complete').length;
                return {
                    label: `${cl.name}  [${done}/${total}]`,
                    value: cl,
                    key: cl.id
                };
            }),
            { label: '➕ Buat checklist baru', value: 'add_checklist', key: 'add_checklist' },
            { label: '← Back', value: 'back', key: 'back' },
        ];
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Header, { title: `Checklists › "${selectedCard?.name}"` }), checklists.length === 0 && _jsx(Text, { color: "gray", children: "Belum ada checklist." }), _jsx(SelectInput, { items: items, onSelect: handleChecklistAction }), _jsx(StatusMsg, { msg: status, color: statusColor })] }));
    }
    // ADD CHECKLIST
    if (screen === 'add_checklist') {
        return (_jsx(TextInputScreen, { title: "Buat Checklist", prompt: "Nama checklist:", onSubmit: handleCreateChecklist, onBack: handleBack }));
    }
    // CHECK ITEMS
    if (screen === 'add_checkitem' && selectedChecklist) {
        const items = [
            ...selectedChecklist.checkItems.map((ci) => ({
                label: `${ci.state === 'complete' ? '✅' : '⬜'} ${ci.name}`,
                value: ci,
                key: ci.id
            })),
            { label: '➕ Tambah item', value: 'add', key: 'add' },
            { label: '← Back', value: 'back', key: 'back' },
        ];
        const total = selectedChecklist.checkItems.length;
        const done = selectedChecklist.checkItems.filter((i) => i.state === 'complete').length;
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Header, { title: `${selectedChecklist.name}  [${done}/${total}]` }), _jsx(Text, { color: "gray", children: "Pilih item untuk toggle \u2705/\u2B1C, atau tambah baru:" }), _jsx(Box, { marginTop: 1, children: _jsx(SelectInput, { items: items, onSelect: handleCheckItemAction }) }), _jsx(StatusMsg, { msg: status, color: statusColor })] }));
    }
    // ADD CHECK ITEM (text input)
    if (screen === 'add_checkitem' && !selectedChecklist) {
        return _jsx(Loading, { label: "Loading checklist..." });
    }
    // COMMENTS
    if (screen === 'comments') {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Header, { title: `Komentar › "${selectedCard?.name}"` }), comments.length === 0 && _jsx(Text, { color: "gray", children: "Belum ada komentar." }), comments.map((c) => (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsx(Text, { color: "cyan", bold: true, children: c.memberCreator.fullName }), _jsx(Text, { color: "gray", children: new Date(c.date).toLocaleString('id') }), _jsx(Text, { children: c.data.text })] }, c.id))), _jsx(Box, { marginTop: 1, flexDirection: "column", children: _jsx(SelectInput, { items: [
                            { label: '➕ Tambah komentar', value: 'add' },
                            { label: '← Back', value: 'back' },
                        ], onSelect: (item) => {
                            if (item.value === 'add')
                                setScreen('add_comment');
                            else
                                handleBack();
                        } }) }), _jsx(StatusMsg, { msg: status, color: statusColor })] }));
    }
    // ADD COMMENT
    if (screen === 'add_comment') {
        return (_jsx(TextInputScreen, { title: "Tambah Komentar", prompt: "Tulis komentar:", onSubmit: handleAddComment, onBack: handleBack }));
    }
    return _jsx(Loading, { label: "Loading..." });
}
