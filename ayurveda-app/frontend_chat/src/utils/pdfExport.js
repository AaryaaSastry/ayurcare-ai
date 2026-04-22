import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { sanitizeMarkdownText } from './textUtils'

export async function downloadMedicalReportPDF(report, options = {}) {
  if (!report) return

  try {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth() // 210 for A4
    const pageHeight = doc.internal.pageSize.getHeight() // 297 for A4

    // Capture individual charts for page-by-page rendering
    const captureChart = async (id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const canvas = await html2canvas(el, { scale: 2 });
      return canvas.toDataURL('image/png', 1.0);
    };

    const doshaImg = await captureChart('chart-dosha');
    const priorityImg = await captureChart('chart-priority');

    // ── Green-Only Clinical Palette ──
    const HEADER_BLUE = [30, 65, 50]     // Deep forest green (primary)
    const PRIMARY_ACCENT = [72, 120, 94]    // Medium sage (accent)
    const LABEL_BLUE = [220, 238, 228]  // Pale mint tint
    const VATA_COLOR = [220, 238, 228]  // Air/Ether
    const PITTA_COLOR = [210, 235, 220]  // Fire
    const KAPHA_COLOR = [225, 242, 230]  // Earth/Water
    const normalizedType = options.reportType === 'Risk & Health Score Report'
      ? 'Risk Report'
      : (options.reportType || report.reportType || 'Diagnosis Report')

    const getDoshaPercentage = (doshaStr = "", type = "vata") => {
      const lowerStr = doshaStr.toLowerCase();
      if (lowerStr.includes('vata') && lowerStr.includes('pitta')) {
        if (type === 'vata') return 45; if (type === 'pitta') return 45; return 10;
      } else if (lowerStr.includes('vata') && lowerStr.includes('kapha')) {
        if (type === 'vata') return 45; if (type === 'kapha') return 45; return 10;
      } else if (lowerStr.includes('pitta') && lowerStr.includes('kapha')) {
        if (type === 'pitta') return 45; if (type === 'kapha') return 45; return 10;
      } else if (lowerStr.includes(type)) return 70;
      return 15;
    };

    const isEmpty = (val) => {
      if (!val) return true;
      if (Array.isArray(val)) return val.length === 0;
      if (typeof val === 'string') return val.trim() === '' || val.trim().toLowerCase() === 'not provided' || val.trim().toLowerCase() === 'n/a' || val.trim().toLowerCase() === 'n.a.';
      return false;
    };

    const toNarrativeText = (value) => {
      if (Array.isArray(value)) {
        return value
          .map((item) => sanitizeMarkdownText(String(item)))
          .filter(Boolean)
          .join('. ');
      }
      if (typeof value === 'string') return sanitizeMarkdownText(value);
      if (typeof value === 'number') return String(value);
      return '';
    };


    const calculateHeight = (text, width) => {
      if (!text) return 10;
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(String(text), width - 4);
      return Math.max(10, splitText.length * 5.3 + 6);
    };

    const ensurePageSpace = (requiredHeight) => {
      if (y + requiredHeight > pageHeight - 20) { doc.addPage(); y = 20; }
    };

    const drawNarrativeSectionTitle = (title) => {
      ensurePageSpace(16);
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
      doc.text(title, 20, y);
      y += 4;
      doc.setDrawColor(PRIMARY_ACCENT[0], PRIMARY_ACCENT[1], PRIMARY_ACCENT[2]);
      doc.setLineWidth(0.4);
      doc.line(20, y, 190, y);
      y += 6;
    };

    const drawNarrativeBlock = (title, body, accent = null) => {
      const mainText = toNarrativeText(body);
      const accentText = toNarrativeText(accent);
      if (isEmpty(mainText) && isEmpty(accentText)) return;

      const bulletPoints = mainText.includes('- ') ? mainText.split('\n').filter(l => l.trim().startsWith('-')) : [];
      const cleanBody = bulletPoints.length ? mainText.split('\n').filter(l => !l.trim().startsWith('-')).join('\n') : mainText;
      const cleanBodyLines = doc.splitTextToSize(cleanBody, 170);
      const accentLines = isEmpty(accentText) ? [] : doc.splitTextToSize(accentText, 170);

      const blockHeight = (cleanBodyLines.length * 5.5) + (bulletPoints.length * 7) + (accentLines.length ? accentLines.length * 5.2 + 8 : 0) + 18;
      ensurePageSpace(blockHeight + 10);

      doc.setDrawColor(PRIMARY_ACCENT[0], PRIMARY_ACCENT[1], PRIMARY_ACCENT[2]);
      doc.setLineWidth(1.5);
      doc.line(20, y - 2, 35, y - 2);

      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
      doc.text(title.toUpperCase(), 20, y + 4);

      let textY = y + 12;
      if (cleanBodyLines.length) {
        doc.setFont('times', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(40, 40, 40);
        doc.text(cleanBodyLines, 20, textY, { maxWidth: 170, align: 'left', lineHeightFactor: 1.6 });
        textY += cleanBodyLines.length * 5.5 + 8;
      }

      if (bulletPoints.length) {
        doc.setFont('times', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(PRIMARY_ACCENT[0], PRIMARY_ACCENT[1], PRIMARY_ACCENT[2]);
        bulletPoints.forEach(point => {
          doc.text('•', 22, textY);
          doc.text(point.replace(/^- /, '').trim(), 28, textY, { maxWidth: 160 });
          textY += 7;
        });
        textY += 4;
      }

      if (accentLines.length) {
        doc.setFont('times', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
        doc.text('CLINICAL HIGHLIGHT', 20, textY);
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        doc.text(accentLines, 20, textY + 6, { maxWidth: 170, align: 'left', lineHeightFactor: 1.5 });
        textY += accentLines.length * 5.5 + 8;
      }
      y = textY + 5;
    };

    const drawReportKPIs = (kpis) => {
      if (!Array.isArray(kpis) || kpis.length === 0) return;
      ensurePageSpace(20);
      const kpiWidth = 170 / kpis.length;
      let maxKpiHeight = 0;

      const currentY = y;
      kpis.forEach((kpi, idx) => {
        const kX = 20 + (idx * kpiWidth);
        doc.setFont('times', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(150, 150, 150);
        doc.text(String(kpi.label).toUpperCase(), kX, currentY, { maxWidth: kpiWidth - 5 });

        doc.setFontSize(10);
        doc.setTextColor(PRIMARY_ACCENT[0], PRIMARY_ACCENT[1], PRIMARY_ACCENT[2]);
        const valLines = doc.splitTextToSize(String(kpi.value), kpiWidth - 5);
        doc.text(valLines, kX, currentY + 6);

        const h = 6 + (valLines.length * 4);
        if (h > maxKpiHeight) maxKpiHeight = h;
      });
      y += maxKpiHeight + 5;
    };

    const drawPainPoints = (points) => {
      if (!Array.isArray(points) || points.length === 0) return;
      ensurePageSpace(points.length * 7 + 10);
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(180, 50, 50); // Clinical high-priority red
      doc.text('KEY CLINICAL FINDINGS (PAIN POINTS)', 20, y);
      y += 6;
      doc.setFont('times', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(20, 20, 20);
      points.forEach(point => {
        doc.text('•', 22, y); // Minimalist bullet
        doc.text(String(point), 28, y, { maxWidth: 160 });
        y += 7;
      });
      y += 4;
    };

    const drawDataRowDynamic = (label, value, options = {}) => {
      if (isEmpty(value)) return;
      const { isBullet = false, threatColor = false } = options;

      const COL1_X  = 20;
      const COL1_W  = 58;
      const COL2_X  = COL1_X + COL1_W;
      const COL2_W  = 112;
      const LINE_H  = 5.5;
      const PAD_TOP = 6;
      const BULLET_X = COL2_X + 4;   // dot centre x
      const TEXT_X   = COL2_X + 9;   // text start x after bullet
      const TEXT_W   = COL2_W - 11;  // max text width in value col

      // ── Pre-process value into renderable segments ──────────────────
      let segments = []; // { text, indent }  indent = true for bullet continuation
      if (isBullet) {
        let items = [];
        if (Array.isArray(value)) {
          items = value.map(v => sanitizeMarkdownText(String(v))).filter(s => s.length > 1);
        } else {
          const str = sanitizeMarkdownText(String(value));
          // Split on newlines, semicolons, or sentence endings before a new capital sentence
          items = str.split(/\n|(?<=\w);\s+|(?<=[a-z])\.\s+(?=[A-Z])/).map(s => s.replace(/^[-•*]\s*/, '').trim()).filter(s => s.length > 4);
          if (items.length <= 1) items = [str];
        }
        doc.setFontSize(9.5);
        items.forEach(item => {
          const wrapped = doc.splitTextToSize(item, TEXT_W);
          wrapped.forEach((line, i) => segments.push({ text: line, isBulletStart: i === 0 }));
        });
      } else {
        const valStr = Array.isArray(value)
          ? value.map(v => sanitizeMarkdownText(String(v))).join('; ')
          : sanitizeMarkdownText(String(value));
        doc.setFontSize(9.5);
        const wrapped = doc.splitTextToSize(valStr, COL2_W - 6);
        wrapped.forEach(line => segments.push({ text: line, isBulletStart: false }));
      }

      // ── Compute accurate row height ──────────────────────────────────
      const h = Math.max(10, segments.length * LINE_H + PAD_TOP + 2);
      ensurePageSpace(h + 4);

      // ── Column backgrounds ───────────────────────────────────────────
      doc.setFillColor(234, 245, 239);          // soft green for label col
      doc.rect(COL1_X, y, COL1_W, h, 'F');
      doc.setFillColor(250, 253, 251);          // near-white for value col
      doc.rect(COL2_X, y, COL2_W, h, 'F');

      // ── Border + divider ─────────────────────────────────────────────
      doc.setDrawColor(185, 210, 198);
      doc.setLineWidth(0.2);
      doc.rect(COL1_X, y, COL1_W + COL2_W, h, 'S');   // outer box
      doc.line(COL2_X, y, COL2_X, y + h);               // column divider

      // ── Label ────────────────────────────────────────────────────────
      doc.setFont('times', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
      doc.text(label, COL1_X + 3, y + PAD_TOP, { maxWidth: COL1_W - 5 });

      // ── Value ────────────────────────────────────────────────────────
      if (threatColor) {
        // Colored pill badge — use plain ASCII text only (jsPDF built-in fonts)
        const tl = String(value).toUpperCase();
        let pillFill = [10, 140, 60]; let pillLabel = 'LOW PRIORITY';
        if (tl.includes('HIGH') || tl.includes('CRIT')) { pillFill = [195, 28, 28]; pillLabel = 'HIGH PRIORITY'; }
        else if (tl.includes('MOD'))                    { pillFill = [165, 112, 0]; pillLabel = 'MEDIUM PRIORITY'; }
        // Draw pill background
        doc.setFillColor(pillFill[0], pillFill[1], pillFill[2]);
        doc.roundedRect(COL2_X + 3, y + 2, 62, 8, 2, 2, 'F');
        // Draw small circle indicator inside pill
        doc.setFillColor(255, 255, 255);
        doc.circle(COL2_X + 9, y + 6.2, 1.5, 'F');
        // Draw pill text
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
        doc.text(pillLabel, COL2_X + 35, y + 7.5, { align: 'center' });
      } else if (isBullet) {
        let curY = y + PAD_TOP;
        segments.forEach(({ text, isBulletStart }) => {
          if (isBulletStart) {
            doc.setFillColor(PRIMARY_ACCENT[0], PRIMARY_ACCENT[1], PRIMARY_ACCENT[2]);
            doc.circle(BULLET_X, curY - 1, 1.1, 'F');
            doc.setFont('times', 'normal'); doc.setFontSize(9.5); doc.setTextColor(22, 22, 22);
            doc.text(text, TEXT_X, curY);
          } else {
            doc.setFont('times', 'normal'); doc.setFontSize(9.5); doc.setTextColor(22, 22, 22);
            doc.text(text, TEXT_X, curY);   // continuation line — aligned under text, not bullet
          }
          curY += LINE_H;
        });
      } else {
        let curY = y + PAD_TOP;
        doc.setFont('times', 'normal'); doc.setFontSize(9.5); doc.setTextColor(22, 22, 22);
        segments.forEach(({ text }) => {
          doc.text(text, COL2_X + 4, curY);
          curY += LINE_H;
        });
      }

      y += h;
    };


    // --- PAGE 1: HEADER BLOCK ---
    doc.setFillColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('times', 'bold');
    doc.setFontSize(20);
    doc.text('Ayurvedic Clinical Consultation', 20, 18);
    doc.setFontSize(14);
    doc.text("Patient's Copy", 20, 28);

    // --- AI GENERATED BADGE (top-right of header) ---
    const bx = pageWidth - 40;
    const by = 7;

    doc.setFillColor(60, 100, 85);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.roundedRect(bx, by, 24, 26, 2, 2, 'FD');

    doc.setDrawColor(200, 220, 210);
    doc.setLineWidth(0.2);
    doc.roundedRect(bx + 1, by + 1, 22, 24, 1.5, 1.5, 'S');

    doc.setFillColor(44, 70, 61);
    doc.roundedRect(bx + 3, by + 2.5, 18, 5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(3.5);
    doc.text('VERIFIED', bx + 12, by + 6, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('AI', bx + 12, by + 16, { align: 'center' });

    doc.setDrawColor(180, 210, 195);
    doc.setLineWidth(0.3);
    doc.line(bx + 5, by + 18, bx + 19, by + 18);

    doc.setTextColor(200, 225, 215);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(3);
    doc.text('GENERATED', bx + 12, by + 22, { align: 'center' });

    doc.setFillColor(200, 225, 215);
    doc.circle(bx + 2, by + 2, 0.5, 'F');
    doc.circle(bx + 22, by + 2, 0.5, 'F');

    // --- I. CLINICAL IDENTIFICATION & HISTORY ---
    let y = 50;
    doc.setDrawColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
    doc.setLineWidth(0.5);
    doc.line(15, y - 5, pageWidth - 15, y - 5);
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
    doc.text('I. PATIENT PROFILE & CLINICAL OVERVIEW', 20, y);
    y += 7;

    const reportId = `AYU-${Math.floor(Math.random() * 90000) + 10000}`;
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const threatLevel = (report.threatLevel || 'MODERATE').toUpperCase();
    const dominant = report.doshaProfile?.dominant || report.diagnosis?.dosha || 'Unknown';

    // ── SPLIT PANEL: All-Green ─────────────────────────────────────────
    const CHARCOAL = [30, 65, 50];      // deep forest green (replaces charcoal)
    const GOLD = [72, 120, 94];     // medium sage (replaces gold)
    const GOLD_LIGHT = [225, 242, 232];   // pale mint row tint
    const GOLD_MID = [140, 190, 162];   // light sage for rings / dividers

    const panelTop = y;
    const LEFT_W = 58;
    const RIGHT_W = 112;
    const LEFT_X = 20;
    const RIGHT_X = LEFT_X + LEFT_W;
    const PANEL_H = 72;

    // ── LEFT CARD: deep charcoal ──
    doc.setFillColor(CHARCOAL[0], CHARCOAL[1], CHARCOAL[2]);
    doc.rect(LEFT_X, panelTop, LEFT_W, PANEL_H, 'F');

    // Gold top accent bar
    doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.rect(LEFT_X, panelTop, LEFT_W, 3, 'F');

    // Avatar — charcoal inner, gold ring
    const avatarX = LEFT_X + LEFT_W / 2;
    const avatarY = panelTop + 15;
    doc.setFillColor(35, 50, 68);  // slightly lighter charcoal
    doc.circle(avatarX, avatarY, 9, 'F');
    doc.setDrawColor(GOLD_MID[0], GOLD_MID[1], GOLD_MID[2]); doc.setLineWidth(0.8);
    doc.circle(avatarX, avatarY, 9, 'S');

    const initials = (report.patientInfo?.name || 'PT').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.setTextColor(GOLD_MID[0], GOLD_MID[1], GOLD_MID[2]);
    doc.text(initials, avatarX, avatarY + 3.5, { align: 'center' });

    // Patient name in white
    doc.setFont('times', 'bold'); doc.setFontSize(9); doc.setTextColor(240, 238, 230);
    doc.text(report.patientInfo?.name || 'Patient', avatarX, panelTop + 28, { align: 'center', maxWidth: LEFT_W - 6 });

    // Gold thin separator
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]); doc.setLineWidth(0.3);
    doc.line(LEFT_X + 8, panelTop + 32, LEFT_X + LEFT_W - 8, panelTop + 32);

    // Left card data rows — gold labels, ivory values
    const lcRow = (label, value, ry) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8);
      doc.setTextColor(GOLD_MID[0], GOLD_MID[1], GOLD_MID[2]);
      doc.text(label, avatarX, ry, { align: 'center' });
      doc.setFont('times', 'normal'); doc.setFontSize(8.5); doc.setTextColor(220, 215, 200);
      doc.text(String(value), avatarX, ry + 4.5, { align: 'center', maxWidth: LEFT_W - 6 });
    };
    lcRow('CASE REFERENCE', reportId, panelTop + 37);
    lcRow('GENDER  ·  AGE', `${report.patientInfo?.gender || 'N/A'}  ·  ${report.patientInfo?.age || 'N/A'} yrs`, panelTop + 48);
    lcRow('CONSULT DATE', currentDate, panelTop + 59);

    // Gold bottom accent bar
    doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.rect(LEFT_X, panelTop + PANEL_H - 3, LEFT_W, 3, 'F');

    // ── RIGHT PANEL: ivory/white with charcoal header ──
    doc.setFillColor(252, 250, 245);
    doc.setDrawColor(200, 190, 170); doc.setLineWidth(0.2);
    doc.rect(RIGHT_X, panelTop, RIGHT_W, PANEL_H, 'FD');

    // Charcoal banner header
    doc.setFillColor(CHARCOAL[0], CHARCOAL[1], CHARCOAL[2]);
    doc.rect(RIGHT_X, panelTop, RIGHT_W, 9, 'F');

    // 'CLINICAL PRIORITY' in gold on charcoal banner
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.setTextColor(GOLD_MID[0], GOLD_MID[1], GOLD_MID[2]);
    doc.text('CLINICAL PRIORITY', RIGHT_X + 4, panelTop + 6);

    // Severity pill — dynamically colored
    let sevColor = [10, 130, 65];
    if (threatLevel.includes('HIGH') || threatLevel.includes('CRIT')) sevColor = [185, 28, 28];
    else if (threatLevel.includes('MOD')) sevColor = [160, 115, 0];

    doc.setFillColor(sevColor[0], sevColor[1], sevColor[2]);
    doc.roundedRect(RIGHT_X + RIGHT_W - 32, panelTop + 1.5, 29, 6, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
    doc.text(threatLevel, RIGHT_X + RIGHT_W - 17.5, panelTop + 6, { align: 'center' });

    // Data rows — alternating ivory-gold tint
    const rpStartY = panelTop + 11;
    const rpColW = RIGHT_W / 2;
    const rpRowH = 15;
    const rpRows = [
      ['Primary Dosha', dominant, 'Consult Time', new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), false],
      ['Prakriti', report.patientInfo?.constitution || 'Tridoshic', 'Severity Index', report.threatLevel || 'Moderate', true],
      ['Height / Weight', `${report.patientInfo?.height || 'N/A'} / ${report.patientInfo?.weight || 'N/A'}`, 'Attending System', 'Ayurveda AI', false],
      ['Case Complexity', 'Level 4 — Senior Review', 'Patient ID', reportId, false],
    ];

    rpRows.forEach((row, i) => {
      const ry = rpStartY + i * rpRowH;
      // Alternating gold tint rows
      if (i % 2 !== 0) {
        doc.setFillColor(GOLD_LIGHT[0], GOLD_LIGHT[1], GOLD_LIGHT[2]);
        doc.rect(RIGHT_X, ry, RIGHT_W, rpRowH, 'F');
      }

      [[row[0], row[1], RIGHT_X, false], [row[2], row[3], RIGHT_X + rpColW, row[4]]].forEach(([lbl, val, rx, tColor]) => {
        // Cell border in warm gold-grey
        doc.setDrawColor(210, 195, 155); doc.setLineWidth(0.15);
        doc.rect(rx, ry, rpColW, rpRowH, 'S');

        // Label in muted gold
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
        doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
        doc.text(String(lbl).toUpperCase(), rx + 3, ry + 4.5);

        // Value in charcoal (or severity color)
        if (tColor) {
          const lv = String(val).toUpperCase();
          if (lv.includes('LOW')) { doc.setTextColor(10, 140, 65); doc.setFont('times', 'bold'); }
          else if (lv.includes('HIGH') || lv.includes('CRIT')) { doc.setTextColor(185, 28, 28); doc.setFont('times', 'bold'); }
          else { doc.setTextColor(160, 115, 0); doc.setFont('times', 'bold'); }
          doc.setFontSize(9.5);
        } else {
          doc.setFont('times', 'normal'); doc.setFontSize(9);
          doc.setTextColor(CHARCOAL[0], CHARCOAL[1], CHARCOAL[2]);
        }
        doc.text(String(val), rx + 3, ry + 11, { maxWidth: rpColW - 6 });
      });
    });

    // Gold bottom accent to mirror left card
    doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.rect(RIGHT_X, panelTop + PANEL_H - 3, RIGHT_W, 3, 'F');

    y = panelTop + PANEL_H + 10;

    // --- III. MEDICAL / SYMPTOM HISTORY ---
    if (normalizedType === 'Diagnosis Report') {
      doc.setFillColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
      doc.rect(20, y, 170, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text('MEDICAL / CLINICAL / SYMPTOM HISTORY', 24, y + 4.5);
      y += 7;

      const symptomsSource = report.symptomsReported?.length ? report.symptomsReported : report.supportingFindings;
      const prakritiStr = report.patientInfo?.constitution ? sanitizeMarkdownText(report.patientInfo.constitution) : '';

      drawDataRowDynamic('Reported Symptoms', symptomsSource, { isTabulated: true, isBullet: true });
      if (!isEmpty(prakritiStr)) {
        drawDataRowDynamic('Patient Prakriti', prakritiStr, { isTabulated: true });
      }
      y += 10;
    }

    const diagnosisName = typeof report.diagnosis === 'string' ? report.diagnosis : (report.diagnosis?.name || 'Ayurvedic Assessment');
    const diagnosisReason = typeof report.diagnosis === 'object' ? (report.diagnosis?.reasoning || report.clinicalImpression) : report.clinicalImpression || null;

    if (normalizedType === 'Diagnosis Report') {
      // ── SECTION II: CLINICAL DIAGNOSIS ──
      ensurePageSpace(30);
      doc.setDrawColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
      doc.setLineWidth(0.5);
      doc.line(15, y, pageWidth - 15, y);
      y += 6;
      doc.setFont('times', 'bold'); doc.setFontSize(13);
      doc.setTextColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
      doc.text('II. CLINICAL DIAGNOSIS & ASSESSMENT', 20, y);
      y += 8;

      // Tabulated Main Diagnosis & Priority only
      drawDataRowDynamic('Principal Diagnosis', diagnosisName);
      drawDataRowDynamic('Clinical Priority', report.threatLevel || 'MODERATE', { threatColor: true });
      y += 12;

      // ── SECTION III: DOSHA PROFILE & CONSTITUTIONAL ANALYSIS ──
      // (Moved here for better flow)
      if (report.diagnosis?.dosha || report.doshaProfile?.dominant) {
        ensurePageSpace(45);
        doc.setDrawColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
        doc.setLineWidth(0.5);
        doc.line(15, y, pageWidth - 15, y);
        y += 6;
        doc.setFont('times', 'bold'); doc.setFontSize(13);
        doc.text('III. DOSHA PROFILE & CONSTITUTIONAL ANALYSIS', 20, y);
        y += 10;

        const domDosha = report.doshaProfile?.dominant || report.diagnosis?.dosha || '';
        const dL = domDosha.toLowerCase();
        let doshaExp = 'Tridosha — Vata (movement), Pitta (metabolism), and Kapha (structure) are in balance. Maintaining this equilibrium is essential for sustained wellbeing.';
        if (dL.includes('vata'))  doshaExp = 'Vata (Air/Ether) — Controls movement: nerve signals, breathing, circulation. Balanced: creativity, vitality, alertness. Imbalanced: anxiety, dry skin, insomnia, poor digestion.';
        else if (dL.includes('pitta')) doshaExp = 'Pitta (Fire/Water) — Controls digestion, metabolism, intelligence. Balanced: focus, confidence, healthy skin. Imbalanced: inflammation, acid reflux, irritability, fever.';
        else if (dL.includes('kapha')) doshaExp = 'Kapha (Earth/Water) — Controls structure, lubrication, immunity. Balanced: calm, strength, resilience. Imbalanced: lethargy, weight gain, congestion, low motivation.';
        
        doc.setFont('times', 'bold'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
        doc.text('Dominant Dosha Context:', 20, y);
        y += 6;
        doc.setFont('times', 'normal'); doc.setFontSize(10);
        const expLines = doc.splitTextToSize(doshaExp, 170);
        doc.text(expLines, 20, y);
        y += (expLines.length * 5) + 6;

        if (report.doshaProfile?.interpretation) {
          doc.setFont('times', 'italic'); doc.setFontSize(9.5); doc.setTextColor(60, 60, 60);
          const intLines = doc.splitTextToSize('Interpretation: ' + report.doshaProfile.interpretation, 170);
          doc.text(intLines, 20, y);
          y += (intLines.length * 4.5) + 10;
        }
        
        // This is where the radar chart would normally be, but we'll move the drawing logic later 
        // to stay consistent with the existing helper calls.
      }

      // ── SECTION IV: THERAPEUTIC PROTOCOL ──
      ensurePageSpace(40);
      doc.setDrawColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
      doc.setLineWidth(0.5);
      doc.line(15, y, pageWidth - 15, y);
      y += 6;
      doc.setFont('times', 'bold'); doc.setFontSize(13);
      doc.text('IV. THERAPEUTIC PROTOCOL & GUIDANCE', 20, y);
      y += 8;

      // Clinical Reasoning (outside table)
      const diagnosisReasonLocal = typeof report.diagnosis === 'object'
        ? (report.diagnosis?.reasoning || report.clinicalImpression)
        : report.clinicalImpression || null;
      if (!isEmpty(diagnosisReasonLocal)) {
        doc.setFont('times', 'bold'); doc.setFontSize(10); doc.text('Clinical Reasoning:', 20, y);
        y += 6;
        drawDataRowDynamic('', diagnosisReasonLocal, { isBullet: true }); // Using it as a bullet renderer without label
        y += 6;
      }

      // Treatment Plan
      const treatmentSrc = Array.isArray(report.treatments) ? report.treatments
        : (report.treatment_plan || report.treatmentNarrative || report.treatments);
      if (!isEmpty(treatmentSrc)) {
        doc.setFont('times', 'bold'); doc.setFontSize(10); doc.text('Treatment Plan:', 20, y);
        y += 6;
        drawDataRowDynamic('', treatmentSrc, { isBullet: true });
        y += 6;
      }

      // Lifestyle Changes
      const lifestyleSrc = report.lifestyle_changes || report.lifestyleChanges
        || report.routine_steps || report.integrationNote || report.morningFlow;
      if (!isEmpty(lifestyleSrc)) {
        doc.setFont('times', 'bold'); doc.setFontSize(10); doc.text('Lifestyle Recommendations:', 20, y);
        y += 6;
        drawDataRowDynamic('', lifestyleSrc, { isBullet: true });
        y += 6;
      }

      // Herbal Medications
      const herbalArr = report.herbalPreparations?.length
        ? report.herbalPreparations.map(h => typeof h === 'object' ? `${h.name}: ${h.purpose}` : h)
        : (report.herbal_meds || report.medicinesAndSupports || null);
      if (!isEmpty(herbalArr)) {
        doc.setFont('times', 'bold'); doc.setFontSize(10); doc.text('Herbal Formulations:', 20, y);
        y += 6;
        drawDataRowDynamic('', herbalArr, { isBullet: true });
        y += 6;
      }

      // Dietary Guidance
      const dietIn  = report.dietaryGuide?.toConsume || report.foodApproach;
      const dietOut = report.dietaryGuide?.toAvoid   || report.avoidances;
      if (!isEmpty(dietIn) || !isEmpty(dietOut)) {
        doc.setFont('times', 'bold'); doc.setFontSize(10); doc.text('Dietary Guidance:', 20, y);
        y += 6;
        if (!isEmpty(dietIn)) {
          doc.setFont('times', 'bold'); doc.setFontSize(9); doc.setTextColor(10, 120, 60);
          doc.text('To Include:', 25, y); y += 5;
          drawDataRowDynamic('', dietIn, { isBullet: true });
          y += 4;
        }
        if (!isEmpty(dietOut)) {
          doc.setFont('times', 'bold'); doc.setFontSize(9); doc.setTextColor(180, 20, 20);
          doc.text('To Avoid:', 25, y); y += 5;
          drawDataRowDynamic('', dietOut, { isBullet: true });
          y += 4;
        }
        doc.setTextColor(40, 40, 40);
        y += 6;
      }

      // Prognosis
      const prognosisSrc = report.prognosis || report.shortTermOutlook || report.recoveryExpectation;
      if (!isEmpty(prognosisSrc)) {
        doc.setFont('times', 'bold'); doc.setFontSize(10); doc.text('Prognosis & Outlook:', 20, y);
        y += 6;
        const progLines = doc.splitTextToSize(sanitizeMarkdownText(String(prognosisSrc)), 165);
        ensurePageSpace(progLines.length * 5 + 5);
        doc.setFont('times', 'normal'); doc.setFontSize(10);
        doc.text(progLines, 25, y);
        y += (progLines.length * 5) + 12;
      }


    } else {
      drawNarrativeSectionTitle('II. SPECIALIST ASSESSMENT: ' + normalizedType.toUpperCase());

      // Render Specialist KPIs and Pain Points if present
      drawReportKPIs(report.kpis);
      drawPainPoints(report.pain_points);

      // Section 1
      const s1_title = normalizedType === 'Comprehensive Report' ? 'Integrated Synthesis' :
        normalizedType === 'Risk Report' ? 'Clinical Forecast' :
          normalizedType === 'Treatment Plan Report' ? 'Therapeutic Strategy' :
            normalizedType === 'Lifestyle Report' ? 'Daily Rhythm Script' :
              'Disease Formation Narrative';

      drawNarrativeBlock(s1_title, report.section1_content || report.currentAssessment || report.prognosisSummary || report.rootCauseFocus || report.integrationNote || report.treatmentNarrative || report.synthesis || diagnosisReason || 'Focused clinical narrative.');

      // Section 2
      const s2_title = report.section2_title || 'Holistic guidance and clinical protocol summary';
      drawNarrativeBlock(s2_title, report.section2_content || report.integrationNote || 'Standard clinical guidance applies.');
    }

    // (Drawing radar chart and breakdown if info is available)
    if (report.diagnosis?.dosha || report.doshaProfile?.dominant) {
      ensurePageSpace(75);
      // y is already updated by the narrative section above if we are in Diagnosis Report mode

      const vataP = Math.max(10, typeof report.doshaProfile?.vata === 'number' ? report.doshaProfile.vata : getDoshaPercentage(report.diagnosis?.dosha || report.doshaProfile?.dominant || '', 'vata'));
      const pittaP = Math.max(10, typeof report.doshaProfile?.pitta === 'number' ? report.doshaProfile.pitta : getDoshaPercentage(report.diagnosis?.dosha || report.doshaProfile?.dominant || '', 'pitta'));
      const kaphaP = Math.max(10, typeof report.doshaProfile?.kapha === 'number' ? report.doshaProfile.kapha : getDoshaPercentage(report.diagnosis?.dosha || report.doshaProfile?.dominant || '', 'kapha'));

      const centerX = 65; const centerY = y + 30; const radius = 25;
      doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.1);
      [0.2, 0.4, 0.6, 0.8, 1].forEach(r => {
        const d = radius * r;
        const p1 = { x: centerX, y: centerY - d };
        const p2 = { x: centerX + d * Math.cos(Math.PI / 6), y: centerY + d * Math.sin(Math.PI / 6) };
        const p3 = { x: centerX - d * Math.cos(Math.PI / 6), y: centerY + d * Math.sin(Math.PI / 6) };
        doc.line(p1.x, p1.y, p2.x, p2.y); doc.line(p2.x, p2.y, p3.x, p3.y); doc.line(p3.x, p3.y, p1.x, p1.y);
      });
      doc.line(centerX, centerY, centerX, centerY - radius);
      doc.line(centerX, centerY, centerX + radius * Math.cos(Math.PI / 6), centerY + radius * Math.sin(Math.PI / 6));
      doc.line(centerX, centerY, centerX - radius * Math.cos(Math.PI / 6), centerY + radius * Math.sin(Math.PI / 6));

      doc.setFontSize(7); doc.setFont('times', 'bold'); doc.setTextColor(100, 100, 100);
      doc.text('VATA', centerX, centerY - radius - 2, { align: 'center' });
      doc.text('PITTA', centerX + radius * Math.cos(Math.PI / 6) + 4, centerY + radius * Math.sin(Math.PI / 6) + 2);
      doc.text('KAPHA', centerX - radius * Math.cos(Math.PI / 6) - 10, centerY + radius * Math.sin(Math.PI / 6) + 2);

      const vR = (vataP / 100) * radius; const pR = (pittaP / 100) * radius; const kR = (kaphaP / 100) * radius;
      const vP = { x: centerX, y: centerY - vR };
      const pP = { x: centerX + pR * Math.cos(Math.PI / 6), y: centerY + pR * Math.sin(Math.PI / 6) };
      const kP = { x: centerX - kR * Math.cos(Math.PI / 6), y: centerY + kR * Math.sin(Math.PI / 6) };

      doc.setFillColor(PRIMARY_ACCENT[0], PRIMARY_ACCENT[1], PRIMARY_ACCENT[2], 0.2);
      doc.setDrawColor(PRIMARY_ACCENT[0], PRIMARY_ACCENT[1], PRIMARY_ACCENT[2]);
      doc.setLineWidth(0.8);
      doc.lines([[vP.x - vP.x, vP.y - vP.y], [pP.x - vP.x, pP.y - vP.y], [kP.x - vP.x, kP.y - vP.y]], vP.x, vP.y, [1, 1], 'FD', true);
      doc.circle(vP.x, vP.y, 0.8, 'F'); doc.circle(pP.x, pP.y, 0.8, 'F'); doc.circle(kP.x, kP.y, 0.8, 'F');

      const matrixX = 115; const matrixY = y + 5;
      doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.text('CLINICAL MATRIX', matrixX, matrixY);
      const drawMatrixRow = (label, value, color, mY) => {
        doc.setFont('times', 'bold'); doc.setFontSize(9); doc.setTextColor(color[0], color[1], color[2]);
        doc.text(label, matrixX, mY); doc.setFont('times', 'normal'); doc.setTextColor(50, 50, 50);
        doc.text(`${value}% Intensity - Targeted Pacification Required`, matrixX, mY + 4, { maxWidth: 70 });
      }
      drawMatrixRow('VATA (AIR/ETHER)', vataP, [100, 150, 200], matrixY + 8);
      drawMatrixRow('PITTA (FIRE/WATER)', pittaP, [200, 100, 50], matrixY + 22);
      drawMatrixRow('KAPHA (EARTH/WATER)', kaphaP, [100, 180, 100], matrixY + 36);
      y += 65;
    }

    const addChartToDoc = (title, imgData, hValue, explanation) => {
      if (!imgData) return;
      ensurePageSpace(hValue + 25);
      doc.setFont('times', 'bold'); doc.setFontSize(11); doc.setTextColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
      doc.text(title, 20, y); y += 6;
      doc.addImage(imgData, 'PNG', 35, y, 140, hValue); y += hValue + 5;
      if (explanation) {
        doc.setFont('times', 'italic'); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
        doc.text(explanation, 105, y, { maxWidth: 140, align: 'center' }); y += 12;
      } else { y += 5; }
    };

    y += 10;
    if (doshaImg || priorityImg) {
      ensurePageSpace(100);
      doc.setFont('times', 'bold'); doc.setFontSize(14); doc.setTextColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
      doc.text('III. QUANTITATIVE ANALYSIS & DATA VISUALIZATION', 20, y); y += 8;
      addChartToDoc('Dosha Balance Analysis', doshaImg, 80, 'Radar chart illustrating the relative distribution of Vata, Pitta, and Kapha energies.');
      addChartToDoc('Severity/Priority Breakdown', priorityImg, 60, 'Metric quantifying the urgency of your clinical condition.');
    }

    y += 10;
    ensurePageSpace(25);
    doc.setFont('times', 'bold'); doc.setFontSize(9); doc.setTextColor(150, 100, 0);
    doc.text('DISCLAIMER: This report is generated by an AI-based Ayurveda Clinical Assistant.', 105, y, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.text('This is NOT a substitute for professional medical advice, diagnosis, or treatment.', 105, y + 5, { align: 'center' });
    doc.text('Always consult a qualified healthcare practitioner before making medical decisions.', 105, y + 10, { align: 'center' });
    y += 18;

    const drawFooter = () => {
      doc.setFontSize(8); doc.setTextColor(30, 30, 30); doc.setFont('times', 'normal');
      doc.text('AI-GENERATED REPORT — Not a substitute for professional medical advice.   |   Ayurveda Clinical Assistant Official Copy', 105, pageHeight - 7, { align: 'center' });
    }
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) { doc.setPage(i); drawFooter(); }

    const reportTitle = options.reportTitle || options.reportType || (typeof report.diagnosis === 'string' ? report.diagnosis : (report.diagnosis?.name || 'Report'));
    const safeName = String(reportTitle).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`report_${safeName || 'clinical'}.pdf`);

  } catch (error) {
    console.error('CRITICAL: PDF generation failed!', error)
    alert(`Error generating PDF: ${error.message || 'Unknown error'}`)
  }
}
