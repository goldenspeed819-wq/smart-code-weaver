/* Lovable Copilot — painel flutuante para editar o repositório GitHub com IA. */
(() => {
  if (window.__lvcLoaded) return;
  window.__lvcLoaded = true;

  const DEFAULT_PROXY = "https://id-preview--669fd5d8-68b0-476b-b97d-00e8aad401df.lovable.app";

  const state = {
    on: false,
    tab: "repo",
    proxyUrl: DEFAULT_PROXY,
    ghToken: "",
    repos: [],
    repo: null, // { full_name, default_branch }
    branch: "",
    tree: [],
    filter: "",
    file: null, // { path, sha, content }
    original: "",
    proposed: "",
    images: [], // data urls
    provider: "lovable",
    keys: { openai: "", anthropic: "", gemini: "", groq: "" },
    lastInstruction: "",
    log: [],
    busy: false,
  };

  const store = {
    get: (keys) =>
      new Promise((r) => {
        try {
          chrome.storage.local.get(keys, r);
        } catch {
          r({});
        }
      }),
    set: (obj) => {
      try {
        chrome.storage.local.set(obj);
      } catch {
        /* ignore */
      }
    },
  };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const log = (msg) => {
    state.log.unshift(`${new Date().toLocaleTimeString()} — ${msg}`);
    state.log = state.log.slice(0, 40);
    render();
  };

  const CODE_RE = /\.(js|jsx|ts|tsx|html|css|scss|json|md)$/i;

  /* ---------------- GitHub ---------------- */
  async function gh(path, init = {}) {
    const res = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${state.ghToken}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }

  async function detectRepos() {
    if (!state.ghToken) return log("Informe o token do GitHub em Ajustes.");
    state.busy = true;
    render();
    try {
      const repos = await gh("/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member");
      state.repos = repos.map((r) => ({ full_name: r.full_name, default_branch: r.default_branch, private: r.private }));
      log(`${state.repos.length} repositórios detectados.`);
    } catch (e) {
      log(`Erro ao listar repositórios: ${e.message}`);
    } finally {
      state.busy = false;
      render();
    }
  }

  async function useRepoUrl(url) {
    const m = String(url).match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
    if (!m) return log("URL do GitHub inválida.");
    const full = `${m[1]}/${m[2].replace(/\.git$/, "")}`;
    await selectRepo({ full_name: full });
  }

  async function selectRepo(repo) {
    state.busy = true;
    render();
    try {
      const info = await gh(`/repos/${repo.full_name}`);
      state.repo = { full_name: info.full_name, default_branch: info.default_branch };
      state.branch = info.default_branch;
      const tree = await gh(`/repos/${info.full_name}/git/trees/${info.default_branch}?recursive=1`);
      state.tree = (tree.tree || []).filter((n) => n.type === "blob" && CODE_RE.test(n.path)).map((n) => n.path);
      state.tab = "files";
      log(`${state.repo.full_name} (${state.branch}) — ${state.tree.length} arquivos de código.`);
    } catch (e) {
      log(`Erro ao carregar repositório: ${e.message}`);
    } finally {
      state.busy = false;
      render();
    }
  }

  async function openFile(path) {
    state.busy = true;
    render();
    try {
      const data = await gh(`/repos/${state.repo.full_name}/contents/${encodeURI(path)}?ref=${state.branch}`);
      const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
      state.file = { path, sha: data.sha };
      state.original = content;
      state.proposed = "";
      state.tab = "editor";
      log(`Arquivo aberto: ${path}`);
    } catch (e) {
      log(`Erro ao abrir arquivo: ${e.message}`);
    } finally {
      state.busy = false;
      render();
    }
  }

  async function commitFile(message) {
    if (!state.file || !state.proposed) return log("Nada para comitar.");
    state.busy = true;
    render();
    try {
      const body = {
        message,
        content: btoa(unescape(encodeURIComponent(state.proposed))),
        sha: state.file.sha,
        branch: state.branch,
      };
      const res = await gh(`/repos/${state.repo.full_name}/contents/${encodeURI(state.file.path)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      state.file.sha = res.content.sha;
      state.original = state.proposed;
      state.proposed = "";
      log(`Commit ${res.commit.sha.slice(0, 7)} enviado.`);
      sendSummaryToChat({
        file: state.file.path,
        repo: state.repo.full_name,
        branch: state.branch,
        commit: res.commit.sha,
        url: res.commit.html_url,
        message,
      });
    } catch (e) {
      log(`Erro no commit: ${e.message}`);
    } finally {
      state.busy = false;
      render();
    }
  }

  /* ---------------- IA ---------------- */
  const PROVIDERS = [
    { id: "lovable", label: "IA do Lovable (padrão)" },
    { id: "openai", label: "OpenAI" },
    { id: "anthropic", label: "Anthropic" },
    { id: "gemini", label: "Google Gemini" },
    { id: "groq", label: "Groq" },
  ];

  function buildPrompt(instruction) {
    return [
      "Você é um engenheiro front-end. Reescreva o ARQUIVO inteiro aplicando o pedido.",
      "Responda SOMENTE com o código final do arquivo, sem explicação e sem cercas de markdown.",
      `Arquivo: ${state.file?.path}`,
      `Pedido: ${instruction}`,
      "--- CÓDIGO ATUAL ---",
      state.original,
    ].join("\n");
  }

  async function callLovable(prompt, images) {
    const res = await fetch(`${state.proxyUrl.replace(/\/$/, "")}/api/public/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, images }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `proxy ${res.status}`);
    return data.text;
  }

  async function callOpenAI(prompt, images) {
    const content = [{ type: "text", text: prompt }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))];
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.keys.openai}` },
      body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content }] }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error?.message || `openai ${res.status}`);
    return d.choices[0].message.content;
  }

  async function callAnthropic(prompt, images) {
    const content = [
      ...images.map((url) => ({
        type: "image",
        source: { type: "base64", media_type: url.slice(5, url.indexOf(";")), data: url.split(",")[1] },
      })),
      { type: "text", text: prompt },
    ];
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": state.keys.anthropic,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 8000, messages: [{ role: "user", content }] }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error?.message || `anthropic ${res.status}`);
    return d.content.map((p) => p.text || "").join("");
  }

  async function callGemini(prompt, images) {
    const parts = [
      { text: prompt },
      ...images.map((url) => ({
        inlineData: { mimeType: url.slice(5, url.indexOf(";")), data: url.split(",")[1] },
      })),
    ];
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.keys.gemini}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts }] }) },
    );
    const d = await res.json();
    if (!res.ok) throw new Error(d.error?.message || `gemini ${res.status}`);
    return d.candidates[0].content.parts.map((p) => p.text || "").join("");
  }

  async function callGroq(prompt) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.keys.groq}` },
      body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }] }),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error?.message || `groq ${res.status}`);
    return d.choices[0].message.content;
  }

  function runner(id) {
    if (id === "lovable") return callLovable;
    if (id === "openai") return state.keys.openai ? callOpenAI : null;
    if (id === "anthropic") return state.keys.anthropic ? callAnthropic : null;
    if (id === "gemini") return state.keys.gemini ? callGemini : null;
    if (id === "groq") return state.keys.groq ? callGroq : null;
    return null;
  }

  async function generate(instruction) {
    if (!state.file) return log("Abra um arquivo antes de pedir a alteração.");
    state.lastInstruction = instruction;
    state.busy = true;
    render();
    const chain = [state.provider, ...PROVIDERS.map((p) => p.id).filter((id) => id !== state.provider)];
    const prompt = buildPrompt(instruction);
    for (const id of chain) {
      const fn = runner(id);
      if (!fn) continue;
      try {
        log(`Gerando com ${id}…`);
        let out = await fn(prompt, state.images);
        out = String(out || "").replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/, "").trim();
        if (!out) throw new Error("resposta vazia");
        state.proposed = out;
        state.tab = "editor";
        log(`Código gerado por ${id}. Revise o diff.`);
        state.busy = false;
        render();
        return;
      } catch (e) {
        log(`${id} falhou: ${e.message}. Tentando o próximo…`);
      }
    }
    state.busy = false;
    log("Nenhuma IA disponível respondeu. Cadastre uma chave em Ajustes.");
    render();
  }

  /* ---------------- Diff ---------------- */
  function diffLines(a, b) {
    const A = a.split("\n");
    const B = b.split("\n");
    const out = [];
    let i = 0;
    let j = 0;
    while (i < A.length || j < B.length) {
      if (A[i] === B[j]) {
        out.push(["ctx", A[i] ?? ""]);
        i++;
        j++;
      } else if (B.indexOf(A[i], j) === -1 && i < A.length) {
        out.push(["del", A[i]]);
        i++;
      } else if (A.indexOf(B[j], i) === -1 && j < B.length) {
        out.push(["add", B[j]]);
        j++;
      } else {
        out.push(["del", A[i] ?? ""]);
        out.push(["add", B[j] ?? ""]);
        i++;
        j++;
      }
    }
    return out;
  }

  /* ---------------- Chat do Lovable ---------------- */
  function findChatInput() {
    return (
      document.querySelector("textarea[placeholder*='Lovable' i]") ||
      document.querySelector("form textarea") ||
      document.querySelector("textarea") ||
      document.querySelector("[contenteditable='true']")
    );
  }

  function setChatValue(el, text) {
    if (!el) return false;
    if (el.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      el.focus();
      document.execCommand("insertText", false, text);
    }
    return true;
  }

  function sendSummaryToChat(info) {
    const changes = diffLines(state.original, state.proposed || state.original);
    const added = changes.filter((c) => c[0] === "add").length;
    const removed = changes.filter((c) => c[0] === "del").length;
    const summary = [
      "✅ Alterações aplicadas pelo Lovable Copilot",
      `Repositório: ${info.repo} (branch ${info.branch})`,
      `Arquivo modificado: ${info.file}`,
      `Pedido: ${state.lastInstruction || info.message}`,
      `Linhas adicionadas: ${added} | removidas: ${removed}`,
      `Commit: ${info.commit.slice(0, 7)} — ${info.url}`,
      "Status: commit realizado com sucesso.",
    ].join("\n");
    const el = findChatInput();
    if (setChatValue(el, summary)) log("Resumo enviado para o chat do Lovable.");
    else log("Não encontrei o campo do chat — resumo copiado no log.");
  }

  // Quando ligado, o texto digitado no chat do Lovable vira a instrução da extensão.
  document.addEventListener(
    "keydown",
    (ev) => {
      if (!state.on || ev.key !== "Enter" || ev.shiftKey) return;
      const el = ev.target;
      if (!(el instanceof HTMLElement) || document.getElementById("lvc-root")?.contains(el)) return;
      const isChat = el.tagName === "TEXTAREA" || el.getAttribute?.("contenteditable") === "true";
      if (!isChat) return;
      const text = (el.value ?? el.textContent ?? "").trim();
      if (!text || text.startsWith("✅ Alterações aplicadas")) return;
      ev.preventDefault();
      ev.stopPropagation();
      setChatValue(el, "");
      open();
      generate(text);
    },
    true,
  );

  /* ---------------- UI ---------------- */
  const root = document.createElement("div");
  root.id = "lvc-root";
  document.documentElement.appendChild(root);

  const ICONS = {
    power: "M12 3v9M6.6 6.6a8 8 0 1 0 10.8 0",
    repo: "M4 4h11a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z M8 8h6",
    files: "M4 5h6l2 2h8v12H4z",
    editor: "M8 6l-5 6 5 6M16 6l5 6-5 6",
    images: "M3 5h18v14H3z M8 11l3 3 3-4 4 5H6z",
    settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M4 12h2m12 0h2M12 4v2m0 12v2",
  };
  const icon = (d) =>
    `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;

  function open() {
    state.on = true;
    render();
  }

  function bodyHtml() {
    if (state.tab === "repo") {
      return `
        <span class="lvc-label">Token do GitHub (PAT)</span>
        <input class="lvc-input" id="lvc-token" type="password" placeholder="ghp_…" value="${esc(state.ghToken)}" />
        <div class="lvc-row">
          <button class="lvc-btn" data-variant="primary" id="lvc-detect">Detectar repositórios</button>
          <span class="lvc-chip" data-ok="${!!state.ghToken}">${state.ghToken ? "token salvo" : "sem token"}</span>
        </div>
        <span class="lvc-label">Ou cole a URL do projeto</span>
        <div class="lvc-row" style="margin-top:0">
          <input class="lvc-input" id="lvc-url" placeholder="https://github.com/usuario/projeto" style="flex:1" />
          <button class="lvc-btn" id="lvc-url-go">Usar</button>
        </div>
        ${
          state.repos.length
            ? `<div class="lvc-list">${state.repos
                .map(
                  (r) =>
                    `<div class="lvc-item" data-repo="${esc(r.full_name)}" data-selected="${state.repo?.full_name === r.full_name}"><span>${esc(r.full_name)}</span><span>${r.private ? "privado" : "público"}</span></div>`,
                )
                .join("")}</div>`
            : `<p class="lvc-muted" style="margin-top:12px">Nenhum repositório carregado ainda.</p>`
        }`;
    }
    if (state.tab === "files") {
      if (!state.repo) return `<p class="lvc-muted">Selecione um repositório primeiro.</p>`;
      const list = state.tree.filter((p) => p.toLowerCase().includes(state.filter.toLowerCase())).slice(0, 300);
      return `
        <div class="lvc-row" style="margin-top:0">
          <span class="lvc-chip" data-ok="true">${esc(state.repo.full_name)} · ${esc(state.branch)}</span>
        </div>
        <span class="lvc-label">Buscar arquivo</span>
        <input class="lvc-input" id="lvc-filter" placeholder="src/components/Header.tsx" value="${esc(state.filter)}" />
        <div class="lvc-list">${
          list.length
            ? list
                .map(
                  (p) =>
                    `<div class="lvc-item" data-file="${esc(p)}" data-selected="${state.file?.path === p}"><span>${esc(p)}</span><span>abrir</span></div>`,
                )
                .join("")
            : `<div class="lvc-item"><span class="lvc-muted">Nada encontrado</span></div>`
        }</div>`;
    }
    if (state.tab === "editor") {
      if (!state.file) return `<p class="lvc-muted">Abra um arquivo na aba de arquivos.</p>`;
      const rows = state.proposed
        ? diffLines(state.original, state.proposed)
            .map(([t, l]) => `<div class="${t === "add" ? "add" : t === "del" ? "del" : ""}">${t === "add" ? "+" : t === "del" ? "-" : " "} ${esc(l)}</div>`)
            .join("")
        : "";
      return `
        <div class="lvc-row" style="margin-top:0"><span class="lvc-chip" data-ok="true">${esc(state.file.path)}</span></div>
        <span class="lvc-label">O que a IA deve fazer neste arquivo</span>
        <textarea class="lvc-textarea" id="lvc-instr" placeholder="Deixe o cabeçalho igual à imagem enviada…">${esc(state.lastInstruction)}</textarea>
        <div class="lvc-row">
          <button class="lvc-btn" data-variant="primary" id="lvc-gen" ${state.busy ? "disabled" : ""}>Gerar alteração</button>
          <button class="lvc-btn" id="lvc-commit" ${state.proposed && !state.busy ? "" : "disabled"}>Aplicar e comitar</button>
          <button class="lvc-btn" id="lvc-discard" ${state.proposed ? "" : "disabled"}>Descartar</button>
        </div>
        ${state.proposed ? `<span class="lvc-label">Diff proposto</span><div class="lvc-diff">${rows}</div>` : `<p class="lvc-muted" style="margin-top:12px">Nenhuma proposta gerada ainda.</p>`}`;
    }
    if (state.tab === "images") {
      return `
        <span class="lvc-label">Imagens da interface (referência para a IA)</span>
        <input class="lvc-input" id="lvc-img" type="file" accept="image/*" multiple />
        <div class="lvc-thumbs">${state.images.map((u, i) => `<img src="${u}" data-img="${i}" title="clique para remover" />`).join("")}</div>
        <p class="lvc-muted" style="margin-top:12px">Você também pode colar (Ctrl+V) uma imagem com o painel aberto.</p>`;
    }
    return `
      <span class="lvc-label">IA preferida (com fallback automático)</span>
      <select class="lvc-select" id="lvc-provider">${PROVIDERS.map(
        (p) => `<option value="${p.id}" ${state.provider === p.id ? "selected" : ""}>${p.label}</option>`,
      ).join("")}</select>
      <span class="lvc-label">Servidor da IA do Lovable</span>
      <input class="lvc-input" id="lvc-proxy" value="${esc(state.proxyUrl)}" />
      ${["openai", "anthropic", "gemini", "groq"]
        .map(
          (k) =>
            `<span class="lvc-label">Chave ${k}</span><input class="lvc-input" data-key="${k}" type="password" value="${esc(state.keys[k])}" placeholder="opcional" />`,
        )
        .join("")}
      <div class="lvc-row"><button class="lvc-btn" data-variant="primary" id="lvc-save">Salvar configurações</button></div>`;
  }

  function render() {
    const tabs = [
      ["repo", "repo", "Repositório"],
      ["files", "files", "Arquivos"],
      ["editor", "editor", "Editor & Diff"],
      ["images", "images", "Imagens"],
      ["settings", "settings", "Ajustes"],
    ];
    const title = tabs.find((t) => t[0] === state.tab)?.[2] ?? "";
    root.innerHTML = `
      <div class="lvc-panel" data-open="${state.on}">
        <div class="lvc-rail">
          ${tabs.map(([id, ic]) => `<button data-tab="${id}" data-active="${state.tab === id}" title="${id}">${icon(ICONS[ic])}</button>`).join("")}
        </div>
        <div class="lvc-main">
          <div class="lvc-head">
            <h2>${title}</h2>
            <span class="lvc-status">${state.busy ? "processando…" : state.on ? "ativo" : "desligado"}</span>
            <button class="lvc-btn" id="lvc-close">Fechar</button>
          </div>
          <div class="lvc-body">
            ${bodyHtml()}
            ${state.log.length ? `<div class="lvc-log">${esc(state.log.join("\n"))}</div>` : ""}
          </div>
        </div>
      </div>
      <button class="lvc-launcher" id="lvc-power" data-on="${state.on}" title="Ligar/desligar">${icon(ICONS.power)}</button>`;
    bind();
  }

  function bind() {
    const q = (s) => root.querySelector(s);
    q("#lvc-power").onclick = () => {
      state.on = !state.on;
      render();
    };
    q("#lvc-close").onclick = () => {
      state.on = false;
      render();
    };
    root.querySelectorAll("[data-tab]").forEach((b) => {
      b.onclick = () => {
        state.tab = b.dataset.tab;
        render();
      };
    });

    const token = q("#lvc-token");
    if (token)
      token.oninput = () => {
        state.ghToken = token.value.trim();
        store.set({ ghToken: state.ghToken });
      };
    if (q("#lvc-detect")) q("#lvc-detect").onclick = detectRepos;
    if (q("#lvc-url-go")) q("#lvc-url-go").onclick = () => useRepoUrl(q("#lvc-url").value);
    root.querySelectorAll("[data-repo]").forEach((el) => {
      el.onclick = () => selectRepo({ full_name: el.dataset.repo });
    });

    const filter = q("#lvc-filter");
    if (filter)
      filter.oninput = () => {
        state.filter = filter.value;
        const pos = filter.selectionStart;
        render();
        const f = root.querySelector("#lvc-filter");
        f.focus();
        f.setSelectionRange(pos, pos);
      };
    root.querySelectorAll("[data-file]").forEach((el) => {
      el.onclick = () => openFile(el.dataset.file);
    });

    if (q("#lvc-gen"))
      q("#lvc-gen").onclick = () => generate(q("#lvc-instr").value.trim() || "Melhore este arquivo conforme as imagens enviadas.");
    if (q("#lvc-commit"))
      q("#lvc-commit").onclick = () =>
        commitFile(`feat: ${(state.lastInstruction || "ajustes via Lovable Copilot").slice(0, 68)}`);
    if (q("#lvc-discard"))
      q("#lvc-discard").onclick = () => {
        state.proposed = "";
        render();
      };

    const img = q("#lvc-img");
    if (img)
      img.onchange = async () => {
        for (const f of img.files) state.images.push(await toDataUrl(f));
        render();
      };
    root.querySelectorAll("[data-img]").forEach((el) => {
      el.onclick = () => {
        state.images.splice(Number(el.dataset.img), 1);
        render();
      };
    });

    const prov = q("#lvc-provider");
    if (prov)
      prov.onchange = () => {
        state.provider = prov.value;
      };
    if (q("#lvc-save"))
      q("#lvc-save").onclick = () => {
        state.proxyUrl = q("#lvc-proxy").value.trim() || DEFAULT_PROXY;
        root.querySelectorAll("[data-key]").forEach((el) => {
          state.keys[el.dataset.key] = el.value.trim();
        });
        store.set({ provider: state.provider, proxyUrl: state.proxyUrl, keys: state.keys });
        log("Configurações salvas.");
      };
  }

  function toDataUrl(file) {
    return new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(file);
    });
  }

  document.addEventListener("paste", async (ev) => {
    if (!state.on) return;
    const items = [...(ev.clipboardData?.items || [])].filter((i) => i.type.startsWith("image/"));
    if (!items.length) return;
    for (const it of items) state.images.push(await toDataUrl(it.getAsFile()));
    log(`${items.length} imagem(ns) adicionada(s).`);
  });

  (async () => {
    const saved = await store.get(["ghToken", "provider", "proxyUrl", "keys"]);
    state.ghToken = saved.ghToken || "";
    state.provider = saved.provider || "lovable";
    state.proxyUrl = saved.proxyUrl || DEFAULT_PROXY;
    state.keys = { ...state.keys, ...(saved.keys || {}) };
    render();
  })();
})();
