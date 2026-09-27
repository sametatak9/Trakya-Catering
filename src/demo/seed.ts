/* eslint-disable @typescript-eslint/no-explicit-any */
// DEMO ÖRNEK VERİ — gerçekçi ama açıkça örnek. Tüm tarihler "bugün"e göre üretilir,
// böylece demo her açıldığında canlı görünür. Sabit tohumlu rastgelelik: her kurulum aynı sonucu verir.
import { Engine, addDaysIso, istanbulToday, type DemoDb, type Row } from './engine';
import { DEMO_USERS } from './users';

export const DEMO_VERSION = 9;

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let idn = 0;
const id = (p: string) => `${p}0000000-0000-4000-8000-${(++idn).toString(16).padStart(12, '0')}`;
const at = (date: string, hh = 9) => `${date}T${String(hh).padStart(2, '0')}:00:00+03:00`;


// [anahtar, ad, kategori, birim, fire%, güncel fiyat, alerjenler, tedarikçi]
type IngDef = [string, string, string, string, number, number | null, string[], string];
const ET = 'Uzunköprü Et Ürünleri'; const HAL = 'Çorlu Hal · Yeşil Manav'; const TOP = 'Keşan Toptan Gıda'; const SUT = 'Trakya Süt Kooperatifi'; const FIR = 'Velimeşe Ekmek Fırını';
const ING: IngDef[] = [
  ['kiyma', 'Dana Kıyma', 'et_tavuk', 'kg', 0, 520, [], ET],
  ['kusbasi', 'Dana Kuşbaşı', 'et_tavuk', 'kg', 8, 610, [], ET],
  ['tavuk_but', 'Tavuk But (kemiksiz)', 'et_tavuk', 'kg', 5, 185, [], ET],
  ['tavuk_gogus', 'Tavuk Göğüs', 'et_tavuk', 'kg', 3, 210, [], ET],
  ['patlican', 'Patlıcan (kemer)', 'sebze_meyve', 'kg', 22, 38, [], HAL],
  ['domates', 'Domates', 'sebze_meyve', 'kg', 5, 32, [], HAL],
  ['biber', 'Sivri Biber', 'sebze_meyve', 'kg', 12, 55, [], HAL],
  ['sogan', 'Kuru Soğan', 'sebze_meyve', 'kg', 10, 18, [], HAL],
  ['sarimsak', 'Sarımsak', 'sebze_meyve', 'kg', 15, 140, [], HAL],
  ['patates', 'Patates', 'sebze_meyve', 'kg', 18, 22, [], HAL],
  ['havuc', 'Havuç', 'sebze_meyve', 'kg', 15, 20, [], HAL],
  ['bezelye', 'Bezelye (dondurulmuş)', 'sebze_meyve', 'kg', 0, 70, [], TOP],
  ['marul', 'Marul', 'sebze_meyve', 'kg', 25, 45, [], HAL],
  ['salatalik', 'Salatalık', 'sebze_meyve', 'kg', 5, 30, [], HAL],
  ['maydanoz', 'Maydanoz', 'sebze_meyve', 'kg', 20, 90, [], HAL],
  ['limon', 'Limon', 'sebze_meyve', 'kg', 0, 45, [], HAL],
  ['meyve', 'Mevsim Meyvesi', 'sebze_meyve', 'kg', 10, 40, [], HAL],
  ['pirinc', 'Baldo Pirinç', 'bakliyat_tahil', 'kg', 0, 62, [], TOP],
  ['bulgur', 'Pilavlık Bulgur', 'bakliyat_tahil', 'kg', 0, 38, ['gluten'], TOP],
  ['mercimek', 'Kırmızı Mercimek', 'bakliyat_tahil', 'kg', 0, 58, [], TOP],
  ['fasulye', 'Kuru Fasulye', 'bakliyat_tahil', 'kg', 0, 95, [], TOP],
  ['makarna', 'Burgu Makarna', 'kuru_gida', 'kg', 0, 42, ['gluten'], TOP],
  ['un', 'Buğday Unu', 'kuru_gida', 'kg', 0, 24, ['gluten'], TOP],
  ['irmik', 'İrmik', 'kuru_gida', 'kg', 0, 40, ['gluten'], TOP],
  ['seker', 'Toz Şeker', 'kuru_gida', 'kg', 0, 38, [], TOP],
  ['nisasta', 'Mısır Nişastası', 'kuru_gida', 'kg', 0, 60, [], TOP],
  ['tereyagi', 'Tereyağı', 'sut_urunleri', 'kg', 0, 430, ['sut'], SUT],
  ['yogurt', 'Yoğurt (kova)', 'sut_urunleri', 'kg', 0, 72, ['sut'], SUT],
  ['peynir', 'Beyaz Peynir', 'sut_urunleri', 'kg', 0, 245, ['sut'], SUT],
  ['kasar', 'Kaşar Peyniri', 'sut_urunleri', 'kg', 0, 360, ['sut'], SUT],
  ['sut', 'Süt', 'sut_urunleri', 'lt', 0, 36, ['sut'], SUT],
  ['yumurta', 'Yumurta', 'sut_urunleri', 'adet', 0, 4.4, ['yumurta'], SUT],
  ['zeytin', 'Siyah Zeytin', 'kuru_gida', 'kg', 0, 170, [], TOP],
  ['bal', 'Süzme Bal', 'kuru_gida', 'kg', 0, 380, [], TOP],
  ['cay', 'Siyah Çay', 'icecek', 'kg', 0, 260, [], TOP],
  ['aycicek', 'Ayçiçek Yağı', 'yag', 'lt', 0, 78, [], TOP],
  ['zeytinyagi', 'Zeytinyağı', 'yag', 'lt', 0, 290, [], TOP],
  ['salca', 'Domates Salçası', 'baharat_sos', 'kg', 0, 95, [], TOP],
  ['tuz', 'Tuz', 'baharat_sos', 'kg', 0, 9, [], TOP],
  ['karabiber', 'Karabiber', 'baharat_sos', 'kg', 0, 480, [], TOP],
  ['pulbiber', 'Pul Biber', 'baharat_sos', 'kg', 0, 320, [], TOP],
  ['nane', 'Kuru Nane', 'baharat_sos', 'kg', 0, 380, [], TOP],
  ['kimyon', 'Kimyon', 'baharat_sos', 'kg', 0, null, [], TOP],
  ['ekmek', 'Ekmek (somun)', 'ekmek_unlu', 'adet', 0, 12, ['gluten'], FIR],
  ['sefertasi', 'Sefer Tası Kapağı (tek kullanımlık)', 'temizlik_sarf', 'adet', 0, 1.9, [], 'Tekirdağ Ambalaj'],
];

