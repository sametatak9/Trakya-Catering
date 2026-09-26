// UBL-TR (GİB e-Fatura / e-Arşiv) XML okuyucu. Tarayıcıdaki DOMParser ile çalışır; ağ gerekmez.
import { unitInfo } from './domain';

export interface UblLine { name: string; quantity: number; unitCode: string; unitPrice: number; lineTotal: number }
export interface UblInvoice {
  invoiceNo: string;
  ettn: string | null;
  issueDate: string;
  dueDate: string | null;
  profile: string | null;          // TICARIFATURA, TEMELFATURA, EARSIVFATURA…
  invoiceType: string | null;      // SATIS, TEVKIFAT, IADE…
  currency: string;
  supplierName: string;
  supplierTaxNo: string | null;
  customerName: string | null;
  customerTaxNo: string | null;
  netAmount: number;               // KDV hariç (TaxExclusiveAmount)
  vatAmount: number;
  withholdingAmount: number;       // tevkifat
  payableAmount: number;
  lines: UblLine[];
}

const num = (s: string | null | undefined) => {
  const n = Number((s ?? '').trim());
  return Number.isFinite(n) ? n : 0;
};

/** Yalnızca doğrudan çocuklar arasında ara (iç içe aynı adlı etiketleri karıştırmamak için) */
function child(el: Element | null | undefined, local: string): Element | null {
  if (!el) return null;
  for (const c of Array.from(el.children)) if (c.localName === local) return c;
  return null;
}
function path(el: Element | null | undefined, ...locals: string[]): Element | null {
  let cur: Element | null | undefined = el;
  for (const l of locals) cur = child(cur, l);
  return cur ?? null;
}
const text = (el: Element | null | undefined) => el?.textContent?.trim() ?? null;

function partyInfo(party: Element | null): { name: string | null; taxNo: string | null } {
  if (!party) return { name: null, taxNo: null };
  let taxNo: string | null = null;
  for (const pid of Array.from(party.children).filter((c) => c.localName === 'PartyIdentification')) {
    const id = child(pid, 'ID');
    const scheme = id?.getAttribute('schemeID')?.toUpperCase();
    if (scheme === 'VKN' || scheme === 'TCKN') { taxNo = text(id); break; }
  }
  const person = child(party, 'Person');
  const name = text(path(party, 'PartyName', 'Name'))
    ?? (person ? [text(child(person, 'FirstName')), text(child(person, 'FamilyName'))].filter(Boolean).join(' ') : null);
  return { name, taxNo };
}

export function parseUbl(xml: string): UblInvoice {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('XML okunamadı');
  const root = doc.documentElement;
  if (!root || root.localName !== 'Invoice') throw new Error('Bu dosya bir UBL fatura değil');

  const supplier = partyInfo(path(root, 'AccountingSupplierParty', 'Party'));
  const customer = partyInfo(path(root, 'AccountingCustomerParty', 'Party'));
  const totals = child(root, 'LegalMonetaryTotal');
  const vat = Array.from(root.children).filter((c) => c.localName === 'TaxTotal')
    .reduce((s, t) => s + num(text(child(t, 'TaxAmount'))), 0);
  const withholding = Array.from(root.children).filter((c) => c.localName === 'WithholdingTaxTotal')
    .reduce((s, t) => s + num(text(child(t, 'TaxAmount'))), 0);

  const lines: UblLine[] = Array.from(root.children).filter((c) => c.localName === 'InvoiceLine').map((l) => {
    const q = child(l, 'InvoicedQuantity');
    return {
      name: text(path(l, 'Item', 'Name')) ?? '',
      quantity: num(text(q)),
      unitCode: q?.getAttribute('unitCode') ?? '',
      unitPrice: num(text(path(l, 'Price', 'PriceAmount'))),
      lineTotal: num(text(child(l, 'LineExtensionAmount'))),
    };
  });

  const net = num(text(child(totals, 'TaxExclusiveAmount'))) || lines.reduce((s, l) => s + l.lineTotal, 0);
  const payable = num(text(child(totals, 'PayableAmount'))) || num(text(child(totals, 'TaxInclusiveAmount'))) || net + vat - withholding;
  const dueDate = text(path(root, 'PaymentMeans', 'PaymentDueDate')) ?? text(child(root, 'DueDate'));

  if (!supplier.name) throw new Error('Satıcı unvanı bulunamadı');
  return {
    invoiceNo: text(child(root, 'ID')) ?? '',
    ettn: text(child(root, 'UUID')),
    issueDate: text(child(root, 'IssueDate')) ?? '',
    dueDate,
    profile: text(child(root, 'ProfileID')),
    invoiceType: text(child(root, 'InvoiceTypeCode')),
    currency: text(child(root, 'DocumentCurrencyCode')) ?? 'TRY',
    supplierName: supplier.name,
    supplierTaxNo: supplier.taxNo,
    customerName: customer.name,
    customerTaxNo: customer.taxNo,
    netAmount: round2(net),
    vatAmount: round2(vat),
    withholdingAmount: round2(withholding),
    payableAmount: round2(payable),
    lines,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** UN/ECE birim kodu → sistem birimi */
export const UNIT_CODES: Record<string, string> = {
  KGM: 'kg', GRM: 'g', LTR: 'lt', MLT: 'ml', C62: 'adet', NIU: 'adet', PA: 'adet', BX: 'adet', H87: 'adet',
};


/** Fatura satırının birim fiyatını hammaddenin stok birimine çevirir (kg ↔ g, lt ↔ ml). Boyut uyuşmazsa null. */
export function pricePerStockUnit(line: Pick<UblLine, 'unitCode' | 'unitPrice'>, stockUnit: string): number | null {
  const lu = UNIT_CODES[line.unitCode] ?? null;
  if (!lu || line.unitPrice <= 0) return null;
  const a = unitInfo(lu), b = unitInfo(stockUnit);
  if (a.base !== b.base) return null;
  return line.unitPrice * (b.toBase / a.toBase);
}
