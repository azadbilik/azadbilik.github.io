#!/bin/sh
# Downloads the source map (public domain, Wikimedia Commons) into data/raw/ (git-ignored, 8 MB):
# «Карта Кавказского края с обозначением границ 1801–1813 г.», Military-Historical Section of the
# Caucasus Military District staff, Lt-Col. V. I. Tomkeev, Tiflis 1901.
cd "$(dirname "$0")/../../data/raw" || exit 1
curl -sfL -A "azadbilik.org atlas" -o tomkeev-1901.jpg \
  "https://upload.wikimedia.org/wikipedia/commons/5/5b/%D0%9A%D0%B0%D1%80%D1%82%D0%B0_%D0%9A%D0%B0%D0%B2%D0%BA%D0%B0%D0%B7%D1%81%D0%BA%D0%BE%D0%B3%D0%BE_%D0%BA%D1%80%D0%B0%D1%8F_%281801-1813%29..jpg" \
  && echo "data/raw/tomkeev-1901.jpg"
