#!/bin/sh
# Reads the kitabxana.az library database (read only) into $EMBED_DIR/works.jsonl: one line per
# visible work (published, by a published author) with the text to embed, and
# $EMBED_DIR/pairs.jsonl: 400 random Persian poems with their default Azerbaijani translation (model check).
# Needs psql. The connection string is read from DATABASE_URL or <repo>/apps/api/.env at run time and never written anywhere.
set -e
REPO=${KITABXANA_REPO:-$HOME/irs-az}
OUT=${EMBED_DIR:-$HOME/.local/share/azadbilik-embed}
mkdir -p "$OUT"
URL=${DATABASE_URL:-$(grep '^DATABASE_URL' "$REPO/apps/api/.env" | cut -d= -f2- | tr -d '"')}
URL=$(printf '%s' "$URL" | sed -E 's/[?&]schema=[^&]*//')   # Prisma's parameter, unknown to psql
# A work with no text of its own (a translation-only work) is embedded by its default published translation
psql "$URL" -At -v ON_ERROR_STOP=1 -c "select row_to_json(x) from (select w.id, w.slug, w.\"titleAz\" t, w.\"titleRu\" tr, w.\"titleEn\" te, w.genre g, w.form f, w.\"originalLang\" l, w.year y, w.\"wordCount\" wc, a.slug a, a.\"nameAz\" an, a.\"nameRu\" anr, a.\"nameEn\" ane, a.\"bornYear\" b, a.period p,
 case when w.body<>'' then left(w.body, 200000) else coalesce((select t.body from \"Translation\" t where t.\"workId\"=w.id and t.status='PUBLISHED' order by t.\"isDefault\" desc, (t.language='AZ_LATIN') desc limit 1),'') end txt,
 case when w.body<>'' then null else (select t.language from \"Translation\" t where t.\"workId\"=w.id and t.status='PUBLISHED' order by t.\"isDefault\" desc, (t.language='AZ_LATIN') desc limit 1) end tl
 from \"Work\" w join \"Author\" a on a.id=w.\"authorId\" where w.status='PUBLISHED' and a.status='PUBLISHED' order by w.slug) x" > "$OUT/works.jsonl"
psql "$URL" -At -v ON_ERROR_STOP=1 -c "select row_to_json(x) from (select w.id, w.slug, left(w.body,1500) fa, left(t.body,1500) az from \"Work\" w join \"Author\" a on a.id=w.\"authorId\" and a.status='PUBLISHED' join \"Translation\" t on t.\"workId\"=w.id and t.status='PUBLISHED' and t.language='AZ_LATIN' and t.\"isDefault\" where w.status='PUBLISHED' and w.\"originalLang\"='FA' and w.body<>'' order by md5(w.id) limit 400) x" > "$OUT/pairs.jsonl"
wc -l "$OUT/works.jsonl" "$OUT/pairs.jsonl"
