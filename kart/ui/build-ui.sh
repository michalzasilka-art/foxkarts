#!/bin/sh
# Copies the ChatGPT-made UI art (Foxino/Foxino Kart UI/out) into the game at phone-friendly sizes.
# Re-run after new art lands: sh kart/ui/build-ui.sh
SRC="/Users/kroupek/Documents/Práce/Claud/Claude Folder/Foxino/Foxino Kart UI/out"
DST="$(cd "$(dirname "$0")" && pwd)"
small() { [ -f "$SRC/$1" ] && sips -Z "$2" "$SRC/$1" --out "$DST/$1" >/dev/null && echo "$1 -> $2px"; }
small panel-indigo.png 768
small panel-indigo-gold.png 768
small panel-cyan.png 768
small btn-gold.png 768
small btn-gold-tab.png 512
small ribbon-red.png 768
small btn-round.png 160
small btn-plus-green.png 128
small coin.png 128
small icon-leave.png 128
small icon-wrench.png 96
small icon-help.png 96
small icon-book.png 128
small icon-gift.png 128
small logo.png 900
