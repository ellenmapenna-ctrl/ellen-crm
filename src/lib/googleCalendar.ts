// Integração com Google Calendar via Google Identity Services (GIS), sem
// backend: o token de acesso vive só no navegador (sessionStorage), nunca
// toca nosso Supabase. Modo somente-leitura — eventos do Google aparecem na
// grade da Agenda, mas quem cria/edita fica só nos "compromissos" locais.
const CLIENT_ID = "716921605751-obiesejt1352ch2v8kcejqotubuug4ku.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const STORAGE_KEY = "google_calendar_token";

export interface GoogleEvento {
  id: string;
  titulo: string;
  data: string; // yyyy-mm-dd
  horaInicio: string | null; // HH:mm, null se for evento de dia inteiro
  horaFim: string | null;
  diaInteiro: boolean;
}

interface TokenArmazenado {
  accessToken: string;
  expiraEm: number; // epoch ms
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
          revoke: (token: string, done: () => void) => void;
        };
      };
    };
  }
}

function lerTokenArmazenado(): TokenArmazenado | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TokenArmazenado;
    if (parsed.expiraEm < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function salvarToken(accessToken: string, expiresInSegundos: number) {
  const registro: TokenArmazenado = { accessToken, expiraEm: Date.now() + expiresInSegundos * 1000 - 60_000 };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(registro));
}

export function tokenGoogleValido(): string | null {
  return lerTokenArmazenado()?.accessToken ?? null;
}

export function desconectarGoogle() {
  const token = tokenGoogleValido();
  sessionStorage.removeItem(STORAGE_KEY);
  if (token && window.google) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }
}

/** Abre o popup de login do Google e resolve com o access token (ou rejeita se cancelado/erro). */
export function conectarGoogle(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject(new Error("Google Identity Services ainda não carregou. Recarregue a página e tente de novo."));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? "Não foi possível conectar ao Google."));
          return;
        }
        salvarToken(resp.access_token, resp.expires_in ?? 3600);
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken();
  });
}

/** Busca eventos do calendário principal do Google entre duas datas (yyyy-mm-dd, inclusive). */
export async function buscarEventosGoogle(accessToken: string, dataInicio: string, dataFim: string): Promise<GoogleEvento[]> {
  const timeMin = `${dataInicio}T00:00:00Z`;
  const timeMax = `${dataFim}T23:59:59Z`;
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`;

  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (resp.status === 401) {
    sessionStorage.removeItem(STORAGE_KEY);
    throw new Error("Sessão do Google expirou. Conecte de novo.");
  }
  if (!resp.ok) throw new Error(`Falha ao buscar eventos do Google (${resp.status}).`);

  const json = await resp.json();
  const items: unknown[] = json.items ?? [];

  return items.map((item): GoogleEvento => {
    const e = item as {
      id: string;
      summary?: string;
      start?: { date?: string; dateTime?: string };
      end?: { date?: string; dateTime?: string };
    };
    const diaInteiro = !!e.start?.date;
    const dataEvento = e.start?.date ?? (e.start?.dateTime ?? "").slice(0, 10);
    const horaInicio = e.start?.dateTime ? e.start.dateTime.slice(11, 16) : null;
    const horaFim = e.end?.dateTime ? e.end.dateTime.slice(11, 16) : null;
    return {
      id: e.id,
      titulo: e.summary || "(sem título)",
      data: dataEvento,
      horaInicio,
      horaFim,
      diaInteiro,
    };
  });
}
