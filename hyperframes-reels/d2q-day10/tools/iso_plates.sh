#!/bin/bash
# cut each finished isometric diorama out of its gradient backdrop into build_iso/assets/plates/iNN.png
cd /home/user/Films/d2q-day10
declare -A SRC=( [i01]=/root/flow-mcp-out/D2QDay10Iso/scene-01.jpeg [i02]=/root/flow-mcp-out/D2QDay10Looks/scene-05.jpeg
  [i03]=/root/flow-mcp-out/D2QDay10Iso/scene-02.jpeg [i04]=/root/flow-mcp-out/D2QDay10Iso/scene-03.jpeg [i05]=/root/flow-mcp-out/D2QDay10Iso/scene-04.jpeg
  [i06]=/root/flow-mcp-out/D2QDay10Iso/scene-05.jpeg [i07]=/root/flow-mcp-out/D2QDay10Iso/scene-06.jpeg [i08]=/root/flow-mcp-out/D2QDay10Iso/scene-07.jpeg
  [i09]=/root/flow-mcp-out/D2QDay10Iso/scene-08.jpeg [i10]=/root/flow-mcp-out/D2QDay10Iso/scene-09.jpeg [i11]=/root/flow-mcp-out/D2QDay10Iso/scene-10.jpeg
  [i12]=/root/flow-mcp-out/D2QDay10Iso/scene-11.jpeg [i13]=/root/flow-mcp-out/D2QDay10Iso/scene-12.jpeg [i14]=/root/flow-mcp-out/D2QDay10Iso/scene-13.jpeg
  [i15]=/root/flow-mcp-out/D2QDay10Iso/scene-14.jpeg [i16]=/root/flow-mcp-out/D2QDay10Iso/scene-15.jpeg )
for k in $(echo "${!SRC[@]}" | tr ' ' '\n' | sort); do
  f=${SRC[$k]}; out=build_iso/assets/plates/$k.png
  if [ -f "$f" ] && [ ! -f "$out" ]; then python3 tools/plate_matte.py "$f" "$out" --feather 0.86 0.99 --floor 0.07 | cut -c1-40; fi
done