// [anahtar, ad, kategori, porsiyon etiketi, servis g, adımlar, satırlar [malzeme, net (g/ml/adet)]]
type RecDef = [string, string, string, string, number | null, string, Array<[string, number]>];
const REC: RecDef[] = [
  ['mercimek', 'Mercimek Çorbası', 'corba', '1 kepçe (250 ml)', 250,
    'Mercimeği yıka, süz.\nSoğan ve havucu tereyağında kavur, unu ekle.\nSalça, mercimek ve suyu ekle; 35 dk kaynat.\nBlenderdan geçir, tuzla. Servis sıcaklığı 75 °C.',
    [['mercimek', 40], ['sogan', 15], ['havuc', 10], ['tereyagi', 5], ['un', 5], ['salca', 3], ['tuz', 2]]],
  ['yayla', 'Yayla Çorbası', 'corba', '1 kepçe (250 ml)', 250,
    'Pirinci haşla.\nYoğurt, un ve yumurtayı çırp; sıcak sudan azar azar ekleyerek ılıt.\nPirince ekle, sürekli karıştırarak kaynat.\nTereyağında naneyi yak, üzerine gezdir.',
    [['yogurt', 60], ['pirinc', 12], ['un', 5], ['yumurta', 0.1], ['tereyagi', 4], ['nane', 0.5], ['tuz', 2]]],
  ['ezogelin', 'Ezogelin Çorbası', 'corba', '1 kepçe (250 ml)', 250,
    'Soğanı tereyağında kavur, salçayı ekle.\nMercimek, bulgur ve pirinci ekle; su ile 40 dk pişir.\nNane ve pul biberi ekle, tuzla.',
    [['mercimek', 30], ['bulgur', 10], ['pirinc', 5], ['sogan', 12], ['salca', 5], ['tereyagi', 4], ['pulbiber', 0.5], ['nane', 0.5], ['tuz', 2]]],
  ['karniyarik', 'Karnıyarık', 'ana_yemek', '1 adet patlıcan + harç', 260,
    'Patlıcanları alacalı soy, tuzlu suda 20 dk beklet, kurula.\nFırın tepsisinde yağla fırçalayıp 200 °C\'de 15 dk ön pişir.\nSoğan, sarımsak ve biberi kavur; kıymayı ekleyip suyunu çektir.\nDomates, salça, tuz ve karabiberi ekle; harcı 10 dk pişir.\nPatlıcanları ortadan yar, harcı doldur, üzerine domates-biber koy.\nSalçalı su ekleyip 180 °C\'de 25 dk pişir. Servis: 1 adet/kişi.',
    [['patlican', 220], ['kiyma', 60], ['sogan', 30], ['domates', 40], ['biber', 20], ['sarimsak', 3], ['aycicek', 25], ['salca', 5], ['tuz', 2], ['karabiber', 0.3]]],
  ['orman', 'Orman Kebabı', 'ana_yemek', '1 kepçe (220 g)', 220,
    'Eti mühürle, soğanı ekle.\nSalça ve sıcak su ekle, 60 dk kısık ateşte pişir.\nPatates, havuç ve bezelyeyi ekle; 25 dk daha pişir.',
    [['kusbasi', 120], ['patates', 60], ['havuc', 30], ['bezelye', 25], ['sogan', 25], ['aycicek', 12], ['salca', 5], ['tuz', 2]]],
  ['tavuksote', 'Tavuk Sote', 'ana_yemek', '1 kepçe (200 g)', 200,
    'Tavuğu kuşbaşı doğra, yüksek ateşte sotele.\nSoğan ve biberi ekle.\nDomates ve salçayı ekle; 20 dk pişir, baharatla.',
    [['tavuk_but', 140], ['biber', 30], ['domates', 40], ['sogan', 25], ['aycicek', 10], ['salca', 4], ['tuz', 2], ['karabiber', 0.3]]],
  ['fasulye', 'Kuru Fasulye', 'ana_yemek', '1 kepçe (250 g)', 250,
    'Fasulyeyi akşamdan ıslat, haşla.\nSoğan ve salçayı yağda kavur.\nFasulye ve sıcak suyu ekle; 60 dk kısık ateşte pişir.',
    [['fasulye', 70], ['sogan', 20], ['salca', 8], ['aycicek', 10], ['tereyagi', 5], ['tuz', 2], ['pulbiber', 0.5]]],
  ['izgaratavuk', 'Izgara Tavuk Göğüs', 'ana_yemek', '1 porsiyon (150 g)', 150,
    'Göğüsleri zeytinyağı ve baharatla marine et (en az 2 saat).\nIzgarada her yüzü 5-6 dk pişir. İç ısı 74 °C.',
    [['tavuk_gogus', 150], ['zeytinyagi', 5], ['tuz', 1], ['karabiber', 0.3]]],
  ['pilav', 'Tereyağlı Pirinç Pilavı', 'pilav_makarna', '1 kepçe (180 g)', 180,
    'Pirinci ılık tuzlu suda 30 dk beklet, süz.\nTereyağında kavur, sıcak suyu ekle (1:1,5).\nKısık ateşte 18 dk pişir, 10 dk demlendir.',
    [['pirinc', 80], ['tereyagi', 8], ['aycicek', 4], ['tuz', 2]]],
  ['bulgurpilav', 'Bulgur Pilavı', 'pilav_makarna', '1 kepçe (180 g)', 180,
    'Soğanı kavur, salça ve domatesi ekle.\nBulguru ekle, sıcak suyu koy; 15 dk pişir, demlendir.',
    [['bulgur', 80], ['sogan', 10], ['domates', 15], ['salca', 4], ['tereyagi', 6], ['tuz', 2]]],
  ['makarna', 'Burgu Makarna', 'pilav_makarna', '1 kepçe (200 g)', 200,
    'Bol tuzlu kaynar suda 9 dk haşla.\nSüz, salçalı yağ sosla karıştır.',
    [['makarna', 90], ['aycicek', 5], ['salca', 3], ['tuz', 2]]],
  ['coban', 'Çoban Salata', 'salata_meze', '1 kase (150 g)', 150,
    'Sebzeleri küp doğra.\nServisten hemen önce zeytinyağı, limon ve tuzla karıştır.',
    [['domates', 60], ['salatalik', 50], ['biber', 15], ['sogan', 15], ['maydanoz', 5], ['zeytinyagi', 8], ['limon', 8], ['tuz', 1]]],
  ['mevsimsalata', 'Mevsim Salata', 'salata_meze', '1 kase (130 g)', 130,
    'Marulu yıka, kurut, doğra.\nDomates, salatalık ve rendelenmiş havucu ekle.\nSosu servis anında ekle.',
    [['marul', 50], ['domates', 30], ['salatalik', 30], ['havuc', 15], ['zeytinyagi', 8], ['limon', 8], ['tuz', 1]]],
  ['cacik', 'Cacık', 'salata_meze', '1 kase (150 g)', 150,
    'Salatalığı rendele, suyunu sık.\nYoğurt, ezilmiş sarımsak ve tuzla karıştır; nane serp. Soğuk servis.',
    [['yogurt', 100], ['salatalik', 40], ['sarimsak', 2], ['nane', 0.3], ['tuz', 1]]],
  ['sutlac', 'Fırın Sütlaç', 'tatli', '1 kase (180 g)', 180,
    'Pirinci az suyla haşla.\nSüt ve şekeri ekle, kaynat.\nNişastayı soğuk sütle aç, ekle; koyulaşınca kaselere paylaştır.\nFırında üstü kızarana kadar (220 °C, 10 dk) pişir.',
    [['sut', 150], ['pirinc', 20], ['seker', 25], ['nisasta', 5]]],
  ['helva', 'İrmik Helvası', 'tatli', '1 porsiyon (90 g)', 90,
    'Şerbet: süt, su ve şekeri kaynat.\nİrmiği tereyağında pembeleşene kadar kavur.\nSıcak şerbeti ekle, demlendir.',
    [['irmik', 30], ['seker', 30], ['tereyagi', 10], ['sut', 50]]],
  ['meyve', 'Mevsim Meyvesi', 'tatli', '1 adet (150 g)', 150, 'Yıka, kurula, servis et.', [['meyve', 150]]],
  ['ekmek', 'Ekmek', 'ekmek', '¼ somun', null, 'Dilimle, poşetle.', [['ekmek', 0.25]]],
  ['k_peynir', 'Beyaz Peynir (kahvaltı)', 'kahvalti', '40 g', 40, 'Dilimle, porsiyonla.', [['peynir', 40]]],
  ['k_kasar', 'Kaşar (kahvaltı)', 'kahvalti', '30 g', 30, 'Dilimle, porsiyonla.', [['kasar', 30]]],
  ['k_zeytin', 'Siyah Zeytin (kahvaltı)', 'kahvalti', '30 g', 30, 'Porsiyonla.', [['zeytin', 30]]],
  ['k_yumurta', 'Haşlanmış Yumurta', 'kahvalti', '1 adet', null, 'Kaynar suda 9 dk haşla, soğuk suya al.', [['yumurta', 1]]],
  ['k_domsal', 'Domates-Salatalık Tabağı', 'kahvalti', '90 g', 90, 'Dilimle.', [['domates', 50], ['salatalik', 40]]],
  ['k_bal', 'Bal & Tereyağı', 'kahvalti', '20 g + 10 g', 30, 'Porsiyon kaplarına paylaştır.', [['bal', 20], ['tereyagi', 10]]],
  ['k_cay', 'Demlik Çay', 'icecek', '2 bardak', null, 'Demle (15 dk), taze servis.', [['cay', 4], ['seker', 6]]],
];

