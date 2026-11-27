# Transcribing the 1886 «Свод» village tables

Source: «Свод статистических данных о населении Закавказского края, извлечённых из посемейных списков 1886 г.» (Tiflis 1893). Each spread is a two-page table: one row per settlement, grouped into uezd → участок → сельское общество (rural society) → villages. Rows run across both pages.

For spread NNN you get two images (full resolution, read both completely):
- `~/kitabxana-scans/svod-1886-ocr/crops/pNNN-L.png` — left page: row number, name, distances, «Общее число жителей» (дымы / м. / ж. / об. п.), the first «По народностям» columns;
- `~/kitabxana-scans/svod-1886-ocr/crops/pNNN-R.png` — right page: the rest of «По народностям», «По вероисповеданию», «По сословиям».
Row k on the right page is the same settlement as row k on the left (same vertical position). If a crop is hard to read, zoom by cropping a region with Python/Pillow at `/private/tmp/claude-501/-Users-alex-zeynalov-WebstormProjects-azadbilik-org/1361f39e-fcb8-44d4-bf33-b3cb575b0c16/scratchpad/venv/bin/python` into your own temp file under that scratchpad and reading it — do this whenever a digit is uncertain.

## Output

Write `~/kitabxana-scans/svod-1886-ocr/out/pNNN.jsonl`, one JSON object per table row, in printed order. Keys:

```
{"p": 240, "gov": "Елисаветпольская", "uezd": "Джеванширский", "uch": "I",
 "kind": "village",            // "village" | "society" (сельское общество subtotal) | "uch" (участок total) | "uezd" (уезд total) | "town" | "other"
 "no": 503,                    // printed row number, null for subtotal rows
 "society": "Карадаглинское",  // the rural society this row belongs to (for a society row: its own name)
 "name": "Джамилы 2-е",        // exactly as printed, pre-reform spelling kept (ъ, і, ѣ), alternative names in brackets kept: "Невукъ (Ковукъ)"
 "seat": true,                 // a "*" before the name (seat of the society)
 "d_uezd": 10, "d_prist": 7,   // the two distance columns (вёрст), null if blank
 "hh": 55, "m": 173, "f": 130, "total": 303,
 "people": {"Татары": [55, 173, 130]},            // column-group heading as printed → [дымы, м, ж]; omit groups that are all dashes
 "faith":  {"Сунниты": [146, 111], "Шииты": [27, 19]},   // → [м, ж]
 "estate": {"Высшее мусульм. сословие": [8, 6], "Духовенство: Суннит.": [4, 5], "Крестьяне: На казенной земле": [51, 161, 119]},  // keep each sub-column's own cells as printed ([м,ж] or [дымы,м,ж])
 "note": ""                    // footnote marks, anything unsure ("hh unclear: 16 or 18")
}
```

A dash «—» means 0/absent: omit that group. Numbers as integers. A name that wraps onto two lines is one row (numbers sit on the last line).

The first line of the file is a header object: `{"p": NNN, "header": "<running head as printed>", "columns": {"people": [...], "faith": [...], "estate": [...]}, "skip": false}`. If the spread is not a village table (title page, town table, summary by uezd in percentages), write only the header with `"skip": true` and a short `"what"`; town tables (a list of towns with numbers) ARE transcribed, with kind "town".

## Conventions settled by the pilot (out/p221.jsonl, out/p240.jsonl are reference examples — read one)

- Footnoted sub-columns (e.g. one «Духовенство» column whose cells carry marks 3) Sunni / 4) Shia): key the marked cell as `"<heading> [N) meaning]"`, and list the footnotes in the header object's `"footnotes"` field.
- A society that starts on the previous spread: rows before the first society line of the spread get the society of the last society on the previous spread if you have that spread in your batch; otherwise `"society": null` and note `"continued from previous spread"`. A society whose villages continue onto the next spread: note `"continues on next spread"` and skip its sum check.
- Obvious typos in headings (e.g. «Хорузлинсксе», «с. с.») are corrected in `society`/`name`, with the printed form in "note".
- Low-contrast digits (2/3, 6/8, 30/39): crop the region and upscale 2–3× before deciding.

## Checks (do them, fix what fails, note what you can't)

- For each row: hh/m/f/total — m + f = total.
- Sum of people groups' m (and f) = row m (and f); same for faith.
- Each society row = sum of its villages (hh, m, f). A mismatch usually means a misread digit: zoom and re-read before accepting. If the printed numbers really disagree, keep them as printed and say so in "note".
- Society names: the subtotal line reads e.g. «8. Карадаглинское с. о.» — society name = «Карадаглинское», number in "note" not "no".

Report back in one short paragraph per spread: rows written, checks failed (and why), anything odd. Do not summarise the data itself.
