/** Finite accounting only. Access, transport, work capacity and consumption rates
 * belong to later gameplay validation, not these trusted headless inputs.
 */
export type Stocks = Readonly<Record<string, Readonly<Record<string, number>>>>;
type ResourceBase = { readonly id: string; readonly resourceId: string; readonly fromStockId: string; readonly amount: number };
export type ResourceOrder = ResourceBase & (
  { readonly type: 'transfer'; readonly toStockId: string } |
  { readonly type: 'consume'; readonly reason: string }
);
export interface ResourceLedgerEntry {
  readonly before: number;
  readonly transferred: number;
  readonly consumed: number;
  readonly after: number;
}
export type ResourceLedger = Readonly<Record<string, ResourceLedgerEntry>>;
const count = (n: number, label: string) => {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`${label} must be a nonnegative safe integer`);
};

/** All outgoing amounts reserve from opening stocks; today's arrivals cannot be
 * spent today. Any conflict rejects the complete plan, independent of click order.
 */
export function resolveResources(opening: Stocks, input: readonly ResourceOrder[]) {
  const stocks: Record<string, Record<string, number>> = Object.fromEntries(Object.keys(opening).sort().map(id => {
    if (!id) throw new Error('Stock ID must be nonempty');
    return [id, Object.fromEntries(Object.entries(opening[id]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([resource, amount]) => {
      if (!resource) throw new Error('Resource ID must be nonempty');
      count(amount, `stock ${id}/${resource}`); return [resource, amount];
    }))];
  }));
  const orders = [...input].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (new Set(orders.map(order => order.id)).size !== orders.length) throw new Error('Duplicate resource order ID');
  const openingAmount = (stock: string, resource: string) => Object.hasOwn(opening[stock], resource) ? opening[stock][resource] : 0;
  const reserved = new Map<string, Map<string, number>>();
  const consumed = new Map<string, number>(), transferred = new Map<string, number>();
  for (const order of orders) {
    if (!order.id || !order.resourceId || !Object.hasOwn(stocks, order.fromStockId)) throw new Error('Invalid resource order or source stock');
    count(order.amount, `resource order ${order.id}`);
    if (!order.amount) throw new Error('Resource order amount must be positive');
    if (order.type === 'transfer') {
      if (order.toStockId === order.fromStockId || !Object.hasOwn(stocks, order.toStockId)) throw new Error('Transfer requires a different existing destination stock');
    } else if (order.type !== 'consume' || !order.reason) throw new Error('Consumption requires an explicit reason');
    const source = reserved.get(order.fromStockId) ?? new Map<string, number>();
    const outgoing = (source.get(order.resourceId) ?? 0) + order.amount;
    count(outgoing, 'resource reservation');
    if (outgoing > openingAmount(order.fromStockId, order.resourceId)) throw new Error(`Insufficient opening stock: ${order.fromStockId}/${order.resourceId}`);
    source.set(order.resourceId, outgoing); reserved.set(order.fromStockId, source);
  }
  // Validation and reservation completed before applying any transfer or sink.
  for (const order of orders) {
    stocks[order.fromStockId][order.resourceId] -= order.amount;
    const totals = order.type === 'transfer' ? transferred : consumed;
    totals.set(order.resourceId, (totals.get(order.resourceId) ?? 0) + order.amount);
    if (order.type === 'transfer') {
      const target = stocks[order.toStockId];
      target[order.resourceId] = (Object.hasOwn(target, order.resourceId) ? target[order.resourceId] : 0) + order.amount;
      count(target[order.resourceId], `destination ${order.toStockId}/${order.resourceId}`);
    }
  }
  const resources = [...new Set(Object.values(stocks).flatMap(stock => Object.keys(stock)))].sort();
  const ledger: Record<string, ResourceLedgerEntry> = Object.fromEntries(resources.map(resource => {
    const before = Object.values(opening).reduce((total, stock) => total + (Object.hasOwn(stock, resource) ? stock[resource] : 0), 0);
    const after = Object.values(stocks).reduce((total, stock) => total + (Object.hasOwn(stock, resource) ? stock[resource] : 0), 0);
    count(before, 'resource total'); count(after, 'resolved resource total');
    const spent = consumed.get(resource) ?? 0;
    if (after !== before - spent) throw new Error('Resource ledger failed');
    return [resource, { before, transferred: transferred.get(resource) ?? 0, consumed: spent, after }];
  }));
  return { stocks, ledger, orders: orders.map(order => ({ ...order })) };
}
