# Writes data/recordings.json: the public-domain Azerbaijani recordings on Wikimedia Commons the
# music page plays, with titles, performers and kinds set by hand from their file names (the
# Commons titles are terse, and two 1902 discs credited to Cabbar Qaryağdıoğlu are Qədirbala's).
#   python3 scripts/recordings.py <survey.json>   (packages/parser/data/raw/music/dinle-candidates.json in irs-az)
import hashlib, json, sys, urllib.parse

P = {
    'Cabbar': ('Q4216454', 'Cabbar Qaryağdıoğlu', 'Джаббар Карягдыоглы', 'Jabbar Garyaghdioglu'),
    'Keçəçioğlu': ('Q12840896', 'Keçəçioğlu Məhəmməd', 'Кечечиоглу Мамед', 'Kechechioglu Mammad'),
    'Bülbül': ('Q1131312', 'Bülbül', 'Бюльбюль', 'Bulbul'),
    'Seyid': ('Q4528165', 'Seyid Şuşinski', 'Сеид Шушинский', 'Seyid Shushinski'),
    'Xan': ('Q2427251', 'Xan Şuşinski', 'Хан Шушинский', 'Khan Shushinski'),
    'Qədirbala': ('qedirbala', 'Qədirbala (Əbdülqədir Cabbarov)', 'Гадирбала (Абдулгадир Джаббаров)', 'Gadirbala (Abdulgadir Jabbarov)'),
    'Ələsgər': ('Q12850169', 'Ələsgər Abdullayev', 'Алескер Абдуллаев', 'Alasgar Abdullayev'),
    'Əhəd': (None, 'Əhəd Əliyev', 'Ахад Алиев', 'Ahad Aliyev'),
}
# file, performer, title az / ru / en, kind (mugham, tesnif, song, instrumental), year
R = [
    ('Cabbar_Qaryağdıoğlu-Dəşti.ogg', 'Cabbar', 'Dəşti', 'Дашти', 'Dashti', 'mugham', None),
    ('Cabbar_Qaryağdıoğlu-Mahur_Təsnifi.ogg', 'Cabbar', 'Mahur təsnifi', 'Махур тесниф', 'Mahur tasnif', 'tesnif', None),
    ('Cabbar_Qaryağdıoğlu-Mahur_təsnifi_(2).ogg', 'Cabbar', 'Mahur təsnifi (2)', 'Махур тесниф (2)', 'Mahur tasnif (2)', 'tesnif', None),
    ('Cabbar_Qaryağdıoğlu-Mənsuriyyə.ogg', 'Cabbar', 'Mənsuriyyə', 'Мансурийя', 'Mansuriyya', 'mugham', None),
    ('Cabbar_Qaryağdıoğlu-Qarğamışam.ogg', 'Cabbar', 'Qarğamışam', 'Гаргамышам', 'Qarghamisham', 'song', None),
    ('Cabbar_Qaryağdıoğlu-Simayi-Şəms.ogg', 'Cabbar', 'Simayi-Şəms', 'Симаи-Шамс', 'Simayi-Shams', 'mugham', None),
    ('Cabbar_Qaryağdıoğlu-Vilayəti.ogg', 'Cabbar', 'Vilayəti', 'Вилаяты', 'Vilayati', 'mugham', None),
    ('Cabbar_Qaryağdıoğlu-Xumar_oldum.ogg', 'Cabbar', 'Xumar oldum', 'Хумар олдум', 'Khumar oldum', 'song', None),
    ('Cabbar_Qaryağdıoğlu-Şahnaz.ogg', 'Cabbar', 'Şahnaz', 'Шахназ', 'Shahnaz', 'mugham', None),
    ('Cabbar_Qaryağdıoğlu_–_Heyratı.ogg', 'Cabbar', 'Heyratı', 'Хейраты', 'Heyrati', 'mugham', None),
    ('Arazbari_by_Jabbar_Karyagdi.ogg', 'Cabbar', 'Arazbarı', 'Аразбары', 'Arazbari', 'mugham', None),
    ('Cabbar_Qaryağdıoğlu-Arazbarı.ogg', 'Cabbar', 'Arazbarı (2)', 'Аразбары (2)', 'Arazbari (2)', 'mugham', None),
    ('Cabbar_Qaryağdıoğlu-Bayatı-Qacar.ogg', 'Cabbar', 'Bayatı-Qacar', 'Баяты-Каджар', 'Bayati-Qajar', 'mugham', None),
    ('Cabbar_Qaryağdıoğlu-Dəşti_təsnifi.ogg', 'Cabbar', 'Dəşti təsnifi', 'Дашти тесниф', 'Dashti tasnif', 'tesnif', None),
    ('Cabbar_Qaryağdıoğlu-Manənd-Müxalif.ogg', 'Cabbar', 'Manəndi-Müxalif', 'Мананди-Мухалиф', 'Manandi-Mukhalif', 'mugham', None),
    ('Cabbar_Qaryağdıoğlu-Mirzə_Hüseyn_Segahı.ogg', 'Cabbar', 'Mirzə Hüseyn Segahı', 'Мирза Гусейн сегях', 'Mirza Huseyn Segah', 'mugham', None),
    ('Cabbar_Qaryağdıoğlu-Orta_Mahur.ogg', 'Cabbar', 'Orta Mahur', 'Орта Махур', 'Orta Mahur', 'mugham', None),
    ('Cabbar_Qaryağdıoğlu-Yetim_Segah.ogg', 'Cabbar', 'Yetim Segah', 'Етим сегях', 'Yetim Segah', 'mugham', None),
    ('Cabbar_Qaryağdıoğlu_–_Qatar.ogg', 'Cabbar', 'Qatar', 'Гатар', 'Qatar', 'mugham', None),
    ('Gul_achdi_by_Jabbar_Garyagdy.ogg', 'Cabbar', 'Gül açdı', 'Гюль ачды', 'Gul achdi', 'song', '1930s'),
    ('Bülbül_–_Süsən_sünbül_(vokal)-1.ogg', 'Bülbül', 'Süsən sünbül (1)', 'Сусан сюнбюль (1)', 'Susan sunbul (1)', 'song', None),
    ('Bülbül_–_Süsən_sünbül_(vokal)-2.ogg', 'Bülbül', 'Süsən sünbül (2)', 'Сусан сюнбюль (2)', 'Susan sunbul (2)', 'song', None),
    ('Bülbül_–_Yaxan_düymələ_(vokal)-1.ogg', 'Bülbül', 'Yaxan düymələ (1)', 'Яхан дюймеле (1)', 'Yakhan duymele (1)', 'song', None),
    ('Bülbül_–_Yaxan_düymələ_(vokal)-2.ogg', 'Bülbül', 'Yaxan düymələ (2)', 'Яхан дюймеле (2)', 'Yakhan duymele (2)', 'song', None),
    ('Bülbül_–_Yaxan_düymələ_(vokal)-3.ogg', 'Bülbül', 'Yaxan düymələ (3)', 'Яхан дюймеле (3)', 'Yakhan duymele (3)', 'song', None),
    ('Seyid_Şuşinski_–_Mənsuriyyə.ogg', 'Seyid', 'Mənsuriyyə', 'Мансурийя', 'Mansuriyya', 'mugham', '1963'),
    ('Xan_Shushinski_Shushanin_Daglari.ogg', 'Xan', 'Şuşanın dağları', 'Шушанын дағлары', 'Shushanin daghlari', 'song', None),
    ('Əbdülqədir_Cabbarov_(Qədirbala)_–_Heyratı_(vokal).ogg', 'Qədirbala', 'Heyratı', 'Хейраты', 'Heyrati', 'mugham', '1902'),
    ('Əbdülqədir_Cabbarov_(Qədirbala)_–_Heytarı.ogg', 'Qədirbala', 'Heyratı (2)', 'Хейраты (2)', 'Heyrati (2)', 'mugham', '1902'),
    ('Ələsgər_Abdullayev_–_Mənsuriyyə.ogg', 'Ələsgər', 'Mənsuriyyə', 'Мансурийя', 'Mansuriyya', 'mugham', None),
    ('Heyrati_mugam.ogg', None, 'Heyratı', 'Хейраты', 'Heyrati', 'mugham', None),
    ('Karabakh_Shikestesi_music.ogg', None, 'Qarabağ şikəstəsi', 'Карабах шикестеси', 'Karabakh shikestesi', 'song', None),
    ('Keçəçioğlu_Məhəmməd-Segah_(1909).ogg', 'Keçəçioğlu', 'Segah', 'Сегях', 'Segah', 'mugham', '1909'),
    ('Keçəçioğlu_Məhəmməd_–_Rahab.ogg', 'Keçəçioğlu', 'Rahab', 'Рахаб', 'Rahab', 'mugham', None),
    ('Keçəçioğlu_Məhəmməd_–_Segah.ogg', 'Keçəçioğlu', 'Segah (2)', 'Сегях (2)', 'Segah (2)', 'mugham', None),
    ('Xaric_Segah_(c.1930).ogg', None, 'Xaric Segah', 'Харидж сегях', 'Kharij Segah', 'instrumental', 'c. 1930'),
    ('Əhəd_Əliyev_–_Segah_(qarmonda).ogg', 'Əhəd', 'Segah (qarmonda)', 'Сегях (на гармони)', 'Segah (on garmon)', 'instrumental', '1930s'),
    ('Əhəd_Əliyev_–_Çahargah_(sazda).ogg', 'Əhəd', 'Çahargah (sazda)', 'Чахаргях (на сазе)', 'Chahargah (on saz)', 'instrumental', '1930s'),
    ('Ələsgər_Abdullayev_–_Rəşt.ogg', 'Ələsgər', 'Rəşt', 'Решт', 'Rasht', 'mugham', None),
    ('Keçəçioğlu_Məhəmməd-Dəşti_(1909).ogg', 'Keçəçioğlu', 'Dəşti', 'Дашти', 'Dashti', 'mugham', '1909'),
    ('Keçəçioğlu_Məhəmməd-Hümayun_(1909).ogg', 'Keçəçioğlu', 'Hümayun', 'Хумаюн', 'Humayun', 'mugham', '1909'),
    ('Keçəçioğlu_Məhəmməd-Rahab_(1909).ogg', 'Keçəçioğlu', 'Rahab (2)', 'Рахаб (2)', 'Rahab (2)', 'mugham', '1909'),
    ('Keçəçioğlu_Məhəmməd-Tac_(1909).ogg', 'Keçəçioğlu', 'Tac', 'Тадж', 'Taj', 'mugham', '1909'),
    ('Keçəçioğlu_Məhəmməd-Tehranım_(1909).ogg', 'Keçəçioğlu', 'Tehranım', 'Тегераным', 'Tehranim', 'tesnif', '1909'),
    ('Keçəçioğlu_Məhəmməd-Çoban-Bayatı.ogg', 'Keçəçioğlu', 'Çoban bayatı', 'Чобан баяты', 'Choban bayati', 'song', None),
    ('Keçəçioğlu_Məhəmməd-Şüştər_(1909).ogg', 'Keçəçioğlu', 'Şüştər', 'Шуштер', 'Shushtar', 'mugham', '1909'),
    ('Keçəçioğlu_Məhəmməd-Şüştər_təsnifi.ogg', 'Keçəçioğlu', 'Şüştər təsnifi', 'Шуштер тесниф', 'Shushtar tasnif', 'tesnif', None),
    ('Keçəçioğlu_Məhəmməd-Əraq_(1909).ogg', 'Keçəçioğlu', 'Əraq', 'Арак', 'Araq', 'mugham', '1909'),
    ('Keçəçioğlu_Məhəmməd_–_Çoban_bayatı.ogg', 'Keçəçioğlu', 'Çoban bayatı (2)', 'Чобан баяты (2)', 'Choban bayati (2)', 'song', None),
    ('Keçəçioğlu_Məhəmməd-Heratı_təsnifi_(1909).ogg', 'Keçəçioğlu', 'Heratı təsnifi', 'Хераты тесниф', 'Herati tasnif', 'tesnif', '1909'),
    ('Keçəçioğlu_Məhəmməd-Osmanlı_təsnifi_(1909).ogg', 'Keçəçioğlu', 'Osmanlı təsnifi', 'Османлы тесниф', 'Osmanli tasnif', 'tesnif', '1909'),
    ('Keçəçioğlu_Məhəmməd-Qarabağ_Şikəstəsi_(1909).ogg', 'Keçəçioğlu', 'Qarabağ şikəstəsi', 'Карабах шикестеси', 'Karabakh shikestesi', 'song', '1909'),
    ('Keçəçioğlu_Məhəmməd-Yeri,_dam_üstə_yeri_(1909).ogg', 'Keçəçioğlu', 'Yeri, dam üstə yeri', 'Ери, дам устэ ери', 'Yeri, dam uste yeri', 'song', '1909'),
    ('Keçəçioğlu_Məhəmməd-Yetim_Segah_(1909).ogg', 'Keçəçioğlu', 'Yetim Segah', 'Етим сегях', 'Yetim Segah', 'mugham', '1909'),
]

