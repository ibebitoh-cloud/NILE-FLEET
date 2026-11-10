import * as api from '../api';
import { callAi, ChatTurn, loadMemory as loadAppMemory, remember as rememberApp, sessionId as appSession } from '../daliCore';
import type { TransportUser } from '../types';
import { DEFAULT_SETTINGS } from './math';
import { buildFuelContext, FuelData, makeFuelData } from './daliContext';

/**
 * DALI for the Fuel section. It only knows the fuel-card data (trucks, drivers, fills,
 * km/L, alerts, truck health, weeks). It never sees customer prices: the Customer Rates
 * section has its own DALI (../dali.ts) and the two are not linked.
 */

export type { ChatTurn, FuelData };

export async function loadFuelData(): Promise<FuelData> {
  const [{ txs }, s] = await Promise.all([api.loadFuel(), api.loadFuelSettings().catch(() => ({}))]);
  return makeFuelData(txs, { ...DEFAULT_SETTINGS, ...s });
}

export async function askFuel(d: FuelData, user: TransportUser, question: string, history: ChatTurn[], earlier: string[]) {
  const context = buildFuelContext(d, user, question, history, earlier);
  const { text } = await callAi<{ text: string }>('fuelAsk', { question, context, history });
  return text;
}

/* ------------------------------ memory ------------------------------ */
// Fuel DALI only: its own session and memory, never the Customer Rates chats.

export const sessionId = (reset = false) => appSession('fuel', reset);
export const remember = (session: string, role: 'user' | 'assistant', message: string) => rememberApp('fuel', session, role, message);
export const loadMemory = (session: string) => loadAppMemory('fuel', session);
