# चौथा आयाम — point to tesseract (after prompt-motion.com's wireframe cube entry)

1080×1920, 30 fps, 25.6 s. Voice: Manish (Audio8; "साया" instead of "परछाईं" because the voice softens छ).

Script: एक बिंदु। इसे खींचिए, बन गई एक रेखा। रेखा को खींचिए, बन गया वर्ग। वर्ग को खींचिए, बन गया घन। अब घन को, एक ऐसी दिशा में
खींचिए, जो हम देख नहीं सकते… चौथा आयाम। जो बनता है, उसे कहते हैं टेसरेक्ट। हम जो देख रहे हैं, वो बस उसका साया है।

One 4D vertex set (16 vertices, bit d = which copy along axis d) whose extents grow as each axis is "dragged out" on each
"खींचिए" (x, y, z, w). Every frame is computed from the timeline time: rotate in the x-w plane, project 4D→3D (D4 = 3.2),
turn and tilt in 3D, project 3D→2D (D3 = 4.2). Edges coloured by axis (x ink, y teal, z #a07812, w #c4553a), an axis gizmo whose
fourth arrow is a dashed "w ?". Labels 0D बिंदु → 1D रेखा → 2D वर्ग → 3D घन → 4D ? → 4D टेसरेक्ट; on "साया" a grey offset copy
(its shadow) fades in; end chips 0D…4D. Bed: bed_synth.py space (76 bpm pads).
