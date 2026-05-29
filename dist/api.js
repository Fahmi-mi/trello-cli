import axios from 'axios';
const BASE = 'https://api.trello.com/1';
let KEY = '';
let TOKEN = '';
export function setCredentials(key, token) {
    KEY = key;
    TOKEN = token;
}
function auth() {
    return { key: KEY, token: TOKEN };
}
export async function getBoards() {
    const res = await axios.get(`${BASE}/members/me/boards`, {
        params: { ...auth(), filter: 'open', fields: 'name,shortUrl' },
    });
    return res.data;
}
export async function getLists(boardId) {
    const res = await axios.get(`${BASE}/boards/${boardId}/lists`, {
        params: { ...auth(), filter: 'open' },
    });
    return res.data;
}
export async function getCards(listId) {
    const res = await axios.get(`${BASE}/lists/${listId}/cards`, {
        params: { ...auth(), fields: 'name,desc,idList,due,dueComplete,shortUrl' },
    });
    return res.data;
}
export async function getCard(cardId) {
    const res = await axios.get(`${BASE}/cards/${cardId}`, {
        params: { ...auth() },
    });
    return res.data;
}
export async function createCard(listId, name, desc) {
    const res = await axios.post(`${BASE}/cards`, null, {
        params: { ...auth(), idList: listId, name, desc: desc || '' },
    });
    return res.data;
}
export async function updateCard(cardId, fields) {
    const res = await axios.put(`${BASE}/cards/${cardId}`, null, {
        params: { ...auth(), ...fields },
    });
    return res.data;
}
export async function getChecklists(cardId) {
    const res = await axios.get(`${BASE}/cards/${cardId}/checklists`, {
        params: { ...auth() },
    });
    return res.data;
}
export async function createChecklist(cardId, name) {
    const res = await axios.post(`${BASE}/checklists`, null, {
        params: { ...auth(), idCard: cardId, name },
    });
    return res.data;
}
export async function addCheckItem(checklistId, name) {
    const res = await axios.post(`${BASE}/checklists/${checklistId}/checkItems`, null, {
        params: { ...auth(), name },
    });
    return res.data;
}
export async function updateCheckItem(cardId, checkItemId, state) {
    const res = await axios.put(`${BASE}/cards/${cardId}/checkItem/${checkItemId}`, null, {
        params: { ...auth(), state },
    });
    return res.data;
}
export async function deleteCheckItem(checklistId, checkItemId) {
    await axios.delete(`${BASE}/checklists/${checklistId}/checkItems/${checkItemId}`, {
        params: { ...auth() },
    });
}
export async function getComments(cardId) {
    const res = await axios.get(`${BASE}/cards/${cardId}/actions`, {
        params: { ...auth(), filter: 'commentCard' },
    });
    return res.data;
}
export async function addComment(cardId, text) {
    await axios.post(`${BASE}/cards/${cardId}/actions/comments`, null, {
        params: { ...auth(), text },
    });
}
