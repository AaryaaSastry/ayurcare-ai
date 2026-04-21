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

    // Ayurvedic Green Theme Colors (Rich Forest Green & Soft Sage)
    const HEADER_BLUE = [44, 70, 61]
    const LABEL_BLUE = [225, 236, 230]
    const PRIMARY_ACCENT = [78, 108, 97]
    const VATA_COLOR = [220, 235, 255]   // Air/Ether
    const PITTA_COLOR = [255, 235, 220]  // Fire
    const KAPHA_COLOR = [225, 245, 225]  // Earth/Water
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

    // Helper to draw a standard row (no boxes)
    const drawRow = (x, y, w, h, text, isLabel = false, align = 'left') => {
      doc.setFont('times', isLabel ? 'bold' : 'normal');
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);

      if (text) {
        const options = { maxWidth: w - 4, lineHeightFactor: 1.5 };
        if (align === 'center') {
          doc.text(String(text), x + w / 2, y + 6, { ...options, align: 'center' });
        } else {
          doc.text(String(text), x + 2, y + 6, options);
        }
      }
      
      // Draw a subtle dotted or light separator line instead of a box
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.1);
      doc.line(x, y + h, x + w, y + h);
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

    // --- PATIENT DEMOGRAPHICS ---
    let y = 50;
    
    doc.setDrawColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
    doc.setLineWidth(0.5);
    doc.line(15, y - 5, pageWidth - 15, y - 5);
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
    doc.text('I. CLINICAL IDENTIFICATION', 20, y);
    y += 8;

    const labelX = 20;
    const valueX = 40;
    const labelX2 = 85;
    const valueX2 = 105;
    const labelX3 = 145;
    const valueX3 = 170;

    const reportId = `AYU-${Math.floor(Math.random() * 90000) + 10000}`;
    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    // Row 1
    doc.setFontSize(9);
    doc.setFont('times', 'bold'); doc.text('Name', labelX, y + 6);
    doc.setFont('times', 'normal'); doc.text(report.patientInfo?.name || 'Patient', valueX, y + 6);
    
    doc.setFont('times', 'bold'); doc.text('Gender', labelX2, y + 6);
    doc.setFont('times', 'normal'); doc.text(report.patientInfo?.gender || 'N/A', valueX2, y + 6);
    
    doc.setFont('times', 'bold'); doc.text('Location', labelX3, y + 6);
    doc.setFont('times', 'normal'); doc.text('Online Consult', valueX3, y + 6);
    
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.1); doc.line(20, y + 9, pageWidth - 20, y + 9);
    y += 10;

    // Row 2
    doc.setFont('times', 'bold'); doc.text('ID No.', labelX, y + 6);
    doc.setFont('times', 'normal'); doc.text(reportId, valueX, y + 6);
    
    doc.setFont('times', 'bold'); doc.text('Date', labelX2, y + 6);
    doc.setFont('times', 'normal'); doc.text(currentDate, valueX2, y + 6);
    
    doc.setFont('times', 'bold'); doc.text('Age', labelX3, y + 6);
    doc.setFont('times', 'normal'); doc.text(sanitizeMarkdownText(String(report.patientInfo?.age || 'N/A')), valueX3, y + 6);
    
    doc.line(20, y + 9, pageWidth - 20, y + 9);
    y += 15;

    // --- CLINICAL INTELLIGENCE BAR (KPIs) ---
    const kpiX1 = 20;
    const kpiX2 = 80;
    const kpiX3 = 140;
    
    doc.setFont('times', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('PRIMARY PATHOLOGY', kpiX1, y);
    doc.text('CASE COMPLEXITY', kpiX2, y);
    doc.text('CLINICAL URGENCY', kpiX3, y);
    
    y += 6;
    doc.setFontSize(11);
    doc.setTextColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
    doc.text(report.doshaProfile?.dominant || report.diagnosis?.dosha || 'Imbalance', kpiX1, y);
    doc.text('LEVEL 4', kpiX2, y); 
    doc.text(report.threatLevel || 'MODERATE', kpiX3, y);
    
    y += 4;
    doc.setDrawColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
    doc.setLineWidth(0.8);
    doc.line(20, y, 60, y);
    doc.line(80, y, 120, y);
    doc.line(140, y, 180, y);
    y += 15;

    // --- PATIENT VITALS (KPI Style) ---
    const hasHeight = !isEmpty(report.patientInfo?.height);
    const hasWeight = !isEmpty(report.patientInfo?.weight);
    if (hasHeight || hasWeight) {
      doc.setFont('times', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text('STATURE', labelX, y);
      doc.text('BODY MASS', labelX2, y);
      
      y += 5;
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text(report.patientInfo.height || 'N/A', labelX, y);
      doc.text(report.patientInfo.weight || 'N/A', labelX2, y);
      
      y += 8;
    }

    // --- CLINICAL OBSERVATIONS (ONLY IN DIAGNOSIS REPORT) ---
    if (normalizedType === 'Diagnosis Report') {
      doc.setTextColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.text('Medical / Clinical / Symptom History', 20, y + 5.5);
      y += 10;

      const symptomsSource = report.symptomsReported?.length ? report.symptomsReported : report.supportingFindings;
      const symptomsStr = symptomsSource?.length ? symptomsSource.map(s => sanitizeMarkdownText(s)).join('; ') : '';
      const prakritiStr = report.patientInfo?.constitution ? sanitizeMarkdownText(report.patientInfo.constitution) : '';

      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);

      if (!isEmpty(symptomsStr)) {
        doc.setFont('times', 'bold');
        doc.text('Reported Symptoms:', 20, y);
        doc.setFont('times', 'normal');
        const lines = doc.splitTextToSize(symptomsStr, 170);
        doc.text(lines, 20, y + 6, { lineHeightFactor: 1.5 });
        y += lines.length * 5.5 + 8;
      }

      if (!isEmpty(prakritiStr)) {
        doc.setFont('times', 'bold');
        doc.text('Prakriti:', 20, y);
        doc.setFont('times', 'normal');
        const lines = doc.splitTextToSize(prakritiStr, 170);
        doc.text(lines, 20, y + 6, { lineHeightFactor: 1.5 });
        y += lines.length * 5.5 + 8;
      }
      y += 5;
    }

    const calculateHeight = (text, width) => {
      if (!text) return 10;
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      const splitText = doc.splitTextToSize(String(text), width - 4);
      return Math.max(10, splitText.length * 5.3 + 6);
    };

    const drawDataRowDynamic = (label, value) => {
      if (isEmpty(value)) return;
      let valString = Array.isArray(value) ? value.map(v => sanitizeMarkdownText(v)).join('; ') : sanitizeMarkdownText(String(value));
      let h = calculateHeight(valString, 110);
      if (y + h > pageHeight - 20) { doc.addPage(); y = 20; }
      drawRow(20, y, 60, h, label, true);
      drawRow(80, y, 110, h, valString, false);
      y += h;
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

    const diagnosisName = typeof report.diagnosis === 'string' ? report.diagnosis : (report.diagnosis?.name || 'Ayurvedic Assessment');
    const diagnosisReason = typeof report.diagnosis === 'object' ? (report.diagnosis?.reasoning || report.clinicalImpression) : report.clinicalImpression || null;

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

    if (normalizedType === 'Diagnosis Report') {
      drawDataRowDynamic('Consultation Date / Time', new Date().toLocaleString());
      drawDataRowDynamic('Principal Doctor', 'Ayurveda AI Clinical Assistant');
      drawDataRowDynamic('Principal Diagnosis', diagnosisName);
      drawDataRowDynamic('Reason / Clinical Assessment', diagnosisReason);
      drawDataRowDynamic('Clinical Threat Level', `PRIORITY: ${report.threatLevel || 'MODERATE'}`);
      
      const treatmentStr = Array.isArray(report.treatments) ? report.treatments.join(', ') : report.treatments || report.treatmentNarrative;
      drawDataRowDynamic('Ayurvedic Treatment Modalities', treatmentStr);
      drawDataRowDynamic('Dietary Inclusion (Pathya)', report.dietaryGuide?.toConsume || report.foodApproach);
      drawDataRowDynamic('Dietary Restriction (Apathya)', report.dietaryGuide?.toAvoid || report.avoidances);
      drawDataRowDynamic('Lifestyle Adjustments', report.lifestyleChanges || report.integrationNote || report.morningFlow);
      const herbalArr = report.herbalPreparations?.length ? report.herbalPreparations.map(h => `${h.name} (${h.purpose})`) : null;
      drawDataRowDynamic('Herbal Formulations', herbalArr || report.medicinesAndSupports);
      drawDataRowDynamic('Clinical Prognosis', report.prognosis || report.shortTermOutlook || report.recoveryExpectation);
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

    if (report.diagnosis?.dosha || report.doshaProfile?.dominant) {
      ensurePageSpace(80);
      doc.setFont('times', 'bold'); doc.setFontSize(12); doc.setTextColor(HEADER_BLUE[0], HEADER_BLUE[1], HEADER_BLUE[2]);
      doc.text('II. DOSHA PROFILE & CONSTITUTIONAL ANALYSIS', 20, y);
      y += 12;

      const vataP = Math.max(10, typeof report.doshaProfile?.vata === 'number' ? report.doshaProfile.vata : getDoshaPercentage(report.diagnosis?.dosha || report.doshaProfile?.dominant || '', 'vata'));
      const pittaP = Math.max(10, typeof report.doshaProfile?.pitta === 'number' ? report.doshaProfile.pitta : getDoshaPercentage(report.diagnosis?.dosha || report.doshaProfile?.dominant || '', 'pitta'));
      const kaphaP = Math.max(10, typeof report.doshaProfile?.kapha === 'number' ? report.doshaProfile.kapha : getDoshaPercentage(report.diagnosis?.dosha || report.doshaProfile?.dominant || '', 'kapha'));

      const centerX = 65; const centerY = y + 30; const radius = 25;
      doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.1);
      [0.2, 0.4, 0.6, 0.8, 1].forEach(r => {
        const d = radius * r;
        const p1 = { x: centerX, y: centerY - d };
        const p2 = { x: centerX + d * Math.cos(Math.PI/6), y: centerY + d * Math.sin(Math.PI/6) };
        const p3 = { x: centerX - d * Math.cos(Math.PI/6), y: centerY + d * Math.sin(Math.PI/6) };
        doc.line(p1.x, p1.y, p2.x, p2.y); doc.line(p2.x, p2.y, p3.x, p3.y); doc.line(p3.x, p3.y, p1.x, p1.y);
      });
      doc.line(centerX, centerY, centerX, centerY - radius);
      doc.line(centerX, centerY, centerX + radius * Math.cos(Math.PI/6), centerY + radius * Math.sin(Math.PI/6));
      doc.line(centerX, centerY, centerX - radius * Math.cos(Math.PI/6), centerY + radius * Math.sin(Math.PI/6));

      doc.setFontSize(7); doc.setFont('times', 'bold'); doc.setTextColor(100, 100, 100);
      doc.text('VATA', centerX, centerY - radius - 2, { align: 'center' });
      doc.text('PITTA', centerX + radius * Math.cos(Math.PI/6) + 4, centerY + radius * Math.sin(Math.PI/6) + 2);
      doc.text('KAPHA', centerX - radius * Math.cos(Math.PI/6) - 10, centerY + radius * Math.sin(Math.PI/6) + 2);

      const vR = (vataP / 100) * radius; const pR = (pittaP / 100) * radius; const kR = (kaphaP / 100) * radius;
      const vP = { x: centerX, y: centerY - vR };
      const pP = { x: centerX + pR * Math.cos(Math.PI/6), y: centerY + pR * Math.sin(Math.PI/6) };
      const kP = { x: centerX - kR * Math.cos(Math.PI/6), y: centerY + kR * Math.sin(Math.PI/6) };

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
