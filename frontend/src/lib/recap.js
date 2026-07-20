// Canvas-based recap card generator for FairXI
// Portrait 1080x1350 (4:5), optimized for IG / WhatsApp status.

const BG = '#050A07';
const SURFACE = '#0C1812';
const ACCENT = '#CCFF00';
const WHITE = '#FFFFFF';
const MUTED = '#8F9E96';

const TEAM_COLORS = ['#CCFF00', '#FFFFFF', '#FF7A00', '#00E5FF'];

const loadFonts = async () => {
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {}
};

const drawPitchGrid = (ctx, w, h) => {
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
};

const drawCenterCircle = (ctx, cx, cy, r) => {
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
};

const drawLogo = (ctx, x, y, size = 48) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(2, 2, size - 4, size - 4);
  ctx.beginPath();
  ctx.moveTo(size / 2, 2);
  ctx.lineTo(size / 2, size - 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const fmtDate = (iso) => {
  try {
    const d = new Date(iso);
    return d
      .toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
      .toUpperCase();
  } catch {
    return iso;
  }
};

export async function renderRecap({ match, players, mvp }) {
  await loadFonts();
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // BG
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  drawPitchGrid(ctx, W, H);
  drawCenterCircle(ctx, W / 2, H / 2, 340);
  drawCenterCircle(ctx, W - 40, 80, 220);

  // Header
  drawLogo(ctx, 60, 60, 56);
  ctx.font = "600 24px 'Bebas Neue', sans-serif";
  ctx.fillStyle = WHITE;
  ctx.textBaseline = 'top';
  ctx.fillText('FAIRXI', 130, 74);
  ctx.font = "500 16px 'Manrope', sans-serif";
  ctx.fillStyle = MUTED;
  ctx.fillText('MATCH RECAP', 130, 100);

  // Date
  ctx.textAlign = 'right';
  ctx.font = "500 18px 'Manrope', sans-serif";
  ctx.fillStyle = ACCENT;
  ctx.fillText(fmtDate(match.date_time), W - 60, 80);
  ctx.fillStyle = MUTED;
  ctx.font = "400 14px 'Manrope', sans-serif";
  ctx.fillText(truncate(match.location || '', 30), W - 60, 106);
  ctx.textAlign = 'left';

  // Match name
  ctx.font = "700 76px 'Bebas Neue', sans-serif";
  ctx.fillStyle = WHITE;
  ctx.fillText(truncate(match.name.toUpperCase(), 22), 60, 180);
  // accent underline
  ctx.fillStyle = ACCENT;
  ctx.fillRect(60, 275, 120, 6);

  // Teams
  const teamsMap = {};
  for (const p of players) {
    const t = p.team_number || 0;
    if (!teamsMap[t]) teamsMap[t] = [];
    teamsMap[t].push(p);
  }
  const teamKeys = Object.keys(teamsMap).filter((k) => k !== '0').sort();
  const teamCount = teamKeys.length || 1;
  const gridTop = 330;
  const gridBottom = 940;
  const gridH = gridBottom - gridTop;
  const cardW = teamCount === 1 ? W - 120 : (W - 120 - 30 * (teamCount - 1)) / teamCount;
  const cardH = gridH;

  teamKeys.forEach((tk, idx) => {
    const color = TEAM_COLORS[(parseInt(tk) - 1) % TEAM_COLORS.length];
    const x = 60 + idx * (cardW + 30);
    // card bg
    ctx.fillStyle = SURFACE;
    ctx.fillRect(x, gridTop, cardW, cardH);
    // 1px accent line top
    ctx.fillStyle = color;
    ctx.fillRect(x, gridTop, cardW, 4);
    // team header
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 40, gridTop + 60, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = "700 26px 'Bebas Neue', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(tk, x + 40, gridTop + 49);
    ctx.textAlign = 'left';
    ctx.fillStyle = WHITE;
    ctx.font = "500 26px 'Bebas Neue', sans-serif";
    ctx.fillText(`TEAM ${tk}`, x + 80, gridTop + 48);
    // players
    ctx.font = "500 22px 'Manrope', sans-serif";
    const players = teamsMap[tk];
    const startY = gridTop + 120;
    players.forEach((p, i) => {
      const py = startY + i * 44;
      // divider
      if (i > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 24, py - 10);
        ctx.lineTo(x + cardW - 24, py - 10);
        ctx.stroke();
      }
      ctx.fillStyle = WHITE;
      ctx.font = "500 22px 'Manrope', sans-serif";
      ctx.fillText(truncate(p.name, 14), x + 24, py);
      ctx.fillStyle = MUTED;
      ctx.font = "600 14px 'Manrope', sans-serif";
      ctx.textAlign = 'right';
      ctx.fillText((p.position || '').slice(0, 3).toUpperCase(), x + cardW - 24, py + 4);
      ctx.textAlign = 'left';
    });
  });

  // MVP card
  const mvpTop = 980;
  ctx.fillStyle = SURFACE;
  ctx.fillRect(60, mvpTop, W - 120, 260);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.strokeRect(60, mvpTop, W - 120, 260);

  ctx.font = "600 18px 'Manrope', sans-serif";
  ctx.fillStyle = ACCENT;
  ctx.fillText('★  MAN OF THE MATCH', 90, mvpTop + 34);

  if (mvp) {
    ctx.font = "700 120px 'Bebas Neue', sans-serif";
    ctx.fillStyle = ACCENT;
    ctx.fillText(truncate(mvp.name.toUpperCase(), 16), 90, mvpTop + 70);
    ctx.font = "500 22px 'Manrope', sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText(
      `${mvp.votes} votes  ·  Team ${mvp.team_number ?? '-'}`,
      90,
      mvpTop + 210
    );
  } else {
    ctx.font = "700 60px 'Bebas Neue', sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText('NO VOTES CAST', 90, mvpTop + 100);
  }

  // Footer
  ctx.font = "600 16px 'Manrope', sans-serif";
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  ctx.fillText('Balanced teams. Split the pitch. Zero drama.', W / 2, H - 60);
  ctx.textAlign = 'left';

  return canvas;
}

