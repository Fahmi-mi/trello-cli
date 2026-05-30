import axios from "axios";

const BASE = "https://api.trello.com/1";

export interface TrelloBoard {
  id: string;
  name: string;
  shortUrl: string;
}

export interface TrelloList {
  id: string;
  name: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idList: string;
  due: string | null;
  dueComplete: boolean;
  shortUrl: string;
}

export interface TrelloChecklist {
  id: string;
  name: string;
  checkItems: TrelloCheckItem[];
}

export interface TrelloCheckItem {
  id: string;
  name: string;
  state: "incomplete" | "complete";
  idChecklist: string;
}

export interface TrelloComment {
  id: string;
  data: { text: string };
  memberCreator: { fullName: string };
  date: string;
}

let KEY = "";
let TOKEN = "";

export function setCredentials(key: string, token: string) {
  KEY = key;
  TOKEN = token;
}

function auth() {
  return { key: KEY, token: TOKEN };
}

export async function getBoards(): Promise<TrelloBoard[]> {
  const res = await axios.get(`${BASE}/members/me/boards`, {
    params: { ...auth(), filter: "open", fields: "name,shortUrl" },
  });
  return res.data;
}

export async function getLists(boardId: string): Promise<TrelloList[]> {
  const res = await axios.get(`${BASE}/boards/${boardId}/lists`, {
    params: { ...auth(), filter: "open" },
  });
  return res.data;
}

export async function getCards(listId: string): Promise<TrelloCard[]> {
  const res = await axios.get(`${BASE}/lists/${listId}/cards`, {
    params: { ...auth(), fields: "name,desc,idList,due,dueComplete,shortUrl" },
  });
  return res.data;
}

export async function getArchivedCards(listId: string): Promise<TrelloCard[]> {
  const res = await axios.get(`${BASE}/lists/${listId}/cards`, {
    params: {
      ...auth(),
      filter: "closed",
      fields: "name,desc,idList,due,dueComplete,shortUrl",
    },
  });
  return res.data;
}

export async function getCard(cardId: string): Promise<TrelloCard> {
  const res = await axios.get(`${BASE}/cards/${cardId}`, {
    params: { ...auth() },
  });
  return res.data;
}

export async function createCard(
  listId: string,
  name: string,
  desc?: string,
): Promise<TrelloCard> {
  const res = await axios.post(`${BASE}/cards`, null, {
    params: { ...auth(), idList: listId, name, desc: desc || "" },
  });
  return res.data;
}

export async function updateCard(
  cardId: string,
  fields: Partial<{
    name: string;
    desc: string;
    idList: string;
    due: string | null;
    closed: boolean;
  }>,
): Promise<TrelloCard> {
  const res = await axios.put(`${BASE}/cards/${cardId}`, null, {
    params: { ...auth(), ...fields },
  });
  return res.data;
}

export async function archiveCard(cardId: string): Promise<TrelloCard> {
  return updateCard(cardId, { closed: true });
}

export async function deleteCard(cardId: string): Promise<void> {
  await axios.delete(`${BASE}/cards/${cardId}`, {
    params: { ...auth() },
  });
}

export async function getChecklists(
  cardId: string,
): Promise<TrelloChecklist[]> {
  const res = await axios.get(`${BASE}/cards/${cardId}/checklists`, {
    params: { ...auth() },
  });
  return res.data;
}

export async function createChecklist(
  cardId: string,
  name: string,
): Promise<TrelloChecklist> {
  const res = await axios.post(`${BASE}/checklists`, null, {
    params: { ...auth(), idCard: cardId, name },
  });
  return res.data;
}

export async function deleteChecklist(checklistId: string): Promise<void> {
  await axios.delete(`${BASE}/checklists/${checklistId}`, {
    params: { ...auth() },
  });
}

export async function addCheckItem(
  checklistId: string,
  name: string,
): Promise<TrelloCheckItem> {
  const res = await axios.post(
    `${BASE}/checklists/${checklistId}/checkItems`,
    null,
    {
      params: { ...auth(), name },
    },
  );
  return res.data;
}

export async function updateCheckItem(
  cardId: string,
  checkItemId: string,
  state: "complete" | "incomplete",
): Promise<TrelloCheckItem> {
  const res = await axios.put(
    `${BASE}/cards/${cardId}/checkItem/${checkItemId}`,
    null,
    {
      params: { ...auth(), state },
    },
  );
  return res.data;
}

export async function deleteCheckItem(
  checklistId: string,
  checkItemId: string,
): Promise<void> {
  await axios.delete(
    `${BASE}/checklists/${checklistId}/checkItems/${checkItemId}`,
    {
      params: { ...auth() },
    },
  );
}

export async function getComments(cardId: string): Promise<TrelloComment[]> {
  const res = await axios.get(`${BASE}/cards/${cardId}/actions`, {
    params: { ...auth(), filter: "commentCard" },
  });
  return res.data;
}

export async function addComment(cardId: string, text: string): Promise<void> {
  await axios.post(`${BASE}/cards/${cardId}/actions/comments`, null, {
    params: { ...auth(), text },
  });
}