survey = json.load(open(sys.argv[1]))
survey = survey if isinstance(survey, list) else survey['recordings']
by_file = {urllib.parse.unquote(r['file_url'].split('/')[-1].split('?')[0]): r for r in survey if r.get('file_url')}
out = []
for f, perf, az, ru, en, kind, year in R:
    r = by_file[f]
    # Commons keeps a file under the md5 of its name; MP3 copies (which every browser plays) under transcoded/
    md5 = hashlib.md5(f.encode()).hexdigest()
    enc = urllib.parse.quote(f)
    stated = r.get('year') or ''
    if not year and 'Commons:' in stated:
        year = stated.split('Commons:')[1].strip(' )')
    out.append({
        'id': f.rsplit('.', 1)[0], 'title': {'az': az, 'ru': ru, 'en': en}, 'kind': kind,
        'performer': dict(zip(['qid', 'az', 'ru', 'en'], P[perf])) if perf else None,
        'year': year or None, 'commons': r['url'],
        'ogg': f'https://upload.wikimedia.org/wikipedia/commons/{md5[0]}/{md5[:2]}/{enc}',
        'mp3': f'https://upload.wikimedia.org/wikipedia/commons/transcoded/{md5[0]}/{md5[:2]}/{enc}/{enc}.mp3',
        'licence': 'Public domain',
    })
json.dump(out, open('data/recordings.json', 'w'), ensure_ascii=False, indent=1)
match = sum(1 for x in out if x['ogg'] == by_file[x['id'] + '.ogg']['file_url'].split('?')[0])
print(f'{len(out)} recordings; {match} file addresses agree with Commons')
