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

   const MultiParagraphText = ({ value, fallback, subtle = false, leadFirst = false }) => {
      const finalValue = typeof value === 'string' && value.trim() ? value : fallback
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
            {kpis.map((kpi, idx) => (
               <div key={`${kpi.label}-${idx}`} className="report-metric-item">
                  <span className="metric-label">{kpi.label}</span>
                  <span className="metric-value">{kpi.value}</span>
               </div>
            ))}
         </div>
      )
   }

   const PainPointList = ({ points = [] }) => {
      if (!points || !points.length) return null
      return (
         <div className="report-pain-points">
            <h5>KEY CLINICAL FINDINGS</h5>
            <ul>
               {points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
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
                     <MultiParagraphText value={chapter.body} fallback={chapter.fallback} leadFirst={index === 0} />
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

   if (normalizedType === 'Diagnosis Report') {
      return (
         <div className="report-narrative-card diagnosis-report">
            <div className="report-hero">
               <span className="report-kicker">Senior Ayurvedic Impression</span>
               <h2>{report.diagnosis?.name || 'Clinical Diagnosis'}</h2>
               <KPIRow kpis={report.kpis} />
               <Paragraph>{report.clinicalImpression || report.diagnosis?.reasoning || 'The case reflects a clinically meaningful Ayurvedic imbalance that deserves structured care.'}</Paragraph>
            </div>

            <Section title="Diagnostic Reasoning" icon={Target}>
               <PainPointList points={report.pain_points} />
               <TextBlock value={report.diagnosis?.reasoning} fallback="The symptom pattern, triggers, and constitutional tendency together support this leading Ayurvedic impression." />
               <ChipRow items={report.supportingFindings || report.symptomsReported || []} />
            </Section>

            <Section title="Dosha Interpretation" icon={Sparkles}>
               <div className="report-meta-grid">
                  <div className="report-stat-card">
                     <span>Dominant Pattern</span>
                     <strong>{report.doshaProfile?.dominant || 'Mixed'}</strong>
                  </div>
                  <div className="report-stat-card">
                     <span>Clinical Priority</span>
                     <strong>{report.threatLevel || 'Moderate'}</strong>
                  </div>
               </div>
               <Paragraph subtle>{report.doshaProfile?.interpretation || 'The dosha picture should be interpreted through the full symptom history rather than as an isolated score.'}</Paragraph>
            </Section>
         </div>
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
                  body: report.section1_content || report.diseaseFormation,
                  fallback: 'Imbalance formed gradually through repeated structural or metabolic disturbance.'
               },
               {
                  title: 'Holistic guidance and clinical protocol summary',
                  body: report.section2_content || report.amaEvolution || report.amaStatus,
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
                  body: report.section1_content || report.morningFlow,
                  fallback: 'Structured approach to daily activity, rest, and metabolic windows.'
               },
               {
                  title: 'Holistic guidance and clinical protocol summary',
                  body: report.section2_content || report.integrationNote,
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
                  body: report.section1_content || report.treatmentNarrative,
                  fallback: 'Protocol designed to pacify acute symptoms while addressing root metabolic agni.'
               },
               {
                  title: 'Holistic guidance and clinical protocol summary',
                  body: report.section2_content || report.cautions || report.avoidances,
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
                  body: report.section1_content || report.currentAssessment,
                  fallback: 'The present trajectory suggests an evolving picture rather than a static state.'
               },
               {
                  title: 'Holistic guidance and clinical protocol summary',
                  body: report.section2_content || report.recoveryExpectation || report.recoveryProbability,
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
