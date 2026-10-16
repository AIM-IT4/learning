#!/bin/bash
# render the remaining frame ranges with 2 workers (jobs alternate between workers)
V=$1; FPS=24
TOTAL=$(python3 -c "import json,math;print(math.ceil(json.load(open('$V/audio/cues.json'))['DURATION']*$FPS))")
JOBS=("484 516 seg01b")
for ((a=516; a<TOTAL; a+=258)); do b=$((a+258)); [ $b -gt $TOTAL ] && b=$TOTAL; JOBS+=("$a $b seg$(printf %02d $(( (a-516)/258 + 2 )))"); done
cd $V/src
worker() {
  for ((i=$1; i<${#JOBS[@]}; i+=2)); do
    set -- ${JOBS[$i]}; out=$V/seg/$3.mp4
    [ -f $out.ok ] && continue
    node render.mjs $1 $2 $out $FPS && touch $out.ok
  done
}
worker 0 > $V/seg/w0.log 2>&1 &
worker 1 > $V/seg/w1.log 2>&1 &
wait
echo ALL DONE total=$TOTAL jobs=${#JOBS[@]}
