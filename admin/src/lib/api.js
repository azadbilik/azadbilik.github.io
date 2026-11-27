// The admin's calls to server/api.js
async function json(res) {
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body;
}

export const get = (path) => fetch(path).then(json);

export const getFile = (file) => get(`/api/file?path=${encodeURIComponent(file)}`);

export const putFile = (file, data) =>
  fetch(`/api/file?path=${encodeURIComponent(file)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data }),
  }).then(json);

// Runs a script and calls onText with each piece of its output as it comes. Abort the signal to stop it.
export async function runScript(id, onText, signal) {
  const res = await fetch(`/api/run?id=${encodeURIComponent(id)}`, { method: 'POST', signal });
  if (!res.ok) throw new Error((await res.json()).error);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    onText(value);
  }
}
