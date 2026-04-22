import React from 'react'
import './report.css'
import { Sparkles, Target } from 'lucide-react'

function ReportRenderer({ report, reportType }) {
   if (!report) return null

   const normalizedType = reportType === 'Risk & Health Score Report' ? 'Risk Report' : reportType

   const Section = ({ title, icon: Icon, children }) => (
      <section className="report-narrative-section">
         <div className="report-section-head">
            <div className="report-icon-shell">
               <Icon size={18} strokeWidth={2.3} />
            </div>
            <h4>{title}</h4>
         </div>
         <div className="report-section-body">{children}</div>
      </section>
   )

   const Paragraph = ({ children, subtle = false, lead = false }) => (
      <p className={[
         'report-paragraph',
         subtle ? 'subtle' : '',
         lead ? 'lead' : '',
      ].filter(Boolean).join(' ')}>
         {children}
      </p>
   )

   const TextBlock = ({ value, fallback, subtle = false, lead = false }) => {
      const finalValue = typeof value === 'string' && value.trim() ? value : fallback
      return <Paragraph subtle={subtle} lead={lead}>{finalValue}</Paragraph>
   }

   const BulletList = ({ value }) => {
      if (!value) return null
      const lines = String(value)
         .split(/[•\n\-\*]/)
         .map(line => line.trim())
         .filter(line => line.length > 0)
      
      if (lines.length === 0) return null
      
      return (
         <ul className="report-bullet-list">
            {lines.map((line, i) => <li key={i}>{line}</li>)}
         </ul>
      )
   }

   const MultiParagraphText = ({ value, fallback, subtle = false, leadFirst = false, forceBullets = false }) => {
      const finalValue = typeof value === 'string' && value.trim() ? value : fallback
      
      if (forceBullets || String(finalValue).includes('•') || String(finalValue).includes('- ')) {
         return <BulletList value={finalValue} />
      }

      const paragraphs = String(finalValue)
         .split(/\n{2,}/)
         .map((chunk) => chunk.trim())
         .filter(Boolean)

      return (
         <>
            {paragraphs.map((paragraph, index) => (
               <Paragraph
                  key={`${paragraph.slice(0, 24)}-${index}`}
                  subtle={subtle}
                  lead={leadFirst && index === 0}
               >
                  {paragraph}
               </Paragraph>
            ))}
         </>
      )
   }

   const ChipRow = ({ items = [] }) => {
      const clean = items.filter((item) => typeof item === 'string' && item.trim())
      if (!clean.length) return null
      return (
         <div className="report-chip-row">
            {clean.map((item, index) => (
               <span key={`${item}-${index}`} className="report-chip">{item}</span>
            ))}
         </div>
      )
   }

   const KPIRow = ({ kpis = [] }) => {
      if (!kpis || !kpis.length) return null
      return (
         <div className="report-metric-row">
            {kpis.map((kpi, idx) => {
               const label = kpi.label?.toLowerCase() || ''
               const isThreat = label.includes('threat') || label.includes('priority') || label.includes('risk')
               let threatClass = ''
               if (isThreat) {
                  const val = String(kpi.value).toLowerCase()
                  if (val.includes('low')) threatClass = 'threat-low'
                  else if (val.includes('medium') || val.includes('moderate')) threatClass = 'threat-medium'
                  else if (val.includes('high') || val.includes('priority')) threatClass = 'threat-high'
               }
               return (
                  <div key={`${kpi.label}-${idx}`} className={`report-metric-item ${threatClass}`}>
                     <span className="metric-label">{kpi.label}</span>
                     <span className="metric-value">{kpi.value}</span>
                  </div>
               )
            })}
         </div>
      )
   }

   const PainPointList = ({ points = [] }) => {
      if (!points || !points.length) return null
      return (
         <div className="report-pain-points">
            <h5>KEY CLINICAL FINDINGS</h5>
            <BulletList value={points.join('\n')} />
         </div>
      )
   }

   const Article = ({ themeClass, kicker, title, intro, kpis, pain_points, chapters = [], closing }) => (
      <article className={`report-article ${themeClass}`}>
         <header className="report-article-header">
            <span className="report-kicker">{kicker}</span>
            <h2>{title}</h2>
            <KPIRow kpis={kpis} />
            <Paragraph lead>{intro}</Paragraph>
         </header>

         <div className="report-article-body">
            <PainPointList points={pain_points} />
            {chapters.map((chapter, index) => (
               <section key={`${chapter.title}-${index}`} className="report-highlight-block">
                  <div className="report-highlight-copy">
                     <h3>{chapter.title}</h3>
                     <MultiParagraphText 
                        value={chapter.body} 
                        fallback={chapter.fallback} 
                        leadFirst={index === 0} 
                        forceBullets={chapter.forceBullets}
                     />
                  </div>
               </section>
            ))}
         </div>

         {closing ? (
            <footer className="report-closing-quote">
               <Sparkles size={18} strokeWidth={2.2} />
               <p>{closing}</p>
            </footer>
         ) : null}
      </article>
   )

   if (normalizedType === 'Master Report') {
      return (
         <Article
            themeClass="comprehensive-report"
            kicker="Final Synthesis"
            title="Integrated Clinical Synthesis"
            kpis={report.master_kpis || report.kpis}
            pain_points={report.master_pain_points || report.pain_points}
            intro="A consolidated clinical synthesis of metabolic patterns, specialty findings, and systemic resilience."
            chapters={[
               {
                  title: 'Diagnostic Reasoning & Doshas',
                  body: report.diagnosis?.reasoning || report.integrated_synthesis || report.section1_content || report.synthesis,
                  fallback: 'Connecting specialty perspectives into a unified clinical narrative.'
               },
               {
                  title: 'Dosha Interpretation',
                  body: report.doshaProfile?.interpretation || 'The dosha balance is fundamental to your unique biological constitution and current clinical presentation.',
                  forceBullets: true
               },
               {
                  title: 'Herbal Medications & Treatments',
                  body: Array.isArray(report.herbal_meds) ? report.herbal_meds.join('\n') : (report.remedies || report.section2_content),
                  fallback: 'Specific clinical remedies to restore metabolic balance.',
                  forceBullets: true
               },
               {
                  title: 'Lifestyle Changes',
                  body: report.lifestyle_changes || report.routine_steps,
                  fallback: 'Daily habits and adjustments to support long-term recovery.',
                  forceBullets: true
               }
            ]}
         />
      )
   }

   if (normalizedType === 'Diagnosis Report') {
      const diagnosisKpis = report.kpis || []
      const hasThreat = diagnosisKpis.some(k => k.label?.toLowerCase().includes('threat') || k.label?.toLowerCase().includes('priority'))
      
      const kpis = [...diagnosisKpis]
      if (!hasThreat && report.threatLevel) {
          kpis.push({ label: 'Clinical Threat Level', value: report.threatLevel })
      }

      const doshaIntro = "Doshas represent the biological energies governing physical and mental processes. Vata governs movement, Pitta governs metabolism, and Kapha governs structure."
      const interpretation = report.doshaProfile?.interpretation || `As a ${report.doshaProfile?.dominant || report.diagnosis?.dosha || 'predominant'} profile, your system requires specific balancing protocols.`

      return (
         <Article
            themeClass="diagnosis-report"
            kicker="Senior Ayurvedic Impression"
            title={report.diagnosis?.name || 'Clinical Diagnosis'}
            kpis={kpis}
            pain_points={report.pain_points}
            intro={report.clinicalImpression || report.diagnosis?.reasoning || 'The case reflects a clinically meaningful Ayurvedic imbalance that deserves structured care.'}
            chapters={[
               {
                  title: 'Diagnostic Reasoning',
                  body: report.diagnosis?.reasoning || report.section1_content,
                  fallback: 'The symptom pattern, triggers, and constitutional tendency together support this leading Ayurvedic impression.',
                  forceBullets: true
               },
               {
                  title: 'Dosha Interpretation',
                  body: `**Dominant Pattern: ${report.doshaProfile?.dominant || report.diagnosis?.dosha || 'Mixed'}**\n\n${doshaIntro}\n\n${interpretation}`,
                  forceBullets: false
               },
               {
                  title: 'Lifestyle Changes',
                  body: report.lifestyle_changes || report.lifestyleChanges || report.routine_steps || report.integrationNote,
                  fallback: 'Daily habits and adjustments to support long-term recovery.',
                  forceBullets: true
               },
               {
                  title: 'Recommended Treatments',
                  body: report.treatment_plan || report.treatments || report.remedies || report.treatmentNarrative,
                  fallback: 'Standardized protocols for restoring vata-pitta-kapha balance.',
                  forceBullets: true
               },
               {
                  title: 'Herbal Medications',
                  body: report.herbal_meds || report.herbalPreparations || report.medicinesAndSupports,
                  fallback: 'Specific clinical remedies to restore metabolic balance.',
                  forceBullets: true
               }
            ]}
         />
      )
   }

   if (normalizedType === 'Root Cause Report') {
      return (
         <Article
            themeClass="root-cause-report"
            kicker="Pathology Lens"
            title={reportType || 'Root Cause Report'}
            kpis={report.kpis}
            pain_points={report.pain_points}
            intro="A clinical reading of how the imbalance likely took shape and began expressing itself through symptoms."
            chapters={[
               {
                  title: 'Disease Formation Narrative',
                  body: report.content || report.section1_content || report.diseaseFormation,
                  fallback: 'Imbalance formed gradually through repeated structural or metabolic disturbance.'
               },
               {
                  title: 'Technical Clinical Notes',
                  body: report.technical_notes || report.section2_content || report.amaEvolution,
                  fallback: 'Small daily aggravators accumulated into a persistent clinical pattern.'
               }
            ]}
         />
      )
   }

   if (normalizedType === 'Lifestyle Report') {
      return (
         <Article
            themeClass="lifestyle-report"
            kicker="Daily Rhythm"
            title={reportType || 'Lifestyle Report'}
            kpis={report.kpis}
            pain_points={report.pain_points}
            intro="A livable rhythm defined by biological triggers and metabolic capacity."
            chapters={[
               {
                  title: 'Daily Rhythm Script',
                  body: report.content || report.section1_content || report.morningFlow,
                  fallback: 'Structured approach to daily activity, rest, and metabolic windows.'
               },
               {
                  title: 'Recommended Routine Steps',
                  body: Array.isArray(report.routine_steps) ? report.routine_steps.join('\n\n') : (report.section2_content || report.integrationNote),
                  fallback: 'Consistency within the daily rhythm is the primary anchor for recovery.'
               }
            ]}
         />
      )
   }

   if (normalizedType === 'Treatment Plan Report') {
      return (
         <Article
            themeClass="treatment-report"
            kicker="Therapeutic Strategy"
            title={reportType || 'Treatment Plan Report'}
            kpis={report.kpis}
            pain_points={report.pain_points}
            intro="Calming aggravation and restoring digestive steadiness through targeted intervention."
            chapters={[
               {
                  title: 'Therapeutic Strategy',
                  body: report.content || report.section1_content || report.treatmentNarrative,
                  fallback: 'Protocol designed to pacify acute symptoms while addressing root metabolic agni.'
               },
               {
                  title: 'Specific Remedial Protocol',
                  body: Array.isArray(report.remedies) ? report.remedies.map(r => `â€¢ ${r}`).join('\n\n') : (report.section2_content || report.cautions),
                  fallback: 'Rationalized approach to diet, supports, and physical therapies.'
               }
            ]}
         />
      )
   }

   if (normalizedType === 'Risk Report') {
      return (
         <Article
            themeClass="risk-report"
            kicker="Clinical Prognosis"
            title={reportType || 'Risk & Health Score Report'}
            kpis={report.kpis}
            pain_points={report.pain_points}
            intro="Clinical assessment of potential progression and recovery benchmarks."
            chapters={[
               {
                  title: 'Clinical Forecast',
                  body: report.content || report.section1_content || report.currentAssessment,
                  fallback: 'The present trajectory suggests an evolving picture rather than a static state.'
               },
               {
                  title: 'Clinical Red Flags',
                  body: Array.isArray(report.red_flags) ? "WATCH FOR:\n" + report.red_flags.join('\n') : (report.prognosis || report.section2_content),
                  fallback: 'Progression depends on consistent adherence to the prioritized protocol.'
               }
            ]}
         />
      )
   }

   return (
      <Article
         themeClass="comprehensive-report"
         kicker="Final Synthesis"
         title={reportType || 'Comprehensive Integrated Report'}
         kpis={report.kpis}
         pain_points={report.pain_points}
         intro="An integrated synthesis of metabolic patterns, routine, and systemic resilience."
         chapters={[
            {
               title: 'Integrated Synthesis',
               body: report.section1_content || report.synthesis || report.mindBodyLink,
               fallback: 'Connecting physical symptoms with systemic metabolic and emotional drivers.'
            },
            {
               title: 'Holistic guidance and clinical protocol',
               body: report.section2_content || report.finalClarity || report.holisticSummary,
               fallback: 'A unified clinical path forward to restore systemic homeostasis.'
            }
         ]}
      />
   )
}

export default ReportRenderer