// [anahtar, ad, tür, öğün, hedef fiyat, müşteri anahtarı, [[reçete, kap, katsayı]]]
type MenuDef = [string, string, string, string, number | null, string | null, Array<[string, string, number]>];
const MENUS: MenuDef[] = [
  ['karni', 'Karnıyarık Menüsü · 5 kap', 'standart', 'ogle', 175, null,
    [['ezogelin', 'corba', 1], ['karniyarik', 'ana', 1], ['pilav', 'yardimci', 1], ['cacik', 'meze', 1], ['sutlac', 'tatli', 1], ['ekmek', 'ekmek', 1]]],
  ['standart', 'Standart Öğle · 4 kap', 'standart', 'ogle', 165, null,
    [['mercimek', 'corba', 1], ['orman', 'ana', 1], ['pilav', 'yardimci', 1], ['mevsimsalata', 'salata', 1], ['ekmek', 'ekmek', 1]]],
  ['tavuk', 'Tavuklu Öğle · 5 kap', 'standart', 'ogle', 160, null,
    [['yayla', 'corba', 1], ['tavuksote', 'ana', 1], ['makarna', 'yardimci', 1], ['coban', 'salata', 1], ['meyve', 'tatli', 1], ['ekmek', 'ekmek', 1]]],
  ['agir', 'Ağır İşçi Menüsü · 6 kap', 'standart', 'ogle', 190, null,
    [['mercimek', 'corba', 1], ['fasulye', 'ana', 1], ['bulgurpilav', 'yardimci', 1.2], ['coban', 'salata', 1], ['helva', 'tatli', 1], ['ekmek', 'ekmek', 1.5]]],
  ['diyet', 'Diyet Menü (düşük karbonhidrat)', 'diyet', 'ogle', 185, null,
    [['yayla', 'corba', 0.8], ['izgaratavuk', 'ana', 1], ['mevsimsalata', 'salata', 1.5], ['meyve', 'tatli', 1]]],
  ['kahvalti', 'Kahvaltı Tabağı · 7 çeşit', 'kahvalti', 'kahvalti', 70, null,
    [['k_peynir', 'kahvalti', 1], ['k_kasar', 'kahvalti', 1], ['k_zeytin', 'kahvalti', 1], ['k_yumurta', 'kahvalti', 1], ['k_domsal', 'kahvalti', 1], ['k_bal', 'kahvalti', 1], ['k_cay', 'icecek', 1], ['ekmek', 'ekmek', 1]]],
  ['soguk', 'Soğuk Mezeli Akşam (organizasyon)', 'soguk_mezeli', 'aksam', 150, null,
    [['cacik', 'meze', 1], ['coban', 'salata', 1], ['k_peynir', 'meze', 1], ['izgaratavuk', 'ana', 1], ['pilav', 'yardimci', 1], ['sutlac', 'tatli', 1], ['ekmek', 'ekmek', 1]]],
  ['ergene', 'Ergene Şantiye Özel · Ağır İşçi', 'ozel', 'ogle', 185, 'ergene',
    [['mercimek', 'corba', 1.2], ['fasulye', 'ana', 1.2], ['bulgurpilav', 'yardimci', 1.3], ['coban', 'salata', 1], ['helva', 'tatli', 1], ['ekmek', 'ekmek', 2]]],
];

