      // ---- c1, the hook: "Every market risk interview asks about VaR. Can you show one you've actually built?"
      // Frame 1 already shows the hero: an interview chat card (a neutral icon, no face; "Interviewer · MARKET RISK") with
      // the question "Walk me through a VaR model you've built.", and behind it a big daily-P&L histogram (illustrative,
      // Student-t; labelled ILLUSTRATIVE). On "VaR" the 99% VaR line drops in and the 1% tail turns red; on "Can" the ES
      // marker lands on the tail and typing dots appear on the answer side; on "you've" the answer bubble arrives BLURRED
      // with a lock, and on "built?" a pill "Built one? Let's see" pops under the card (all before 02 starts). At the chapter change c1 stops drawing
      // and c2 carries the same picture on (K.hook) to open the lock and reveal the answer.
      // words (global): 0 Every 1 market 2 risk 3 interview 4 asks 5 about 6 VaR. 7 Can 8 you 9 show 10 one 11 you've
      //   12 actually 13 built?
      const g = document.getElementById("c1-cv").getContext("2d");
      const { clamp } = K;
      const st = { t: 0 };
      function init() { K.load({ cover: "assets/img/cover.jpg" }, "c1-images", () => draw()); }
      // the hook's beats in film time (c2 uses the same ones)
      const HB = K.hookBeats(WA);
      function draw() {
        const t = st.t, T = T0 + t;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
        if (t >= NEXT) return;                      // c2 takes the picture over from here
        const bob = (ph) => ({ dx: 0, dy: K.bob(T, ph, 3), rot: 0, sc: 1, yaw: 0, pitch: 0, a: 1 });
        K.hook(g, T, Object.assign({ P: bob(0.2), PH: bob(1.2) }, HB));
        K.floor(g);
      }
