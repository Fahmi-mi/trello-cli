import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import * as api from './api.js';
import {
  TrelloBoard,
  TrelloList,
  TrelloCard,
  TrelloChecklist,
  TrelloCheckItem,
} from './api.js';

type Screen =
  | 'boards'
  | 'lists'
  | 'cards'
  | 'card_detail'
  | 'create_card'
  | 'edit_card'
  | 'move_card'
  | 'checklists'
  | 'add_checklist'
  | 'add_checkitem'
  | 'comments'
  | 'add_comment';

// ── helpers ──────────────────────────────────────────────────────────────────

function Header({ title }: { title: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="blueBright">
          {'━'.repeat(50)}
        </Text>
      </Box>
      <Text bold color="cyanBright">
        {' 🗂  Trello CLI  '}
        <Text color="white">› {title}</Text>
      </Text>
      <Box>
        <Text bold color="blueBright">
          {'━'.repeat(50)}
        </Text>
      </Box>
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
      <Text color={(color as any) || 'green'}>{msg}</Text>
    </Box>
  ) : null;
}

// ── TextInputScreen ───────────────────────────────────────────────────────────

function TextInputScreen({
  title,
  prompt,
  onSubmit,
  onBack,
  initialValue = '',
}: {
  title: string;
  prompt: string;
  onSubmit: (val: string) => void;
  onBack: () => void;
  initialValue?: string;
}) {
  const [value, setValue] = useState(initialValue);

  useInput((input, key) => {
    if (key.escape) onBack();
  });

  return (
    <Box flexDirection="column">
      <Header title={title} />
      <Text color="yellow">{prompt}</Text>
      <Box marginTop={1}>
        <Text color="gray">{'> '}</Text>
        <TextInput value={value} onChange={setValue} onSubmit={onSubmit} />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">[ESC] back</Text>
      </Box>
    </Box>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const { exit } = useApp();

  const [screen, setScreen] = useState<Screen>('boards');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [statusColor, setStatusColor] = useState('green');

  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [cards, setCards] = useState<TrelloCard[]>([]);
  const [checklists, setChecklists] = useState<TrelloChecklist[]>([]);
  const [comments, setComments] = useState<api.TrelloComment[]>([]);

  const [selectedBoard, setSelectedBoard] = useState<TrelloBoard | null>(null);
  const [selectedList, setSelectedList] = useState<TrelloList | null>(null);
  const [selectedCard, setSelectedCard] = useState<TrelloCard | null>(null);
  const [selectedChecklist, setSelectedChecklist] = useState<TrelloChecklist | null>(null);

  const flash = (msg: string, color = 'green') => {
    setStatus(msg);
    setStatusColor(color);
    setTimeout(() => setStatus(''), 3000);
  };

  // ── Load boards ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'boards') {
      setLoading(true);
      api.getBoards().then((b: TrelloBoard[]) => { setBoards(b); setLoading(false); }).catch(() => {
        flash('❌ Gagal load boards. Cek API key/token.', 'red');
        setLoading(false);
      });
    }
  }, [screen]);

  useInput((_input, key) => {
    if (key.escape) handleBack();
    if (_input === 'q') exit();
  });

  function handleBack() {
    if (screen === 'boards') return exit();
    if (screen === 'lists') setScreen('boards');
    else if (screen === 'cards') setScreen('lists');
    else if (screen === 'card_detail') setScreen('cards');
    else if (screen === 'checklists') setScreen('card_detail');
    else if (screen === 'add_checklist') setScreen('checklists');
    else if (screen === 'add_checkitem') setScreen('checklists');
    else if (screen === 'comments') setScreen('card_detail');
    else if (screen === 'add_comment') setScreen('comments');
    else if (screen === 'create_card') setScreen('cards');
    else if (screen === 'edit_card') setScreen('card_detail');
    else if (screen === 'move_card') setScreen('card_detail');
    else setScreen('boards');
  }

  // ── Board select ─────────────────────────────────────────────────────────────
  async function handleBoardSelect(item: { value: TrelloBoard }) {
    const board = item.value;
    setSelectedBoard(board);
    setLoading(true);
    const ls = await api.getLists(board.id);
    setLists(ls);
    setLoading(false);
    setScreen('lists');
  }

  // ── List select ──────────────────────────────────────────────────────────────
  async function handleListSelect(item: { value: TrelloList | 'back' }) {
    if (item.value === 'back') return handleBack();
    const list = item.value as TrelloList;
    setSelectedList(list);
    setLoading(true);
    const cs = await api.getCards(list.id);
    setCards(cs);
    setLoading(false);
    setScreen('cards');
  }

  // ── Card select ──────────────────────────────────────────────────────────────
  async function handleCardSelect(item: { value: TrelloCard | 'create' | 'back' }) {
    if (item.value === 'back') return handleBack();
    if (item.value === 'create') return setScreen('create_card');
    const card = item.value as TrelloCard;
    setSelectedCard(card);
    setScreen('card_detail');
  }

  // ── Card detail actions ──────────────────────────────────────────────────────
  async function handleCardAction(item: { value: string }) {
    const action = item.value;
    if (action === 'back') return handleBack();
    if (action === 'checklists') {
      setLoading(true);
      const cls = await api.getChecklists(selectedCard!.id);
      setChecklists(cls);
      setLoading(false);
      setScreen('checklists');
    } else if (action === 'comments') {
      setLoading(true);
      const coms = await api.getComments(selectedCard!.id);
      setComments(coms);
      setLoading(false);
      setScreen('comments');
    } else if (action === 'edit') {
      setScreen('edit_card');
    } else if (action === 'move') {
      setScreen('move_card');
    }
  }

  // ── Create card ──────────────────────────────────────────────────────────────
  async function handleCreateCard(name: string) {
    if (!name.trim()) return;
    setLoading(true);
    await api.createCard(selectedList!.id, name.trim());
    const cs = await api.getCards(selectedList!.id);
    setCards(cs);
    setLoading(false);
    flash(`✅ Card "${name}" dibuat!`);
    setScreen('cards');
  }

  // ── Edit card ────────────────────────────────────────────────────────────────
  async function handleEditCard(newName: string) {
    if (!newName.trim()) return;
    setLoading(true);
    const updated = await api.updateCard(selectedCard!.id, { name: newName.trim() });
    setSelectedCard(updated);
    setLoading(false);
    flash(`✅ Card diupdate!`);
    setScreen('card_detail');
  }

  // ── Move card ────────────────────────────────────────────────────────────────
  async function handleMoveCard(item: { value: TrelloList | 'back' }) {
    if (item.value === 'back') return handleBack();
    const targetList = item.value as TrelloList;
    setLoading(true);
    const updated = await api.updateCard(selectedCard!.id, { idList: targetList.id });
    setSelectedCard(updated);
    const cs = await api.getCards(selectedList!.id);
    setCards(cs);
    setLoading(false);
    flash(`✅ Card dipindah ke "${targetList.name}"!`);
    setScreen('card_detail');
  }

  // ── Checklist actions ────────────────────────────────────────────────────────
  async function handleChecklistAction(item: { value: string | TrelloChecklist }) {
    if (item.value === 'back') return handleBack();
    if (item.value === 'add_checklist') return setScreen('add_checklist');
    const cl = item.value as TrelloChecklist;
    setSelectedChecklist(cl);
    setScreen('add_checkitem');
  }

  async function handleCreateChecklist(name: string) {
    if (!name.trim()) return;
    setLoading(true);
    await api.createChecklist(selectedCard!.id, name.trim());
    const cls = await api.getChecklists(selectedCard!.id);
    setChecklists(cls);
    setLoading(false);
    flash(`✅ Checklist "${name}" dibuat!`);
    setScreen('checklists');
  }

  async function handleCheckItemAction(item: { value: TrelloCheckItem | 'add' | 'back' }) {
    if (item.value === 'back') {
      setLoading(true);
      const cls = await api.getChecklists(selectedCard!.id);
      setChecklists(cls);
      setLoading(false);
      return setScreen('checklists');
    }
    if (item.value === 'add') return setScreen('add_checkitem');
    const ci = item.value as TrelloCheckItem;
    const newState = ci.state === 'complete' ? 'incomplete' : 'complete';
    setLoading(true);
    await api.updateCheckItem(selectedCard!.id, ci.id, newState);
    const cls = await api.getChecklists(selectedCard!.id);
    setChecklists(cls);
    const updated = cls.find((c: TrelloChecklist) => c.id === selectedChecklist!.id) || selectedChecklist!;
    setSelectedChecklist(updated);
    setLoading(false);
    flash(newState === 'complete' ? `✅ "${ci.name}" selesai!` : `↩ "${ci.name}" di-uncheck`);
  }

  async function handleAddCheckItem(name: string) {
    if (!name.trim()) return;
    setLoading(true);
    await api.addCheckItem(selectedChecklist!.id, name.trim());
    const cls = await api.getChecklists(selectedCard!.id);
    const updated = cls.find((c: TrelloChecklist) => c.id === selectedChecklist!.id) || selectedChecklist!;
    setChecklists(cls);
    setSelectedChecklist(updated);
    setLoading(false);
    flash(`✅ Item "${name}" ditambahkan!`);
    setScreen('add_checkitem');
  }

  // ── Comments ─────────────────────────────────────────────────────────────────
  async function handleAddComment(text: string) {
    if (!text.trim()) return;
    setLoading(true);
    await api.addComment(selectedCard!.id, text.trim());
    const coms = await api.getComments(selectedCard!.id);
    setComments(coms);
    setLoading(false);
    flash('✅ Komentar ditambahkan!');
    setScreen('comments');
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return <Loading label="Loading..." />;

  // BOARDS
  if (screen === 'boards') {
    const items = boards.map((b) => ({ label: b.name, value: b, key: b.id }));
    return (
      <Box flexDirection="column">
        <Header title="Pilih Board" />
        <SelectInput items={items} onSelect={handleBoardSelect} />
        <Box marginTop={1}><Text color="gray">[Q] quit</Text></Box>
        <StatusMsg msg={status} color={statusColor} />
      </Box>
    );
  }

  // LISTS
  if (screen === 'lists') {
    const items = [
      ...lists.map((l) => ({ label: l.name, value: l as TrelloList | 'back', key: l.id })),
      { label: '← Back', value: 'back' as const, key: 'back' },
    ];
    return (
      <Box flexDirection="column">
        <Header title={`${selectedBoard?.name} › Lists`} />
        <SelectInput items={items} onSelect={handleListSelect} />
        <Box marginTop={1}><Text color="gray">[ESC] back</Text></Box>
      </Box>
    );
  }

  // CARDS
  if (screen === 'cards') {
    const items = [
      ...cards.map((c) => ({
        label: c.name + (c.due ? ` 📅 ${new Date(c.due).toLocaleDateString('id')}` : ''),
        value: c as TrelloCard | 'create' | 'back',
        key: c.id,
      })),
      { label: '➕ Buat card baru', value: 'create' as const, key: 'create' },
      { label: '← Back', value: 'back' as const, key: 'back' },
    ];
    return (
      <Box flexDirection="column">
        <Header title={`${selectedList?.name} › Cards`} />
        {cards.length === 0 && <Text color="gray">Belum ada card di list ini.</Text>}
        <SelectInput items={items} onSelect={handleCardSelect} />
        <Box marginTop={1}><Text color="gray">[ESC] back</Text></Box>
        <StatusMsg msg={status} color={statusColor} />
      </Box>
    );
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
    return (
      <Box flexDirection="column">
        <Header title="Detail Card" />
        <Box marginBottom={1} flexDirection="column">
          <Text bold color="yellow">{selectedCard.name}</Text>
          {selectedCard.desc && <Text color="gray">{selectedCard.desc}</Text>}
          {selectedCard.due && (
            <Text color={selectedCard.dueComplete ? 'green' : 'red'}>
              📅 Due: {new Date(selectedCard.due).toLocaleDateString('id')}
              {selectedCard.dueComplete ? ' ✅' : ''}
            </Text>
          )}
          <Text color="blue">{selectedCard.shortUrl}</Text>
        </Box>
        <SelectInput items={actions} onSelect={handleCardAction} />
        <StatusMsg msg={status} color={statusColor} />
      </Box>
    );
  }

  // CREATE CARD
  if (screen === 'create_card') {
    return (
      <TextInputScreen
        title="Buat Card Baru"
        prompt={`Nama card baru di "${selectedList?.name}":`}
        onSubmit={handleCreateCard}
        onBack={handleBack}
      />
    );
  }

  // EDIT CARD
  if (screen === 'edit_card' && selectedCard) {
    return (
      <TextInputScreen
        title="Edit Card"
        prompt="Nama baru:"
        onSubmit={handleEditCard}
        onBack={handleBack}
        initialValue={selectedCard.name}
      />
    );
  }

  // MOVE CARD
  if (screen === 'move_card') {
    const items = [
      ...lists
        .filter((l) => l.id !== selectedCard?.idList)
        .map((l) => ({ label: l.name, value: l as TrelloList | 'back', key: l.id })),
      { label: '← Back', value: 'back' as const, key: 'back' },
    ];
    return (
      <Box flexDirection="column">
        <Header title={`Pindahkan "${selectedCard?.name}"`} />
        <Text color="gray">Pilih list tujuan:</Text>
        <SelectInput items={items} onSelect={handleMoveCard} />
      </Box>
    );
  }

  // CHECKLISTS
  if (screen === 'checklists') {
    const items = [
      ...checklists.map((cl) => {
        const total = cl.checkItems.length;
        const done = cl.checkItems.filter((i: TrelloCheckItem) => i.state === 'complete').length;
        return {
          label: `${cl.name}  [${done}/${total}]`,
          value: cl as TrelloChecklist | string,
          key: cl.id
        };
      }),
      { label: '➕ Buat checklist baru', value: 'add_checklist', key: 'add_checklist' },
      { label: '← Back', value: 'back', key: 'back' },
    ];
    return (
      <Box flexDirection="column">
        <Header title={`Checklists › "${selectedCard?.name}"`} />
        {checklists.length === 0 && <Text color="gray">Belum ada checklist.</Text>}
        <SelectInput items={items} onSelect={handleChecklistAction} />
        <StatusMsg msg={status} color={statusColor} />
      </Box>
    );
  }

  // ADD CHECKLIST
  if (screen === 'add_checklist') {
    return (
      <TextInputScreen
        title="Buat Checklist"
        prompt="Nama checklist:"
        onSubmit={handleCreateChecklist}
        onBack={handleBack}
      />
    );
  }

  // CHECK ITEMS
  if (screen === 'add_checkitem' && selectedChecklist) {
    const items = [
      ...selectedChecklist.checkItems.map((ci: TrelloCheckItem) => ({
        label: `${ci.state === 'complete' ? '✅' : '⬜'} ${ci.name}`,
        value: ci as TrelloCheckItem | 'add' | 'back',
        key: ci.id
      })),
      { label: '➕ Tambah item', value: 'add' as const, key: 'add' },
      { label: '← Back', value: 'back' as const, key: 'back' },
    ];
    const total = selectedChecklist.checkItems.length;
    const done = selectedChecklist.checkItems.filter((i: TrelloCheckItem) => i.state === 'complete').length;
    return (
      <Box flexDirection="column">
        <Header title={`${selectedChecklist.name}  [${done}/${total}]`} />
        <Text color="gray">Pilih item untuk toggle ✅/⬜, atau tambah baru:</Text>
        <Box marginTop={1}>
          <SelectInput items={items} onSelect={handleCheckItemAction} />
        </Box>
        <StatusMsg msg={status} color={statusColor} />
      </Box>
    );
  }

  // ADD CHECK ITEM (text input)
  if (screen === 'add_checkitem' && !selectedChecklist) {
    return <Loading label="Loading checklist..." />;
  }

  // COMMENTS
  if (screen === 'comments') {
    return (
      <Box flexDirection="column">
        <Header title={`Komentar › "${selectedCard?.name}"`} />
        {comments.length === 0 && <Text color="gray">Belum ada komentar.</Text>}
        {comments.map((c) => (
          <Box key={c.id} flexDirection="column" marginBottom={1}>
            <Text color="cyan" bold>{c.memberCreator.fullName}</Text>
            <Text color="gray">{new Date(c.date).toLocaleString('id')}</Text>
            <Text>{c.data.text}</Text>
          </Box>
        ))}
        <Box marginTop={1} flexDirection="column">
          <SelectInput
            items={[
              { label: '➕ Tambah komentar', value: 'add' },
              { label: '← Back', value: 'back' },
            ]}
            onSelect={(item) => {
              if (item.value === 'add') setScreen('add_comment');
              else handleBack();
            }}
          />
        </Box>
        <StatusMsg msg={status} color={statusColor} />
      </Box>
    );
  }

  // ADD COMMENT
  if (screen === 'add_comment') {
    return (
      <TextInputScreen
        title="Tambah Komentar"
        prompt="Tulis komentar:"
        onSubmit={handleAddComment}
        onBack={handleBack}
      />
    );
  }

  return <Loading label="Loading..." />;
}