// [anahtar, ad, ilçe, il, kişi başı ₺, vade gün, e-fatura, günlük öğle, günlük kahvaltı, yetkili]
type CustDef = [string, string, string, string, number, number, boolean, number, number, string];
const CUSTOMERS: CustDef[] = [
  ['osb', 'Çorlu OSB Tekstil A.Ş.', 'Çorlu', 'Tekirdağ', 150, 30, true, 320, 140, 'İdari İşler · Ayşe Y.'],
  ['ergene', 'Ergene Şantiyesi (Kuzey Yapı)', 'Ergene', 'Tekirdağ', 165, 45, true, 180, 60, 'Şantiye Şefi · Okan B.'],
  ['belediye', 'Lüleburgaz Belediye Personeli', 'Lüleburgaz', 'Kırklareli', 135, 60, false, 140, 0, 'Destek Hizmetleri'],
  ['kesan', 'Keşan Lojistik Depo', 'Keşan', 'Edirne', 160, 30, false, 90, 0, 'Depo Müdürü · Serkan T.'],
  ['velimese', 'Velimeşe Otomotiv Yan Sanayi', 'Ergene', 'Tekirdağ', 155, 30, true, 85, 0, 'İK · Derya K.'],
  ['kolej', 'Tekirdağ Bilim Koleji', 'Süleymanpaşa', 'Tekirdağ', 170, 30, false, 35, 0, 'Müdür Yrd. · Cem A.'],
];

const FCATS: Array<[string, string, string, string, string[], number]> = [
  ['tabldot_satis', 'Tabldot / sözleşmeli yemek', 'gelir', 'Satış', [], 10],
  ['organizasyon', 'Organizasyon & özel gün (mevlüt, düğün…)', 'gelir', 'Satış', [], 20],
  ['diger_gelir', 'Diğer gelir (atık yağ, hurda…)', 'gelir', 'Diğer', [], 90],
  ['gida_hammadde', 'Gıda malzemesi', 'gider', 'Mutfak', ['kasap', 'et', 'tavuk', 'manav', 'sebze', 'bakliyat', 'toptan', 'gıda', 'süt'], 10],
  ['mutfak_sarf', 'Ambalaj, sefer tası & hijyen', 'gider', 'Mutfak', ['ambalaj', 'sefer', 'folyo', 'eldiven', 'deterjan', 'hijyen'], 20],
  ['elektrik', 'Elektrik', 'gider', 'İşletme', ['elektrik', 'kwh', 'trakya elektrik'], 30],
  ['su', 'Su', 'gider', 'İşletme', ['su idaresi', 'm3'], 40],
  ['dogalgaz', 'Doğalgaz / LPG', 'gider', 'İşletme', ['doğalgaz', 'trakya gaz', 'lpg'], 50],
  ['kira', 'Kira', 'gider', 'İşletme', ['kira'], 60],
  ['iletisim', 'İnternet & telefon', 'gider', 'İşletme', ['internet', 'telekom', 'gsm'], 70],
  ['akaryakit', 'Akaryakıt (mazot)', 'gider', 'Araç & Sevkiyat', ['akaryakıt', 'motorin', 'mazot', 'opet'], 80],
  ['arac_bakim', 'Araç bakım & onarım', 'gider', 'Araç & Sevkiyat', ['oto', 'servis', 'lastik'], 90],
  ['arac_sigorta', 'Araç sigorta, MTV & HGS', 'gider', 'Araç & Sevkiyat', ['sigorta', 'kasko', 'hgs'], 100],
  ['ekipman_bakim', 'Mutfak ekipman bakım', 'gider', 'Bakım & Demirbaş', ['kazan', 'fırın', 'teknik servis'], 110],
  ['demirbas', 'Demirbaş alımı', 'gider', 'Bakım & Demirbaş', ['demirbaş', 'makine'], 120],
  ['personel_maas', 'Personel maaş', 'gider', 'Personel', ['maaş'], 130],
  ['personel_sgk', 'SGK & vergi (personel)', 'gider', 'Personel', ['sgk', 'muhtasar'], 140],
  ['muhasebe_hukuk', 'Muhasebe & danışmanlık', 'gider', 'Diğer', ['muhasebe', 'mali müşavir'], 150],
  ['vergi_harc', 'Vergi, harç & belediye', 'gider', 'Diğer', ['belediye', 'harç'], 160],
  ['diger_gider', 'Diğer gider', 'gider', 'Diğer', [], 900],
];

