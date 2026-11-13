#!/usr/bin/env bash
# Gera a trilha e os SFX de demonstração (obra própria, sem licença de terceiros).
set -euo pipefail
cd "$(dirname "$0")/../assets" && mkdir -p music sfx
ffmpeg -y -v error -f lavfi -i "sine=f=110:d=32" -f lavfi -i "sine=f=164.81:d=32" -f lavfi -i "sine=f=220:d=32" -f lavfi -i "sine=f=277.18:d=32" -f lavfi -i "anoisesrc=c=pink:d=32:a=0.02" \
  -filter_complex "[0][1][2][3][4]amix=inputs=5:normalize=1,tremolo=f=0.25:d=0.5,lowpass=f=1800,aecho=0.8:0.6:400:0.3,afade=t=in:d=2,afade=t=out:st=29:d=3,volume=4" -ar 48000 -ac 2 music/ambient-pad-a.wav
ffmpeg -y -v error -f lavfi -i "anoisesrc=c=white:d=0.8:a=0.6" -af "bandpass=f=1200:w=900,afade=t=in:d=0.35:curve=exp,afade=t=out:st=0.35:d=0.45,highpass=f=300" -ar 48000 -ac 2 sfx/whoosh.wav
ffmpeg -y -v error -f lavfi -i "sine=f=880:d=0.6" -f lavfi -i "sine=f=1318.5:d=0.6" -filter_complex "amix=2,afade=t=out:st=0.02:d=0.58:curve=exp,volume=2" -ar 48000 -ac 2 sfx/chime.wav
echo "assets gerados"