export async function downloadRecap(payload, filename = 'fairxi-recap.png') {
  const canvas = await renderRecap(payload);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      resolve();
    }, 'image/png');
  });
}

export async function shareRecap(payload, filename = 'fairxi-recap.png') {
  const canvas = await renderRecap(payload);
  return shareOrDownloadBlob(canvas, filename, 'FairXI Match Recap');
}

/** Shared share-or-download helper that prefers Capacitor Share on native. */
async function shareOrDownloadBlob(canvas, filename, title) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      // Native (Capacitor) path
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor?.isNativePlatform?.()) {
          const { Share } = await import('@capacitor/share');
          const { Filesystem, Directory } = await import('@capacitor/filesystem').catch(() => ({}));
          if (Filesystem) {
            const base64 = await blobToBase64(blob);
            const fname = filename;
            const write = await Filesystem.writeFile({
              path: fname,
              data: base64,
              directory: Directory.Cache,
            });
            await Share.share({ title, url: write.uri, dialogTitle: title });
            return resolve('shared-native');
          }
        }
      } catch { /* fall through to web share */ }
      // Web Share API
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title, text: title });
          return resolve('shared');
        } catch { /* fall through */ }
      }
      // Download fallback
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      resolve('downloaded');
    }, 'image/png');
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/* ------------------ GROUP / SEASON RECAP ------------------ */

