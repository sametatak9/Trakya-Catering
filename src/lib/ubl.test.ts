// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { parseUbl, pricePerStockUnit } from './ubl';

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:ProfileID>TICARIFATURA</cbc:ProfileID>
  <cbc:ID>KSP2026000000123</cbc:ID>
  <cbc:UUID>3f2504e0-4f89-11d3-9a0c-0305e82c3301</cbc:UUID>
  <cbc:IssueDate>2026-09-24</cbc:IssueDate>
  <cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="MERSISNO">0123</cbc:ID></cac:PartyIdentification>
    <cac:PartyIdentification><cbc:ID schemeID="VKN">9876543210</cbc:ID></cac:PartyIdentification>
    <cac:PartyName><cbc:Name>Uzunköprü Et Ürünleri Ltd. Şti.</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="VKN">1111111111</cbc:ID></cac:PartyIdentification>
    <cac:PartyName><cbc:Name>Trakya Catering</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:PaymentMeans><cbc:PaymentMeansCode>42</cbc:PaymentMeansCode><cbc:PaymentDueDate>2026-10-24</cbc:PaymentDueDate></cac:PaymentMeans>
  <cac:TaxTotal><cbc:TaxAmount currencyID="TRY">610.00</cbc:TaxAmount></cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="TRY">61000.00</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="TRY">61000.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="TRY">61610.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="TRY">61610.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="KGM">100</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="TRY">60000.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Dana Kuşbaşı</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="TRY">600.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
  <cac:InvoiceLine>
    <cbc:ID>2</cbc:ID>
    <cbc:InvoicedQuantity unitCode="KGM">20</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="TRY">1000.00</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>Kemik (çorbalık)</cbc:Name></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="TRY">50.00</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>`;

describe('UBL-TR okuyucu', () => {
  it('satıcı, ETTN, tutarlar ve kalemleri çıkarır', () => {
    const inv = parseUbl(XML);
    expect(inv.invoiceNo).toBe('KSP2026000000123');
    expect(inv.ettn).toBe('3f2504e0-4f89-11d3-9a0c-0305e82c3301');
    expect(inv.issueDate).toBe('2026-09-24');
    expect(inv.dueDate).toBe('2026-10-24');
    expect(inv.supplierName).toBe('Uzunköprü Et Ürünleri Ltd. Şti.');
    expect(inv.supplierTaxNo).toBe('9876543210');     // MERSIS değil VKN
    expect(inv.customerTaxNo).toBe('1111111111');
    expect(inv.netAmount).toBe(61000);
    expect(inv.vatAmount).toBe(610);
    expect(inv.payableAmount).toBe(61610);
    expect(inv.lines).toHaveLength(2);
    expect(inv.lines[0]).toMatchObject({ name: 'Dana Kuşbaşı', quantity: 100, unitCode: 'KGM', unitPrice: 600 });
  });
  it('fatura olmayan dosyayı reddeder', () => {
    expect(() => parseUbl('<Order/>')).toThrow();
    expect(() => parseUbl('bozuk')).toThrow();
  });
});

describe('fatura fiyatını stok birimine çevirme', () => {
  it('aynı boyutta birim dönüştürür', () => {
    expect(pricePerStockUnit({ unitCode: 'KGM', unitPrice: 600 }, 'kg')).toBe(600);
    expect(pricePerStockUnit({ unitCode: 'GRM', unitPrice: 0.6 }, 'kg')).toBeCloseTo(600);
    expect(pricePerStockUnit({ unitCode: 'LTR', unitPrice: 80 }, 'ml')).toBeCloseTo(0.08);
  });
  it('boyut uyuşmazsa veya kod bilinmiyorsa null', () => {
    expect(pricePerStockUnit({ unitCode: 'KGM', unitPrice: 10 }, 'lt')).toBeNull();
    expect(pricePerStockUnit({ unitCode: 'XYZ', unitPrice: 10 }, 'kg')).toBeNull();
  });
});