const RCATS: Array<[string, string, number]> = [
  ['corba', 'Çorbalar', 10], ['ana_yemek', 'Ana Yemekler', 20], ['sebze', 'Sebze Yemekleri', 30], ['pilav_makarna', 'Pilav / Makarna', 40],
  ['salata_meze', 'Salata / Meze', 50], ['tatli', 'Tatlılar', 60], ['icecek', 'İçecekler', 70], ['kahvalti', 'Kahvaltılık', 80], ['ekmek', 'Ekmek / Unlu', 90],
];

// Öğle menüsü rotasyonu; bugün = Karnıyarık (850 kişi senaryosu)
const ROTATION = ['karni', 'standart', 'tavuk', 'agir', 'standart', 'tavuk', 'karni'];
const rotationFor = (k: number) => ROTATION[((k % 7) + 7) % 7];

const addMonthIso = (m: string, n: number) => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm - 1 + n, 1)).toISOString().slice(0, 7); };

export function buildSeed(): DemoDb {
  idn = 0;
  const today = istanbulToday();
  const db: DemoDb = { version: DEMO_VERSION, seededOn: today, t: {} };
  const e = new Engine(db, () => DEMO_USERS[0].user_id);
  e.seeding = true;
  const rand = rng(20260926);
  const day = (k: number) => addDaysIso(today, k);
  const put = (table: string, row: Row) => e.insert(table, row);

  put('company_settings', {
    id: 1, legal_name: 'Trakya Catering Gıda San. ve Tic. Ltd. Şti.', short_name: 'Trakya Catering', slogan: 'Toplu yemek üretimi · Çorlu',
    tax_office: 'Çorlu', tax_no: '0000000000', address: 'Velimeşe OSB, 3. Cadde No:12 (örnek adres)', city: 'Ergene / Tekirdağ',
    phone: '0282 555 00 00', email: 'info@ornek.test', website: 'trakyacatering.test', report_footer: 'Demo raporudur — veriler örnektir.',
  });
  for (const u of DEMO_USERS) put('team_members', { user_id: u.user_id, full_name: u.full_name, role: u.role, active: true });
  RCATS.forEach(([code, name, sort]) => put('recipe_categories', { code, name, sort }));
  FCATS.forEach(([code, name, kind, group_name, keywords, sort]) => put('finance_categories', { code, name, kind, group_name, keywords, sort }));
  const kasa = put('finance_accounts', { id: id('f'), name: 'Nakit Kasa', kind: 'kasa', opening_balance: 25000 });
  const banka = put('finance_accounts', { id: id('f'), name: 'Banka', kind: 'banka', opening_balance: 850000 });

  // --- hammaddeler + fiyat geçmişi
  const ing: Record<string, Row> = {};
  for (const [key, name, category, stock_unit, waste_pct, price, allergens, supplier] of ING) {
    ing[key] = put('ingredients', { id: id('1'), name, category, stock_unit, waste_pct, allergens, notes: `Tedarikçi: ${supplier}` });
    if (price == null) continue;
    const stale = key === 'bezelye';
    const jump = key === 'patlican' ? 0.87 : key === 'kiyma' ? 0.923 : key === 'aycicek' ? 0.94 : null;
    const history: Array<[number, number]> = stale
      ? [[-120, 0.9], [-85, 0.95], [-52, 1]]
      : jump ? [[-95, jump * 0.94], [-60, jump * 0.97], [-25, jump], [key === 'patlican' ? -2 : -5, 1]]
        : [[-95, 0.9], [-62, 0.94], [-30, 0.97], [-9, 1]];
    for (const [k, f] of history) {
      const p = Math.round(price * f * (price < 10 ? 100 : 1)) / (price < 10 ? 100 : 1);
      put('ingredient_prices', { ingredient_id: ing[key].id, price: p, source: k > -40 ? 'alis_faturasi' : 'manuel', supplier_name: supplier, noted_at: at(day(k), 10) });
    }
  }

  // --- reçeteler
  const rec: Record<string, Row> = {};
  for (const [key, name, cat, label, served, steps, lines] of REC) {
    rec[key] = put('recipes', { id: id('2'), name, category_code: cat, portion_label: label, portion_served_g: served, instructions: steps });
    lines.forEach(([ik, net], k) => put('recipe_ingredients', { recipe_id: rec[key].id, ingredient_id: ing[ik].id, net_qty: net, sort: k + 1 }));
  }

  // --- müşteriler
  const cust: Record<string, Row> = {};
  CUSTOMERS.forEach(([key, name, district, city, price, term, einv, , , contact], k) => {
    cust[key] = put('customers', {
      id: id('3'), name, kind: 'kurum', city, district, contact_name: contact, phone: `0555 000 00 ${String(11 + k).padStart(2, '0')}`,
      email: `satinalma${k + 1}@ornek.test`, default_meal_price: price, vat_rate: 10, payment_term_days: term, e_invoice: einv,
      address: `${district} (örnek adres)`, tax_no: `${k + 1}`.repeat(10),
    });
  });

  // --- menüler
  const menu: Record<string, Row> = {};
  for (const [key, name, kind, meal, target, ck, items] of MENUS) {
    menu[key] = put('menus', { id: id('4'), name, kind, meal, target_price: target, customer_id: ck ? cust[ck].id : null });
    items.forEach(([rk, course, f], k) => put('menu_items', { menu_id: menu[key].id, recipe_id: rec[rk].id, course, portion_factor: f, sort: k + 1 }));
  }

  // Sipariş geçmişi geçen ayın 1'inden başlar; daha eski aylar finansta dönem toplamı olarak durur
  const prevMonthStart = `${addMonthIso(today.slice(0, 7), -1)}-01`;
  const kStart = -Math.round((Date.parse(today) - Date.parse(prevMonthStart)) / 86400000);

  // --- menü planı: sipariş geçmişi + önümüzdeki 10 gün
  for (let k = kStart; k <= 10; k++) {
    put('menu_plans', { plan_date: day(k), meal: 'ogle', menu_id: menu[rotationFor(k)].id });
    put('menu_plans', { plan_date: day(k), meal: 'kahvalti', menu_id: menu.kahvalti.id });
    if (rotationFor(k) === 'agir' || rotationFor(k) === 'standart') put('menu_plans', { plan_date: day(k), meal: 'ogle', customer_id: cust.ergene.id, menu_id: menu.ergene.id });
  }

  // --- siparişler: geçen ayın başından 2 gün sonrasına (bugün öğle toplamı = 850)
  for (let k = kStart; k <= 2; k++) {
    const d = day(k);
    CUSTOMERS.forEach(([key, , , , price, , , lunch, breakfast]) => {
      const jitter = k === 0 ? 0 : Math.round((rand() - 0.5) * lunch * 0.08);
      const status = k < 0 ? 'teslim_edildi' : k === 0 ? 'onaylandi' : 'bekliyor';
      const q = lunch + jitter;
      put('meal_orders', {
        service_date: d, meal: 'ogle', customer_id: cust[key].id, kind: 'sozlesmeli', ordered_qty: q,
        delivered_qty: k < 0 ? q - (rand() < 0.2 ? Math.ceil(rand() * 4) : 0) : null, unit_price: price, vat_rate: 10, status,
      });
      if (breakfast > 0) {
        const bq = breakfast + (k === 0 ? 0 : Math.round((rand() - 0.5) * breakfast * 0.1));
        put('meal_orders', {
          service_date: d, meal: 'kahvalti', customer_id: cust[key].id, menu_id: menu.kahvalti.id, kind: 'sozlesmeli', ordered_qty: bq,
          delivered_qty: k < 0 ? bq : null, unit_price: 60, vat_rate: 10, status,
        });
      }
    });
  }
  put('meal_orders', { service_date: day(-6), meal: 'aksam', customer_id: cust.belediye.id, menu_id: menu.soguk.id, kind: 'organizasyon', ordered_qty: 250, delivered_qty: 250, unit_price: 120, status: 'teslim_edildi', note: 'Mevlüt yemeği — Kültür Merkezi' });
  put('meal_orders', { service_date: day(3), meal: 'aksam', customer_id: cust.velimese.id, menu_id: menu.soguk.id, kind: 'organizasyon', ordered_qty: 180, unit_price: 140, status: 'onaylandi', note: '25. yıl yemeği — fabrika bahçesi' });

  // Vadesi gelen alacaklar tahsil edildi (Banka); Keşan Lojistik geç ödüyor (vadesi geçmiş alacak örneği)
  for (const f of e.rows('finance_entries').filter((x) => x.source === 'siparis')) {
    if (f.due_date < today && f.customer_id !== cust.kesan.id) e.patch('finance_entries', f, { status: 'odendi', account_id: banka.id, paid_at: f.due_date });
  }
  put('finance_entries', { entry_date: day(-78), kind: 'gelir', category_code: 'tabldot_satis', description: 'Önceki dönem tabldot (fatura kesildi)', net_amount: 182000, vat_amount: 18200, counterparty: cust.belediye.name, customer_id: cust.belediye.id, status: 'bekliyor', due_date: day(-18) });

  // --- giderler: 6 ay
  const month0 = today.slice(0, 7);
  const addMonth = addMonthIso;
  const expense = (date: string, cat: string, net: number, counterparty: string, description: string, vatRate = 20, extra: Row = {}) => {
    if (date > today) return;
    put('finance_entries', { entry_date: date, kind: 'gider', category_code: cat, description, net_amount: net, vat_amount: Math.round(net * vatRate) / 100, counterparty, status: 'odendi', account_id: banka.id, paid_at: date, ...extra });
  };
  for (let m = -5; m <= 0; m++) {
    const mon = addMonth(month0, m); const d = (dd: number) => `${mon}-${String(dd).padStart(2, '0')}`; const f = 1 + m * 0.018;
    expense(d(5), 'kira', 40000, 'Velimeşe OSB Yönetimi', 'Tesis kirası', 0);
    expense(d(8), 'elektrik', Math.round((19500 + (m % 2) * 2300 + (m === 0 ? 3400 : 0)) * f), 'Trakya Elektrik Perakende', 'Elektrik faturası');
    expense(d(9), 'su', Math.round((4100 - (m === 0 ? 450 : 0)) * f), 'Ergene Su İdaresi', 'Su faturası');
    expense(d(10), 'dogalgaz', Math.round((12800 + (m + 5) * 900) * f), 'Trakya Gaz Dağıtım', 'Doğalgaz faturası');
    expense(d(12), 'akaryakit', Math.round((21000 + (m % 3) * 1800 + (m === 0 ? 2600 : 0)) * f), 'Opet Çorlu', 'Motorin — 3 frigorifik araç');
    expense(d(15), 'mutfak_sarf', Math.round(18500 * f), 'Tekirdağ Ambalaj', 'Sefer tası, folyo, eldiven');
    expense(d(25), 'iletisim', 1650, 'Türk Telekom', 'Fiber internet', 20);
    expense(d(27), 'personel_sgk', 238000, 'SGK', 'SGK primi', 0);
    expense(d(28), 'personel_maas', 780000, 'Personel (38 kişi)', 'Maaş ödemeleri', 0, { source: 'maas' });
    if (m === -2 || m === 0) expense(d(17), 'arac_bakim', m === 0 ? 14200 : 6800, 'Çorlu Oto Servis', 'Frigorifik araç bakımı');
    if (m === -4) expense(d(19), 'ekipman_bakim', 9800, 'Kazan Teknik Servis', 'Buharlı kazan bakımı');
    if (m === -1) expense(d(22), 'demirbas', 42000, 'Endüstriyel Mutfak A.Ş.', 'Kombi fırın (taksit 1/3)');
    expense(d(6), 'muhasebe_hukuk', 7500, 'Mali Müşavirlik Bürosu', 'Aylık muhasebe');
    // 45 günden eski satışlar: aylık toplam
    if (m < -1) put('finance_entries', { entry_date: d(26), kind: 'gelir', category_code: 'tabldot_satis', description: 'Tabldot satış (dönem toplamı)', net_amount: 4150000 + (m + 5) * 38000, vat_amount: 415000 + (m + 5) * 3800, counterparty: 'Sözleşmeli müşteriler', status: 'odendi', account_id: banka.id, paid_at: d(28) });
    if (m === -3) put('finance_entries', { entry_date: d(20), kind: 'gelir', category_code: 'organizasyon', description: 'Düğün yemeği 400 kişi', net_amount: 64000, vat_amount: 6400, counterparty: 'Özel müşteri', status: 'odendi', account_id: kasa.id, paid_at: d(20) });
    if (d(3) <= today) put('finance_entries', { entry_date: d(3), kind: 'gelir', category_code: 'diger_gelir', description: 'Atık kızartma yağı satışı', net_amount: 3200, vat_amount: 0, counterparty: 'Geri Dönüşüm Ltd.', status: 'odendi', account_id: kasa.id, paid_at: d(3) });
  }
  // Mutfak gıda alımları: her hafta (faturadan)
  const weekly: Array<[string, number, string]> = [[ET, 236000, 'Et ve tavuk'], [HAL, 92000, 'Sebze-meyve'], [TOP, 104000, 'Kuru gıda, bakliyat, yağ'], [SUT, 62000, 'Süt ürünleri'], [FIR, 19600, 'Ekmek']];
  let invNo = 1000;
  const firstExpenseDay = `${addMonthIso(month0, -5)}-01`;
  for (let w = -26; w <= -1; w++) {
    weekly.forEach(([sup, base, what], j) => {
      const d = day(w * 7 + j);
      if (d < firstExpenseDay) return;
      const net = Math.round(base * 1.27 * (1 + w * 0.0025) * (0.93 + rand() * 0.14));
      const tax = String(j + 1).repeat(10);
      const invoice = put('purchase_invoices', {
        supplier_name: sup, supplier_tax_no: tax, invoice_no: `ORN2026${++invNo}`, invoice_date: d, category_code: 'gida_hammadde',
        net_amount: net, vat_amount: Math.round(net * 0.01 * 100) / 100, total_amount: Math.round(net * 1.01 * 100) / 100, due_date: addDaysIso(d, 30),
        status: 'onaylandi', source: w > -8 ? 'ubl_xml' : 'manuel', lines: [{ name: what, quantity: 1, unitCode: 'C62', unitPrice: net, lineTotal: net }],
      });
      const entry = e.rows('finance_entries').find((x) => x.source_id === invoice.id);
      if (entry && entry.due_date < day(3)) e.patch('finance_entries', entry, { status: 'odendi', account_id: banka.id, paid_at: entry.due_date });
    });
  }
  // Gelen kutusu: onay bekleyen e-faturalar (otomatik kategori önerili)
  const inbox: Array<[string, string, string, number, number, number, Array<Row>]> = [
    ['Trakya Elektrik Perakende Satış A.Ş.', '4444444444', 'elektrik', 23100, 20, -2, [{ name: 'Aktif enerji bedeli', quantity: 5200, unitCode: 'KWH', unitPrice: 4.1, lineTotal: 21320 }, { name: 'Dağıtım bedeli', quantity: 1, unitCode: 'C62', unitPrice: 1780, lineTotal: 1780 }]],
    [ET, '1111111111', 'gida_hammadde', 131200, 1, -1, [{ name: 'Dana Kıyma', quantity: 150, unitCode: 'KGM', unitPrice: 520, lineTotal: 78000 }, { name: 'Tavuk But (kemiksiz)', quantity: 180, unitCode: 'KGM', unitPrice: 185, lineTotal: 33300 }, { name: 'Tavuk Göğüs', quantity: 95, unitCode: 'KGM', unitPrice: 210, lineTotal: 19950 }]],
    [HAL, '2222222222', 'gida_hammadde', 11500, 1, 0, [{ name: 'Patlıcan (kemer)', quantity: 240, unitCode: 'KGM', unitPrice: 38, lineTotal: 9120 }, { name: 'Sivri Biber', quantity: 22, unitCode: 'KGM', unitPrice: 55, lineTotal: 1210 }, { name: 'Domates', quantity: 36, unitCode: 'KGM', unitPrice: 32, lineTotal: 1152 }]],
    ['Opet Çorlu Akaryakıt', '5555555555', 'akaryakit', 8350, 20, -1, [{ name: 'Motorin', quantity: 180, unitCode: 'LTR', unitPrice: 46.4, lineTotal: 8352 }]],
  ];
  inbox.forEach(([sup, tax, cat, net, vat, k, lines]) => put('purchase_invoices', {
    supplier_name: sup, supplier_tax_no: tax, invoice_no: `ORN2026${++invNo}`, invoice_date: day(k), category_code: cat,
    net_amount: net, vat_amount: Math.round(net * vat) / 100, total_amount: Math.round(net * (100 + vat)) / 100, due_date: day(k + 20),
    status: 'taslak', source: 'ubl_xml', lines, ettn: crypto.randomUUID?.() ?? null,
  }));
  // Yaklaşan borç: bu ayın elektriği (vade 4 gün sonra)
  put('finance_entries', { entry_date: day(-3), kind: 'gider', category_code: 'dogalgaz', description: 'Doğalgaz faturası (son ödeme yaklaşıyor)', net_amount: 17400, vat_amount: 3480, counterparty: 'Trakya Gaz Dağıtım', status: 'bekliyor', due_date: day(4) });

  // --- günlük hazırlık: bu ayın başından (en az 14 gün) bugüne (öğle ve kahvaltı)
  const sideItems: Record<string, Array<[string, string, number, number]>> = {
    karniyarik: [['Maydanoz (süsleme)', 'adet', 0.02, 15], ['Közlenmiş biber (garnitür)', 'kg', 0.012, 55]],
    orman: [['Defne yaprağı', 'g', 0.1, 0.9]],
    tavuksote: [['Kekik', 'g', 0.2, 0.6]],
    coban: [['Nar ekşisi', 'lt', 0.004, 140]],
    pilav: [['Tavuk suyu (bulyon)', 'adet', 0.02, 6]],
  };
  const recKeyById = new Map(Object.entries(rec).map(([k, r]) => [r.id, k]));
  const kPrep = Math.min(-14, -(Number(today.slice(8, 10)) - 1));
  for (let k = kPrep; k <= 0; k++) {
    const d = day(k);
    for (const meal of ['ogle', 'kahvalti']) {
      e.planPrepFromOrders(d, meal);
      const batches = e.rows('prep_batches').filter((b) => b.prep_date === d && b.meal === meal);
      for (const b of batches) {
        const rk = recKeyById.get(b.recipe_id);
        if (k === 0 && meal === 'ogle' && rk === 'sutlac') continue; // bugün: tatlı henüz girilmedi
        e.prepFillFromRecipe(b.id);
        const drift = 1 + (rand() - 0.45) * 0.1;
        for (const it of e.rows('prep_batch_items').filter((x) => x.batch_id === b.id)) {
          const scale = it.ingredient_id === ing.kiyma.id || it.ingredient_id === ing.kusbasi.id ? 0.97 + rand() * 0.04 : drift;
          it.qty = Math.max(0.001, Math.round(Number(it.qty) * scale * 1000) / 1000);
        }
        (sideItems[rk ?? ''] ?? []).forEach(([name, u, per, price], n) => put('prep_batch_items', {
          batch_id: b.id, manual_name: name, qty: Math.round(per * Number(b.portions) * 1000) / 1000, unit: u, unit_price: price, is_side: true, sort: 50 + n,
        }));
        b.status = k < 0 ? 'kapandi' : meal === 'kahvalti' ? 'pisti' : (rk === 'karniyarik' || rk === 'ezogelin' ? 'taslak' : 'pisti');
      }
    }
  }
  // Organizasyon akşamı hazırlığı (mevlüt)
  e.planPrepFromOrders(day(-6), 'aksam');
  for (const b of e.rows('prep_batches').filter((x) => x.prep_date === day(-6) && x.meal === 'aksam')) { e.prepFillFromRecipe(b.id); b.status = 'kapandi'; }

  // --- reçete maliyet geçmişi (Güncelle butonunun anlık görüntüleri)
  const costs = e.vRecipeCosts();
  for (const c of costs) {
    [[-60, 0.9], [-30, 0.95], [-7, 0.985]].forEach(([k, f]) => put('recipe_cost_snapshots', {
      recipe_id: c.recipe_id, cost: Math.round(c.cost_last * f * 100) / 100, noted_at: at(day(k), 17), note: 'Fiyat güncellemesi',
    }));
  }

  // --- sohbet
  const U = Object.fromEntries(DEMO_USERS.map((u) => [u.role, u]));
  const chat: Array<[string, string, number, number, string]> = [
    ['genel', 'yonetici', -1, 17, 'Arkadaşlar yarın 850 kişilik karnıyarık var, patlıcan siparişi verildi mi?'],
    ['genel', 'satinalma', -1, 17, 'Verildi, 240 kg sabah 06:30\'da Çorlu Hal\'den geliyor. Fiyat 38 ₺ (geçen hafta 33 ₺ idi).'],
    ['genel', 'diyetisyen', -1, 18, 'Ergene şantiyesine ağır işçi menüsü devam, porsiyon katsayısı 1,2. Menü planına işledim.'],
    ['mutfak', 'asci_basi', 0, 7, 'Patlıcanlar geldi, soyma ve tuzlu suya alma başladı. 4 kişi patlıcanda.'],
    ['mutfak', 'asci_basi', 0, 8, 'Kıyma 51 kg tartıldı, harç için yeterli. Sütlaç için süt 128 lt lazım.'],
    ['mutfak', 'diyetisyen', 0, 8, 'Cacık 150 g kase, sarımsak az olsun — OSB\'den şikâyet gelmişti.'],
    ['sevkiyat', 'sofor', 0, 7, 'Çorlu OSB tuzluk ve 2 koli peçete istedi, bugünkü sefere ekler misiniz?'],
    ['sevkiyat', 'depo', 0, 8, 'Tuzluk 20 adet + peçete 2 koli hazır, 34 ABC 01 aracına yüklendi.'],
    ['sevkiyat', 'sofor', 0, 9, 'Ergene şantiye girişi değişti, B kapısından giriyoruz. Konum güncellensin.'],
  ];
  chat.forEach(([channel, role, k, hh, body]) => put('chat_messages', { channel, author_id: U[role].user_id, author_name: U[role].full_name, body, created_at: at(day(k), hh) }));

  return db;
}