async function renderGroupRecap({ group, matches, standings, mvp_leaderboard, top_gainers }) {
  await loadFonts();
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  drawPitchGrid(ctx, W, H);
  drawCenterCircle(ctx, W / 2, 720, 380);
  drawCenterCircle(ctx, W - 40, 80, 220);

  // Header
  drawLogo(ctx, 60, 60, 56);
  ctx.font = "600 24px 'Bebas Neue', sans-serif";
  ctx.fillStyle = WHITE;
  ctx.textBaseline = 'top';
  ctx.fillText('FAIRXI', 130, 74);
  ctx.font = "500 16px 'Manrope', sans-serif";
  ctx.fillStyle = MUTED;
  ctx.fillText('SEASON RECAP', 130, 100);

  ctx.textAlign = 'right';
  ctx.font = "500 18px 'Manrope', sans-serif";
  ctx.fillStyle = ACCENT;
  ctx.fillText(`${matches.length} MATCHES`, W - 60, 80);
  ctx.textAlign = 'left';

  // Group name
  ctx.font = "700 88px 'Bebas Neue', sans-serif";
  ctx.fillStyle = WHITE;
  ctx.fillText(truncate((group.name || 'Season').toUpperCase(), 20), 60, 170);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(60, 275, 120, 6);

  // Standings top 6
  let y = 340;
  ctx.font = "600 20px 'Manrope', sans-serif";
  ctx.fillStyle = ACCENT;
  ctx.fillText('STANDINGS · TOP 6', 60, y);
  y += 44;
  ctx.fillStyle = SURFACE;
  ctx.fillRect(60, y, W - 120, 380);

  const top6 = standings.slice(0, 6);
  ctx.font = "500 14px 'Manrope', sans-serif";
  ctx.fillStyle = MUTED;
  ctx.fillText('#', 90, y + 24);
  ctx.fillText('PLAYER', 130, y + 24);
  ctx.textAlign = 'right';
  ctx.fillText('W', 700, y + 24);
  ctx.fillText('D', 780, y + 24);
  ctx.fillText('L', 860, y + 24);
  ctx.fillText('RATING', W - 90, y + 24);
  ctx.textAlign = 'left';

  top6.forEach((s, i) => {
    const rowY = y + 60 + i * 50;
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(80, rowY - 12);
      ctx.lineTo(W - 80, rowY - 12);
      ctx.stroke();
    }
    ctx.font = "700 26px 'Bebas Neue', sans-serif";
    ctx.fillStyle = i === 0 ? ACCENT : MUTED;
    ctx.fillText(String(i + 1), 90, rowY + 8);
    ctx.font = "600 24px 'Manrope', sans-serif";
    ctx.fillStyle = WHITE;
    ctx.fillText(truncate(s.name, 18), 130, rowY + 8);
    ctx.font = "600 22px 'Manrope', sans-serif";
    ctx.fillStyle = i === 0 ? ACCENT : WHITE;
    ctx.textAlign = 'right';
    ctx.fillText(String(s.wins), 700, rowY + 8);
    ctx.fillStyle = MUTED;
    ctx.fillText(String(s.draws), 780, rowY + 8);
    ctx.fillText(String(s.losses), 860, rowY + 8);
    ctx.fillStyle = ACCENT;
    ctx.fillText(s.current_rating != null ? Number(s.current_rating).toFixed(2) : '—', W - 90, rowY + 8);
    ctx.textAlign = 'left';
  });

  // MVP Leader + Top gainer
  const mvpTop = 820;
  ctx.fillStyle = SURFACE;
  ctx.fillRect(60, mvpTop, (W - 150) / 2, 260);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.strokeRect(60, mvpTop, (W - 150) / 2, 260);
  ctx.font = "600 16px 'Manrope', sans-serif";
  ctx.fillStyle = ACCENT;
  ctx.fillText('★  MAN OF THE SEASON', 90, mvpTop + 34);
  const mvpTop1 = (mvp_leaderboard || []).find((r) => r.mvp_count > 0);
  if (mvpTop1) {
    ctx.font = "700 76px 'Bebas Neue', sans-serif";
    ctx.fillStyle = ACCENT;
    ctx.fillText(truncate(mvpTop1.name.toUpperCase(), 14), 90, mvpTop + 70);
    ctx.font = "500 20px 'Manrope', sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText(`${mvpTop1.mvp_count} MVP awards`, 90, mvpTop + 210);
  } else {
    ctx.font = "600 40px 'Bebas Neue', sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText('TBD', 90, mvpTop + 100);
  }

  // Top gainer box
  const gx = 60 + (W - 150) / 2 + 30;
  ctx.fillStyle = SURFACE;
  ctx.fillRect(gx, mvpTop, (W - 150) / 2, 260);
  ctx.font = "600 16px 'Manrope', sans-serif";
  ctx.fillStyle = ACCENT;
  ctx.fillText('▲  TOP RATING GAINER', gx + 30, mvpTop + 34);
  const gainer = (top_gainers || [])[0];
  if (gainer && gainer.gain > 0) {
    ctx.font = "700 76px 'Bebas Neue', sans-serif";
    ctx.fillStyle = WHITE;
    ctx.fillText(truncate(gainer.name.toUpperCase(), 14), gx + 30, mvpTop + 70);
    ctx.font = "500 20px 'Manrope', sans-serif";
    ctx.fillStyle = ACCENT;
    ctx.fillText(`+${Number(gainer.gain).toFixed(2)} rating`, gx + 30, mvpTop + 210);
  } else {
    ctx.font = "600 40px 'Bebas Neue', sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText('TBD', gx + 30, mvpTop + 100);
  }

  ctx.font = "600 16px 'Manrope', sans-serif";
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  ctx.fillText('Balanced teams. Split the pitch. Zero drama.', W / 2, H - 60);
  ctx.textAlign = 'left';

  return canvas;
}

export async function downloadGroupRecap(payload, filename = 'fairxi-season.png') {
  const canvas = await renderGroupRecap(payload);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      resolve();
    }, 'image/png');
  });
}

export async function shareGroupRecap(payload, filename = 'fairxi-season.png') {
  const canvas = await renderGroupRecap(payload);
  return shareOrDownloadBlob(canvas, filename, 'FairXI Season Recap');
}
