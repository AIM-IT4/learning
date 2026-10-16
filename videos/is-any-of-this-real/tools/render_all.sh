#!/bin/bash
# render all segments with 2 workers; each segment is an independent x264 file
V=$1; FPS=24
TOTAL=$(python3 -c "import json,math;print(math.ceil(json.load(open('$V/audio/cues.json'))['DURATION']*$FPS))")
SEG=258
cd $V/src
worker() {
  for ((s=$1; s*SEG<TOTAL; s+=2)); do
    a=$((s*SEG)); b=$(((s+1)*SEG)); [ $b -gt $TOTAL ] && b=$TOTAL
    out=$V/seg/seg$(printf %02d $s).mp4
    [ -f $out.ok ] && continue
    node render.mjs $a $b $out $FPS && touch $out.ok
  done
}
worker 0 > $V/seg/w0.log 2>&1 &
worker 1 > $V/seg/w1.log 2>&1 &
wait
echo ALL DONE total=$TOTAL
